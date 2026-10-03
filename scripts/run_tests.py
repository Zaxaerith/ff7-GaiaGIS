"""Repeatable unittest runner with log, exit status, and workspace-only temp files."""
import argparse
import os
from pathlib import Path
import sys
import unittest
import io
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.cli import write_json
from gaiagis.safety import output_path

parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path)
args=parser.parse_args()
if args.source: os.environ['GAIAGIS_SOURCE_ROOT']=str(args.source.resolve())
os.environ['TEMP']=os.environ['TMP']=str(ROOT/'output'/'tmp')
buffer=io.StringIO()
suite=unittest.defaultTestLoader.discover(str(ROOT/'tests'))
result=unittest.TextTestRunner(stream=buffer,verbosity=2).run(suite)
log=buffer.getvalue()
output_path(ROOT/'output'/'validation'/'tests.log').write_text(log,encoding='utf-8')
write_json(ROOT/'output'/'validation'/'tests.json',dict(tests_run=result.testsRun,
    successful=result.wasSuccessful(),failures=len(result.failures),errors=len(result.errors),
    skipped=len(result.skipped),source_integration_enabled=bool(os.environ.get('GAIAGIS_SOURCE_ROOT'))))
print(log)
raise SystemExit(0 if result.wasSuccessful() else 1)
