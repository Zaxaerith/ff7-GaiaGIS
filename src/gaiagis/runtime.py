"""Workspace launcher: use installed QGIS runtime without changing its files."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
from gaiagis.safety import output_path

def qgis_environment(root):
    root = root.resolve()
    python_homes = sorted((root/"apps").glob("Python3*"))
    if len(python_homes)!=1 or not (root/"apps"/"qgis"/"python").is_dir():
        raise RuntimeError(f"Not a supported standalone OSGeo4W/QGIS layout: {root}")
    scratch = Path(env_temp) if (env_temp := os.environ.get('TEMP')) else ROOT/'output/dev/current/qgis'
    if not scratch.resolve().is_relative_to(ROOT/'output'):
        scratch = ROOT/'output/dev/current/qgis'
    scratch = output_path(scratch)
    scratch.mkdir(parents=True,exist_ok=True)
    env = os.environ.copy()
    env.update(TEMP=str(scratch),TMP=str(scratch),TMPDIR=str(scratch),
               PYTHONDONTWRITEBYTECODE="1",PYTHONNOUSERSITE="1",PYTHONHOME=str(python_homes[0]),
               PYTHONPATH=os.pathsep.join((str(ROOT/"src"),str(root/"apps"/"qgis"/"python"))),
               QGIS_PREFIX_PATH=str(root/"apps"/"qgis"),QT_QPA_PLATFORM="offscreen",
               QT_PLUGIN_PATH=os.pathsep.join((str(root/"apps"/"qgis"/"qtplugins"),str(root/"apps"/"qt6"/"plugins"))),
               QGIS_CUSTOM_CONFIG_PATH=str(ROOT/"output"/"qgis_profile"),
               GDAL_DATA=str(root/"apps"/"gdal"/"share"/"gdal"),PROJ_DATA=str(root/"share"/"proj"),
               PROJ_NETWORK="OFF",PYTHONUTF8="1")
    env["PATH"] = os.pathsep.join((str(root/"bin"),str(root/"apps"/"qgis"/"bin"),str(root/"apps"/"qt6"/"bin"),env.get("PATH","")))
    return env
