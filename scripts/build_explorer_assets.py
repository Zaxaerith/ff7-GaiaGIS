"""Build a private optional Explorer pack from your read-only FF7 installation."""
# SPDX-License-Identifier: GPL-3.0-only
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from gaiagis.explorer_export import build_explorer
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('--output',type=Path,default=ROOT/'output/v1_9/gaia-explorer.bin');a=p.parse_args()
    r=build_explorer(a.source,a.output,a.output.with_suffix('.report.json'));print(json.dumps({k:r[k] for k in ('bytes','sha256','models','animations','textures','surface_stats')},indent=2))
