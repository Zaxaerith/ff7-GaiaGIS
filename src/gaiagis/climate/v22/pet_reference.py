# SPDX-License-Identifier: GPL-3.0-only
import json,tomllib,urllib.request
import numpy as np
from osgeo import gdal
from ..grid import Grid
from ..insolation import monthly_insolation
from ..v21.earth_data import remap
from ..v21.benchmark import correlation,weighted_mean
from .common import ROOT,OUT,V21,target,write_json,write_csv,digest,reference,families,raster
BASE='https://psl.noaa.gov/thredds/fileServer/Datasets/ncep.reanalysis.derived/surface_gauss/'
MET_FILES={'specific_humidity':('shum.2m.mon.ltm.1991-2020.nc','shum','kg/kg'),'pressure':('pres.sfc.mon.ltm.1991-2020.nc','pres','Pa'),'wind10':('wspd.10m.mon.ltm.1991-2020.nc','wspd','m/s'),'shortwave':('dswrf.sfc.mon.ltm.1991-2020.nc','dswrf','W/m^2')}
DAYS=np.array([31,28+8/30,31,30,31,30,31,31,30,31,30,31])
def rules():return tomllib.loads((ROOT/'config/climate/v22/aridity_validation.toml').read_text())
def saturation(t):return .6108*np.exp(17.27*t/(t+237.3))
def convert_units(key,values,unit):
    """Explicit documented NOAA humidity conversion; reject other mismatches."""
    expected=MET_FILES[key][2]
    if key=='specific_humidity' and unit=='grams/kg':return values/1000
    if key=='pressure' and unit=='Pascals':return values
    if unit!=expected:raise ValueError(f'{key}: expected {expected}, got {unit}')
    return values
def penman_monteith(t,tmin,tmax,pressure_kpa,q,u10,rs_mj_day,ra_mj_day,height):
    """FAO56 daily grass ET0 from monthly mean Earth meteorology, mm/day."""
    es=(saturation(tmin)+saturation(tmax))/2;ea=q*pressure_kpa/(.622+.378*q);vpd=np.maximum(es-ea,0)
    slope=4098*saturation(t)/(t+237.3)**2;gamma=.000665*pressure_kpa;u2=np.maximum(u10,0)*4.87/np.log(67.8*10-5.42)
    clear=(.75+2e-5*height)*ra_mj_day
    ratio=np.divide(rs_mj_day,clear,out=np.full_like(rs_mj_day,.333333),where=clear>1e-8);ratio=np.clip(ratio,.333333,1)
    longwave=4.903e-9*((tmax+273.16)**4+(tmin+273.16)**4)/2*np.maximum(.34-.14*np.sqrt(np.maximum(ea,0)),0)*(1.35*ratio-.35)
    net=.77*np.maximum(rs_mj_day,0)-longwave
    rate=(.408*slope*net+gamma*900/(t+273)*u2*vpd)/(slope+gamma*(1+.34*u2))
    return np.maximum(rate,0),{'net_radiation_mj_day':net,'vapor_pressure_kpa':ea,'wind2_m_s':u2,'vpd_kpa':vpd}
def load_nc(path,var,grid):
    ds=gdal.OpenEx(str(path),gdal.OF_MULTIDIM_RASTER);group=ds.GetRootGroup();a=group.OpenMDArray(var)
    if a is None:raise ValueError('Missing '+var+' in '+str(path))
    values=np.array(a.ReadAsArray(),dtype=float);nd=a.GetNoDataValueAsDouble()
    if nd is not None:values=np.where(values==nd,np.nan,values)
    values=values*(a.GetScale() if a.GetScale() is not None else 1)+(a.GetOffset() if a.GetOffset() is not None else 0)
    attrs={p.GetName():p.ReadAsString() for p in a.GetAttributes()};attrs['units']=a.GetUnit()
    values=remap(values,group.OpenMDArray('lat').ReadAsArray(),group.OpenMDArray('lon').ReadAsArray(),grid)
    return values,attrs
def valid_domain(ref,annual_pet,cfg):
    t=ref['monthly_temperature']
    return (ref['land_fraction']>=cfg['minimum_land_fraction'])&(annual_pet>=cfg['minimum_annual_reference_pet_mm'])&(ref['annual_temperature']>=cfg['minimum_reference_annual_temperature_c'])&(t.max(axis=0)>=cfg['minimum_reference_warmest_month_c'])&((t>cfg['monthly_frozen_temperature_c']).sum(axis=0)>=cfg['minimum_reference_thawed_months'])&(ref['snow_fraction']<=cfg['maximum_reference_snow_fraction'])
