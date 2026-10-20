# SPDX-License-Identifier: GPL-3.0-only
"""Independent private WM0 byte/Fraction/GeoPackage oracle, not a data publisher."""
import argparse
from collections import Counter, defaultdict
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import sqlite3
import struct
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'src'))
from gaiagis.lzss import decompress
from gaiagis.map_reader import parse_map
from gaiagis.safety import output_path, WORKSPACE_ROOT

PAIRS = ((63, 50), (64, 41), (65, 42), (66, 60), (67, 47), (68, 48))
GROUPS = (((63,), (50,)), ((64, 65), (41, 42)), ((66,), (60,)), ((67, 68), (47, 48)))


def metrics(points):
    x, z, h = zip(*points)
    d = sum(x[i]*z[(i+1) % 3]-x[(i+1) % 3]*z[i] for i in range(3))
    a = None if not d else Fraction(sum(h[i]*(z[(i+1) % 3]-z[(i+2) % 3]) for i in range(3)), d)
    b = None if not d else Fraction(sum(h[i]*(x[(i+2) % 3]-x[(i+1) % 3]) for i in range(3)), d)
    u, v = [points[1][i]-points[0][i] for i in range(3)], [points[2][i]-points[0][i] for i in range(3)]
    cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
    if d:
        c = Fraction(h[0])-a*x[0]-b*z[0]
        assert all(a*xx+b*zz+c == hh for xx, zz, hh in points)
    return dict(determinant=d, area=abs(d)/2, a=None if a is None else float(a), b=None if b is None else float(b), degenerate=cross == (0, 0, 0))


def geometry(blob):
    assert blob[:2] == b'GP' and blob[3] & 1 and int.from_bytes(blob[4:8], 'little', signed=True) == -1
    pos = 8+{0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(blob[3] >> 1) & 7]
    assert blob[pos] == 1
    kind = int.from_bytes(blob[pos+1:pos+5], 'little'); pos += 5
    if kind == 1001:
        return struct.unpack_from('<ddd', blob, pos)
    assert kind == 1003 and int.from_bytes(blob[pos:pos+4], 'little') == 1
    assert int.from_bytes(blob[pos+4:pos+8], 'little') == 4
    points = [struct.unpack_from('<ddd', blob, pos+8+i*24) for i in range(4)]
    assert points[-1] == points[0]
    return tuple(points[:3])


