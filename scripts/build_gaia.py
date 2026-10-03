"""Workspace launcher: use installed QGIS runtime without changing its files."""
import argparse
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"src"))
from gaiagis.safety import output_path

def qgis_environment(root):
    root = root.resolve()
    python_homes = sorted((root/"apps").glob("Python3*"))
    if len(python_homes)!=1 or not (root/"apps"/"qgis"/"python").is_dir():
        raise RuntimeError(f"Not a supported standalone OSGeo4W/QGIS layout: {root}")
    scratch = output_path(ROOT/"output"/"runtime")
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

def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--qgis-root",type=Path,default=Path(os.environ.get("GAIAGIS_QGIS_ROOT",r"C:\MYAPPLY\QGIS")))
    parser.add_argument("--test",action="store_true")
    args,remaining = parser.parse_known_args()
    runtime = args.qgis_root/"bin"/"python.exe"
    if not runtime.is_file():
        raise SystemExit("QGIS runtime unavailable; specify --qgis-root. No automatic installation performed.")
    command = [str(runtime),"-B"]
    if args.test:
        command += [str(ROOT/"scripts"/"test_sphere.py"),*remaining]
    else:
        command += ["-m","gaiagis","build-sphere",*remaining]
    return subprocess.call(command,cwd=ROOT,env=qgis_environment(args.qgis_root))

if __name__=="__main__":
    raise SystemExit(main())
