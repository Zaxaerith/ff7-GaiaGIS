# SPDX-License-Identifier: GPL-3.0-only
"""Analytical periodic bucket only for proven PET-saturated net-import cells.

No extra spinup years or physical parameter change. Atmosphere/ET/melt stay
identical; solution is verified against the original monthly ET equation.
Accumulating ice is explicitly still out of equilibrium.
"""
import copy
import numpy as np
from ..grid import Grid
from ..v21.model import route_runoff,wetness
from .common import OUT,target,read,families,write_json,write_csv

def saturated_periodic_bucket(increments,capacity):
    increments=np.asarray(increments,float);prefix=np.cumsum(increments)
    if prefix[-1]<=0:raise ValueError('Analytic spill solution needs positive annual net input')
    start=capacity+prefix[-1]-max(0.,float(prefix.max()));state=start;stores=[];runoff=[]
    for flux in increments:
        water=state+flux
        if water<0:raise ValueError('Analytic trajectory exhausts storage')
        runoff.append(max(water-capacity,0));state=min(water,capacity);stores.append(state)
    if abs(state-start)>1e-8:raise ValueError('Not a periodic reflected bucket')
    return start,np.array(stores),np.array(runoff)

def run():
    grid=Grid(2.5);rows=[];diagnosis={}
    for family in families():
        name=family['name'];f=dict(np.load(OUT/f'soil/{name}_fields.npz'));diag=read(OUT/f'soil/{name}_diagnostics.json');s=family['config']['v21'];capacity=s['soil_capacity_mm'];critical=capacity*s['soil_critical_fraction'];t=f['monthly_temperature'];p=f['monthly_pet'];liquid=(t>0)
        selected=np.argwhere(abs(f['soil_year_drift'])>=s['soil_periodic_tolerance_mm']);details=[]
        for j,i in selected:
            et=f['monthly_land_et'][:,j,i];warm=liquid[:,j,i];saturated=bool(np.all(abs(et[warm]-p[:,j,i][warm])<1e-8))
            snow_delta=float(f['snow_year_drift'][j,i]);days=family['config']['planet']['orbital_days']/12
            fixed_melt=bool(np.all(abs(f['monthly_melt'][:,j,i][warm]-np.maximum(t[:,j,i][warm],0)*family['config']['moisture']['degree_day_melt_mm_k_day']*days)<1e-8))
            snow_forcing_repeatable=abs(snow_delta)<.05 or (snow_delta>0 and fixed_melt)
            if not saturated or not snow_forcing_repeatable:raise RuntimeError('Drift cause does not satisfy analytical repair conditions')
            increments=warm*f['monthly_precipitation'][:,j,i]+f['monthly_melt'][:,j,i]-et
            start,store,runoff=saturated_periodic_bucket(increments,capacity);before=np.r_[start,store[:-1]]
            beta=np.where(warm,p[:,j,i]/(critical+p[:,j,i]+1e-15),0);et_check=np.minimum(p[:,j,i],beta*(before+f['monthly_melt'][:,j,i]+warm*f['monthly_precipitation'][:,j,i]))
            if np.max(abs(et_check-et))>1e-8:raise RuntimeError('Periodic seed changes coupled ET, cannot use analytical repair')
            original_end=float(f['monthly_soil_storage'][-1,j,i]);original_drift=float(f['soil_year_drift'][j,i]);f['monthly_soil_storage'][:,j,i]=store;f['monthly_runoff'][:,j,i]=runoff;f['soil_year_drift'][j,i]=store[-1]-start
            details.append({'family':name,'lon':float(grid.lon[i]),'lat':float(grid.lat[j]),'original_soil_drift_mm':original_drift,'annual_net_liquid_import_mm':float(increments.sum()),'snow_drift_mm':snow_delta,'warm_month_et_equals_pet':saturated,'snow_melt_forcing_repeatable':snow_forcing_repeatable,'original_soil_end_mm':original_end,'periodic_soil_start_mm':float(start),'periodic_soil_end_mm':float(store[-1]),'new_runoff_mm':float(runoff.sum()),'new_soil_periodic_drift_mm':float(store[-1]-start)})
        rows.extend(details);diagnosis[name]={'cells_repaired':len(details),'cause':'PET-capped ET makes small positive net atmospheric/liquid import independent of storage; zero-initial bucket fills linearly until capacity. Weak includes growing SWE with fixed degree-day melt; medium top cell has periodic SWE.','details':details}
        if not len(details):continue
        f['annual_runoff']=f['monthly_runoff'].sum(axis=0);f['soil_moisture_fraction']=f['monthly_soil_storage'].mean(axis=0)/capacity
        routing,rdiag=route_runoff(grid,f['land_fraction'],f['elevation'],f['annual_runoff']);f.update(routing);f['wetness_index']=wetness(f['land_fraction'],f['elevation'],f['aridity_index'],f['soil_moisture_fraction'],routing)
        corrected=copy.deepcopy(diag);corrected.update(soil_periodic_drift_mm=float(abs(f['soil_year_drift']).max()),soil_converged=bool(abs(f['soil_year_drift']).max()<s['soil_periodic_tolerance_mm']),runoff_routing=rdiag,numerical_revision='v22_'+name+'_periodic_bucket',additional_spinup_years=0,physical_parameters_changed=False,snow_reservoir_equilibrated=False,analytical_bucket_cells=len(details))
        np.savez_compressed(target(OUT/f'soil/{name}_periodic_fields.npz'),**f);write_json(OUT/f'soil/{name}_periodic_diagnostics.json',corrected)
        print('Analytic bucket',name,len(details),corrected['soil_periodic_drift_mm'],flush=True)
    write_csv(OUT/'soil/periodic_bucket_repair.csv',rows);write_json(OUT/'soil/root_cause.json',diagnosis)
