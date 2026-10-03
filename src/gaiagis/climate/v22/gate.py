# SPDX-License-Identifier: GPL-3.0-only
"""Fixed-region holdout and side-by-side gates; never rank missing Gaia scores."""
import csv
import numpy as np
from ..grid import Grid
from ..v21.benchmark import evaluate,weighted_mean
from .common import ROOT,OUT,V21,read,reference,families,write_json,write_csv,digest

CALIBRATION_ROLES={'global_temperature','zonal_temperature','global_precipitation','zonal_precipitation','inherited_land_temperature_seasonality'}
VALIDATION_ROLES={'pm_reference','aridity','snow','koppen','regions'}
def assert_no_leakage(calibration,validation):
    overlap=set(calibration)&set(validation)
    if overlap:raise ValueError('Calibration/validation role leakage: '+str(sorted(overlap)))

def dataset_roles():
    """Only genuinely new meteorological inputs are validation-only files.

    NCEP temperature and terrain are shared covariates, not independent data.
    """
    calibration=[{'path':str(V21/'earth_benchmark/data'/name),'sha256':digest(V21/'earth_benchmark/data'/name)} for name in ['temperature.nc','precipitation.nc']]
    new=read(OUT/'earth/pet_reference.json')['meteorology']
    assert_no_leakage([r['sha256'] for r in calibration],[r['sha256'] for r in new])
    return {'calibration':calibration,'validation_only_meteorology':new,'shared_covariates':['NCEP mean temperature','NCEP Tmin/Tmax','Earth land mask and orography'],'parameter_retuning_in_v22':False,'statistical_independence':False,'prior_design_erratum':'Inherited V21 thermal loss also includes 0.15 times land temperature-seasonality RMSE. This supporting metric is not a fresh holdout.'}

def region_mask(grid,bbox):
    west,east,south,north=bbox
    return ((grid.lon>=west)&(grid.lon<east))[None,:]&((grid.lat>=south)&(grid.lat<north))[:,None]

def regime_checks(region,t,p,ai,snow):
    values={'temperature':t,'precipitation':p,'aridity':ai,'snow':snow};out={}
    for name,value in values.items():
        for direction,op in [('min',lambda x,y:x>=y),('max',lambda x,y:x<=y)]:
            key=f'{name}_{direction}'
            if key in region:out[key]=value is not None and bool(op(value,region[key]))
    return out

def regional_values(fields,pet,weights):
    mean_pet=weighted_mean(pet,weights)
    return {'temperature':weighted_mean(fields['annual_temperature'],weights),'precipitation':weighted_mean(fields['annual_precipitation'],weights),'aridity':weighted_mean(fields['annual_precipitation'],weights)/mean_pet if mean_pet>=100 else None,'snow':weighted_mean(fields['snow_fraction'],weights)}

def run():
    assert_no_leakage(CALIBRATION_ROLES,VALIDATION_ROLES)
    grid=Grid(2.5);ref=reference();aridity=read(OUT/'earth/aridity_validation.json');pm=dict(np.load(OUT/'earth/pet_reference.npz'));plan=read(ROOT/'config/climate/v22/regions.json');rows=[];results={}
    for family in families():
        name=family['name'];periodic=(OUT/f'soil/{name}_periodic_fields.npz').exists();stem=name+'_periodic' if periodic else name;fields=dict(np.load(OUT/f'soil/{stem}_fields.npz'));diag=read(OUT/f'soil/{stem}_diagnostics.json');old=read(V21/f'earth_benchmark/{name}_metrics.json');new,_=evaluate(grid,fields,ref,diag)
        passed=0;regional=[];pet=np.where(ref['monthly_temperature']>0,fields['monthly_pet'],0).sum(axis=0)
        for region in plan['regions']:
            weights=grid.area*ref['land_fraction']*region_mask(grid,region['bbox'])
            if weights.sum()<=0:raise ValueError('Region contains no land: '+region['name'])
            rv=regional_values(ref,pm['annual_pet'],weights);mv=regional_values(fields,pet,weights);rc=regime_checks(region,rv['temperature'],rv['precipitation'],rv['aridity'],rv['snow']);mc=regime_checks(region,mv['temperature'],mv['precipitation'],mv['aridity'],mv['snow'])
            supported=all(rc.values());ok=supported and all(mc.values());passed+=ok
            row={'family':name,'region':region['name'],'regime':region['regime'],'land_area_m2':float(weights.sum()),'reference_supports_regime':supported,'model_pass':ok,'reference_failed_checks':';'.join(k for k,v in rc.items() if not v),'model_failed_checks':';'.join(k for k,v in mc.items() if not v),**{'model_'+k:v for k,v in mv.items()},**{'reference_'+k:v for k,v in rv.items()}}
            rows.append(row);regional.append(row)
        new['gate_checks']['aridity_pattern']=aridity['families'][name]['primary_pass'];new['gate_checks']['regional_regimes']=passed>=plan['minimum_regions_passed'];new['gate_passed']=all(new['gate_checks'].values())
        results[name]={'evaluated_revision':diag.get('numerical_revision',name),'soil_periodic_drift_mm':diag['soil_periodic_drift_mm'],'snow_equilibrium_required_for_soil_gate':False,'old_gate_passed':old['gate_passed'],'old_failed_checks':[k for k,v in old['gate_checks'].items() if not v],'new_gate_passed':new['gate_passed'],'new_failed_checks':[k for k,v in new['gate_checks'].items() if not v],'new_gate_checks':new['gate_checks'],'primary_aridity':aridity['families'][name],'regions_passed':int(passed),'metrics':new['metrics'],'structures':new['structures']}
        print('Earth V22',name,new['gate_passed'],results[name]['new_failed_checks'],flush=True)
    count=sum(r['new_gate_passed'] for r in results.values());document={'families':results,'acceptable_family_count':count,'earth_gate_passed':count>=3,'calibration_roles':sorted(CALIBRATION_ROLES),'validation_roles':sorted(VALIDATION_ROLES),'leakage':'No V22 calibration/retuning; shared NCEP temperature means metric-role holdout, not independent-observation holdout','snow_koppen_caveat':'Already seen in V21; retained diagnostics, not newly unseen validation','region_design_sha256':digest(ROOT/'config/climate/v22/regions.json'),'validation_design_sha256':digest(ROOT/'docs/climate/v22/validation-design.md'),'old_gate_preserved':True,'thresholds_lowered':False}
    write_json(OUT/'earth/heldout_metrics.json',document);write_csv(OUT/'earth/regional_validation.csv',rows)
    write_json(OUT/'earth/dataset_roles.json',dataset_roles())
    if count<3:
        with (V21/'candidate_ensemble.csv').open(encoding='utf-8') as f:ensemble=list(csv.DictReader(f))
        # Every inherited scenario is still blocked; no climate values are copied.
        for row in ensemble:
            if row.get('status')!='not_run_earth_gate_failed':raise ValueError('Unexpected frozen ensemble status')
        write_csv(OUT/'gaia_ensemble/scenario_manifest.csv',ensemble)
        write_json(OUT/'gaia_ensemble/conclusion.json',{'status':'not_run_earth_gate_failed','scenarios':len(ensemble),'acceptable_earth_families':count,'pareto':'not_computed_missing_scores','balanced_candidate':None,'formal_v2_mapping':False,'conclusion':'No physically robust V2 mapping yet.'})
    else:raise RuntimeError('Earth eligibility established: ensemble phase must now be implemented before completion')
    return document
