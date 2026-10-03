# SPDX-License-Identifier: GPL-3.0-only
import copy,json
import numpy as np
from ..climate_model import run_model as legacy_model
from ..energy_balance import energy_balance
from ..insolation import monthly_insolation
from ..classification import CLASSES
from .common import ROOT,OUT,config,write_json,write_csv,target
KEYS=['annual_temperature','annual_precipitation','snow_fraction','aridity_index','temperature_seasonality']
def proposals():return json.loads((ROOT/'config/climate/v21/physics_proposals.json').read_text())
def weighted_mean(x,w):return float(np.sum(x*w)/max(np.sum(w),1e-20))
def correlation(x,y,w):
    x=x-weighted_mean(x,w);y=y-weighted_mean(y,w)
    denom=np.sqrt(np.sum(w*x*x)*np.sum(w*y*y))
    return float(np.sum(w*x*y)/denom) if denom>0 else 0.
def major(classes):return np.array([0 if s=='Ocean' else 'ABCDE'.index(s[0])+1 for s in CLASSES])[classes]
def evaluate(grid,fields,reference,diagnostics):
    a=grid.area;land=a*reference['land_fraction'];metrics={};zonal=[]
    for name in KEYS:
        x=fields[name];y=reference[name];zx=np.mean(x,axis=1);zy=np.mean(y,axis=1)
        metrics[name]={'model_global_mean':weighted_mean(x,a),'reference_global_mean':weighted_mean(y,a),'model_land_mean':weighted_mean(x,land),'reference_land_mean':weighted_mean(y,land),
          'zonal_rmse':float(np.sqrt(weighted_mean((zx-zy)**2,grid.dx))),'pattern_correlation':correlation(x,y,a),'land_pattern_correlation':correlation(x,y,land),
          'zonal_correlation':correlation(zx,zy,grid.dx),'zonal_gradient_rmse_per_degree':float(np.sqrt(np.mean((np.gradient(zx,grid.lat)-np.gradient(zy,grid.lat))**2)))}
        for j,latitude in enumerate(grid.lat):zonal.append(dict(variable=name,latitude=float(latitude),model=float(zx[j]),reference=float(zy[j]),model_land=weighted_mean(x[j],land[j]),reference_land=weighted_mean(y[j],land[j])))
    select=(reference['land_fraction']>=.5);metrics['koppen_major_land_agreement']=weighted_mean((major(fields['koppen_class'])==major(reference['koppen_class'])).astype(float),land*select)
    metrics['koppen_exact_land_agreement']=weighted_mean((fields['koppen_class']==reference['koppen_class']).astype(float),land*select)
    def band(name,low,high,landonly=False):
        mask=((np.abs(grid.lat)>=low)&(np.abs(grid.lat)<high))[:,None];return weighted_mean(fields[name],mask*(land if landonly else a))
    structure={
      'tropical_minus_polar_temperature_c':band('annual_temperature',0,15)-band('annual_temperature',60,90),
      'tropical_minus_subtropical_precipitation_mm':band('annual_precipitation',0,15)-band('annual_precipitation',20,35),
      'midlatitude_minus_subtropical_precipitation_mm':band('annual_precipitation',40,60)-band('annual_precipitation',20,35),
      'highlatitude_minus_tropical_land_seasonality_c':band('temperature_seasonality',50,75,True)-band('temperature_seasonality',0,15,True)}
    # Broad land/ocean thermal contrast conditioned on latitude, avoids mixing climates.
    mask=((np.abs(grid.lat)>=35)&(np.abs(grid.lat)<60))[:,None]
    structure['midlatitude_land_minus_ocean_seasonality_c']=weighted_mean(fields['temperature_seasonality'],a*mask*reference['land_fraction'])-weighted_mean(fields['temperature_seasonality'],a*mask*(1-reference['land_fraction']))
    g=json.loads((ROOT/'config/climate/v21/earth_gate.json').read_text());t=metrics['annual_temperature'];p=metrics['annual_precipitation']
    checks={
      'temperature_global_bias':abs(t['model_global_mean']-t['reference_global_mean'])<=g['temperature_global_bias_max_c'],
      'temperature_land_bias':abs(t['model_land_mean']-t['reference_land_mean'])<=g['temperature_land_bias_max_c'],
      'temperature_zonal_rmse':t['zonal_rmse']<=g['temperature_zonal_rmse_max_c'],
      'temperature_pattern':t['pattern_correlation']>=g['temperature_pattern_correlation_min'],
      'precipitation_global_mean':g['precipitation_global_ratio_min']<=p['model_global_mean']/p['reference_global_mean']<=g['precipitation_global_ratio_max'],
      'precipitation_land_mean':g['precipitation_land_ratio_min']<=p['model_land_mean']/p['reference_land_mean']<=g['precipitation_land_ratio_max'],
      'precipitation_zonal_rmse':p['zonal_rmse']<=g['precipitation_zonal_rmse_max_mm'],
      'precipitation_pattern':p['pattern_correlation']>=g['precipitation_pattern_correlation_min'],
      'snow_pattern':metrics['snow_fraction']['land_pattern_correlation']>=g['snow_land_pattern_correlation_min'],
      'aridity_pattern':metrics['aridity_index']['land_pattern_correlation']>=g['aridity_land_pattern_correlation_min'],
      'koppen_major':metrics['koppen_major_land_agreement']>=g['koppen_major_land_agreement_min'],
      'warm_tropics':structure['tropical_minus_polar_temperature_c']>=g['tropical_minus_polar_temperature_min_c'],
      'wet_tropics':structure['tropical_minus_subtropical_precipitation_mm']>=g['tropical_minus_subtropical_precipitation_min_mm'],
      'midlatitude_rain_band':structure['midlatitude_minus_subtropical_precipitation_mm']>=g['midlatitude_minus_subtropical_precipitation_min_mm'],
      'seasonality':structure['highlatitude_minus_tropical_land_seasonality_c']>=g['highlatitude_minus_tropical_land_seasonality_min_c'],
      'ocean_moderation':structure['midlatitude_land_minus_ocean_seasonality_c']>0,
      'water_balance':diagnostics['water_balance_max_monthly_residual_mm']<=g['maximum_monthly_water_balance_residual_mm'],
      'soil_periodicity':diagnostics.get('soil_converged',True)}
    return {'metrics':metrics,'structures':structure,'gate_checks':checks,'gate_passed':all(checks.values()),'diagnostics':diagnostics},zonal
