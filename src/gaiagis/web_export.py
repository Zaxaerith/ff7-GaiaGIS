# SPDX-License-Identifier: GPL-3.0-only
"""Compact local Web transport from Stage 1 Geographic products, no FF7 parsing."""
import hashlib
import json
import math
from pathlib import Path
import sqlite3
import struct
from contextlib import closing
from .cli import write_json
from .constants import TERRAIN_NAMES,REGION_NAMES
from .safety import output_path

MAGIC = b"GAIAWEB\0"
VERSION = 1
HEADER_SIZE = 64
VERTEX = struct.Struct("<fff")
ATTRIBUTE = struct.Struct("<BBHHHBBHBBH")
NULL8,NULL16 = 255,65535

def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda:stream.read(1<<20),b""):
            digest.update(chunk)
    return digest.hexdigest()

def cartesian(point,radius):
    lon,lat,h = point
    lam,phi = math.radians(lon),math.radians(lat)
    return ((radius+h)*math.cos(phi)*math.cos(lam),
            (radius+h)*math.cos(phi)*math.sin(lam),(radius+h)*math.sin(phi))

def build_web_assets(stage1:Path,destination:Path,*,portable=False):
    stage1 = stage1.resolve()
    destination = output_path(destination)
    destination.mkdir(parents=True,exist_ok=True)
    build_path = stage1/"reconstruction"/"build_metadata.json"
    canonical_path = stage1/"geographic-transport.sqlite" if portable else stage1/"gis"/"gaia_geographic.gpkg"
    build = json.loads(build_path.read_text(encoding="utf-8"))
    radius = build["config"]["radius_m"]
    vertices,indices,attributes = [],[],[]
    keys = {}
    error = 0.0
    cap_lookup = {}
    def vertex(key,point):
        nonlocal error
        if key in keys:
            i = keys[key]
            if any(abs(a-b)>1e-8 for a,b in zip(vertices[i],point)):
                raise ValueError(f"Inconsistent Stage 1 coordinate for vertex {key}")
            return i
        keys[key] = len(vertices)
        vertices.append(tuple(point))
        rounded = VERTEX.unpack(VERTEX.pack(*point))
        error = max(error,math.dist(cartesian(point,radius),cartesian(rounded,radius)))
        return keys[key]
    # immutable + mode=ro prevents any SQLite journal or modification of GIS inputs.
    with closing(sqlite3.connect(canonical_path.as_uri()+"?mode=ro&immutable=1",uri=True)) as db:
        rows = db.execute("SELECT map_id,section_id,mesh_id,triangle_id,terrain_id,region_id,script_id,texture_id,is_chocobo,source_vertex_indices,geographic_corners_json FROM gaia_ff7_surface WHERE part_id=0 ORDER BY section_id,mesh_id,triangle_id")
        for map_id,section,mesh,triangle,terrain,region,script,texture,chocobo,source_indices,corners in rows:
            points = json.loads(corners)
            refs = json.loads(source_indices)
            indices.append(tuple(vertex(("ff7",map_id,section,mesh,i),p) for i,p in zip(refs,points,strict=True)))
            attributes.append((terrain,region,section,mesh,triangle,0,map_id,texture,script,chocobo,NULL16))
        source_count = len(indices)
        for hemisphere in ("north","south"):
            for cap_id,lon,lat,height in db.execute("SELECT cap_vertex_id,longitude_deg,latitude_deg,height_m FROM gaia_cap_vertices WHERE hemisphere=? ORDER BY cap_vertex_id",(hemisphere,)):
                key = ("cap",hemisphere,cap_id)
                index = vertex(key,(lon,lat,height))
                cap_lookup[(hemisphere,"pole" if abs(lat)==90 else (lon,lat,height))] = index
            for cap_triangle,corners in db.execute("SELECT cap_triangle_id,geographic_corners_json FROM gaia_polar_caps WHERE hemisphere=? AND part_id=0 ORDER BY cap_triangle_id",(hemisphere,)):
                points = json.loads(corners)
                triangle = []
                for lon,lat,height in points:
                    key = (hemisphere,"pole" if abs(lat)==90 else (lon,lat,height))
                    if key not in cap_lookup:
                        raise ValueError(f"Unknown Stage 1 cap vertex {key}")
                    triangle.append(cap_lookup[key])
                indices.append(tuple(triangle))
                attributes.append((NULL8,NULL8,NULL16,NULL16,NULL16,1 if hemisphere=="north" else 2,NULL8,NULL16,NULL8,NULL8,cap_triangle))
        expected = build["source_triangles"]+sum(c["triangles"] for c in build["caps"])
        if source_count!=build["source_triangles"] or len(indices)!=expected:
            raise ValueError(f"Stage 1 lineage/count mismatch: {len(indices)} != {expected}")
    vertex_offset = HEADER_SIZE
    index_offset = vertex_offset+len(vertices)*VERTEX.size
    attribute_offset = index_offset+len(indices)*12
    total = attribute_offset+len(indices)*ATTRIBUTE.size
    header = struct.pack("<8sHH13I",MAGIC,VERSION,HEADER_SIZE,1,len(vertices),len(indices),
                         vertex_offset,index_offset,attribute_offset,ATTRIBUTE.size,total,source_count,len(indices)-source_count,0,0,0)
    target = output_path(destination/"gaia-mesh.bin")
    with target.open("wb") as stream:
        stream.write(header)
        for point in vertices:
            stream.write(VERTEX.pack(*point))
        for triangle in indices:
            stream.write(struct.pack("<III",*triangle))
        for row in attributes:
            stream.write(ATTRIBUTE.pack(*row))
    if target.stat().st_size!=total or error>2:
        raise ValueError("Transport size or visualization precision invariant failed")
    metadata = dict(format="Gaia Web transport",version=VERSION,endianness="little",binary="gaia-mesh.bin",
                    sha256=sha256(target),byte_length=total,vertex_count=len(vertices),triangle_count=len(indices),
                    ff7_triangle_count=source_count,synthetic_triangle_count=len(indices)-source_count,
                    physical_reference_radius_m=radius,web_reference_radius=1,
                    mercator_max_latitude_deg=build["config"]["mercator_max_latitude_deg"],phi_max_deg=build["phi_max_deg"],
                    precision="Float32 visualization product; Stage 1 Float64 Geographic is authoritative",
                    maximum_cartesian_quantization_error_m=error,
                    origin_codes={"0":"ff7","1":"north_polar_ocean","2":"south_polar_ocean"},
                    null_sentinels={"uint8":NULL8,"uint16":NULL16},terrain_names=TERRAIN_NAMES,region_names=REGION_NAMES,
                    stage1=dict(build_metadata_sha256=sha256(build_path),**({'geographic_transport_sha256':sha256(canonical_path),'transport_backend':'stdlib Float64 SQLite; not GeoPackage'} if portable else {'geographic_gpkg_sha256':sha256(canonical_path)}),
                                source_wm0_sha256=next(r["sha256"] for r in build["source_fingerprint"]["before"]["files"] if r["filename"]=="wm0.map")),
                    offsets=dict(header=0,vertices=vertex_offset,indices=index_offset,attributes=attribute_offset),
                    distribution="LOCAL ONLY — derived game geometry, redistribution requires separate review",
                    note="Unused source vertex records are omitted; per-mesh topology and every triangle identity preserved. Pole longitude is undefined and chosen per display sector, not a new GIS coordinate.")
    write_json(destination/"gaia-meta.json",metadata)
    return metadata
