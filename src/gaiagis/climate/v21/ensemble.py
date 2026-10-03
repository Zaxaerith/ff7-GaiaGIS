# SPDX-License-Identifier: GPL-3.0-only
"""Four fixed mappings; physics gate cannot be bypassed by a Gaia score."""
import copy,json,itertools
import numpy as np
from .common import OUT,ROOT,target,write_json,write_csv,raster
from .rasterization import mappings
from .model import run_model,extremes
from .benchmark import weighted_mean
from ..evidence import sigmoid
SCALES=[.5,.75,1.,1.5,2.]
SCHEMES=['default','equal_high','reduced_swamp']
def evidence(fields,weights):
    t=fields['monthly_temperature'];p=fields['annual_precipitation'];ai=fields['aridity_index'];snow=fields['snow_fraction']
    scores={};stats={};baseweights={'snow':3,'jungle':3,'desert':3,'swamp':1.5,'forest':1,'grass':.25,'wasteland':.25}
    # Equal-high scheme doubles all three high confidence classes together;
    # no contradictory high-confidence ordering is imposed.
    if weights=='equal_high':baseweights.update(snow=6,jungle=6,desert=6)
    elif weights=='reduced_swamp':baseweights['swamp']=.25
    qualities={
      'snow':.5*sigmoid((10-t.max(axis=0))/5)+.5*np.minimum(fields['snow_season_months']/3,1),
      'jungle':sigmoid((t.min(axis=0)-15)/5)*sigmoid((p-1500)/500)*np.exp(-np.maximum(np.count_nonzero(fields['monthly_precipitation']<60,axis=0)-3,0)/3)*(1-snow),
      'desert':sigmoid((.5-ai)/.15),
      'swamp':sigmoid((fields['wetness_index']-.55)/.12),
      'forest':sigmoid((ai-.5)/.2)*sigmoid((t.max(axis=0)-10)/5),
      'grass':sigmoid((ai-.2)/.2)*sigmoid((t.max(axis=0)-8)/5),
      'wasteland':sigmoid((.7-ai)/.15)}
    for name,terrain in [('snow',10),('jungle',25),('desert',8),('swamp',7),('forest',1),('grass',0),('wasteland',9)]:
        area=fields['evidence_reference_area'][terrain];scores[name]=weighted_mean(qualities[name],area)
        stats[name]={'soft_score':scores[name],'reference_weight_m2':float(area.sum()),'annual_temperature_c':weighted_mean(fields['annual_temperature'],area),'annual_precipitation_mm':weighted_mean(p,area),'aridity_index':weighted_mean(ai,area),'snow_fraction':weighted_mean(snow,area),'wetness_index':weighted_mean(fields['wetness_index'],area)}
    return sum(baseweights[k]*scores[k] for k in scores)/sum(baseweights.values()),stats
def pareto(rows):
    # Maximize median consistency and worst-scenario consistency, minimize
    # deformation. Missing climate scores can never be promoted to winners.
    eligible=[r for r in rows if r.get('climate_median') is not None]
    result=[]
    for r in eligible:
        dominated=False
        for s in eligible:
            if r is s:continue
            a=[s['climate_median']>=r['climate_median'],s['climate_min']>=r['climate_min'],s['latitude_rms_delta_deg']<=r['latitude_rms_delta_deg']]
            strict=s['climate_median']>r['climate_median'] or s['climate_min']>r['climate_min'] or s['latitude_rms_delta_deg']<r['latitude_rms_delta_deg']
            if all(a) and strict:dominated=True;break
        result.append({**r,'pareto_frontier':not dominated})
    return result
def factor_range(rows,factor):
    others=[x for x in ['vertical_scale_m_per_raw','physics_family','evidence_scheme'] if x!=factor];groups={}
    for r in rows:groups.setdefault(tuple(r[k] for k in others),[]).append(r['climate_consistency'])
    return max((max(v)-min(v) for v in groups.values()),default=None)