def audit(source, resource, package):
    raw = source.read_bytes(); source_sha = hashlib.sha256(raw).hexdigest()
    envelope = json.loads(resource.read_bytes()); payload = envelope['payload'].encode()
    assert envelope['source_sha256'] == source_sha and hashlib.sha256(payload).hexdigest() == envelope['payload_sha256']
    meshes = {(r[0], r[2]): r for r in json.loads(payload)['meshes']}
    world = parse_map(source, 0); assert not world.failures
    production = {(m.section_id, m.mesh_id): m for m in world.meshes}
    cursor = lambda b, p, width, signed=False: int.from_bytes(b[p:p+width], 'little', signed=signed)
    counts = Counter(); selected = []; section_edges = defaultdict(Counter)
    db = sqlite3.connect(package.resolve().as_uri()+'?mode=ro', uri=True); db.row_factory = sqlite3.Row
    faces = {r['source_face_id']: r for r in db.execute('SELECT * FROM source_faces')}
    polygons = {r['source_face_id']: geometry(r['geom']) for r in db.execute('SELECT * FROM variant_geometry')}
    vertices_gis = {r['vertex_id']: r for r in db.execute('SELECT * FROM source_vertices')}
    normals_gis = {r['normal_id']: r for r in db.execute('SELECT * FROM source_normals')}
    mesh_gis = {r['mesh_key']: r for r in db.execute('SELECT * FROM source_meshes')}
    assert len(raw) == 69*47104
    for section in range(69):
        placement = dict(PAIRS).get(section, section); counts['sections'] += 1
        for mid in range(16):
            absolute = section*47104+cursor(raw, section*47104+4*mid, 4)
            size = cursor(raw, absolute, 4); decoded = decompress(raw[absolute+4:absolute+4+size])
            nt, nv = cursor(decoded, 0, 2), cursor(decoded, 2, 2)
            assert len(decoded) == 4+12*nt+16*nv
            tables = []
            for table in range(2):
                values = []
                for i in range(nv):
                    p = 4+12*nt+(table*nv+i)*8
                    values.append([*(cursor(decoded, p+k*2, 2, True) for k in range(3)), cursor(decoded, p+6, 2)])
                tables.append(values)
            vertices, normals = tables; m = production[section, mid]
            assert (absolute, size, len(decoded)) == (section*47104+m.offset, m.compressed_size, m.decoded_size)
            assert [[v.raw_x, v.raw_y, v.raw_z, v.padding] for v in m.vertices] == vertices
            assert [[v.raw_x, v.raw_y, v.raw_z, v.padding] for v in m.normals] == normals
            packed = meshes.get((section, mid))
            if packed:
                assert packed[:8] == [section, placement, mid, absolute, size, len(decoded), vertices, normals]
                mg = mesh_gis[f'{section}/{mid}']; assert (mg['compressed_header_offset'], mg['compressed_data_offset'], mg['compressed_bytes'], mg['decoded_bytes']) == (absolute, absolute+4, size, len(decoded))
                for i, (v, n) in enumerate(zip(vertices, normals)):
                    key = f'{section}/{mid}/{i}'; vg, ng = vertices_gis[key], normals_gis[key]
                    assert [vg[k] for k in ('raw_x', 'raw_y', 'raw_z', 'padding')] == v
                    assert [ng[k] for k in ('raw_x', 'raw_y', 'raw_z', 'padding')] == n
                    assert vg['decoded_offset'] == 4+12*nt+8*i and ng['decoded_offset'] == 4+12*nt+8*(nv+i)
                    position = (v[0]+8192*(placement % 9*4+mid % 4), v[2]+8192*(placement//9*4+mid//4), v[1])
                    assert geometry(vg['geom']) == position
            for tid in range(nt):
                p = 4+12*tid; t = [*decoded[p:p+10], cursor(decoded, p+10, 2)]; prod = m.triangles[tid]
                assert t == [*prod.indices, prod.terrain_script_byte, *(x for pair in prod.uv for x in pair), prod.raw_ids]
                points = [(vertices[j][0]+8192*(placement % 9*4+mid % 4), vertices[j][2]+8192*(placement//9*4+mid//4), vertices[j][1]) for j in t[:3]]
                result = metrics(points); counts['faces'] += 1; counts['fraction_planes'] += result['determinant'] != 0
                for slot in range(3):
                    a, b = points[slot], points[(slot+1) % 3]
                    if any(a[axis] == b[axis] and a[axis] % 32768 == 0 for axis in (0, 1)):
                        section_edges[section][tuple(sorted((a, b)))] += 1
                if packed:
                    assert packed[8][tid] == t
                    key = f'{section}/{mid}/{tid}'; row = faces[key]
                    for field, expected in [('section', section), ('mesh', mid), ('triangle', tid), ('base_placement', placement), ('decoded_offset', p), ('terrain_script_byte', t[3]), ('raw_ids', t[10]), ('determinant', result['determinant']), ('area', result['area']), ('gradient_a', result['a']), ('gradient_b', result['b']), ('zero_xz', int(result['determinant'] == 0)), ('degenerate_3d', int(result['degenerate']))]:
                        assert row[field] == expected, (key, field)
                    assert [row[f'index_{i}'] for i in range(3)] == t[:3]
                    assert [row[f'vertex_{i}'] for i in range(3)] == [f'{section}/{mid}/{j}' for j in t[:3]]
                    assert [row[f'normal_{i}'] for i in range(3)] == [f'{section}/{mid}/{j}' for j in t[:3]]
                    assert json.loads(row['uv']) == [t[4:6], t[6:8], t[8:10]]
                    if result['determinant']:
                        assert polygons[key] == tuple(points)
                    else:
                        assert key not in polygons
                    selected.append(dict(id=key, section=section, points=points, normals=[normals[j][:3] for j in t[:3]], raw=t, **result))
            counts['meshes'] += 1; counts['vertices'] += nv; counts['normals'] += nv
    boundary_checks = []
    for row in json.loads(payload)['boundary_evidence']:
        a, b = row['sections']; axis, coordinate = row['axis'], row['coordinate']
        counters = [Counter({k: n for k, n in section_edges[section].items() if k[0][axis] == coordinate == k[1][axis]}) for section in (a, b)]
        exact = sum((counters[0] & counters[1]).values())
        actual = dict(a=sum(counters[0].values()), b=sum(counters[1].values()), exact=exact, unmatched_a=sum((counters[0]-counters[1]).values()), unmatched_b=sum((counters[1]-counters[0]).values()))
        assert all(row[k] == v for k, v in actual.items()), row
        boundary_checks.append(dict(group=row['group'], kind=row['kind'], sections=row['sections'], **actual))
    assert [r['unmatched_a'] for r in boundary_checks if r['group'] == 4 and r['kind'] == 'mixed_rejected'] == [5, 5]
    group_statistics = []
    for aa, bb in GROUPS:
        sides = [[f for f in selected if f['section'] in ss] for ss in (bb, aa)]
        geo = [Counter(tuple(sorted(f['points'])) for f in side) for side in sides]
        uv = [Counter((tuple(sorted(f['points'])), f['raw'][3], f['raw'][10], tuple(sorted((p, tuple(f['raw'][4+2*i:6+2*i])) for i, p in enumerate(f['points'])))) for f in side) for side in sides]
        common = sum((geo[0] & geo[1]).values())
        group_statistics.append(dict(common=common, base_only=sum((geo[0]-geo[1]).values()), alternative_only=sum((geo[1]-geo[0]).values()), lower=common-sum((uv[0] & uv[1]).values())))
    assert [g['common'] for g in group_statistics] == [2760, 4084, 2275, 5152]
    assert sum(g['lower'] for g in group_statistics) == 383
    assert len(selected) == 30514 and len(polygons) == 30432 and len(vertices_gis) == len(normals_gis) == 18700
    db.close()
    return dict(source_sha256=source_sha, counts=dict(counts), groups=group_statistics,
                boundaries=boundary_checks, exact_resource_and_gis_faces=len(selected), source_zero_xz=sum(f['determinant'] == 0 for f in selected),
                sqlite_geometry_decoder='independent Point Z/Polygon Z header and WKB cursor', oracle=selected)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for key in ('source-map', 'resource', 'gpkg', 'output'):
        p.add_argument('--'+key, type=Path, required=True)
    args = p.parse_args(); target = output_path(args.output)
    if not target.is_relative_to(WORKSPACE_ROOT/'output/dev/current') or target.exists():
        raise ValueError('Choose a new private oracle JSON')
    result = audit(args.source_map, args.resource, args.gpkg)
    with target.open('x', encoding='utf-8') as f:
        json.dump(result, f, separators=(',', ':')); f.write('\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'oracle'}))


if __name__ == '__main__':
    main()
