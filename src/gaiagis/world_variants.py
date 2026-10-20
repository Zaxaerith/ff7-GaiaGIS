# SPDX-License-Identifier: GPL-3.0-only
"""WM0 source variants, never a runtime state or a changed-footprint model.

Source indices and multiplicity are authoritative. Equal geometry only creates
a candidate set, never an ordinal/nearest-neighbour entity correspondence.
"""
from collections import Counter, defaultdict
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
from .map_reader import parse_map
from .constants import KNOWN
from .native_analysis import triangle_metrics
from .safety import WORKSPACE_ROOT, output_path, protect_input
from .clean_output import reject_links

GROUPS = (((63,), (50,)), ((64, 65), (41, 42)), ((66,), (60,)), ((67, 68), (47, 48)))
PLACEMENTS = {a: b for aa, bb in GROUPS for a, b in zip(aa, bb)}
SECTIONS = tuple(sorted((*PLACEMENTS, *PLACEMENTS.values())))
SCHEMA = 'gaiagis-world-variants'
GENERATOR = 'world-variants-1'
LIMIT = 8_000_000  # Plain UTF-8, no compressed stream; independent of Visual budgets.
PAYLOAD_LIMIT = 6_000_000


def compact(value):
    return json.dumps(value, ensure_ascii=True, separators=(',', ':'), allow_nan=False)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_hash(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def signatures(face):
    points = tuple(map(tuple, face['points']))
    geometry = tuple(sorted(points))
    oriented = min(points[i:]+points[:i] for i in range(3))
    attrs = (face['terrain_script_byte'], face['raw_ids'])
    uv = tuple(sorted((p, tuple(u)) for p, u in zip(points, face['uv'])))
    normals = tuple(sorted((p, tuple(n)) for p, n in zip(points, face['normals'])))
    combined = tuple(sorted((p, tuple(u), tuple(n)) for p, u, n in zip(points, face['uv'], face['normals'])))
    return geometry, oriented, attrs, uv, normals, combined


def compare_faces(base, alternative):
    """Every relation is a complete geometry bucket on both source sides."""
    buckets = defaultdict(lambda: [[], []])
    signatures_by_id = {}
    for side, faces in enumerate((base, alternative)):
        for face in faces:
            if face['id'] in signatures_by_id:
                raise ValueError('Duplicate source face identity')
            sig = signatures(face)
            signatures_by_id[face['id']] = sig
            buckets[sig[0]][side].append(face)
    stats = Counter()
    relations = []
    for geometry, sides in sorted(buckets.items()):
        b, a = sides
        common = min(len(b), len(a))
        stats['geometry_common'] += common
        stats['base_only'] += max(0, len(b)-len(a))
        stats['alternative_only'] += max(0, len(a)-len(b))
        for key, indices in [('winding_common', (1,)), ('attribute_common', (2,)),
                             ('uv_common', (3,)), ('normal_common', (4,)),
                             ('attribute_uv_common', (2, 3)), ('all_common', (2, 5))]:
            counters = [Counter(tuple(signatures_by_id[f['id']][i] for i in indices) for f in side) for side in sides]
            stats[key] += sum((counters[0] & counters[1]).values())
        ambiguous = len(b) > 1 or len(a) > 1
        stats['ambiguous_buckets'] += ambiguous
        relations.append(dict(signature=sha(compact(geometry).encode()), base=[f['id'] for f in b],
                              alternative=[f['id'] for f in a], common=common, ambiguous=ambiguous,
                              status='common' if common else 'base_only' if b else 'alternative_only'))
    stats['attribute_uv_difference_lower_bound'] = stats['geometry_common']-stats['attribute_uv_common']
    stats['base_faces'], stats['alternative_faces'] = len(base), len(alternative)
    stats['face_delta'] = len(alternative)-len(base)
    stats['area_contribution_delta'] = sum(f['metrics']['area'] for f in alternative)-sum(f['metrics']['area'] for f in base)
    terrain = []
    for code in sorted({f['terrain_script_byte'] & 31 for f in (*base, *alternative)}):
        rows = [[f for f in faces if f['terrain_script_byte'] & 31 == code] for faces in (base, alternative)]
        terrain.append(dict(terrain=code, base_faces=len(rows[0]), alternative_faces=len(rows[1]),
                            base_area=sum(f['metrics']['area'] for f in rows[0]), alternative_area=sum(f['metrics']['area'] for f in rows[1])))
    return dict(stats=dict(stats), relations=relations, terrain=terrain)


def mesh_payload(mesh):
    vectors = lambda rows: [[v.raw_x, v.raw_y, v.raw_z, v.padding] for v in rows]
    return [mesh.section_id, mesh.base_section_id, mesh.mesh_id,
            mesh.section_id*47104+mesh.offset, mesh.compressed_size, mesh.decoded_size,
            vectors(mesh.vertices), vectors(mesh.normals),
            [[*t.indices, t.terrain_script_byte, *(x for uv in t.uv for x in uv), t.raw_ids] for t in mesh.triangles]]


def payload_faces(payload):
    result = []
    for section, placement, mid, header, compressed, decoded, vertices, normals, triangles in payload['meshes']:
        col, row = placement % 9*4+mid % 4, placement//9*4+mid//4
        for tid, t in enumerate(triangles):
            points = [(vertices[i][0]+8192*col, vertices[i][2]+8192*row, vertices[i][1]) for i in t[:3]]
            result.append(dict(id=f'{section}/{mid}/{tid}', section=section, placement=placement, mesh=mid, triangle=tid,
                               points=points, normals=[normals[i][:3] for i in t[:3]], indices=t[:3],
                               terrain_script_byte=t[3], raw_ids=t[10], uv=list(zip(t[4:10:2], t[5:10:2])),
                               decoded_offset=4+12*tid, metrics=triangle_metrics(points)))
    return result


def edge_rows(faces, sections, *, outer=True):
    """Explicit grid sides; not all incidence=1 edges, no modulo or repair."""
    placements = {f['placement'] for f in faces if f['section'] in sections}
    edges = defaultdict(list)
    for f in faces:
        if f['section'] not in sections:
            continue
        p = f['points']; cell = f['placement']; x, z = cell % 9*32768, cell//9*32768
        sides = [(0, x, cell-1 if cell % 9 else None), (0, x+32768, cell+1 if cell % 9 < 8 else None),
                 (1, z, cell-9 if cell >= 9 else None), (1, z+32768, cell+9 if cell < 54 else None)]
        for slot in range(3):
            a, b = p[slot], p[(slot+1) % 3]
            if any(a[axis] == limit == b[axis] and (not outer or neighbor not in placements) for axis, limit, neighbor in sides):
                edges[tuple(sorted((tuple(a), tuple(b))))].append((f['id'], slot))
    return edges


def edge_comparison(a, b):
    ca, cb = Counter({k: len(v) for k, v in a.items()}), Counter({k: len(v) for k, v in b.items()})
    return dict(a=sum(ca.values()), b=sum(cb.values()), exact=sum((ca & cb).values()),
                unmatched_a=sum((ca-cb).values()), unmatched_b=sum((cb-ca).values()))


def analyze_payload(payload):
    faces = payload_faces(payload)
    groups = []
    for index, (aa, bb) in enumerate(GROUPS, 1):
        base = [f for f in faces if f['section'] in bb]
        alt = [f for f in faces if f['section'] in aa]
        compared = compare_faces(base, alt)
        ba, ab = edge_rows(faces, bb), edge_rows(faces, aa)
        compared.update(group=index, alternatives=aa, bases=bb, boundary=edge_comparison(ba, ab))
        groups.append(compared)
    return faces, groups


def world_script(path):
    """Bounded static instruction/entry CFG evidence. No VM or save evaluation."""
    from .lgp import inventory, read_entry
    from .ev import decode_ev, basic_blocks, RETURN, JUMP, BRANCH_FALSE
    path = Path(path).resolve(strict=True); protect_input(path)
    if not 1 <= path.stat().st_size <= 16_000_000:
        raise ValueError('World script archive budget')
    before = source_hash(path)
    entries = [x for x in inventory(path)['entries'] if x['filename'] == 'wm0.ev']
    if len(entries) != 1:
        raise ValueError('Ambiguous wm0.ev identity')
    entry = entries[0]; data = read_entry(path, entry)
    functions, intervals = decode_ev(data); sites = {}
    for function in functions:
        instructions = intervals[function.start]; blocks = basic_blocks(function, instructions)
        seen, todo = set(), [function.start]
        while todo:
            pc = todo.pop()
            if pc in seen or pc not in instructions:
                continue
            seen.add(pc); op, arg, nxt = instructions[pc]
            if op == RETURN:
                continue
            if op in (JUMP, BRANCH_FALSE):
                todo.append(arg)
            if op != JUMP:
                todo.append(nxt)
        for pc in sorted(seen):
            if instructions[pc][0] != 0x349:
                continue
            previous = [q for q in instructions if instructions[q][2] == pc and blocks[q] == blocks[pc]]
            literal = instructions[previous[0]][1] if len(previous) == 1 and instructions[previous[0]][0] == 0x110 else None
            record = sites.setdefault(pc, dict(word_offset=pc, payload_byte_offset=1024+pc*2,
                                      archive_byte_offset=entry['data_offset']+1024+pc*2, literal=literal, entries=[]))
            record['entries'].append(dict(table=function.table, header=function.header, kind=function.kind, function=function.id))
    if source_hash(path) != before:
        raise ValueError('World script archive changed during read')
    return dict(source_sha256=before, section_sha256=sha(data), entry=entry, sites=list(sites.values()), runtime='Unknown')


def load_source(path):
    path = Path(path).resolve(strict=True); protect_input(path)
    if path.stat().st_size != 69*47104:
        raise ValueError('WM0 source section budget')
    if source_hash(path) != KNOWN['wm0.map'][1].lower():
        raise ValueError('Unsupported WM0 source fingerprint; canonical V1 profile required')
    world = parse_map(path, 0)
    if world.failures or world.unknown_sections or len(world.meshes) != 1104:
        raise ValueError('Incomplete WM0 source')
    counts = dict(sections=world.section_count, meshes=len(world.meshes), faces=sum(len(m.triangles) for m in world.meshes),
                  vertices=sum(len(m.vertices) for m in world.meshes), normals=sum(len(m.normals) for m in world.meshes))
    return world, counts


def make_payload(world):
    return dict(meshes=[mesh_payload(m) for m in world.meshes if m.section_id in SECTIONS],
                boundary_evidence=boundary_evidence(world))


def boundary_evidence(world):
    """Group neighbours are finite raw-grid contexts, never wrap/gameplay edges."""
    cache = {}
    def side(section, axis, coordinate):
        key = section, axis, coordinate
        if key not in cache:
            edges = defaultdict(list)
            for mesh in world.meshes:
                if mesh.section_id != section:
                    continue
                for t in mesh.triangles:
                    p = [mesh.position(i) for i in t.indices]
                    for slot in range(3):
                        a, b = p[slot], p[(slot+1) % 3]
                        if a[axis] == coordinate == b[axis]:
                            edges[tuple(sorted((a, b)))].append((f'{section}/{mesh.mesh_id}/{t.triangle_id}', slot))
            cache[key] = edges
        return cache[key]
    rows = []
    def add(group, kind, a, b, axis, coordinate):
        ea, eb = side(a, axis, coordinate), side(b, axis, coordinate)
        summary = edge_comparison(ea, eb)
        unmatched = [k for k in sorted(ea.keys() | eb.keys()) if len(ea.get(k, [])) != len(eb.get(k, []))]
        rows.append(dict(group=group, kind=kind, sections=[a, b], axis=axis, coordinate=coordinate, **summary,
                         examples=[dict(points=k, a_owners=ea.get(k, []), b_owners=eb.get(k, [])) for k in unmatched[:6]]))
    reverse = {b: a for a, b in PLACEMENTS.items()}
    for group, (aa, bb) in enumerate(GROUPS, 1):
        for alt, base in zip(aa, bb):
            x, z = base % 9*32768, base//9*32768
            for axis, coordinate, neighbor in [(0, x, base-1 if base % 9 else None), (0, x+32768, base+1 if base % 9 < 8 else None),
                                               (1, z, base-9 if base >= 9 else None), (1, z+32768, base+9 if base < 54 else None)]:
                if neighbor in bb:
                    continue
                add(group, 'world_boundary' if neighbor is None else 'base_alternative_side', base, alt, axis, coordinate)
                if neighbor is not None:
                    add(group, 'external_base', base, neighbor, axis, coordinate)
                    add(group, 'external_alternative', alt, neighbor, axis, coordinate)
                    if neighbor in reverse:
                        add(group, 'cumulative_context', alt, reverse[neighbor], axis, coordinate)
        if len(bb) == 2:
            axis, coordinate = 0, bb[1] % 9*32768
            for kind, a, b in [('internal_base', *bb), ('internal_alternative', *aa),
                               ('mixed_rejected', aa[0], bb[1]), ('mixed_rejected', bb[0], aa[1])]:
                add(group, kind, a, b, axis, coordinate)
    return rows


def resource_bytes(world, script=None):
    payload = compact(dict(make_payload(world), script_evidence=script)); raw = payload.encode('utf-8')
    if len(raw) > PAYLOAD_LIMIT:
        raise ValueError('Variant payload budget')
    envelope = dict(schema=SCHEMA, version=1, generator=GENERATOR, map_id='WM0', source_sha256=source_hash(world.path),
                    coordinate_frame=['placed raw X', 'placed raw Z', 'raw Y'], normal_frame='original raw XYZ',
                    groups=[dict(id=i, alternatives=a, bases=b) for i, (a, b) in enumerate(GROUPS, 1)],
                    payload_bytes=len(raw), payload_sha256=sha(raw), payload=payload)
    result = compact(envelope).encode('utf-8')
    if len(result) > LIMIT:
        raise ValueError('Variant resource budget')
    return result


def safe_target(path, suffix, directory):
    path = Path(path).absolute(); target = output_path(path)
    if target != path or not target.is_relative_to(WORKSPACE_ROOT/directory) or target.suffix != suffix:
        raise ValueError(f'Choose a new private {directory}/*{suffix}')
    for ancestor in (path, *path.parents):
        if ancestor == WORKSPACE_ROOT:
            break
        reject_links(ancestor)
    if path.exists():
        raise ValueError('Output exists; choose a new filename')
    return path


def export_resource(source, target, script=None):
    target = safe_target(target, '.json', 'output/dev/current')
    before = source_hash(source); world, counts = load_source(source)
    evidence = world_script(script) if script else None
    data = resource_bytes(world, evidence); target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.variant-resource-', dir=target.parent) as temp:
        candidate = Path(temp)/target.name; candidate.write_bytes(data)
        if candidate.read_bytes() != data or source_hash(source) != before:
            raise ValueError('Source/candidate changed')
        safe_target(target, '.json', 'output/dev/current'); os.link(candidate, target)
    return dict(path=str(target), bytes=len(data), sha256=sha(data), source_sha256=before, source_counts=counts)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['resource', 'gis'])
    parser.add_argument('--source-map', type=Path, required=True)
    parser.add_argument('--world-lgp', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    if args.operation == 'resource':
        result = export_resource(args.source_map, args.output, args.world_lgp)
    else:
        try:
            from .world_variant_gis import export_gis
            result = export_gis(args.source_map, args.output)
        except ImportError:
            import sys
            import subprocess
            root = os.environ.get('GAIAGIS_QGIS_ROOT')
            if not root or sys.platform != 'win32' or getattr(sys, 'frozen', False):
                parser.exit(1, 'Variant GIS requires installed GDAL >= 3.9 Python; set GAIAGIS_QGIS_ROOT.\n')
            from .runtime import qgis_environment
            root = Path(root).resolve(); env = qgis_environment(root); env.pop('GAIAGIS_QGIS_ROOT', None)
            return subprocess.run([str(root/'bin/python.exe'), '-B', '-m', 'gaiagis', 'world-variants', 'gis',
                                   '--source-map', str(args.source_map.absolute()), '--output', str(args.output.absolute())],
                                  cwd=WORKSPACE_ROOT, env=env).returncode
    print(json.dumps(result, ensure_ascii=False))
    return 0
