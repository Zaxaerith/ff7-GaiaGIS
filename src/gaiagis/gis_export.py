"""GDAL vector exports; custom spherical Gaia CRS, never terrestrial EPSG IDs."""
import json
import math
from pathlib import Path
from .reconstruction import split_antimeridian, clip_axis, clip_horizon
from .safety import output_path

FIELDS = {
    "source_file": "text", "map_id": "int", "section_id": "int", "mesh_id": "int",
    "triangle_id": "int", "terrain_id": "int", "region_id": "int", "script_id": "int",
    "texture_id": "int", "is_chocobo": "int", "geometry_origin": "text",
    "part_id": "int", "synthetic_feature": "text", "synthetic_surface_class": "text",
    "cap_triangle_id": "int", "cap_ring_index": "int", "hemisphere": "text",
    "raw_ids": "int", "terrain_script_byte": "int", "uv_json": "text",
    "source_vertex_indices": "text", "geographic_corners_json": "text",
    "raw_game_corners_json": "text"
}

def source_attributes(mesh, triangle, raw, geographic):
    return dict(**mesh.lineage(triangle),terrain_id=triangle.ff7_terrain_type,region_id=triangle.region,
                script_id=triangle.script,texture_id=triangle.texture,is_chocobo=int(triangle.is_chocobo),
                geometry_origin="ff7",raw_ids=triangle.raw_ids,terrain_script_byte=triangle.terrain_script_byte,
                uv_json=json.dumps(triangle.uv),source_vertex_indices=json.dumps(triangle.indices),
                geographic_corners_json=json.dumps(geographic),raw_game_corners_json=json.dumps(raw))

def geographic_features(world, caps, mapping):
    for mesh in world.base_meshes:
        for triangle in mesh.triangles:
            raw = [mesh.position(i) for i in triangle.indices]
            geo = [mapping.game_to_geographic(*p) for p in raw]
            attributes = source_attributes(mesh,triangle,raw,geo)
            parts = split_antimeridian(geo)
            if not parts:
                raise ValueError(f"Source triangle disappeared: {mesh.lineage(triangle)}")
            for part_id,part in enumerate(parts):
                yield part,dict(attributes,part_id=part_id)
    for cap in caps:
        for index,triangle in enumerate(cap.triangles):
            geo = cap.polygon(triangle)
            attributes = dict(geometry_origin="synthetic_polar_cap",synthetic_feature=cap.hemisphere+"_polar_ocean",
                              synthetic_surface_class="ocean",hemisphere=cap.hemisphere,cap_triangle_id=index,
                              cap_ring_index=min(cap.ring_indices[i] for i in triangle),geographic_corners_json=json.dumps(geo))
            for part_id,part in enumerate(split_antimeridian(geo)):
                yield part,dict(attributes,part_id=part_id)

def make_crs(config, directory):
    from osgeo import osr
    osr.UseExceptions()
    directory = output_path(directory)
    directory.mkdir(parents=True,exist_ok=True)
    geographic = osr.SpatialReference()
    geographic.SetGeogCS("Gaia Geographic", "Gaia reconstructed datum", "Gaia assumed mean sphere",
                        config.radius_m,0,"Gaia cartographic origin",0,"degree",math.pi/180)
    geographic.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    raw = osr.SpatialReference()
    raw.SetLocalCS("GaiaGame raw FF7 coordinate space")
    raw.SetLinearUnits("raw game unit",1)
    raw.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    definitions = {
        "equirectangular": "+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0",
        "mercator": "+proj=merc +lat_ts=0 +lon_0=0",
        "mollweide": "+proj=moll +lon_0=0",
        "orthographic": f"+proj=ortho +lon_0={config.orthographic_longitude_deg} +lat_0={config.orthographic_latitude_deg}"
    }
    crs = {"geographic":geographic,"raw":raw}
    for name,definition in definitions.items():
        projected = osr.SpatialReference()
        projected.ImportFromProj4(f"{definition} +R={config.radius_m:.15g} +units=m +no_defs +type=crs")
        projected.CopyGeogCSFrom(geographic)
        projected.SetProjCS("Gaia "+name.title())
        projected.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        crs[name] = projected
    for name,srs in crs.items():
        (directory/f"gaia_{name}.wkt").write_text(srs.ExportToWkt(["FORMAT=WKT2_2019"])+"\n",encoding="utf-8")
        (directory/f"gaia_{name}.proj").write_text(srs.ExportToProj4()+"\n" if name!="raw" else "# Local engineering CRS; raw units are not meters.\n",encoding="utf-8")
    return crs

