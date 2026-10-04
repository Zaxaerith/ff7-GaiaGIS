# SPDX-License-Identifier: GPL-3.0-only
import argparse
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.texture_pack import build_texture_pack

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Build optional local WM0 textures from your read-only FF7 installation')
    parser.add_argument('source',type=Path)
    parser.add_argument('--meta',type=Path,default=ROOT/'web/public/data/gaia-meta.json')
    parser.add_argument('--output',type=Path,default=ROOT/'output/v1_7/gaia-textures.bin')
    args=parser.parse_args()
    print(json.dumps(build_texture_pack(args.source,args.meta,args.output),indent=2))
