# SPDX-License-Identifier: GPL-3.0-only
"""Native Windows V2.1 launcher; no platform/GCM probes or installations."""
import os,subprocess,sys
from pathlib import Path
from build_gaia import qgis_environment
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/climate_v21'
runtime=Path(os.environ.get('GAIAGIS_QGIS_ROOT',r'C:\MYAPPLY\QGIS'))
env=qgis_environment(runtime);temp=OUT/'temp';temp.mkdir(parents=True,exist_ok=True)
env.update(TEMP=str(temp),TMP=str(temp),TMPDIR=str(temp),MPLCONFIGDIR=str(temp/'matplotlib'),OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1',QGIS_CUSTOM_CONFIG_PATH=str(temp/'qgis_profile'),GAIAGIS_SOURCE_ROOT=r'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition')
if sys.argv[1:]==['probe']:
    args=['-c','import sys,numpy,scipy,shapely; from osgeo import gdal; print(sys.version); print(numpy.__version__,scipy.__version__,shapely.__version__,gdal.VersionInfo())']
elif sys.argv[1:]==['test']:args=[str(ROOT/'scripts/climate_v21_check.py')]
else:args=['-m','gaiagis.climate.v21.pipeline',*sys.argv[1:]]
raise SystemExit(subprocess.call([str(runtime/'bin/python.exe'),'-B',*args],cwd=ROOT,env=env))
