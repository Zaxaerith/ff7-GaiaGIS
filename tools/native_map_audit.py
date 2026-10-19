# SPDX-License-Identifier: GPL-3.0-only
"""Read-only real MAP/Native-v1 audit; writes a private, explicit QA oracle.

Uses a second raw mesh cursor and a shoelace/Fraction plane solver. No GIS writer
or Web math is used to establish expected attributes/metrics.
"""
import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import struct
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'src'))
from gaiagis.lzss import decompress
from gaiagis.map_reader import parse_map
from gaiagis.native_analysis import analyze_world
from gaiagis.safety import output_path, WORKSPACE_ROOT


def audit(source, binary, map_id):
    raw, packed = source.read_bytes(), binary.read_bytes()
    hlen = struct.unpack_from('<I', packed, 12)[0]
    header = json.loads(packed[16:16+hlen])
    sha = hashlib.sha256(raw).hexdigest()
    assert packed[:12] == b'GAIAMAP\0\1\0\0\0'
    assert header['mapId'] == f'WM{map_id}' and header['source_sha256'] == sha
    assert hashlib.sha256(packed[:-32]).digest() == packed[-32:]
    payload = packed[16+hlen:-32]
    assert hashlib.sha256(payload).hexdigest() == header['payload_sha256']
    world = parse_map(source, map_id)
    records, analysis = analyze_world(world)
    oracle, count, vertex_count = [], 0, 0
    for section in range(len(raw)//47104):
        for mesh in range(16):
            offset = struct.unpack_from('<I', raw, section*47104+mesh*4)[0]+section*47104
            length = struct.unpack_from('<I', raw, offset)[0]
            decoded = decompress(raw[offset+4:offset+4+length])
            nt, nv = struct.unpack_from('<HH', decoded)
            vector_start = 4+nt*12
            vertices = [struct.unpack_from('<hhhH', decoded, vector_start+i*8) for i in range(nv)]
            normals = [struct.unpack_from('<hhhH', decoded, vector_start+(nv+i)*8) for i in range(nv)]
            vertex_count += nv
            production_mesh = world.base_meshes[section*16+mesh]
            assert production_mesh.offset == offset-section*47104 and production_mesh.compressed_size == length
            for i, v in enumerate(vertices):
                assert tuple(getattr(production_mesh.vertices[i], k) for k in ('raw_x','raw_y','raw_z','padding')) == v
                assert tuple(getattr(production_mesh.normals[i], k) for k in ('raw_x','raw_y','raw_z','padding')) == normals[i]
            for tid in range(nt):
                t = struct.unpack_from('<10BH', decoded, 4+tid*12)
                grid_x = 3 if map_id == 2 else 2
                col, row = section % grid_x*4+mesh % 4, section//grid_x*4+mesh//4
                points = [(vertices[j][0]+8192*col, vertices[j][2]+8192*row, vertices[j][1]) for j in t[:3]]
                expected = tuple(x for p in points for x in p)+tuple(x for j in t[:3] for x in normals[j][:3])+(section, mesh, tid, t[10]&511, t[3]&31, (t[10]>>9)&31, t[3]>>5, (t[10]>>15)|((t[10]>>14)&1)<<1)+t[4:10]
                assert struct.unpack_from('<9i9h4H4B6B', payload, count*72) == expected
                x,z,h = zip(*points)
                d = sum(x[i]*z[(i+1)%3]-x[(i+1)%3]*z[i] for i in range(3))
                a = None if not d else Fraction(sum(h[i]*(z[(i+1)%3]-z[(i+2)%3]) for i in range(3)), d)
                b = None if not d else Fraction(sum(h[i]*(x[(i+2)%3]-x[(i+1)%3]) for i in range(3)), d)
                m = analysis['faces'][count]
                assert (m['determinant'], m['a'], m['b']) == (d, a, b)
                if d:
                    c = Fraction(h[0])-a*x[0]-b*z[0]
                    assert all(a*xx+b*zz+c == hh for xx,zz,hh in points)
                oracle.append(dict(points=points, terrain=t[3]&31, determinant=d, area=abs(d)/2,
                                   a=None if a is None else float(a), b=None if b is None else float(b),
                                   zero=m['zero_xz'], degenerate=m['degenerate_3d'], duplicate=m['duplicate_count'],
                                   incidence=m['edge_incidence'], component=m['component']))
                count += 1
    assert count == header['triangle_count'] == len(records) and len(payload) == count*72
    return dict(map=f'WM{map_id}', source_sha256=sha, native_sha256=hashlib.sha256(packed).hexdigest(),
                vertices=vertex_count, exact_records=count, summary=analysis['summary'], terrain=analysis['terrain'], oracle=oracle)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args=parser.parse_args()
    target=output_path(args.output)
    if not target.is_relative_to(WORKSPACE_ROOT/'output/dev/current') or target.exists():
        raise ValueError('Choose a new private QA JSON')
    reports=[audit(args.source_dir/f'wm{i}.map', args.workspace/f'gaia-map-WM{i}.bin', i) for i in (2,3)]
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(reports,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    print(json.dumps([{k:v for k,v in r.items() if k!='oracle'} for r in reports]))


if __name__=='__main__': main()