def thermal_calibration(grid,reference):
    """Fit EBM only to Earth. Mean A analytic; B/D chosen by Earth zonal error."""
    land=reference['land_fraction'];h=reference['elevation'];base=config();trials=[]
    q=monthly_insolation(grid.lat,base['planet']).mean(axis=0)[:,None]
    absorbed=grid.mean(q*(1-(land*.32+(1-land)*.30)))
    plan=proposals()
    for b in plan['thermal_b_w_m2_k']:
        for d in plan['thermal_d_w_m2_k']:
            c=copy.deepcopy(base);e=c['energy'];e['olr_b_w_m2_k']=b;e['meridional_diffusivity_w_m2_k']=d
            e['olr_a_w_m2']=absorbed-b*(grid.mean(reference['annual_temperature'])+e['lapse_k_per_m']*grid.mean(h))
            t,_,diag=energy_balance(grid,land,grid.coast_distance(land),c);t=t-e['lapse_k_per_m']*h
            annual=t.mean(axis=0);rmse=np.sqrt(weighted_mean((annual.mean(axis=1)-reference['annual_temperature'].mean(axis=1))**2,grid.dx))
            seas=np.sqrt(weighted_mean((np.ptp(t,axis=0)-reference['temperature_seasonality'])**2,grid.area*land))
            loss=float(rmse+plan['thermal_seasonality_loss_weight']*seas);trials.append(dict(b=b,d=d,a=e['olr_a_w_m2'],zonal_rmse=float(rmse),land_seasonality_rmse=float(seas),loss=loss,config=c))
    best=min(trials,key=lambda x:x['loss']);write_json(OUT/'earth_benchmark/thermal_calibration.json',{'method':'Earth mean fit analytically; 12 prespecified B/D pairs minimize Earth zonal temperature RMSE + 0.15 land seasonality RMSE; not independent validation','trials':[{k:v for k,v in x.items() if k!='config'} for x in trials],'best':{k:v for k,v in best.items() if k!='config'}})
    return best['config']
def run_earth():
    from .model import run_model
    grid=__import__('gaiagis.climate.grid',fromlist=['Grid']).Grid(2.5);reference=dict(np.load(OUT/'earth_benchmark/reference.npz'))
    old,diag=legacy_model(grid,reference['land_fraction'],reference['elevation'],config());metrics,z=evaluate(grid,old,reference,diag)
    write_json(OUT/'earth_benchmark/legacy_metrics.json',metrics);write_csv(OUT/'earth_benchmark/legacy_zonal.csv',z)
    np.savez_compressed(target(OUT/'earth_benchmark/legacy_fields.npz'),**old)
    print('Legacy Earth gate',metrics['gate_passed'],[k for k,v in metrics['gate_checks'].items() if not v],flush=True)
    base=thermal_calibration(grid,reference);families=[];allmetrics={}
    plan=proposals()
    for name,diff in plan['families'].items():
        c=copy.deepcopy(base);c['v21']={**plan['shared'],'eddy_diffusivity_m2_s':diff}
        fields,diag=run_model(grid,reference['land_fraction'],reference['elevation'],c);m,z=evaluate(grid,fields,reference,diag)
        families.append(dict(name=name,accepted=m['gate_passed'],config=c));allmetrics[name]=m
        write_json(OUT/f'earth_benchmark/{name}_metrics.json',m);write_csv(OUT/f'earth_benchmark/{name}_zonal.csv',z)
        np.savez_compressed(target(OUT/f'earth_benchmark/{name}_fields.npz'),**fields)
        print('Earth',name,m['gate_passed'],'failed',[k for k,v in m['gate_checks'].items() if not v],flush=True)
    write_json(OUT/'earth_benchmark/parameter_families.json',families)
    write_json(OUT/'earth_benchmark_metrics.json',{'legacy':metrics,'families':allmetrics,'accepted_family_count':sum(x['accepted'] for x in families),'gate_definition':'config/climate/v21/earth_gate.json','validation_caveat':'Earth data used for calibration and screening. This is in-sample; no held-out climate validation.'})
    rows=[]
    for name in allmetrics:
        import csv
        with (OUT/f'earth_benchmark/{name}_zonal.csv').open() as f:
            rows.extend([{'family':name,**r} for r in csv.DictReader(f)])
    write_csv(OUT/'earth_zonal_means.csv',rows)
    return families
