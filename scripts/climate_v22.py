# SPDX-License-Identifier: GPL-3.0-only
"""Native runtime launcher, no WSL/platform/GCM probes or installations."""
import os,subprocess,sys
from pathlib import Path
from build_gaia import qgis_environment
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/climate_v22';temp=OUT/'temp';temp.mkdir(parents=True,exist_ok=True)
runtime=Path(os.environ.get('GAIAGIS_QGIS_ROOT',r'C:\MYAPPLY\QGIS'))
env=qgis_environment(runtime);env.update(TEMP=str(temp),TMP=str(temp),TMPDIR=str(temp),MPLCONFIGDIR=str(temp/'matplotlib'),OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1',QGIS_CUSTOM_CONFIG_PATH=str(temp/'qgis_profile'),GAIAGIS_SOURCE_ROOT=r'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition')
args=[str(ROOT/'scripts/climate_v22_check.py')] if sys.argv[1:]==['test'] else ['-m','gaiagis.climate.v22.pipeline',*sys.argv[1:]]
raise SystemExit(subprocess.call([str(runtime/'bin/python.exe'),'-B',*args],cwd=ROOT,env=env))