def polygon_geometry(points):
    from osgeo import ogr
    ring = ogr.Geometry(ogr.wkbLinearRing)
    for x,y,z in [*points,points[0]]:
        if not all(math.isfinite(v) for v in (x,y,z)):
            raise ValueError("Non-finite GIS coordinate")
        ring.AddPoint(x,y,z)
    polygon = ogr.Geometry(ogr.wkbPolygon25D)
    polygon.AddGeometry(ring)
    return polygon

class Package:
    def __init__(self,path):
        from osgeo import ogr
        ogr.UseExceptions()
        self.path = output_path(path)
        self.path.parent.mkdir(parents=True,exist_ok=True)
        # Replacement limited to this named generated artifact inside workspace.
        if self.path.exists():
            self.path.unlink()
        self.dataset = ogr.GetDriverByName("GPKG").CreateDataSource(str(self.path),options=["VERSION=1.4","CRS_WKT_EXTENSION=YES"])
        if self.dataset is None:
            raise RuntimeError(f"Cannot create {self.path}")
        self.dataset.StartTransaction()
        self.counts = {}

    def layer(self,name,crs,point=False,fields=None,geometry_type=None):
        from osgeo import ogr
        layer = self.dataset.CreateLayer(name,crs,(geometry_type if geometry_type is not None else ogr.wkbPoint25D if point else ogr.wkbPolygon25D),options=["SPATIAL_INDEX=YES"])
        if layer is None:
            raise RuntimeError(f"Cannot create layer {name}")
        for key,kind in (fields or FIELDS).items():
            types = {"int":ogr.OFTInteger,"real":ogr.OFTReal,"text":ogr.OFTString}
            if layer.CreateField(ogr.FieldDefn(key,types[kind]))!=0:
                raise RuntimeError(f"Cannot create field {key}")
        self.counts[name] = 0
        return layer

    def add(self,layer,points,attributes,point=False):
        from osgeo import ogr
        feature = ogr.Feature(layer.GetLayerDefn())
        for key,value in attributes.items():
            if value is not None:
                feature.SetField(key,value)
        if point:
            geometry = ogr.Geometry(ogr.wkbPoint25D)
            geometry.AddPoint(*points)
        else:
            geometry = polygon_geometry(points)
        feature.SetGeometry(geometry)
        if layer.CreateFeature(feature)!=0:
            raise RuntimeError(f"Cannot write feature to {layer.GetName()}")
        self.counts[layer.GetName()] += 1

    def close(self):
        self.dataset.CommitTransaction()
        self.dataset = None
        return dict(self.counts)

