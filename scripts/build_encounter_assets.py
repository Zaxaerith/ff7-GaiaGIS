# SPDX-License-Identifier: GPL-3.0-only
"""Generate optional private encounter data from read-only FF7 inputs."""
import argparse
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.encounters import build_encounters

def main():
    parser=argparse.ArgumentParser(description='Generate local world encounter GIS references, preserving V1 geometry')
    parser.add_argument('--source',required=True,type=Path)
    parser.add_argument('--output',type=Path,default=ROOT/'web/public/data/gaia-encounters.json')
    args=parser.parse_args();asset=build_encounters(args.source,args.output)
    print(f"{len(asset['regions'])} region groups; {len(asset['encounter_sets'])} sets; {sum(s['active'] for s in asset['encounter_sets'])} active")
    print(f'{args.output.stat().st_size} bytes; local-generated, not for public distribution')
if __name__=='__main__':main()
