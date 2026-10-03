"""Final source check after artifact tests; never overwrites Stage 0 records."""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"src"))
from gaiagis.dataset import discover,fingerprint
from gaiagis.cli import write_json
from gaiagis.safety import output_path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source",type=Path,required=True)
    parser.add_argument("--output",type=Path,default=ROOT/"output")
    args = parser.parse_args()
    directory = output_path(args.output/"reconstruction")
    before = json.loads((directory/"source_before.json").read_text(encoding="utf-8"))
    after = fingerprint(discover(args.source))
    initial = {r["filename"]:r for r in before["files"]}
    comparison = []
    for row in after["files"]:
        old = initial.pop(row["filename"])
        comparison.append(dict(filename=row["filename"],before_size=old["size"],after_size=row["size"],
                               before_sha256=old["sha256"],after_sha256=row["sha256"],
                               unchanged=old["size"]==row["size"] and old["sha256"]==row["sha256"]))
    unchanged = not initial and all(r["unchanged"] for r in comparison)
    write_json(directory/"source_final.json",dict(before=before,after=after,comparison=comparison,
                                                 ff7_source_modified="NO" if unchanged else "SOURCE CHANGE DETECTED"))
    print(f"FF7 source modified: {'NO' if unchanged else 'SOURCE CHANGE DETECTED'}; {len(comparison)} fingerprints compared")
    return 0 if unchanged else 1

if __name__=="__main__":
    raise SystemExit(main())
