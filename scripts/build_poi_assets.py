# SPDX-License-Identifier: GPL-3.0-only
"""Generate private POI JSON using only read-only FF7 inputs."""
import argparse
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.poi import build_poi

def main():
    parser=argparse.ArgumentParser(description='Generate local V1 world entrance locations; does not modify V1 mesh')
    parser.add_argument('--source',required=True,type=Path)
    parser.add_argument('--field-archive',type=Path,help='English flevel.lgp override for extracted layouts')
    parser.add_argument('--output',type=Path,default=ROOT/'web/public/data/gaia-poi.json')
    args=parser.parse_args()
    asset=build_poi(args.source,args.output,args.field_archive)
    print(f"{len(asset['locations'])} locations; {len(asset['entrances'])} entrances; {len(asset['unresolved'])} unresolved records")
    print(f'{args.output.stat().st_size} bytes; local-generated data, not for public distribution')
if __name__=='__main__':main()
