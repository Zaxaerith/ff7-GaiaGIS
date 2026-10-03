# SPDX-License-Identifier: GPL-3.0-only
"""Small, checksum recorded public climatologies; no full reanalysis downloads."""
import urllib.request,zipfile,json
import numpy as np
from osgeo import gdal,ogr
from shapely.geometry import shape,box
from shapely.ops import transform
from ..geography import overlap_matrix
from ..insolation import monthly_insolation
from ..classification import koppen
from .common import OUT,target,write_json,digest,config
DATA=OUT/'earth_benchmark/data'
BASE='https://psl.noaa.gov/thredds/fileServer/Datasets/'
FILES={
 'land.zip':('https://naturalearth.s3.amazonaws.com/110m_physical/ne_110m_land.zip','Natural Earth 110m land','Public domain','vector 1:110m'),
 'height.nc':(BASE+'ncep.reanalysis.derived/surface/hgt.sfc.nc','NCEP/NCAR model orography','US Government data; NOAA PSL disclaimer','2.5 degree nodal'),
 'temperature.nc':(BASE+'ncep.reanalysis.derived/surface_gauss/air.2m.mon.ltm.1991-2020.nc','NCEP/NCAR 2m temperature 1991-2020','US Government data; NOAA PSL disclaimer','T62 Gaussian 94x192'),
 'tmax.nc':(BASE+'ncep.reanalysis.derived/surface_gauss/tmax.2m.mon.ltm.1991-2020.nc','NCEP/NCAR mean daily Tmax 1991-2020','US Government data; NOAA PSL disclaimer','T62 Gaussian 94x192'),
 'tmin.nc':(BASE+'ncep.reanalysis.derived/surface_gauss/tmin.2m.mon.ltm.1991-2020.nc','NCEP/NCAR mean daily Tmin 1991-2020','US Government data; NOAA PSL disclaimer','T62 Gaussian 94x192'),
 'precipitation.nc':(BASE+'gpcp/precip.mon.ltm.1991-2020.nc','GPCP monthly precipitation V2.3 1991-2020','NOAA PSL hosted; GPCP acknowledgement required','2.5 degree cell means'),
 'snow.nc':(BASE+'ncep.reanalysis.derived/surface_gauss/weasd.sfc.mon.ltm.1981-2010.nc','NCEP/NCAR snow water equivalent 1981-2010','US Government data; NOAA PSL disclaimer','T62 Gaussian 94x192')}
def download():
    records=[]
    for name,(url,dataset,license,resolution) in FILES.items():
        path=target(DATA/name)
        if not path.exists():
            with urllib.request.urlopen(url,timeout=90) as response:
                data=response.read(10_000_001)
                if len(data)>10_000_000:raise RuntimeError('Individual public input exceeds 10 MB cap')
                path.write_bytes(data)
        print('Earth input',name,path.stat().st_size,flush=True)
        records.append(dict(filename=name,dataset=dataset,url=url,license=license,resolution=resolution,size=path.stat().st_size,sha256=digest(path)))
    with zipfile.ZipFile(DATA/'land.zip') as archive:
        versions=[archive.read(n).decode('utf-8').strip() for n in archive.namelist() if 'VERSION' in n.upper()]
        for record in records:
            if record['filename']=='land.zip':record['version']=versions
    write_json(DATA/'provenance.json',{'inputs':records,'license_sources':['https://www.naturalearthdata.com/about/terms-of-use/','https://psl.noaa.gov/disclaimer/'],
      'resampling':'Conservative latitude/longitude overlap for climatology; Natural Earth polygons clipped in (longitude radians,sin latitude), with densified boundary edges.',
      'topography_limitation':'Model-smoothed NCEP orography, public compact equivalent; not ETOPO or an independently observed DEM.',
      'snow_limitation':'1981-2010 SWE compared with 1991-2020 temperature/precipitation. Different period and model snow physics; not independent observed snow cover.',
      'aridity_limitation':'Reference PET derived with FAO56 Hargreaves from NCEP Tmin/Tmax and astronomical radiation; not observed PET.'})
def read_nc(name,variable):
    ds=gdal.OpenEx(str(DATA/name),gdal.OF_MULTIDIM_RASTER);group=ds.GetRootGroup();a=group.OpenMDArray(variable)
    if a is None:raise ValueError(f'{name}: missing variable {variable}; arrays {group.GetMDArrayNames()}')
    values=np.asarray(a.ReadAsArray(),float);scale=a.GetScale();offset=a.GetOffset();nodata=a.GetNoDataValueAsDouble()
    if nodata is not None:values=np.where(values==nodata,np.nan,values)
    values=values*(1 if scale is None else scale)+(0 if offset is None else offset)
    attributes={attr.GetName():attr.ReadAsString() for attr in a.GetAttributes()}
    attributes['units']=a.GetUnit()
    lat=group.OpenMDArray('lat').ReadAsArray();lon=group.OpenMDArray('lon').ReadAsArray()
    return values,lat,lon,attributes