def bounded(p,pet):return np.divide(p,p+pet,out=np.zeros_like(p,dtype=float),where=(p+pet)>0)
def prepare():
    grid=Grid(2.5);ref=reference();cfg=rules();forcing={};records=[]
    for key,(name,var,unit) in MET_FILES.items():
        path=target(OUT/'earth/data'/name);url=BASE+name
        if not path.exists():
            with urllib.request.urlopen(url,timeout=90) as r:
                data=r.read(10_000_001)
                if len(data)>10_000_000:raise ValueError('Public input exceeds 10 MB file cap')
                path.write_bytes(data)
        values,attrs=load_nc(path,var,grid)
        values=convert_units(key,values,attrs['units'])
        forcing[key]=values;records.append({'role':'validation_only','variable':key,'url':url,'period':'1991-2020','source_resolution':'T62 Gaussian 94x192','target_resolution':'2.5 degree','units':unit,'sha256':digest(path),'size':path.stat().st_size,'metadata':attrs,'license':'US Government NCEP/NCAR; NOAA PSL disclaimer and attribution'})
        print('PM forcing',key,path.stat().st_size,flush=True)
    planet=families()[0]['config']['planet'];qtoa=np.broadcast_to(monthly_insolation(grid.lat,planet)[:,:,None],ref['monthly_temperature'].shape)*.0864
    # Reference height conditional on land; no Gaia height scale involved.
    height=np.divide(ref['elevation'],ref['land_fraction'],out=np.zeros_like(ref['elevation']),where=ref['land_fraction']>0)
    daily,intermediate=penman_monteith((ref['tmin']+ref['tmax'])/2,ref['tmin'],ref['tmax'],forcing['pressure']/1000,forcing['specific_humidity'],forcing['wind10'],forcing['shortwave']*.0864,qtoa,height)
    unmasked=daily*DAYS[:,None,None];monthly=np.where(ref['monthly_temperature']>cfg['monthly_frozen_temperature_c'],unmasked,0);annual=monthly.sum(axis=0);mask=valid_domain(ref,annual,cfg)
    np.savez_compressed(target(OUT/'earth/pet_reference.npz'),monthly_pet=monthly,annual_pet=annual,unmasked_monthly_pet=unmasked,valid_domain=mask,**intermediate)
    raster(OUT/'earth/pet_reference.tif',grid,annual,'mm year-1');raster(OUT/'earth/pet_valid_domain.tif',grid,mask.astype(float))
    write_json(OUT/'earth/pet_reference.json',{'formula':'FAO56 Eq6 / Eq47 / net shortwave Eq38 + longwave Eq39','meteorology':records,'shared_inputs':'Frozen V21 NCEP Tmin/Tmax/mean T, model orography, GPCP P; PM reference is independent of model PET, not independently observed ET','resampling':'Conservative sine-latitude/longitude overlap; nonlinear PM evaluated after coarse remap','assumptions':cfg,'monthly_days':DAYS.tolist(),'valid_land_area_fraction':weighted_mean(mask.astype(float),grid.area*ref['land_fraction']),'configuration_sha256':digest(ROOT/'config/climate/v22/aridity_validation.toml'),'design_sha256':digest(ROOT/'docs/climate/v22/validation-design.md')})
    rows=[];output={};weights=grid.area*ref['land_fraction'];p_ref=ref['annual_precipitation'];ratio_ref=p_ref/np.maximum(annual,1e-12)
    for family in families():
        f=dict(np.load(V21/f'earth_benchmark/{family["name"]}_fields.npz'));p=f['annual_precipitation'];model_pet=np.where(ref['monthly_temperature']>cfg['monthly_frozen_temperature_c'],f['monthly_pet'],0).sum(axis=0)
        # Same reference-frozen monthly mask: diagnostics cannot select cells
        # by each model outcome. Original unmasked PET comparison is also kept.
        ratio=p/np.maximum(model_pet,1e-12);w=weights*mask
        result={'primary_raw_ratio_r':correlation(ratio,ratio_ref,w),'primary_pass':False,'raw_all_land_r':correlation(p/np.maximum(f['monthly_pet'].sum(axis=0),1),p_ref/np.maximum(annual,1),weights),
          'P_minus_PET_r':correlation(p-model_pet,p_ref-annual,w),'bounded_r':correlation(bounded(p,model_pet),bounded(p_ref,annual),w),'model_pet_land_mean':weighted_mean(model_pet,w),'reference_pet_land_mean':weighted_mean(annual,w),'domain_land_fraction':weighted_mean(mask.astype(float),weights),'unmasked_model_pet_primary_r':correlation(p/np.maximum(f['monthly_pet'].sum(axis=0),1e-12),ratio_ref,w)}
        result['primary_pass']=result['primary_raw_ratio_r']>=cfg['primary_minimum_areaweighted_correlation'];output[family['name']]=result
        rows.append({'family':family['name'],**result})
    write_json(OUT/'earth/aridity_validation.json',{'primary':cfg['primary_metric'],'threshold':cfg['primary_minimum_areaweighted_correlation'],'families':output,'secondary_used_for_gate':False});write_csv(OUT/'earth/aridity_validation.csv',rows)
    return output