def export_packages(output,world,caps,mapping,crs,progress=print):
    from osgeo import osr
    output = output_path(output)
    raw_package = Package(output/"gis"/"gaia_raw.gpkg")
    raw_layer = raw_package.layer("gaia_raw_triangles",crs["raw"])
    for mesh in world.base_meshes:
        for triangle in mesh.triangles:
            raw = [mesh.position(i) for i in triangle.indices]
            geo = [mapping.game_to_geographic(*p) for p in raw]
            raw_package.add(raw_layer,raw,dict(source_attributes(mesh,triangle,raw,geo),part_id=0))
    counts = {"raw":raw_package.close()}
    raw_layer = None
    progress("Raw GeoPackage written; exporting geographic surfaces")
    package = Package(output/"gis"/"gaia_geographic.gpkg")
    combined = package.layer("gaia_surface",crs["geographic"])
    ff7 = package.layer("gaia_ff7_surface",crs["geographic"])
    polar = package.layer("gaia_polar_caps",crs["geographic"])
    features = list(geographic_features(world,caps,mapping))
    for points,attributes in features:
        package.add(combined,points,attributes)
        package.add(ff7 if attributes["geometry_origin"]=="ff7" else polar,points,attributes)
    vertices = package.layer("gaia_cap_vertices",crs["geographic"],True,dict(
        cap_vertex_id="int",hemisphere="text",cap_ring_index="int",geometry_origin="text",
        source_boundary_refs_json="text",longitude_latitude_height_json="text",
        longitude_deg="real",latitude_deg="real",height_m="real"))
    for cap in caps:
        for i,point in enumerate(cap.vertices):
            package.add(vertices,point,dict(cap_vertex_id=i,hemisphere=cap.hemisphere,cap_ring_index=cap.ring_indices[i],
                        longitude_deg=point[0],latitude_deg=point[1],height_m=point[2],
                        geometry_origin="ff7_boundary_sample" if i<cap.boundary_count else "synthetic_polar_cap",
                        source_boundary_refs_json=json.dumps(cap.boundary_source_refs[i]) if i<cap.boundary_count else "null",
                        longitude_latitude_height_json=json.dumps(point)),True)
    counts["geographic"] = package.close()
    combined=ff7=polar=vertices=None
    projections = Package(output/"gis"/"gaia_projections.gpkg")
    projection_report = {}
    for name in ("equirectangular","mercator","mollweide","orthographic"):
        progress(f"Projecting {name}")
        transform = osr.CoordinateTransformation(crs["geographic"],crs[name])
        layer = projections.layer("gaia_"+name,crs[name])
        clipped,omitted = 0,0
        for points,attributes in features:
            working = points
            if name=="mercator":
                limit = mapping.config.mercator_max_latitude_deg
                working = clip_axis(clip_axis(points,1,-limit,True),1,limit,False)
            elif name=="orthographic":
                working = clip_horizon(points,mapping.config.orthographic_longitude_deg,mapping.config.orthographic_latitude_deg)
            if len(working)<3:
                omitted += 1
                continue
            if working!=points:
                clipped += 1
            projected = [transform.TransformPoint(*p) for p in working]
            projections.add(layer,projected,attributes)
        projection_report[name] = dict(exported_features=projections.counts[layer.GetName()],clipped_features=clipped,omitted_features=omitted,
                                        all_coordinates_finite=True,
                                        policy=(f"Clip to +/-{mapping.config.mercator_max_latitude_deg} degrees" if name=="mercator" else
                                                "Clip to front hemisphere; horizon intersections by bisection" if name=="orthographic" else "Full geographic surface"))
    counts["projections"] = projections.close()
    layer = None
    return dict(layer_counts=counts,projection_report=projection_report,
                antimeridian=dict(algorithm="Unwrap short edges then clip at +/-180 with interpolated height; lineage and part_id retained",
                                  split_source_triangles=len([1 for _,a in features if a["geometry_origin"]=="ff7" and a["part_id"]>0]),
                                  maximum_exported_longitude_span=max(max(p[0] for p in ps)-min(p[0] for p in ps) for ps,_ in features)))


# Personal mapping exchange shares this GDAL owner; never exports game packs.
USER_TABLES = {'Point': 'user_points', 'Polyline': 'user_lines', 'Polygon': 'user_polygons'}
USER_FIELDS = {'feature_order':'int','id':'text','layer_id':'text','name':'text','note':'text','tags_json':'text',
               'color':'text','point_size':'real','fill_opacity':'real','created_at':'real','updated_at':'real'}


