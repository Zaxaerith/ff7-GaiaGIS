# SPDX-License-Identifier: GPL-3.0-only
"""Private Native GeoPackage v1. Requires installed GDAL >= 3.9; no runtime GIS bundle."""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import shutil
import subprocess
import sys
import tempfile
import time
from .safety import WORKSPACE_ROOT, output_path, protect_input
from .clean_output import reject_links
from .native_analysis import analyze_world
from .map_reader import parse_map

LIMIT = 64_000_000  # < 20k source faces/map, vertices, edges and three occurrences/face.
SCHEMA = 'gaiagis-native-gpkg'


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def safe_target(path):
    path = Path(path).absolute()
    target = output_path(path)
    if target != path or not target.is_relative_to(WORKSPACE_ROOT/'output/exports/native') or target.suffix.lower() != '.gpkg':
        raise ValueError('Native GIS output must be a new output/exports/native/*.gpkg')
    for p in (path, *path.parents):
        if p == WORKSPACE_ROOT:
            break
        reject_links(p)
    if target.exists():
        raise ValueError('Output exists; choose a new filename')
    return target


def source_rows(world, analysis):
    """Canonical rows, source offsets are explicitly compressed or decoded-relative."""
    meshes, vertices, faces, polygons, edge_rows, occurrences = [], [], [], [], [], []
    face_id = vertex_id = 0
    for mesh in world.base_meshes:
        mid = f'{mesh.section_id}/{mesh.mesh_id}'
        common = dict(map_id=f'WM{world.map_id}', section=mesh.section_id, mesh=mesh.mesh_id)
        meshes.append(dict(common, mesh_key=mid, compressed_header_offset=mesh.section_id*47104+mesh.offset,
                           compressed_data_offset=mesh.section_id*47104+mesh.offset+4,
                           compressed_bytes=mesh.compressed_size, decoded_bytes=mesh.decoded_size,
                           vertex_count=len(mesh.vertices), face_count=len(mesh.triangles)))
        for i, (v, n) in enumerate(zip(mesh.vertices, mesh.normals)):
            vertices.append(dict(common, vertex_id=vertex_id+i, mesh_key=mid, vertex_index=i,
                                 raw_x=v.raw_x, raw_y=v.raw_y, raw_z=v.raw_z, vertex_padding=v.padding,
                                 normal_x=n.raw_x, normal_y=n.raw_y, normal_z=n.raw_z, normal_padding=n.padding,
                                 vertex_decoded_offset=4+12*len(mesh.triangles)+8*i,
                                 normal_decoded_offset=4+12*len(mesh.triangles)+8*len(mesh.vertices)+8*i,
                                 geometry=mesh.position(i)))
        for t in mesh.triangles:
            m = analysis['faces'][face_id]
            row = dict(common, source_face_id=face_id, mesh_key=mid, triangle=t.triangle_id,
                       vertex_0=vertex_id+t.indices[0], vertex_1=vertex_id+t.indices[1], vertex_2=vertex_id+t.indices[2],
                       index_0=t.indices[0], index_1=t.indices[1], index_2=t.indices[2],
                       decoded_offset=4+12*t.triangle_id, raw_ids=t.raw_ids, terrain_script_byte=t.terrain_script_byte,
                       terrain=t.ff7_terrain_type, region=t.region, texture=t.texture, script=t.script,
                       flags=int(t.is_chocobo) | t.unknown_bit14 << 1,
                       uv=json.dumps(t.uv, separators=(',', ':')), determinant=m['determinant'], area=m['area'],
                       gradient_a=None if m['a'] is None else float(m['a']), gradient_b=None if m['b'] is None else float(m['b']),
                       zero_xz=int(m['zero_xz']), degenerate_3d=int(m['degenerate_3d']), duplicate_count=m['duplicate_count'],
                       collapsed_edges=m['collapsed_edges'], repeated_edges=m['repeated_edges'], component=m['component'],
                       incidence_0=m['edge_incidence'][0], incidence_1=m['edge_incidence'][1], incidence_2=m['edge_incidence'][2])
            faces.append(row)
            if not m['zero_xz']:
                polygons.append(dict(row, geometry=tuple(mesh.position(i) for i in t.indices)))
            face_id += 1
        vertex_id += len(mesh.vertices)
    for eid, ((p, q), owners) in enumerate(analysis['edges'].items()):
        edge_rows.append(dict(edge_id=eid, ax=p[0], az=p[1], ah=p[2], bx=q[0], bz=q[1], bh=q[2],
                              incidence=len(owners), collapsed=int(p == q), distinct_faces=len({i for i, _ in owners})))
        occurrences.extend(dict(edge_id=eid, source_face_id=i, slot=slot) for i, slot in owners)
    metadata = dict(schema=SCHEMA, version=1, map_id=f'WM{world.map_id}', coordinate_space=f'WM{world.map_id}Native',
                    source_sha256=digest(world.path), original_axis_order=['X', 'Y', 'Z'], geometry_axis_order=['native X', 'native Z', 'raw Y'],
                    normal_frame='original raw XYZ; axis permutation has determinant -1', global_mapping=None,
                    units=['raw unit', 'raw unit²', 'raw height/raw horizontal unit'], generator='native-gis-1',
                    method='Source triangle contribution sum, not union. Exact 3D endpoint edges; no weld/wrap. Components only incidence=2 distinct faces.',
                    limits='No physical metres, altitude, compass, navigability or geographic overlay. QGIS may default to Meter; this is not a source unit.',
                    summary=analysis['summary'])
    return dict(native_metadata=[dict(metadata_json=json.dumps(metadata, ensure_ascii=False, sort_keys=True))],
                source_meshes=meshes, source_vertices=vertices, source_faces=faces, xz_analysis_faces=polygons,
                edge_diagnostics=edge_rows, edge_occurrences=occurrences,
                terrain_statistics=[dict(terrain=k, **v) for k, v in analysis['terrain'].items()])


