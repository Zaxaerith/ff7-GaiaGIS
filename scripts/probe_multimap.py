# SPDX-License-Identifier: GPL-3.0-only
"""Read-only native multi-map research, deliberately without periodic welding."""
from collections import Counter, defaultdict
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from gaiagis.dataset import discover, fingerprint
from gaiagis.map_reader import parse_map
from gaiagis.analysis import geometry_summary, boundary_edges, compare_boundaries
from gaiagis.lgp import inventory, read_entry
from gaiagis.world_events import analyze_ev
from gaiagis.texture_pack import catalog
from gaiagis.tex import decode_tex


def native_topology(world):
    edges, faces = Counter(), Counter()
    horizontal_heights = defaultdict(set)
    for mesh in world.base_meshes:
        for tri in mesh.triangles:
            points = tuple(mesh.position(i) for i in tri.indices)
            faces[tuple(sorted(points))] += 1
            for x, z, h in points:
                horizontal_heights[x, z].add(h)
            for a, b in ((0, 1), (1, 2), (2, 0)):
                edges[tuple(sorted((points[a], points[b])))] += 1
    bounds = boundary_edges(world.base_meshes, *world.extent)
    seams = dict(west_east=compare_boundaries(bounds['west'], bounds['east']),
                 north_south=compare_boundaries(bounds['low_north'], bounds['high_north']))
    resources={r['id']:r for r in catalog(f'WM{world.map_id}')}
    for axis,left,right in [('west_east','west','east'),('north_south','low_north','high_north')]:
        comparable=equal=0
        for key,a in bounds[left].items():
            b=bounds[right].get(key,[])
            if len(a)!=1 or len(b)!=1 or a[0]['texture']!=b[0]['texture']:continue
            r=resources.get(a[0]['texture'])
            if not r:continue
            comparable+=1
            def wrapped(record):
                return tuple(((u-r['u_offset'])%r['width'],(v-r['v_offset'])%r['height']) for u,v in record['uv'])
            equal+=wrapped(a[0])==wrapped(b[0])
        seams[axis]['wrapped_uv_equal']=equal
        seams[axis]['wrapped_uv_comparable']=comparable
    return dict(exact_native_edges=len(edges), incidence=dict(Counter(edges.values())),
                boundary_edges=sum(n == 1 for n in edges.values()),
                non_manifold_edges=sum(n > 2 for n in edges.values()),
                collapsed_edges=sum(a == b for a, b in edges),
                duplicate_face_excess=sum(n - 1 for n in faces.values()),
                horizontal_positions_with_multiple_heights=sum(len(h) > 1 for h in horizontal_heights.values()),
                opposite_boundaries=seams,
                geometric_periodicity={axis: bool(s['segments_a'] and s['segments_b'] and s['match_ratio'] == 1)
                                       for axis, s in seams.items()},
                warning='Exact native position incidence is diagnostic; no modulo wrap or inferred adjacency.')


def main():
    parser=argparse.ArgumentParser(description='Read-only native MAP topology and source inventory probe')
    parser.add_argument('source',type=Path)
    parser.add_argument('--protected-manifest',type=Path,help='Optional previous workspace fingerprint manifest')
    args=parser.parse_args()
    source = args.source
    out = ROOT / 'output/v1_8'
    out.mkdir(parents=True, exist_ok=True)
    ds = discover(source)
    def save(name, value):
        (out / name).write_text(json.dumps(value, indent=2, sort_keys=True), encoding='utf8')
    before = out / 'source-before.json'
    if not before.exists():
        save(before.name, fingerprint(ds))
    lgp = ds.files['world_us.lgp']
    entries = {e['filename'].casefold(): e for e in inventory(lgp)['entries']}
    results = {}
    for map_id in (0, 2, 3):
        name = f'wm{map_id}'
        world = parse_map(ds.files[name + '.map'], map_id)
        result = dict(summary=geometry_summary(world), topology=native_topology(world))
        result['source_sha256'] = hashlib.sha256(world.path.read_bytes()).hexdigest()
        ev = read_entry(lgp, entries[name + '.ev'])
        analysis = analyze_ev(ev,map_id=f'WM{map_id}')
        result['summary']['normal_records_base']=sum(len(m.normals) for m in world.base_meshes)
        result['ev'] = dict(bytes=len(ev), sha256=hashlib.sha256(ev).hexdigest(),
                            functions=len(analysis['functions']), opcode_inventory=analysis['opcode_inventory'],
                            observations=analysis['observations'], unresolved=analysis['unresolved'],
                            call_graph=analysis['call_graph'])
        save(name + '-research.json', result)
        results[name] = dict(triangles=result['summary']['triangles_base'],
                             meshes=result['summary']['base_meshes'],
                             extent=result['summary']['extent'],
                             topology={k: v for k, v in result['topology'].items() if k != 'opposite_boundaries'},
                             ev_functions=result['ev']['functions'])
    save('inventory-summary.json', results)
    textures={}
    for identity in ('WM2','WM3'):
        textures[identity]=[]
        for resource in catalog(identity):
            image=decode_tex(read_entry(lgp,entries[resource['name']+'.tex']))
            textures[identity].append(dict(resource,format=image.metadata,alpha=dict(Counter(image.rgba[3::4]))))
    save('texture-inventory.json',textures)
    manifest=args.protected_manifest or ROOT/'output/v1_6/before.json'
    if args.protected_manifest and not manifest.exists():
        parser.error(f'Protected manifest not found: {manifest}')
    if manifest.exists():
        protected=json.loads(manifest.read_text(encoding='utf8'))
        changed=[p for p,v in protected.items() if not Path(p).exists() or hashlib.sha256(Path(p).read_bytes()).hexdigest()!=v['sha256']]
        save('preservation.json',dict(checked=len(protected),changed=changed,status='compared'))
    else:
        save('preservation.json',dict(checked=0,changed=None,status='unavailable; previous manifest not provided'))
        print('Protected workspace manifest unavailable; source fingerprints are still recorded.',file=sys.stderr)
    save('source-after.json',fingerprint(ds))
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
