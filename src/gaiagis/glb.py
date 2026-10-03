"""Minimal glTF 2.0 binary writer, retaining original per-mesh index tables."""
import json
import math
import struct
from .cli import write_json
from .safety import output_path

def write_glb(path, world, caps, mapping):
    binary = bytearray()
    views, accessors, meshes, nodes, metadata = [], [], [], [], []

    def accessor(values, components, component_type, target, bounds=False):
        while len(binary)%4:
            binary.append(0)
        offset = len(binary)
        fmt = "f" if component_type==5126 else "I"
        flattened = [x for v in values for x in v] if components>1 else values
        binary.extend(struct.pack("<"+str(len(flattened))+fmt,*flattened))
        view = len(views)
        views.append(dict(buffer=0,byteOffset=offset,byteLength=len(binary)-offset,target=target))
        item = dict(bufferView=view,componentType=component_type,count=len(values),type="VEC3" if components==3 else "SCALAR")
        if bounds:
            item.update(min=[min(v[i] for v in values) for i in range(components)],max=[max(v[i] for v in values) for i in range(components)])
        accessors.append(item)
        return len(accessors)-1

    def add(name, geographic, triangles, extras):
        cartesian = [mapping.geographic_to_cartesian(*p) for p in geographic]
        # Gaia Z-up -> glTF Y-up, a proper rotation, with meters unchanged.
        positions = [(x,z,-y) for x,y,z in cartesian]
        normals = []
        for p in positions:
            length = math.sqrt(sum(v*v for v in p))
            normals.append(tuple(v/length for v in p))
        position = accessor(positions,3,5126,34962,True)
        normal = accessor(normals,3,5126,34962)
        indices = accessor([i for t in triangles for i in t],1,5125,34963)
        mesh_id = len(meshes)
        meshes.append(dict(name=name,primitives=[dict(attributes=dict(POSITION=position,NORMAL=normal),indices=indices,mode=4,material=0,extras=extras)]))
        nodes.append(dict(mesh=mesh_id,name=name))

    for mesh in world.base_meshes:
        add(f"WM0_{mesh.section_id}_{mesh.mesh_id}",
            [mapping.game_to_geographic(*mesh.position(i)) for i in range(len(mesh.vertices))],
            [t.indices for t in mesh.triangles],
            dict(geometry_origin="ff7",map_id=0,section_id=mesh.section_id,mesh_id=mesh.mesh_id,metadata_mesh_index=len(metadata)))
        metadata.append(dict(source_file=mesh.source_file,map_id=0,section_id=mesh.section_id,mesh_id=mesh.mesh_id,
                             vertices=[dict(raw_x=v.raw_x,raw_y=v.raw_y,raw_z=v.raw_z,padding=v.padding) for v in mesh.vertices],
                             raw_normals=[[v.raw_x,v.raw_y,v.raw_z,v.padding] for v in mesh.normals],
                             triangles=[dict(triangle_id=t.triangle_id,indices=t.indices,terrain_id=t.ff7_terrain_type,
                                             region_id=t.region,script_id=t.script,texture_id=t.texture,
                                             is_chocobo=t.is_chocobo,uv=t.uv,raw_ids=t.raw_ids,
                                             terrain_script_byte=t.terrain_script_byte) for t in mesh.triangles]))
    for cap in caps:
        add(cap.hemisphere+"_polar_ocean",cap.vertices,cap.triangles,
            dict(geometry_origin="synthetic_polar_cap",synthetic_feature=cap.hemisphere+"_polar_ocean",section_id=None,mesh_id=None,triangle_id=None))
    document = dict(asset=dict(version="2.0",generator="GaiaGIS analytic reconstruction"),scene=0,
                    scenes=[dict(nodes=list(range(len(nodes))))],nodes=nodes,meshes=meshes,
                    materials=[dict(name="Validation surface",doubleSided=True,pbrMetallicRoughness=dict(baseColorFactor=[0.32,0.57,0.66,1],metallicFactor=0,roughnessFactor=1))],
                    buffers=[dict(byteLength=len(binary))],bufferViews=views,accessors=accessors,
                    extras=dict(radius_m=mapping.config.radius_m,coordinate_transform="glTF=(GaiaX,GaiaZ,-GaiaY)",height_units="meters",metadata_file="gaia_sphere_metadata.json"))
    encoded = json.dumps(document,separators=(",",":"),allow_nan=False).encode("utf-8")
    encoded += b" "*((-len(encoded))%4)
    binary.extend(b"\0"*((-len(binary))%4))
    path = output_path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("wb") as stream:
        stream.write(struct.pack("<4sII",b"glTF",2,12+8+len(encoded)+8+len(binary)))
        stream.write(struct.pack("<I4s",len(encoded),b"JSON"))
        stream.write(encoded)
        stream.write(struct.pack("<I4s",len(binary),b"BIN\0"))
        stream.write(binary)
    write_json(path.with_name("gaia_sphere_metadata.json"),dict(
        schema_version=1,source_triangle_connectivity="original per-mesh indices, order and winding retained",
        gltf_normal_policy="radial validation shading; raw FF7 normals retained below, not transformed as physical terrain normals",
        position_precision="float32 meters; GPKG coordinates are float64; no GIS precision claim for GLB",
        game_axes="east=raw_x+mesh_offset; north=raw_z+mesh_offset; height=raw_y",
        cartesian_axes="X=R cos(lat) cos(lon); Y=R cos(lat) sin(lon); Z=R sin(lat)",
        source_meshes=metadata,
        caps=[dict(hemisphere=c.hemisphere,boundary_count=c.boundary_count,
                   vertex_lon_lat_height=c.vertices,triangles=c.triangles,ring_indices=c.ring_indices,
                   boundary_source_refs=c.boundary_source_refs) for c in caps]))
    return dict(mesh_count=len(meshes),source_vertex_records=sum(len(m.vertices) for m in world.base_meshes),
                cap_vertex_records=sum(len(c.vertices) for c in caps),source_triangles=sum(len(m.triangles) for m in world.base_meshes),
                cap_triangles=sum(len(c.triangles) for c in caps),byte_length=path.stat().st_size)