def verify_package(path, rows):
    """Full exact attribute and XYZ readback, SQLite/OGR independently decode GPKG."""
    from osgeo import gdal, ogr
    with closing(sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro', uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Native GeoPackage SQLite integrity/references')
        expected = [('source_vertices', 'POINT', -1, 1, 0), ('xz_analysis_faces', 'POLYGON', -1, 1, 0)]
        if sorted(db.execute('SELECT table_name,geometry_type_name,srs_id,z,m FROM gpkg_geometry_columns')) != expected:
            raise ValueError('Native GeoPackage geometry/SRS contract')
        for name, _, _, _, _ in expected:
            if db.execute('SELECT srs_id FROM gpkg_contents WHERE table_name=?', (name,)).fetchone() != (-1,):
                raise ValueError('Native GeoPackage contents SRS')
            for (blob,) in db.execute(f'SELECT geom FROM {name}'):
                if blob[:2] != b'GP' or int.from_bytes(blob[4:8], 'little', signed=True) != -1:
                    raise ValueError('Native GeoPackage geometry header SRS')
        for name, key in (('source_meshes','mesh_key'), ('source_vertices','vertex_id'), ('source_faces','source_face_id'), ('xz_analysis_faces','source_face_id'), ('edge_diagnostics','edge_id')):
            if db.execute(f'SELECT count(*)-count(DISTINCT {key}) FROM {name}').fetchone()[0]:
                raise ValueError('Duplicate native logical source key')
        for slot in range(3):
            if db.execute(f'SELECT count(*) FROM source_faces f LEFT JOIN source_vertices v ON f.vertex_{slot}=v.vertex_id WHERE v.vertex_id IS NULL OR f.mesh_key<>v.mesh_key OR f.index_{slot}<>v.vertex_index').fetchone()[0]:
                raise ValueError('Native vertex reference')
        for query in (
            'SELECT count(*) FROM xz_analysis_faces a LEFT JOIN source_faces f USING(source_face_id) WHERE f.source_face_id IS NULL OR f.zero_xz<>0',
            'SELECT count(*) FROM edge_occurrences o LEFT JOIN source_faces f USING(source_face_id) LEFT JOIN edge_diagnostics e USING(edge_id) WHERE f.source_face_id IS NULL OR e.edge_id IS NULL OR o.slot NOT BETWEEN 0 AND 2',
        ):
            if db.execute(query).fetchone()[0]:
                raise ValueError('Native face/edge reference')
    ds = gdal.OpenEx(str(path), gdal.OF_VECTOR | gdal.OF_READONLY)
    if ds is None:
        raise ValueError('OGR readback unavailable')
    try:
        if ds.GetLayerCount() != len(rows):
            raise ValueError('Native table contract')
        for name, expected_rows in rows.items():
            layer = ds.GetLayerByName(name)
            if layer.GetFeatureCount() != len(expected_rows):
                raise ValueError('Native row count')
            for feature, row in zip(layer, expected_rows):
                for key, value in row.items():
                    if key != 'geometry' and feature.GetField(key) != value:
                        raise ValueError(f'Native attribute readback: {name}.{key}')
                if 'geometry' in row:
                    geom = feature.GetGeometryRef()
                    actual = geom.GetPoint() if name == 'source_vertices' else tuple(geom.GetGeometryRef(0).GetPoint(i) for i in range(3))
                    if actual != row['geometry']:
                        raise ValueError('Native XYZ readback')
            layer = None
    finally:
        ds.Close()
    return dict(sqlite='ok', ogr='all attributes and XYZ exact', srs_id=-1)


