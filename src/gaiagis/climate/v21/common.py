# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import csv, hashlib, json
import numpy as np
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'output/climate_v21'
def target(path):
    path=Path(path).resolve()
    if not path.is_relative_to(OUT.resolve()):raise ValueError(f'V2.1 output escapes isolation: {path}')
    path.parent.mkdir(parents=True,exist_ok=True)
    return path
def write_json(path,data):
    target(path).write_text(json.dumps(data,indent=2,allow_nan=False,default=lambda x:x.item() if isinstance(x,np.generic) else x.tolist())+'\n',encoding='utf-8')
def write_csv(path,rows):
    rows=list(rows)
    with target(path).open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def config():return json.loads((ROOT/'output/climate_v2/run-settings.json').read_text())['config']
def raster(path,grid,data,earth=False,unit='1'):
    from osgeo import gdal,osr
    ds=gdal.GetDriverByName('GTiff').Create(str(target(path)),grid.nx,grid.ny,1,gdal.GDT_Float32,options=['COMPRESS=DEFLATE','TILED=YES'])
    ds.SetGeoTransform((-180,360/grid.nx,0,90,0,-180/grid.ny))
    srs=osr.SpatialReference();srs.ImportFromEPSG(4326) if earth else srs.ImportFromWkt((ROOT/'crs/gaia_geographic.wkt').read_text())
    ds.SetProjection(srs.ExportToWkt());ds.SetMetadata({'STATUS':'V2.1 research only; not a formal Gaia climate mapping','BODY':'Earth' if earth else 'Gaia','UNITS':unit})
    band=ds.GetRasterBand(1);band.WriteArray(data[::-1]);band.SetUnitType(unit);ds.FlushCache();ds=None
