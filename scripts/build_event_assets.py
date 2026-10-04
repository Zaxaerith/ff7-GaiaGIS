# SPDX-License-Identifier: GPL-3.0-only
"""Read-only local World Events extraction, never distributed as game data."""
import argparse
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.world_events import build_events

def main():
    parser=argparse.ArgumentParser(description='Generate private WM0 world events with bounded static analysis')
    parser.add_argument('--source',required=True,type=Path)
    parser.add_argument('--field-archive',type=Path)
    parser.add_argument('--output',type=Path,default=ROOT/'web/public/data/gaia-events.json')
    args=parser.parse_args();asset=build_events(args.source,args.output,args.field_archive)
    print(f"{len(asset['events'])} spatial events; {len(asset['unresolved'])} unresolved candidates")
    print(asset['extraction']['event_counts'])
    print(f'{args.output.stat().st_size} bytes; local-generated only')
if __name__=='__main__':main()