def export_native_gis(source, map_id, output):
    from osgeo import gdal, ogr
    from .gis_export import Package, polygon_geometry, _user_row
    gdal.UseExceptions(); ogr.UseExceptions()
    if int(gdal.VersionInfo('VERSION_NUM')) < 3090000:
        raise ValueError('Native GIS requires GDAL >= 3.9 for explicit SRID=-1')
    if map_id not in (2, 3):
        raise ValueError('Native GIS supports only WM2/WM3')
    source = Path(source).resolve(strict=True)
    protect_input(source)
    target = safe_target(output)
    if source.stat().st_size != 47104*(12 if map_id == 2 else 4):
        raise ValueError('Native MAP section/file budget')
    before = digest(source)
    began = time.perf_counter()
    world = parse_map(source, map_id)
    records, analysis = analyze_world(world)
    rows = source_rows(world, analysis)
    target.parent.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(target.parent).free < LIMIT*2:
        raise ValueError('Insufficient staging/readback disk space')
    package = table = None
    with tempfile.TemporaryDirectory(prefix='.native-gis-', dir=target.parent) as scratch:
        candidate = Path(scratch)/target.name
        try:
            package = Package(candidate)
            for name, values in rows.items():
                sample = values[0] if values else rows['source_faces'][0]
                fields = {key: ogr.OFTString if isinstance(value, str) else ogr.OFTReal if isinstance(value, float) or key.startswith('gradient_') else ogr.OFTInteger64
                          for key, value in sample.items() if key != 'geometry'}
                kind = ogr.wkbPoint25D if name == 'source_vertices' else ogr.wkbPolygon25D if name == 'xz_analysis_faces' else ogr.wkbNone
                table = package.dataset.CreateLayer(name, None, kind, options=['SRID=-1', 'SPATIAL_INDEX=YES'] if kind != ogr.wkbNone else [])
                for key, field_type in fields.items():
                    if table.CreateField(ogr.FieldDefn(key, field_type)) != 0:
                        raise ValueError('Native field creation')
                for row_number, value in enumerate(values):
                    geom = None
                    if name == 'source_vertices':
                        geom = ogr.Geometry(ogr.wkbPoint25D); geom.AddPoint(*value['geometry'])
                    elif name == 'xz_analysis_faces':
                        geom = polygon_geometry(value['geometry'])
                    _user_row(table, {k: v for k, v in value.items() if k != 'geometry'}, geom)
                    if row_number % 1000 == 0 and candidate.stat().st_size > LIMIT:
                        raise ValueError('Native GeoPackage output budget')
                table = None
            package.dataset.CommitTransaction(); package.dataset.Close(); package = None
            if candidate.stat().st_size > LIMIT:
                raise ValueError('Native GeoPackage output budget')
            checked = verify_package(candidate, rows)
            if digest(source) != before:
                raise ValueError('MAP changed during export')
            safe_target(target)
            os.link(candidate, target)  # Atomic no-clobber, including a concurrent writer.
        finally:
            table = None
            if package is not None:
                try:
                    package.dataset.CommitTransaction()
                finally:
                    package.dataset.Close()
    return dict(path=str(target), schema=SCHEMA, version=1, source_sha256=before, sha256=digest(target),
                bytes=target.stat().st_size, counts={k: len(v) for k, v in rows.items()},
                summary=analysis['summary'], validation=checked, seconds=time.perf_counter()-began)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['export'])
    parser.add_argument('--source-map', type=Path, required=True)
    parser.add_argument('--map', choices=['WM2', 'WM3'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        print(json.dumps(export_native_gis(args.source_map, int(args.map[2]), args.output), ensure_ascii=False))
        return 0
    except ImportError:
        root = os.environ.get('GAIAGIS_QGIS_ROOT')
        if root and sys.platform == 'win32' and not getattr(sys, 'frozen', False):
            from .runtime import qgis_environment
            root = Path(root).resolve(); env = qgis_environment(root); env.pop('GAIAGIS_QGIS_ROOT', None)
            return subprocess.run([str(root/'bin/python.exe'), '-B', '-m', 'gaiagis', 'native-gis', 'export',
                                   '--source-map', str(args.source_map.absolute()), '--map', args.map,
                                   '--output', str(args.output.absolute())], cwd=WORKSPACE_ROOT, env=env).returncode
        parser.exit(1, 'Native GIS requires GDAL >= 3.9 Python; set GAIAGIS_QGIS_ROOT. Portable Viewer does not require GIS.\n')
    except (ValueError, OSError, RuntimeError, KeyError, TypeError) as error:
        parser.exit(1, f'Native GIS export rejected: {error}\n')
