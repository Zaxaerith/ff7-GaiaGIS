# SPDX-License-Identifier: GPL-3.0-only
"""Original implementation of Peel et al. 2007 Table 1 + seasonal tie rule.
Model fields are approximate: product label is Koppen-Geiger-like.
"""
import numpy as np
CLASSES=['Ocean','Af','Am','Aw','BWh','BWk','BSh','BSk','Csa','Csb','Csc','Cwa','Cwb','Cwc','Cfa','Cfb','Cfc','Dsa','Dsb','Dsc','Dsd','Dwa','Dwb','Dwc','Dwd','Dfa','Dfb','Dfc','Dfd','ET','EF']
def koppen(temperature,precipitation,latitudes,land):
    out=np.zeros(land.shape,dtype=np.int16)
    for j,lat in enumerate(latitudes):
        summer=np.array([3,4,5,6,7,8]) if lat>=0 else np.array([9,10,11,0,1,2]);winter=(summer+6)%12
        for i in range(land.shape[1]):
            if land[j,i]<.5:continue
            t=temperature[:,j,i];p=precipitation[:,j,i];mean=t.mean();cold=t.min();hot=t.max();annual=p.sum()
            ps=p[summer];pw=p[winter];fraction=ps.sum()/max(annual,1e-12)
            threshold=10*(2*mean+(28 if fraction>=.7 else 0 if fraction<=.3 else 14))
            if annual<threshold:code=('BW' if annual<threshold/2 else 'BS')+('h' if mean>=18 else 'k')
            elif cold>=18:code='Af' if p.min()>=60 else 'Am' if p.min()>=100-annual/25 else 'Aw'
            elif hot<=10:code='ET' if hot>0 else 'EF' # equality 10 assigned E (documented tie)
            else:
                first='C' if cold>0 else 'D';drysummer=ps.min()<40 and ps.min()<pw.max()/3;drywinter=pw.min()<ps.max()/10
                season='w' if drywinter and (not drysummer or ps.sum()>pw.sum()) else 's' if drysummer else 'f'
                third='a' if hot>=22 else 'b' if np.count_nonzero(t>10)>=4 else 'd' if first=='D' and cold< -38 else 'c'
                code=first+season+third
            out[j,i]=CLASSES.index(code)
    return out
def snow_diagnostic(temperature,precipitation,config):
    m=config['moisture'];days=config['planet']['orbital_days']/12
    store=np.zeros(temperature.shape[1:]);covered=[]
    for year in range(6):
        covered=[]
        for month in range(12):
            cold=temperature[month]<=m['snow_temperature_c'];accumulation=np.where(cold,precipitation[month],0)
            melt=np.maximum(temperature[month]-m['snow_temperature_c'],0)*m['degree_day_melt_mm_k_day']*days
            store=np.maximum(0,store+accumulation-melt)
            covered.append((store>1)&(cold|(store>melt)))
    months=np.sum(covered,axis=0)
    return months/12,months.astype(np.int16)
