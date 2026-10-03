# SPDX-License-Identifier: GPL-3.0-only
"""Use existing scientific Python/GDAL runtime; no installation or V1 writes."""
from pathlib import Path
import os,subprocess,sys
from build_gaia import qgis_environment
ROOT=Path(__file__).resolve().parents[1]
runtime=Path(os.environ.get('GAIAGIS_QGIS_ROOT',r'C:\MYAPPLY\QGIS'))
env=qgis_environment(runtime)
env.update(MPLCONFIGDIR=str(ROOT/'.cache/climate-matplotlib'),OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1')
command=[str(runtime/'bin/python.exe'),'-B']
if sys.argv[1:]==['probe']:
    command+=['-c',"import sys,numpy,scipy,matplotlib; from osgeo import gdal; import importlib.util; print(sys.version); print(numpy.__version__,scipy.__version__,matplotlib.__version__,gdal.VersionInfo()); print({m:bool(importlib.util.find_spec(m)) for m in ['netCDF4','xarray']})"]
elif sys.argv[1:] in [['test'],['test-all']]:
    if sys.argv[1:]==['test-all']:
        env['GAIAGIS_SOURCE_ROOT']=r'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition'
        command+=[str(ROOT/'scripts/climate_v2_check.py')]
    else:command+=['-m','unittest','discover','-s',str(ROOT/'tests'),'-p','test_climate*.py','-v']
elif sys.argv[1:]==['report']:
    command+=[str(ROOT/'scripts/climate_v2_report.py')]
else:command+=['-m','gaiagis.climate.pipeline',*sys.argv[1:]]
raise SystemExit(subprocess.call(command,cwd=ROOT,env=env))
