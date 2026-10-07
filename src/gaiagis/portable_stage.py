"""Stdlib-only private Float64 transport staging; NOT a GIS/GeoPackage exporter.

Uses the frozen V1 Mapping, cap builder and lineage attributes. No CRS/math changes.
The compiled Viewer consumes exactly the same original (unclipped) geographic
corners as the GDAL Stage 1 route. This private SQLite staging is never shipped.
"""
# SPDX-License-Identifier: GPL-3.0-only
from dataclasses import asdict
import json
from pathlib import Path
import sqlite3
from .safety import WORKSPACE_ROOT, output_path
from .dataset import discover, fingerprint
from .map_reader import parse_map
from .reconstruction import Mapping, read_config
from .caps import build_caps
from .gis_export import source_attributes

def build_portable_stage(source, cache):
    cache=output_path(Path(cache));cache.mkdir(parents=True,exist_ok=True)
    ds=discover(Path(source));config=read_config(WORKSPACE_ROOT/'config/default.toml')
    world=parse_map(ds.files['wm0.map'],0)
    if world.failures or world.unknown_sections:raise ValueError('Incomplete WM0 source')
    mapping=Mapping(*world.extent,config);caps=build_caps(world,mapping)
    path=output_path(cache/'geographic-transport.sqlite')
    if path.exists():path.unlink()
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE gaia_ff7_surface (map_id,section_id,mesh_id,triangle_id,terrain_id,region_id,script_id,texture_id,is_chocobo,source_vertex_indices,geographic_corners_json,part_id)')
        for mesh in world.base_meshes:
            records=[]
            for triangle in mesh.triangles:
                raw=[mesh.position(i) for i in triangle.indices];geo=[mapping.game_to_geographic(*p) for p in raw]
                a=source_attributes(mesh,triangle,raw,geo)
                records.append(tuple(a[k] for k in ('map_id','section_id','mesh_id','triangle_id','terrain_id','region_id','script_id','texture_id','is_chocobo','source_vertex_indices','geographic_corners_json'))+(0,))
            db.executemany('INSERT INTO gaia_ff7_surface VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',records)
        db.execute('CREATE TABLE gaia_cap_vertices (cap_vertex_id,longitude_deg,latitude_deg,height_m,hemisphere)')
        db.execute('CREATE TABLE gaia_polar_caps (cap_triangle_id,geographic_corners_json,hemisphere,part_id)')
        for cap in caps:
            db.executemany('INSERT INTO gaia_cap_vertices VALUES (?,?,?,?,?)',[(i,*p,cap.hemisphere) for i,p in enumerate(cap.vertices)])
            db.executemany('INSERT INTO gaia_polar_caps VALUES (?,?,?,?)',[(i,json.dumps(cap.polygon(t)),cap.hemisphere,0) for i,t in enumerate(cap.triangles)])
    build=dict(config=asdict(config),source_triangles=sum(len(m.triangles) for m in world.base_meshes),caps=[dict(triangles=len(c.triangles)) for c in caps],phi_max_deg=mapping.phi_max,source_fingerprint=dict(before=fingerprint(ds)),transport_backend='stdlib Float64 SQLite; not GeoPackage')
    target=output_path(cache/'reconstruction/build_metadata.json');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(build,sort_keys=True,indent=2),encoding='utf8')
    return cache
