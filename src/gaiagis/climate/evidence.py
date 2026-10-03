# SPDX-License-Identifier: GPL-3.0-only
import numpy as np
from .classification import CLASSES
def sigmoid(x):return 1/(1+np.exp(-np.clip(x,-50,50)))
def score_evidence(source,mapping,grid,fields,weights):
    centers=source['raw'].mean(axis=1);lon=360*(centers[:,0]/source['width']-.5);lat=mapping(centers[:,1]/source['height'])
    j,i=grid.indices(lon,lat)
    cold=fields['monthly_temperature'][:,j,i].min(axis=0);warm=fields['monthly_temperature'][:,j,i].max(axis=0)
    precip=fields['annual_precipitation'][j,i];arid=fields['aridity_index'][j,i];snow=fields['snow_season_months'][j,i]
    dry=np.count_nonzero(fields['monthly_precipitation'][:,j,i]<60,axis=0);scores=np.full(len(lon),np.nan);stats={};numerator=denominator=0
    for name,c in weights.items():
        select=source['ids'][:,4]==c['terrain_id'];area=source['area_v1'][select];total=area.sum()
        if not select.any():continue
        if name=='snow':quality=.5*sigmoid((c['maximum_warm_month_c']-warm)/5)+.5*np.minimum(snow/c['minimum_snow_months'],1)
        elif name=='jungle':quality=sigmoid((cold-c['minimum_cold_month_c'])/5)*sigmoid((precip-c['minimum_annual_precipitation_mm'])/500)*np.exp(-np.maximum(dry-c['maximum_dry_months'],0)/3)*(1-fields['snow_fraction'][j,i])
        elif 'maximum_aridity_index' in c:quality=sigmoid((c['maximum_aridity_index']-arid)/.15)
        else:
            quality=sigmoid((arid-c['minimum_aridity_index'])/.2)
            if 'minimum_warm_month_c' in c:quality*=sigmoid((warm-c['minimum_warm_month_c'])/5)
        scores[select]=quality[select]
        def mean(values):return float(np.sum(values[select]*area)/max(total,1))
        consistency=mean(quality);numerator+=c['weight']*consistency;denominator+=c['weight']
        histogram={CLASSES[k]:float(area[fields['koppen_class'][j[select],i[select]]==k].sum()/max(total,1)) for k in np.unique(fields['koppen_class'][j[select],i[select]])}
        stats[name]={'terrain_id':c['terrain_id'],'triangle_count':int(select.sum()),'fixed_v1_area_m2':float(total),'soft_score':consistency,
                     'matched_fraction_score_ge_0_5':mean((quality>=.5).astype(float)),'annual_temperature_c':mean(fields['annual_temperature'][j,i]),
                     'coldest_month_c':mean(cold),'warmest_month_c':mean(warm),'annual_precipitation_mm':mean(precip),
                     'aridity_index':mean(arid),'snow_fraction':mean(fields['snow_fraction'][j,i]),'classes':histogram}
    return float(numerator/denominator),stats,scores
