# SPDX-License-Identifier: GPL-3.0-only
"""CLI static profile validation; optional read-only WM0 aggregate diagnostics."""
import argparse
from collections import Counter
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.traversal import PROFILES,STATES,evaluate
from gaiagis.safety import output_path


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,help='Optional FF7 installation/dataset root; read only')
    parser.add_argument('--output',type=Path,default=ROOT/'output/v1_3')
    args=parser.parse_args();out=output_path(args.output);out.mkdir(parents=True,exist_ok=True)
    matrix={p:[evaluate(p,t)['state'] for t in range(32)] for p in PROFILES}
    counts={p:{s:Counter(row)[s] for s in STATES} for p,row in matrix.items()}
    result=dict(profile='classic-pc-reference',runtime_equivalence='not-verified-steam2026',matrix=matrix,terrain_code_counts=counts)
    if args.source:
        from gaiagis.dataset import discover
        from gaiagis.map_reader import parse_map
        world=parse_map(discover(args.source).files['wm0.map'],0)
        triangles=[t for m in world.base_meshes for t in m.triangles]
        result['wm0']=dict(triangles=len(triangles),terrain_counts=dict(sorted(Counter(t.ff7_terrain_type for t in triangles).items())),
            script_counts=dict(sorted(Counter(t.script for t in triangles).items())),
            profiles={p:dict(Counter(evaluate(p,t.ff7_terrain_type,t.script)['state'] for t in triangles)) for p in PROFILES})
    (out/'statistics.json').write_text(json.dumps(result,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='matrix'},indent=2));return 0


if __name__=='__main__':raise SystemExit(main())
