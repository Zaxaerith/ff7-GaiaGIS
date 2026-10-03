"""Run invariant and artifact checks; keep Stage 0 test outputs intact."""
import argparse
import json
import os
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"src"))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source",type=Path)
    parser.add_argument("--unit-only",action="store_true")
    args = parser.parse_args()
    if args.source:
        os.environ["GAIAGIS_SOURCE_ROOT"] = str(args.source)
    output = ROOT/"output"/"reconstruction"
    output.mkdir(parents=True,exist_ok=True)
    suite = unittest.defaultTestLoader.discover(str(ROOT/"tests"),pattern="test_sphere.py" if args.unit_only else "test_*.py")
    with (output/"tests.log").open("w",encoding="utf-8") as stream:
        result = unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
    info = dict(tests=result.testsRun,failures=len(result.failures),errors=len(result.errors),skipped=len(result.skipped),successful=result.wasSuccessful())
    (output/"tests.json").write_text(json.dumps(info,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(info),flush=True)
    if not result.wasSuccessful():
        print((output/"tests.log").read_text(encoding="utf-8"),flush=True)
    return 0 if result.wasSuccessful() else 1

if __name__=="__main__":
    raise SystemExit(main())