def run_ensemble(grid):
    families=json.loads((OUT/'earth_benchmark/parameter_families.json').read_text());accepted=[x for x in families if x['accepted']];rows=[];robust=[];terrainstats=[]
    for mapping in mappings():
        metrics=mapping.metrics()
        for family,scale in itertools.product(families,SCALES):
            status='not_run_earth_gate_failed';fields=None
            if family['accepted']:
                data=dict(np.load(OUT/f'rasterization/{mapping.name}.npz'));c=copy.deepcopy(family['config'])
                fields,d=run_model(grid,data['land_fraction'],data['mean_elevation_raw']*scale,c);fields['evidence_reference_area']=data['evidence_reference_area'];status='evaluated'
                directory=OUT/f'gaia_ensemble/{mapping.name}_{family["name"]}_scale_{scale:g}'
                np.savez_compressed(target(directory/'fields.npz'),**fields);write_json(directory/'diagnostics.json',d);write_csv(directory/'wettest_top20.csv',extremes(grid,fields))
                if scale==1 and family['name']=='medium':raster(OUT/'hydrology'/f'{mapping.name}_wetness_index.tif',grid,fields['wetness_index'])
            for scheme in SCHEMES:
                score,stats=evidence(fields,scheme) if fields is not None else (None,{})
                row={'candidate':mapping.name,'vertical_scale_m_per_raw':scale,'physics_family':family['name'],'evidence_scheme':scheme,'status':status,'climate_consistency':score,'earth_gate_passed':family['accepted'],**metrics};rows.append(row)
                for name,s in stats.items():terrainstats.append({'candidate':mapping.name,'physics_family':family['name'],'vertical_scale':scale,'scheme':scheme,'terrain':name,**s})
        subset=[r for r in rows if r['candidate']==mapping.name and r['climate_consistency'] is not None];values=[r['climate_consistency'] for r in subset]
        robust.append({'candidate':mapping.name,'evaluated_scenarios':len(subset),'planned_scenarios':len(families)*len(SCALES)*len(SCHEMES),'climate_median':float(np.median(values)) if values else None,'climate_min':min(values) if values else None,'climate_max':max(values) if values else None,'vertical_scale_score_range':factor_range(subset,'vertical_scale_m_per_raw'),'physics_parameter_score_range':factor_range(subset,'physics_family'),'evidence_weight_score_range':factor_range(subset,'evidence_scheme'),'earth_accepted_families':len(accepted),'status':'evaluated' if values else 'blocked_by_earth_gate',**metrics})
    write_csv(OUT/'candidate_ensemble.csv',rows);write_csv(OUT/'candidate_robustness.csv',robust)
    frontier=pareto(robust)
    if not frontier:frontier=[{'candidate':m.name,'pareto_frontier':None,'climate_score':None,'status':'not_evaluable_earth_gate_failed','latitude_rms_delta_deg':m.metrics()['latitude_rms_delta_deg']} for m in mappings()]
    write_csv(OUT/'pareto.csv',frontier)
    if terrainstats:write_csv(OUT/'gaia_ensemble/terrain_statistics.csv',terrainstats)
    conclusion={'accepted_family_count':len(accepted),'evaluated_scenarios':sum(r['climate_consistency'] is not None for r in rows),'planned_scenarios':len(rows),'formal_v2':False,'conclusion':'No physically robust V2 mapping yet.',
      'geometric_role':'v1_baseline; existing geometric reference, not Earth-certified climate','balanced_role':None,'climate_first_role':None,
      'reason':'No Earth-acceptable physics family. Three proposal families are not accepted. Gaia scores, sensitivities and Pareto climate roles remain unmeasured.' if not accepted else 'Formal robustness criteria must be evaluated before release.'}
    write_json(OUT/'gaia_ensemble/conclusion.json',conclusion);return conclusion
