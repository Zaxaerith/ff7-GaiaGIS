# SPDX-License-Identifier: GPL-3.0-only
"""Earth-only reservoir and controlled precipitation diagnostics."""
import numpy as np
from ..grid import Grid
from .common import OUT,V21,reference,families,target,write_json,write_csv
from .model import run_model

def reservoir_kind(temperature,snow_delta,soil_delta):
    if np.max(temperature)<=0 and snow_delta>0:return 'persistent_ice_accumulation_soil_inactive'
    if snow_delta>0.05:return 'snow_accumulating_with_seasonal_melt'
    if abs(soil_delta)>0.05:return 'soil_slow_or_nonperiodic'
    return 'soil_periodic'

def soil():
    grid=Grid(2.5);ref=reference();cells=[];history=[];summary={}
    for family in families():
        name=family['name'];f,diag=run_model(grid,ref['land_fraction'],ref['elevation'],family['config'])
        original=dict(np.load(V21/f'earth_benchmark/{name}_fields.npz'))
        differences={key:float(np.max(abs(f[key]-original[key]))) for key in ['monthly_precipitation','monthly_soil_storage','monthly_swe','annual_temperature']}
        if max(differences.values())>1e-8:raise RuntimeError('Instrumented baseline differs from frozen V21: '+str(differences))
        diag['baseline_max_absolute_differences']=differences
        np.savez_compressed(target(OUT/f'soil/{name}_fields.npz'),**f);write_json(OUT/f'soil/{name}_diagnostics.json',diag)
        for row in diag['reservoir_history']:history.append({'family':name,**row})
        order=np.argsort((abs(f['soil_year_drift'])*(ref['land_fraction']>0)).ravel())[-20:][::-1]
        for k in order:
            j,i=divmod(int(k),grid.nx);t=f['monthly_temperature'][:,j,i];sd=float(f['soil_year_drift'][j,i]);sn=float(f['snow_year_drift'][j,i]);prior=float(f['soil_previous_year_drift'][j,i])
            cells.append({'family':name,'lon':float(grid.lon[i]),'lat':float(grid.lat[j]),'land_fraction':float(ref['land_fraction'][j,i]),'temperature':float(t.mean()),'warmest_month':float(t.max()),'frozen_months':int((t<=0).sum()),'snow_end_mm':float(f['monthly_swe'][-1,j,i]),'snow_drift_mm':sn,'soil_end_mm':float(f['monthly_soil_storage'][-1,j,i]),'soil_drift_mm':sd,'previous_soil_drift_mm':prior,'annual_contraction_ratio':sd/prior if abs(prior)>1e-12 else 0.,'runoff_mm':float(f['annual_runoff'][j,i]),'precipitation_mm':float(f['annual_precipitation'][j,i]),'pet_mm':float(f['monthly_pet'][:,j,i].sum()),'actual_land_et_mm':float(f['monthly_land_et'][:,j,i].sum()),'melt_mm':float(f['monthly_melt'][:,j,i].sum()),'saturation_months':int((f['monthly_soil_storage'][:,j,i]>=149.999).sum()),'drainage_parent':int(f['drainage_parent'][j,i]),'kind':reservoir_kind(t,sn,sd)})
        summary[name]={'soil_converged':diag['soil_converged'],'soil_max_drift_mm':diag['soil_periodic_drift_mm'],'snow_max_drift_mm':float(abs(f['snow_year_drift']).max()),'snow_positive_drift_land_area_fraction':float(np.sum(grid.area*ref['land_fraction']*(f['snow_year_drift']>.05))/np.sum(grid.area*ref['land_fraction']))}
        print('Soil',name,summary[name],flush=True)
    write_csv(OUT/'soil/convergence_cells.csv',cells);write_csv(OUT/'soil/soil_vs_snow_drift.csv',history);write_json(OUT/'soil/summary.json',summary)

def precipitation():
    grid=Grid(2.5);ref=reference();strong=families()[2];baseline=dict(np.load(OUT/'soil/strong_fields.npz'));anchor=np.unravel_index(np.argmax(baseline['annual_precipitation']),baseline['annual_precipitation'].shape);rows=[]
    for term in [None,'orography','advection','eddy','rainout_latitude']:
        if term is None:f=baseline;diag=__import__('json').loads((OUT/'soil/strong_diagnostics.json').read_text())
        else:f,diag=run_model(grid,ref['land_fraction'],ref['elevation'],strong['config'],term)
        peak=np.unravel_index(np.argmax(f['annual_precipitation']),f['annual_precipitation'].shape)
        name=term or 'baseline';write_json(OUT/f'precipitation/{name}_diagnostics.json',diag)
        for location,(j,i) in [('baseline_extreme',anchor),('run_extreme',peak)]:
            p=float(f['annual_precipitation'][j,i]);e=float(f['monthly_evaporation'][:,j,i].sum());adv=float(f['monthly_advection_convergence'][:,j,i].sum());eddy=float(f['monthly_eddy_convergence'][:,j,i].sum())
            rows.append({'disabled_term':name,'location_role':location,'lon':float(grid.lon[i]),'lat':float(grid.lat[j]),'precipitation_mm':p,'baseline_precipitation_here_mm':float(baseline['annual_precipitation'][j,i]),'delta_mm':p-float(baseline['annual_precipitation'][j,i]),'evaporation_mm':e,'advection_convergence_mm':adv,'eddy_convergence_mm':eddy,'budget_residual_mm':p-e-adv-eddy,'orographic_rain_fraction':float(np.sum(f['monthly_orographic_rain_fraction'][:,j,i]*f['monthly_precipitation'][:,j,i])/p),'global_precipitation_mm':grid.mean(f['annual_precipitation']),'soil_converged':diag['soil_converged'],'excluded_from_family_acceptance':True,'excluded_from_gaia_scoring':True})
        print('Extreme diagnostic',name,float(f['annual_precipitation'][anchor]),flush=True)
    write_csv(OUT/'precipitation/extreme_attribution.csv',rows)
