# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import csv,hashlib,json
import numpy as np
ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'output/climate_v22';V21=ROOT/'output/climate_v21'
def target(path):
    path=Path(path).resolve()
    if not path.is_relative_to(OUT.resolve()):raise ValueError('V22 output escapes isolation: '+str(path))
    path.parent.mkdir(parents=True,exist_ok=True);return path
def read(path):return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def write_json(path,value):target(path).write_text(json.dumps(value,indent=2,allow_nan=False,default=lambda x:x.item() if isinstance(x,np.generic) else x.tolist())+'\n',encoding='utf-8')
def write_csv(path,rows):
    rows=list(rows)
    if not rows:raise ValueError('Empty CSV requires an explicit schema')
    with target(path).open('w',encoding='utf-8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
def reference():return dict(np.load(V21/'earth_benchmark/reference.npz'))
def families():return read(V21/'earth_benchmark/parameter_families.json')
def raster(path,grid,data,unit='1',earth=True):
    from osgeo import gdal,osr
    ds=gdal.GetDriverByName('GTiff').Create(str(target(path)),grid.nx,grid.ny,1,gdal.GDT_Float32,options=['COMPRESS=DEFLATE','TILED=YES'])
    ds.SetGeoTransform((-180,360/grid.nx,0,90,0,-180/grid.ny));srs=osr.SpatialReference()
    srs.ImportFromEPSG(4326) if earth else srs.ImportFromWkt((ROOT/'crs/gaia_geographic.wkt').read_text())
    ds.SetProjection(srs.ExportToWkt());ds.SetMetadata({'STATUS':'V22 research diagnostic','BODY':'Earth' if earth else 'Gaia','UNIT':unit});band=ds.GetRasterBand(1);band.WriteArray(data[::-1]);band.SetUnitType(unit);ds.FlushCache();ds=None
