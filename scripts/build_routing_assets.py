# SPDX-License-Identifier: GPL-3.0-only
"""Generate private source-exact adjacency without changing the V1 mesh."""
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from gaiagis.routing import export_routing
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',required=True,type=Path);parser.add_argument('--output',type=Path,default=ROOT/'web/public/data/gaia-routing.bin');args=parser.parse_args()
print(json.dumps(export_routing(args.source,args.output),indent=2))
