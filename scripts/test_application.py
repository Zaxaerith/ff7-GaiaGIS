"""Run application regressions without executing sealed climate research tests."""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'src'))
from gaiagis.safety import output_path


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'output/application-tests')
    args = parser.parse_args(argv)
    out = output_path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    os.environ['TEMP'] = os.environ['TMP'] = str(out)
    if args.source:
        os.environ['GAIAGIS_SOURCE_ROOT'] = str(args.source.resolve())
    else:
        os.environ.pop('GAIAGIS_SOURCE_ROOT', None)
    try:
        from osgeo import osr  # Required by the established projection regression.
    except ModuleNotFoundError:
        from build_gaia import qgis_environment
        qgis = Path(os.environ.get('GAIAGIS_QGIS_ROOT', r'C:\MYAPPLY\QGIS 4.2.2'))
        runtime = qgis / 'bin/python.exe'
        if not runtime.is_file():
            parser.error('Projection regressions need GDAL/QGIS; set GAIAGIS_QGIS_ROOT')
        resolved=['--output',str(out)]
        if args.source:resolved+=['--source',str(args.source.resolve())]
        return subprocess.call([str(runtime), '-B', str(Path(__file__).resolve()), *resolved],
                               cwd=ROOT, env=qgis_environment(qgis))
    suite = unittest.TestSuite()
    for path in sorted((ROOT / 'tests').glob('test_*.py')):
        if 'climate' not in path.name:
            suite.addTests(unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern=path.name))
    # The legacy CRS regression writes a tiny GPKG. Keep its original tests,
    # but isolate their generated fixtures from frozen Stage 1 evidence.
    import test_sphere
    from shutil import copyfile
    scratch = out / 'legacy-projection'
    (scratch / 'config').mkdir(parents=True, exist_ok=True)
    copyfile(ROOT / 'config/default.toml', scratch / 'config/default.toml')
    # Only these two routines generate files. Dataset regressions continue to
    # read the existing immutable V1 outputs; redirecting their module globally
    # would instead hide the authoritative GIS/GLB regression inputs.
    from functools import wraps
    def isolate(function):
        @wraps(function)
        def call(*args, **kwargs):
            previous = test_sphere.WORKSPACE_ROOT
            test_sphere.WORKSPACE_ROOT = scratch
            try:
                return function(*args, **kwargs)
            finally:
                test_sphere.WORKSPACE_ROOT = previous
        return call
    projection = test_sphere.ProjectionTests
    projection.setUpClass = classmethod(isolate(projection.setUpClass.__func__))
    projection.test_geopackage_creation_enables_wkt2_extension = isolate(
        projection.test_geopackage_creation_enables_wkt2_extension)
    with (out / 'tests.log').open('w', encoding='utf8') as stream:
        result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    report = dict(tests=result.testsRun, skipped=len(result.skipped),
                  failures=len(result.failures), errors=len(result.errors),
                  successful=result.wasSuccessful(), climate_tests_executed=0,
                  actual_source_enabled=bool(args.source))
    (out / 'tests.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    print(json.dumps(report), flush=True)
    if not result.wasSuccessful():
        print((out / 'tests.log').read_text(encoding='utf8'), flush=True)
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    raise SystemExit(main())
