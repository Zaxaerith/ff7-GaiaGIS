# SPDX-License-Identifier: GPL-3.0-only
"""Independent WM0 Variant Raw GeoPackage. Never replaces a V1/Native export."""
from contextlib import closing
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
import time
from .world_variants import (GROUPS, SECTIONS, analyze_payload, compact, edge_rows,
                             load_source, make_payload, safe_target, sha, signatures, source_hash)

SCHEMA = 'gaiagis-world-variant-gpkg'
GENERATOR = 'world-variant-gis-1'
LIMIT = 96_000_000  # All 30,514 source faces, analysis geometry and candidate relations.


def rows_for_world(world):
    payload = make_payload(world); faces, groups = analyze_payload(payload)
    rows = {k: [] for k in ('variant_metadata', 'source_sections', 'source_meshes', 'source_vertices',
                            'source_normals', 'source_faces', 'variant_geometry', 'variant_diagnostics',
                            'change_statistics', 'comparison_relations', 'comparison_members')}
    groups_by_section = {s: i for i, (aa, bb) in enumerate(GROUPS, 1) for s in (*aa, *bb)}
    normals, vertex_keys = {}, {}
    for m in world.meshes:
        if m.section_id not in SECTIONS:
            continue
        sid, mid = m.section_id, m.mesh_id; key = f'{sid}/{mid}'
        common = dict(section=sid, mesh=mid, mesh_key=key, group_id=groups_by_section[sid],
                      side='alternative' if sid >= 63 else 'base', base_placement=m.base_section_id)
        if mid == 0:
            rows['source_sections'].append(dict(section=sid, base_placement=m.base_section_id, group_id=common['group_id'], side=common['side']))
        rows['source_meshes'].append(dict(common, compressed_header_offset=sid*47104+m.offset,
                                           compressed_data_offset=sid*47104+m.offset+4, compressed_bytes=m.compressed_size,
                                           decoded_bytes=m.decoded_size, vertex_count=len(m.vertices), face_count=len(m.triangles)))
        for i, (v, n) in enumerate(zip(m.vertices, m.normals)):
            vid = f'{key}/{i}'; vertex_keys[sid, mid, i] = vid
            rows['source_vertices'].append(dict(common, vertex_id=vid, vertex_index=i, raw_x=v.raw_x, raw_y=v.raw_y,
                                                  raw_z=v.raw_z, padding=v.padding, decoded_offset=4+12*len(m.triangles)+8*i,
                                                  geometry=m.position(i)))
            rows['source_normals'].append(dict(common, normal_id=vid, normal_index=i, raw_x=n.raw_x, raw_y=n.raw_y,
                                                 raw_z=n.raw_z, padding=n.padding, decoded_offset=4+12*len(m.triangles)+8*len(m.vertices)+8*i,
                                                 frame='original raw XYZ'))
            normals[vid] = n
    for f in faces:
        sid, mid, tid = f['section'], f['mesh'], f['triangle']; t, ids = f['terrain_script_byte'], f['raw_ids']; m = f['metrics']
        sig = signatures(f)
        row = dict(source_face_id=f['id'], map_id='WM0', section=sid, mesh=mid, triangle=tid,
                   mesh_key=f'{sid}/{mid}', base_placement=f['placement'], group_id=groups_by_section[sid],
                   side='alternative' if sid >= 63 else 'base', index_0=f['indices'][0], index_1=f['indices'][1], index_2=f['indices'][2],
                   vertex_0=vertex_keys[sid, mid, f['indices'][0]], vertex_1=vertex_keys[sid, mid, f['indices'][1]], vertex_2=vertex_keys[sid, mid, f['indices'][2]],
                   normal_0=vertex_keys[sid, mid, f['indices'][0]], normal_1=vertex_keys[sid, mid, f['indices'][1]], normal_2=vertex_keys[sid, mid, f['indices'][2]],
                   decoded_offset=f['decoded_offset'], terrain_script_byte=t, raw_ids=ids, terrain=t & 31, script=t >> 5,
                   texture=ids & 511, region=(ids >> 9) & 31, bit14=(ids >> 14) & 1, bit15=(ids >> 15) & 1,
                   uv=compact(f['uv']), determinant=m['determinant'], area=m['area'],
                   gradient_a=None if m['a'] is None else float(m['a']), gradient_b=None if m['b'] is None else float(m['b']),
                   zero_xz=int(m['zero_xz']), degenerate_3d=int(m['degenerate_3d']),
                   geometry_signature=sha(compact(sig[0]).encode()), winding_signature=sha(compact(sig[1]).encode()),
                   attribute_signature=sha(compact(sig[2]).encode()), uv_signature=sha(compact(sig[3]).encode()), normal_signature=sha(compact(sig[4]).encode()))
        rows['source_faces'].append(row)
        if not m['zero_xz']:
            rows['variant_geometry'].append(dict(source_face_id=f['id'], geometry=tuple(f['points'])))
    for g in groups:
        gid = g['group']
        rows['change_statistics'].append(dict(group_id=gid, statistics_json=compact(g['stats']), terrain_json=compact(g['terrain']), boundary_json=compact(g['boundary'])))
        for relation in g['relations']:
            key = f"{gid}/{relation['signature']}"
            rows['comparison_relations'].append(dict(relation_id=key, group_id=gid, signature=relation['signature'],
                                                       base_count=len(relation['base']), alternative_count=len(relation['alternative']),
                                                       common=relation['common'], ambiguous=int(relation['ambiguous']), status=relation['status']))
            rows['comparison_members'].extend(dict(relation_id=key, side=side, source_face_id=fid)
                                               for side in ('base', 'alternative') for fid in relation[side])
        edges = [edge_rows(faces, sections) for sections in (g['bases'], g['alternatives'])]
        for number, key in enumerate(sorted(edges[0].keys() | edges[1].keys())):
            owners = [edges[i].get(key, []) for i in (0, 1)]
            rows['variant_diagnostics'].append(dict(edge_id=f'{gid}/{number}', group_id=gid, endpoints_json=compact(key),
                                                       base_owners_json=compact(owners[0]), alternative_owners_json=compact(owners[1]),
                                                       base_occurrences=len(owners[0]), alternative_occurrences=len(owners[1]),
                                                       exact_matches=min(map(len, owners)), method='exact 3D outer grid-side occurrences; no wrap/weld'))
    metadata = dict(schema=SCHEMA, version=1, generator=GENERATOR, map_id='WM0', source_sha256=source_hash(world.path),
                    coordinate_space='WM0Raw', geometry_axis_order=['placed raw X', 'placed raw Z', 'raw Y'],
                    normal_frame='original raw XYZ', units=['raw unit', 'raw unit²'], global_mapping=None,
                    groups=[dict(id=i, alternatives=a, bases=b) for i, (a, b) in enumerate(GROUPS, 1)],
                    method='Exact geometry occurrence multiset and source contribution sums, not footprint change area.',
                    runtime_selection='Unknown', qgis_limit='Client Meter label does not establish a physical source unit.')
    rows['variant_metadata'] = [dict(metadata_json=compact(metadata))]
    return rows


