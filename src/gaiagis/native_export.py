# SPDX-License-Identifier: GPL-3.0-only
"""Deterministic deindexed native MAP transport. No GIS mapping or caps."""
import hashlib
import json
from pathlib import Path
import struct
from .constants import LAYOUTS, TERRAIN_NAMES, REGION_NAMES
from .map_spaces import MapId, native_space

MAGIC = b'GAIAMAP\0'
RECORD = struct.Struct('<9i9h4H4B6B')


def encode_native(world):
    identity = MapId(f'WM{world.map_id}')
    if identity == MapId.WM0:
        raise ValueError('WM0 uses frozen V1 transport')
    if world.failures or world.unknown_sections or world.section_count != LAYOUTS[world.map_id][0] * LAYOUTS[world.map_id][1]:
        raise ValueError('Native map incomplete or unsupported sections')
    records = bytearray()
    for mesh in world.base_meshes:
        for t in mesh.triangles:
            positions = [n for i in t.indices for n in mesh.position(i)]  # X,Z,raw height
            normals = [n for i in t.indices for n in (mesh.normals[i].raw_x, mesh.normals[i].raw_y, mesh.normals[i].raw_z)]
            records.extend(RECORD.pack(*positions, *normals, mesh.section_id, mesh.mesh_id,
                                       t.triangle_id, t.texture, t.ff7_terrain_type, t.region,
                                       t.script, int(t.is_chocobo) | t.unknown_bit14 << 1,
                                       *[n for pair in t.uv for n in pair]))
    header = dict(schema='gaiagis-native-map', version=1, mapId=identity.value,
                  coordinate_space=native_space(identity), global_mapping=None,
                  axis_order=['native_x', 'native_z', 'raw_height'], height_unit='raw_source_units',
                  section_grid=list(LAYOUTS[world.map_id]), section_count=world.section_count,
                  triangle_count=len(records)//RECORD.size, record_bytes=RECORD.size,
                  extent=list(world.extent), source_sha256=hashlib.sha256(world.path.read_bytes()).hexdigest(),
                  payload_sha256=hashlib.sha256(records).hexdigest(), terrain_names=TERRAIN_NAMES, region_names=REGION_NAMES)
    encoded=json.dumps(header, sort_keys=True, separators=(',', ':')).encode('ascii')
    body=MAGIC+struct.pack('<2I',1,len(encoded))+encoded+records
    return body+hashlib.sha256(body).digest(), header


def export_native(world, output):
    root=Path(__file__).resolve().parents[2]
    output=Path(output).resolve()
    if not output.is_relative_to(root):
        raise ValueError('Output must remain in workspace')
    binary,header=encode_native(world)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_bytes(binary)
    meta=dict(header,sha256=hashlib.sha256(binary).hexdigest(),bytes=len(binary))
    output.with_suffix('.json').write_text(json.dumps(meta,sort_keys=True,indent=2),encoding='utf8')
    return meta
