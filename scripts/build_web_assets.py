# SPDX-License-Identifier: GPL-3.0-only
import argparse
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"src"))
from gaiagis.web_export import build_web_assets

def main():
    parser = argparse.ArgumentParser(description="Export Stage 1 Geographic data to local Web assets")
    parser.add_argument("--stage1",type=Path,default=ROOT/"output")
    parser.add_argument("--output",type=Path,default=ROOT/"web"/"public"/"data")
    args = parser.parse_args()
    meta = build_web_assets(args.stage1,args.output)
    print(f"Gaia Web v{meta['version']}: {meta['vertex_count']} vertices; {meta['triangle_count']} triangles; {meta['byte_length']} bytes")
    print(f"Max Float32 spherical error: {meta['maximum_cartesian_quantization_error_m']:.6f} m; local only")

if __name__=="__main__":
    main()