def verify_package(path, rows):
    from osgeo import gdal
    spatial = [('source_vertices', 'POINT', -1, 1, 0), ('variant_geometry', 'POLYGON', -1, 1, 0)]
    with closing(sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro', uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Variant SQLite integrity')
        if sorted(db.execute('SELECT table_name,geometry_type_name,srs_id,z,m FROM gpkg_geometry_columns')) != spatial:
            raise ValueError('Variant geometry/SRS/Z/M')
        for name, _, _, _, _ in spatial:
            if db.execute('SELECT srs_id FROM gpkg_contents WHERE table_name=?', (name,)).fetchone() != (-1,):
                raise ValueError('Variant contents SRS')
            if any(blob[:2] != b'GP' or int.from_bytes(blob[4:8], 'little', signed=True) != -1 for (blob,) in db.execute(f'SELECT geom FROM {name}')):
                raise ValueError('Variant geometry header SRS')
        for table, key in [('source_sections', 'section'), ('source_meshes', 'mesh_key'), ('source_vertices', 'vertex_id'),
                           ('source_normals', 'normal_id'), ('source_faces', 'source_face_id'), ('variant_geometry', 'source_face_id'),
                           ('comparison_relations', 'relation_id'), ('variant_diagnostics', 'edge_id')]:
            if db.execute(f'SELECT count(*)-count(DISTINCT {key}) FROM {table}').fetchone()[0]:
                raise ValueError('Duplicate variant source identity')
        for slot in range(3):
            if db.execute(f'SELECT count(*) FROM source_faces f LEFT JOIN source_vertices v ON f.vertex_{slot}=v.vertex_id LEFT JOIN source_normals n ON f.normal_{slot}=n.normal_id WHERE v.vertex_id IS NULL OR n.normal_id IS NULL OR f.mesh_key<>v.mesh_key OR f.index_{slot}<>v.vertex_index').fetchone()[0]:
                raise ValueError('Variant vertex/normal identity')
        for query in ['SELECT count(*) FROM variant_geometry g LEFT JOIN source_faces f USING(source_face_id) WHERE f.source_face_id IS NULL OR f.zero_xz<>0',
                      'SELECT count(*) FROM comparison_members m LEFT JOIN source_faces f USING(source_face_id) LEFT JOIN comparison_relations r USING(relation_id) WHERE f.source_face_id IS NULL OR r.relation_id IS NULL OR m.side<>f.side OR r.group_id<>f.group_id']:
            if db.execute(query).fetchone()[0]:
                raise ValueError('Variant logical relationship')
    ds = gdal.OpenEx(str(path), gdal.OF_VECTOR | gdal.OF_READONLY)
    if ds is None or ds.GetLayerCount() != len(rows):
        raise ValueError('Variant OGR tables')
    try:
        for name, expected in rows.items():
            layer = ds.GetLayerByName(name)
            if layer.GetFeatureCount() != len(expected):
                raise ValueError('Variant row count')
            for feature, row in zip(layer, expected):
                for key, value in row.items():
                    if key != 'geometry' and feature.GetField(key) != value:
                        raise ValueError(f'Variant field mismatch {name}.{key}')
                if 'geometry' in row:
                    geometry = feature.GetGeometryRef()
                    actual = geometry.GetPoint() if name == 'source_vertices' else tuple(geometry.GetGeometryRef(0).GetPoint(i) for i in range(3))
                    if actual != row['geometry']:
                        raise ValueError('Variant XYZ mismatch')
            layer = None
    finally:
        ds.Close()
    return dict(sqlite='ok', ogr='all fields and XYZ exact', srs_id=-1, z=1, m=0)