def validate_user_mapping(value):
    """Bounded GaiaJSON v1 metadata/geometry; browser also checks spherical polygon semantics."""
    import re
    from osgeo import ogr
    def shape(v, keys):
        if not isinstance(v,dict) or set(v)!=set(keys): raise ValueError('Unexpected/missing GaiaJSON fields')
    def number(v, lo, hi):
        if type(v) not in (int,float) or not math.isfinite(v) or not lo<=v<=hi: raise ValueError('Invalid finite number')
    def text(v, limit, required=False):
        if not isinstance(v,str) or len(v.encode('utf-16-le'))//2>limit or required and not v or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]',v): raise ValueError('Invalid text')
    def identity(v):
        if not isinstance(v,str) or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_:.-]{0,159}',v): raise ValueError('Invalid stable ID')
    shape(value,['schema','version','coordinateSpace','mapId','layers','features'])
    if value['schema']!='gaiagis-user-features' or type(value['version']) is not int or value['version']!=1 or value['coordinateSpace']!='GaiaGame' or value['mapId']!='wm0': raise ValueError('Requires GaiaJSON v1 / WM0 / GaiaGame, not GeoJSON or WGS84')
    layers,features=value['layers'],value['features']
    if not isinstance(layers,list) or len(layers)>32 or not isinstance(features,list) or len(features)>500: raise ValueError('Layer/feature limit')
    ids=set();orders=set()
    for layer in layers:
        shape(layer,['id','name','visible','opacity','order']);identity(layer['id']);text(layer['name'],120,True)
        number(layer['opacity'],0,1);number(layer['order'],0,31)
        if type(layer['visible']) is not bool or type(layer['order']) is not int or layer['id'] in ids or layer['order'] in orders: raise ValueError('Invalid/duplicate layer identity or order')
        ids.add(layer['id']);orders.add(layer['order'])
    seen=set();total=0
    for f in features:
        shape(f,['id','layerId','geometryType','geometry','name','note','tags','style','createdAt','updatedAt'])
        identity(f['id'])
        if f['id'] in seen or f['layerId'] not in ids or f['geometryType'] not in USER_TABLES: raise ValueError('Invalid/duplicate feature identity or layer')
        seen.add(f['id']);text(f['name'],120,True);text(f['note'],1000)
        if not isinstance(f['tags'],list) or len(f['tags'])>8: raise ValueError('Invalid tags')
        for tag in f['tags']: text(tag,32,True)
        if len(set(f['tags']))!=len(f['tags']): raise ValueError('Duplicate tags')
        style=f['style'];shape(style,['color','pointSize','fillOpacity'])
        if not isinstance(style['color'],str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',style['color']): raise ValueError('Invalid color')
        number(style['pointSize'],3,18);number(style['fillOpacity'],0,.6)
        number(f['createdAt'],0,8.64e15);number(f['updatedAt'],f['createdAt'],8.64e15)
        g=f['geometry'];shape(g,['mapId','coordinateSpace','vertices'])
        if g['mapId']!='wm0' or g['coordinateSpace']!='GaiaGame': raise ValueError('Unknown geometry domain')
        vertices=g['vertices'];kind=f['geometryType'];minimum={'Point':1,'Polyline':2,'Polygon':3}[kind]
        if not isinstance(vertices,list) or not minimum<=len(vertices)<=512 or kind=='Point' and len(vertices)!=1: raise ValueError('Invalid vertex count')
        total+=len(vertices)
        for v in vertices:
            shape(v,['game_east','game_north']);number(v['game_east'],0,294912);number(v['game_north'],0,229376)
            if v['game_east']==294912: raise ValueError('East outside periodic domain')
        if kind=='Polygon':
            # Validate spherical simple rings in the same gnomonic plane as the
            # browser, without altering the exported raw coordinates at the seam.
            from .reconstruction import Mapping,SphereConfig
            config=SphereConfig();mapping=Mapping(294912,229376,config)
            def dot(a,b): return sum(x*y for x,y in zip(a,b))
            def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
            def normalize(a):
                length=math.sqrt(dot(a,a))
                if length<1e-14: raise ValueError('Ambiguous polygon hemisphere')
                return [x/length for x in a]
            vectors=[normalize(mapping.geographic_to_cartesian(*mapping.game_to_geographic(v['game_east'],229376-v['game_north'],0))) for v in vertices]
            center=normalize([sum(v[i] for v in vectors) for i in range(3)])
            east=normalize(cross([0,0,1] if abs(center[2])<.9 else [0,1,0],center));north=cross(center,east);points=[]
            for i,v in enumerate(vectors):
                if any(math.atan2(math.sqrt(dot(cross(v,b),cross(v,b))),dot(v,b))<1e-10 for b in vectors[:i]): raise ValueError('Repeated polygon vertex')
                d=dot(v,center)
                if d<=1e-6: raise ValueError('Polygon must fit an open hemisphere')
                points.append([dot(v,east)/d,dot(v,north)/d])
            polygon=ogr.CreateGeometryFromJson(json.dumps({'type':'Polygon','coordinates':[[*points,points[0]]]}))
            if not polygon.IsValid() or polygon.GetArea()==0: raise ValueError('Malformed simple polygon (holes/multipart not supported)')
    if total>20000: raise ValueError('Total vertex limit')
    if len(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode('utf-8'))>4*1024*1024: raise ValueError('GaiaJSON exceeds 4 MiB')
    return value


def _user_crs():
    from osgeo import osr
    srs=osr.SpatialReference();srs.SetLocalCS('GaiaGame WM0 user mapping')
    srs.SetLinearUnits('raw game unit',1);srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return srs


def _user_row(layer, attributes, geometry=None):
    from osgeo import ogr
    row=ogr.Feature(layer.GetLayerDefn())
    for key,value in attributes.items(): row.SetField(key,value)
    if geometry is not None: row.SetGeometry(geometry)
    if layer.CreateFeature(row)!=0: raise ValueError('Cannot write user mapping row')


def export_user_geopackage(source, destination):
    """Explicit user-authored GaiaJSON -> GPKG, no coordinate transform or game input."""
    from osgeo import ogr
    from .safety import protect_input
    source=Path(source).resolve();protect_input(source)
    if source.stat().st_size>4*1024*1024: raise ValueError('GaiaJSON exceeds 4 MiB')
    value=validate_user_mapping(json.loads(source.read_text(encoding='utf-8')))
    target=output_path(Path(destination));target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists(): raise ValueError('Output exists; choose a new filename')
    temporary=target.with_name(target.name+'.partial.gpkg')
    if temporary.exists(): raise ValueError('Partial output exists; choose a new filename')
    package=None
    try:
        package=Package(temporary);srs=_user_crs()
        metadata=package.layer('gaia_exchange',None,fields={'schema':'text','version':'int','map_id':'text','coordinate_space':'text'},geometry_type=ogr.wkbNone)
        _user_row(metadata,dict(schema='gaiagis-user-gpkg',version=1,map_id='wm0',coordinate_space='GaiaGame'))
        layers=package.layer('user_layers',None,fields={'id':'text','name':'text','visible':'int','opacity':'real','order_index':'int'},geometry_type=ogr.wkbNone)
        for l in value['layers']: _user_row(layers,dict(id=l['id'],name=l['name'],visible=int(l['visible']),opacity=l['opacity'],order_index=l['order']))
        kinds={'Point':ogr.wkbPoint,'Polyline':ogr.wkbLineString,'Polygon':ogr.wkbPolygon}
        for kind,table in USER_TABLES.items():
            layer=package.layer(table,srs,fields=USER_FIELDS,geometry_type=kinds[kind])
            for feature_order,f in enumerate(value['features']):
                if f['geometryType']!=kind: continue
                points=[[v['game_east'],v['game_north']] for v in f['geometry']['vertices']]
                coordinates=points[0] if kind=='Point' else [[*points,points[0]]] if kind=='Polygon' else points
                geometry=ogr.CreateGeometryFromJson(json.dumps(dict(type='LineString' if kind=='Polyline' else kind,coordinates=coordinates)))
                _user_row(layer,dict(feature_order=feature_order,id=f['id'],layer_id=f['layerId'],name=f['name'],note=f['note'],tags_json=json.dumps(f['tags'],ensure_ascii=False),color=f['style']['color'],point_size=f['style']['pointSize'],fill_opacity=f['style']['fillOpacity'],created_at=f['createdAt'],updated_at=f['updatedAt']),geometry)
        package.close();package=None;temporary.replace(target)
    finally:
        if package is not None: package.dataset=None
        if temporary.exists(): temporary.unlink()
    return dict(layers=len(value['layers']),features=len(value['features']),coordinate_space='GaiaGame',bytes=target.stat().st_size)


def import_user_geopackage(source, destination):
    """Read only our versioned raw-coordinate package; reject CRS reassignment/reprojection."""
    from osgeo import gdal,ogr
    from .safety import protect_input
    source=Path(source).resolve();protect_input(source)
    with source.open('rb') as stream: header=stream.read(16)
    if source.stat().st_size>64*1024*1024 or header!=b'SQLite format 3\0': raise ValueError('Requires bounded GeoPackage')
    dataset=gdal.OpenEx(str(source),gdal.OF_VECTOR|gdal.OF_READONLY,allowed_drivers=['GPKG'])
    if dataset is None: raise ValueError('Cannot open user GeoPackage')
    try:
        if {dataset.GetLayer(i).GetName() for i in range(dataset.GetLayerCount())}!=set(USER_TABLES.values())|{'user_layers','gaia_exchange'}: raise ValueError('Unsupported tables; requires GaiaGIS user mapping package')
        metadata=dataset.GetLayerByName('gaia_exchange')
        for table,columns in [('gaia_exchange',{'schema','version','map_id','coordinate_space'}),('user_layers',{'id','name','visible','opacity','order_index'})]:
            definition=dataset.GetLayerByName(table).GetLayerDefn()
            if definition.GetGeomType()!=ogr.wkbNone or {definition.GetFieldDefn(i).GetName() for i in range(definition.GetFieldCount())}!=columns: raise ValueError('Unsupported metadata table fields/geometry')
        if metadata.GetFeatureCount()!=1: raise ValueError('Invalid exchange metadata')
        m=metadata.GetNextFeature()
        if m.GetField('schema')!='gaiagis-user-gpkg' or m.GetField('version')!=1 or m.GetField('coordinate_space')!='GaiaGame' or m.GetField('map_id')!='wm0': raise ValueError('Unsupported exchange schema/domain')
        layers=dataset.GetLayerByName('user_layers')
        if layers.GetFeatureCount()>32: raise ValueError('Layer limit')
        values=[]
        for l in layers:
            visible=l.GetField('visible')
            if visible not in (0,1): raise ValueError('Invalid layer visibility')
            values.append(dict(id=l.GetField('id'),name=l.GetField('name'),visible=bool(visible),opacity=l.GetField('opacity'),order=l.GetField('order_index')))
        features=[];feature_orders=[];srs=_user_crs();total=0
        for kind,table in USER_TABLES.items():
            layer=dataset.GetLayerByName(table)
            if not layer.GetSpatialRef() or not layer.GetSpatialRef().IsSame(srs): raise ValueError('CRS changed; requires original GaiaGame raw coordinates')
            definition=layer.GetLayerDefn()
            if {definition.GetFieldDefn(i).GetName() for i in range(definition.GetFieldCount())}!=set(USER_FIELDS): raise ValueError('Unsupported/missing feature attributes')
            if len(features)+layer.GetFeatureCount()>500: raise ValueError('Feature limit')
            for f in layer:
                geometry=f.GetGeometryRef();expected={'Point':ogr.wkbPoint,'Polyline':ogr.wkbLineString,'Polygon':ogr.wkbPolygon}[kind]
                if geometry is None or geometry.IsEmpty() or geometry.GetGeometryType()!=expected: raise ValueError('Requires nonempty simple 2D geometry, no multipart/Z/M')
                if kind=='Polygon':
                    if geometry.GetGeometryCount()!=1: raise ValueError('Polygon holes unsupported')
                    ring=geometry.GetGeometryRef(0);count=ring.GetPointCount()
                    if count>513 or count<4 or ring.GetPoint(0)!=ring.GetPoint(count-1): raise ValueError('Invalid polygon closure/limit')
                    points=[ring.GetPoint(i)[:2] for i in range(count-1)]
                else:
                    if geometry.GetPointCount()>512: raise ValueError('Vertex limit')
                    points=[geometry.GetPoint(i)[:2] for i in range(geometry.GetPointCount())]
                order=f.GetField('feature_order')
                if order is not None and (type(order) is not int or not 0<=order<500 or order in feature_orders): raise ValueError('Invalid/duplicate feature order')
                feature_orders.append(order)
                total+=len(points)
                if total>20000: raise ValueError('Total vertex limit')
                features.append(dict(id=f.GetField('id'),layerId=f.GetField('layer_id'),geometryType=kind,geometry=dict(mapId='wm0',coordinateSpace='GaiaGame',vertices=[dict(game_east=x,game_north=y) for x,y in points]),name=f.GetField('name'),note=f.GetField('note') if f.GetField('note') is not None else '',tags=json.loads(f.GetField('tags_json')) if f.GetField('tags_json') is not None else [],style=dict(color=f.GetField('color'),pointSize=f.GetField('point_size'),fillOpacity=f.GetField('fill_opacity')),createdAt=f.GetField('created_at'),updatedAt=f.GetField('updated_at')))
    finally:
        dataset.Close()
    dataset=None
    features=[f for _,f in sorted(zip([o if o is not None else 500+i for i,o in enumerate(feature_orders)],features),key=lambda row:row[0])]
    value=validate_user_mapping(dict(schema='gaiagis-user-features',version=1,mapId='wm0',coordinateSpace='GaiaGame',layers=values,features=features))
    target=output_path(Path(destination));target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists(): raise ValueError('Output exists; choose a new filename')
    temporary=target.with_name(target.name+'.partial')
    if temporary.exists(): raise ValueError('Partial output exists; choose a new filename')
    try:
        temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temporary.replace(target)
    finally:
        if temporary.exists(): temporary.unlink()
    return dict(layers=len(values),features=len(features),vertices=total,coordinate_space='GaiaGame')


def user_exchange_main(argv=None):
    import argparse
    parser=argparse.ArgumentParser(description='Local user GaiaJSON / GeoPackage exchange (GDAL required)')
    parser.add_argument('direction',choices=['to-gpkg','from-gpkg']);parser.add_argument('--input',required=True,type=Path);parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args(argv)
    try:
        result=(export_user_geopackage if args.direction=='to-gpkg' else import_user_geopackage)(args.input,args.output)
        print(json.dumps(result));return 0
    except ImportError:
        parser.exit(1,'User mapping exchange requires a GDAL-enabled Python (for example the installed QGIS Python).\n')
    except (ValueError,OSError,RuntimeError,TypeError,KeyError) as e:
        parser.exit(1,f'User mapping exchange rejected: {e}\n')
