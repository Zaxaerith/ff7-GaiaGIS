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

    def layer(self,name,crs,point=False,fields=None):
        from osgeo import ogr
        layer = self.dataset.CreateLayer(name,crs,ogr.wkbPoint25D if point else ogr.wkbPolygon25D,options=["SPATIAL_INDEX=YES"])
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