def export_gis(source, output):
    from osgeo import gdal, ogr
    from .gis_export import Package, polygon_geometry, _user_row
    gdal.UseExceptions(); ogr.UseExceptions()
    if int(gdal.VersionInfo('VERSION_NUM')) < 3090000:
        raise ValueError('GDAL >= 3.9 required for SRID=-1')
    target = safe_target(output, '.gpkg', 'output/exports/world-variants')
    before = source_hash(source); began = time.perf_counter(); world, counts = load_source(source)
    rows = rows_for_world(world); target.parent.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(target.parent).free < 2*LIMIT:
        raise ValueError('Insufficient Variant staging space')
    package = table = None
    with tempfile.TemporaryDirectory(prefix='.world-variant-', dir=target.parent) as temporary:
        candidate = Path(temporary)/target.name
        try:
            package = Package(candidate)
            for name, values in rows.items():
                sample = values[0]
                kind = ogr.wkbPoint25D if name == 'source_vertices' else ogr.wkbPolygon25D if name == 'variant_geometry' else ogr.wkbNone
                table = package.dataset.CreateLayer(name, None, kind, options=['SRID=-1', 'SPATIAL_INDEX=YES'] if kind != ogr.wkbNone else [])
                for key, value in sample.items():
                    if key == 'geometry':
                        continue
                    field = ogr.OFTString if isinstance(value, str) else ogr.OFTReal if isinstance(value, float) or key.startswith('gradient_') else ogr.OFTInteger64
                    if table.CreateField(ogr.FieldDefn(key, field)) != 0:
                        raise ValueError('Variant field creation')
                for i, row in enumerate(values):
                    geom = None
                    if name == 'source_vertices':
                        geom = ogr.Geometry(ogr.wkbPoint25D); geom.AddPoint(*row['geometry'])
                    elif name == 'variant_geometry':
                        geom = polygon_geometry(row['geometry'])
                    _user_row(table, {k: v for k, v in row.items() if k != 'geometry'}, geom)
                    if i % 1000 == 0 and candidate.stat().st_size > LIMIT:
                        raise ValueError('Variant GIS budget')
                table = None
            package.dataset.CommitTransaction(); package.dataset.Close(); package = None
            if candidate.stat().st_size > LIMIT:
                raise ValueError('Variant GIS budget')
            checked = verify_package(candidate, rows)
            if source_hash(source) != before:
                raise ValueError('MAP changed during Variant export')
            safe_target(target, '.gpkg', 'output/exports/world-variants'); os.link(candidate, target)
        finally:
            table = None
            if package is not None:
                try:
                    package.dataset.CommitTransaction()
                finally:
                    package.dataset.Close()
    return dict(path=str(target), schema=SCHEMA, version=1, source_sha256=before, sha256=source_hash(target),
                bytes=target.stat().st_size, source_counts=counts, counts={k: len(v) for k, v in rows.items()},
                validation=checked, seconds=time.perf_counter()-began)