def remap(values,lat,lon,grid):
    lat=np.asarray(lat);lon=(np.asarray(lon)+180)%360-180
    iy=np.argsort(lat);ix=np.argsort(lon);values=values[...,iy,:][...,ix];lat=lat[iy];lon=lon[ix]
    edges=np.r_[-90,(lat[:-1]+lat[1:])/2,90]
    sy=np.sin(np.deg2rad(edges));wy=overlap_matrix(sy,grid.xe)
    step=np.median(np.diff(lon));sx=np.deg2rad(np.r_[lon-step/2,lon[-1]+step/2])
    wx=sum(overlap_matrix(sx+s,np.deg2rad(grid.lon_edges)) for s in [-2*np.pi,0,2*np.pi])
    if not np.isfinite(values).all():raise ValueError('Missing Earth climatology values; no silent infill')
    return np.einsum('ys,...st,xt->...yx',wy,values,wx,optimize=True)/(grid.dx[:,None]*grid.dlambda)
def land_mask(grid):
    # OGR reads the zip in place; no extraction or files outside V21.
    ds=ogr.Open('/vsizip/'+str(DATA/'land.zip').replace('\\','/')+'/ne_110m_land.shp');layer=ds.GetLayer(0)
    fraction=np.zeros_like(grid.area);total=0
    for feature in layer:
        geom=shape(json.loads(feature.GetGeometryRef().ExportToJson())).segmentize(.25)
        geom=transform(lambda x,y,z=None:(np.deg2rad(x),np.sin(np.deg2rad(y))),geom)
        total+=geom.area*grid.radius**2
        x0,y0,x1,y1=geom.bounds
        js=range(max(0,np.searchsorted(grid.xe,y0)-1),min(grid.ny,np.searchsorted(grid.xe,y1)+1))
        ls=np.deg2rad(grid.lon_edges)
        ins=range(max(0,np.searchsorted(ls,x0)-1),min(grid.nx,np.searchsorted(ls,x1)+1))
        for j in js:
            for i in ins:fraction[j,i]+=geom.intersection(box(ls[i],grid.xe[j],ls[i+1],grid.xe[j+1])).area*grid.radius**2/grid.area[j,i]
    if fraction.max()>1+1e-6:raise ValueError('Earth land polygons overlap')
    return fraction,{'polygon_area_m2':total,'raster_area_m2':float(np.sum(fraction*grid.area)),'relative_error':abs(np.sum(fraction*grid.area)-total)/total}
def prepare(grid):
    download();land,audit=land_mask(grid)
    fields={};metadata={}
    for key,name,var in [('monthly_temperature','temperature.nc','air'),('tmax','tmax.nc','tmax'),('tmin','tmin.nc','tmin'),('height','height.nc','hgt'),('monthly_precipitation','precipitation.nc','precip'),('monthly_swe','snow.nc','weasd')]:
        v,lat,lon,attrs=read_nc(name,var);v=remap(v,lat,lon,grid);metadata[key]=attrs
        units=attrs.get('units','')
        if key in ['monthly_temperature','tmax','tmin']:
            if units.lower() not in ['k','degk','kelvin']:raise ValueError(f'Unexpected temperature units {units}')
            v-=273.15
        fields[key]=v.squeeze()
    # Exact mean Gregorian month lengths in these 30 years.
    days=np.array([31,28+8/30,31,30,31,30,31,31,30,31,30,31])
    if metadata['monthly_precipitation'].get('units')!='mm/day':raise ValueError('Precipitation units mismatch')
    fields['monthly_precipitation']*=days[:,None,None]
    height=np.maximum(0,fields.pop('height'))*land
    q=np.broadcast_to(monthly_insolation(grid.lat,config()['planet'])[:,:,None],fields['monthly_temperature'].shape)
    fields['monthly_pet']=.0023*np.maximum(0,fields['monthly_temperature']+17.8)*np.sqrt(np.maximum(fields['tmax']-fields['tmin'],0))*q*86400/1e6*.408*days[:,None,None]
    fields['annual_temperature']=np.average(fields['monthly_temperature'],axis=0,weights=days)
    fields['annual_precipitation']=fields['monthly_precipitation'].sum(axis=0)
    fields['aridity_index']=fields['annual_precipitation']/np.maximum(fields['monthly_pet'].sum(axis=0),1)
    fields['snow_fraction']=np.mean(fields['monthly_swe']>=10,axis=0)*(land>0)
    fields['temperature_seasonality']=np.ptp(fields['monthly_temperature'],axis=0)
    fields['koppen_class']=koppen(fields['monthly_temperature'],fields['monthly_precipitation'],grid.lat,land)
    fields['land_fraction']=land;fields['elevation']=height
    np.savez_compressed(target(OUT/'earth_benchmark/reference.npz'),**fields)
    write_json(OUT/'earth_benchmark/reference_metadata.json',{'variables':metadata,'mask_audit':audit,'snow_threshold_mm_swe':10,'reference_koppen':'Derived with same documented classifier from reference monthly T/P, not an independent Koppen map','pet_source':'FAO56 Hargreaves Eq52; radiation converted from MJ to equivalent mm before use','mean_month_days':days.tolist()})
    return fields
