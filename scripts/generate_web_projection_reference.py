# SPDX-License-Identifier: GPL-3.0-only
"""One-time mathematical fixtures using Stage 1's custom CRS files, not game data."""
import json
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
if "--worker" not in sys.argv:
    from build_gaia import qgis_environment
    qgis=Path(r"C:\MYAPPLY\QGIS")
    raise SystemExit(subprocess.call([str(qgis/"bin"/"python.exe"),"-B",__file__,"--worker"],cwd=ROOT,env=qgis_environment(qgis)))
from osgeo import osr,gdal
osr.UseExceptions()
def crs(name):
    srs=osr.SpatialReference()
    srs.ImportFromWkt((ROOT/"crs"/f"gaia_{name}.wkt").read_text(encoding="utf-8"))
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return srs
geo=crs("geographic")
points=[(-180,0),(-165,70),(-120,-65),(-45,-60),(0,0),(15,40),(60,-20),(90,0),(179,80),(0,90),(0,-90)]
reference={"radius_m":6371008.8,"generated_by":"GDAL/PROJ using Stage 1 custom Gaia WKT2","gdal_version":gdal.VersionInfo("RELEASE_NAME"),"points":[]}
for lon,lat in points:
    item={"lon":lon,"lat":lat,"projections":{}}
    for name in ("equirectangular","mercator","mollweide","orthographic"):
        if name=="mercator" and abs(lat)>85.0511287798066:continue
        if name=="orthographic" and abs(lon)>90:continue
        xyz=osr.CoordinateTransformation(geo,crs(name)).TransformPoint(lon,lat,0)
        item["projections"][name]=list(xyz[:2])
    reference["points"].append(item)
destination=ROOT/"web"/"tests"/"fixtures"/"proj-reference.json"
destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(json.dumps(reference,indent=2)+"\n",encoding="utf-8")
print(destination)
