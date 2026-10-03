# SPDX-License-Identifier: GPL-3.0-only
import copy,json
import numpy as np
from ..grid import Grid
from .model import run_model,route_runoff,wetness
from .common import OUT,write_json,target
def run_synthetic():
    family=json.loads((OUT/'earth_benchmark/parameter_families.json').read_text())[1];c=copy.deepcopy(family['config']);g=Grid(10)
    lon,lat=np.meshgrid(g.lon,g.lat);continent=((abs(lon)<80)&(abs(lat)<65)).astype(float);h=np.zeros_like(lon)
    results={}
    for name,land,height in [('aquaplanet',h,h),('flat_continent',continent,h),('mountain_barrier',continent,3000*np.exp(-(lon/12)**2)*continent)]:
        fields,d=run_model(g,land,height,c);np.savez_compressed(target(OUT/f'synthetic/{name}.npz'),**fields)
        j=np.argmin(abs(g.lat-25));west=abs(g.lon+15)<11;east=abs(g.lon-15)<11
        results[name]={'diagnostics':d,'global_precipitation':g.mean(fields['annual_precipitation']),
          'land_precipitation':float(np.sum(fields['annual_precipitation']*land*g.area)/max(np.sum(land*g.area),1)),
          'wind_u_at_25':float(fields['prevailing_wind_u'][:,j].mean()),'west_flank_precipitation':float(fields['annual_precipitation'][j,west].mean()),'east_flank_precipitation':float(fields['annual_precipitation'][j,east].mean())}
        if name=='flat_continent':
            coast=(abs(lon)>50)&(continent>0);interior=(abs(lon)<20)&(continent>0)
            # Compare same tropical latitude band to isolate continentality.
            band=abs(lat)<20;results[name]['coastal_tropical_precipitation']=float(fields['annual_precipitation'][coast&band].mean());results[name]['interior_tropical_precipitation']=float(fields['annual_precipitation'][interior&band].mean())
    # Hydrological idealizations share uniform rainfall; isolate relief/routing.
    for name in ['closed_basin','coastal_plain','interior_continent']:
        land=continent.copy();height=land*500
        if name=='closed_basin':height=land*(200+800*np.exp(-((np.hypot(lon/1.5,lat)-25)/9)**2))
        elif name=='coastal_plain':height=land*np.maximum(0,600*(1-abs(lon)/80))
        else:height=land*600
        runoff=land*200;routed,d=route_runoff(g,land,height,runoff);soil=np.full_like(land,.5);ai=np.full_like(land,.8)
        index=wetness(land,height,ai,soil,routed)
        results[name]={'routing':d,'maximum_depression_depth':float(routed['depression_depth'].max()),'maximum_wetness':float(index.max()),'interior_wetness':float(index[(abs(lon)<15)&(abs(lat)<15)].mean()),'assumptions':'200 mm/year local runoff and uniform P/PET .8; routes to ocean spill outlets. Closed basin depression is diagnosed, not a lake volume simulation.'}
        np.savez_compressed(target(OUT/f'synthetic/{name}.npz'),land_fraction=land,elevation=height,wetness_index=index,**routed)
    results['status']='Diagnostic physics tests permitted after Earth evaluation; no Gaia evaluation unless Earth gate passes.'
    write_json(OUT/'synthetic/results.json',results);return results
