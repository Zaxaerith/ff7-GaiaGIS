# SPDX-License-Identifier: GPL-3.0-only
"""Original regression assertions plus V21 tests; all fixtures isolated."""
import importlib,io,json,sys,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/climate_v21';scratch=OUT/'temp/regression';scratch.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tests'))
from gaiagis import safety
# test_core creates TEMP at import. Redirect just that import, then restore
# its policy root so original safety assertions still examine true workspace.
with patch.object(safety,'WORKSPACE_ROOT',scratch):core=importlib.import_module('test_core')
core.WORKSPACE_ROOT=ROOT
suite=unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern='test_*.py')
module=sys.modules['test_sphere'];cls=module.ProjectionTests
setup=cls.setUpClass.__func__;test=cls.test_geopackage_creation_enables_wkt2_extension
def isolated_setup(klass):
    with patch.object(module,'WORKSPACE_ROOT',scratch):setup(klass)
def isolated_test(self):
    with patch.object(module,'WORKSPACE_ROOT',scratch):test(self)
cls.setUpClass=classmethod(isolated_setup);cls.test_geopackage_creation_enables_wkt2_extension=isolated_test
buffer=io.StringIO();result=unittest.TextTestRunner(stream=buffer,verbosity=2).run(suite)
(OUT/'tests.log').write_text(buffer.getvalue(),encoding='utf-8')
summary={'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),'successful':result.wasSuccessful(),'fixture_root':str(scratch),'legacy_test_sources_modified':False}
(OUT/'tests.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');print(buffer.getvalue());print(json.dumps(summary));raise SystemExit(0 if result.wasSuccessful() else 1)
