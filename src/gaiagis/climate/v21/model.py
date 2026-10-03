# SPDX-License-Identifier: GPL-3.0-only
"""Surface radiation PET, conservative eddy transport, persistent soil bucket.

No FF7 terrain labels enter any physical equation. Monthly snow is diagnostic;
soil and atmospheric fluxes couple through an implicit active-set solve.
"""
import heapq
import numpy as np
from scipy import sparse
from scipy.sparse.linalg import splu
from ..energy_balance import energy_balance
from ..circulation import winds
from ..moisture import transport_operator,uplift
from ..classification import koppen

def pet(temperature,insolation,settings):
    """FAO56 net radiation estimate + Priestley-Taylor; monthly mean proxies.

    Humidity and cloudiness are assumed, not meteorological observations.
    Reference surface albedo .23 and approximate longwave loss are explicit.
    """
    t=np.clip(temperature,-80,60);sat=.6108*np.exp(17.27*t/(t+237.3));slope=4098*sat/(t+237.3)**2
    rs=insolation*settings['shortwave_transmissivity'];ea=settings['relative_humidity_proxy']*sat
    cloud=np.clip(1.35*settings['shortwave_transmissivity']/.75-.35,.05,1)
    longwave=5.670374419e-8*(t+273.15)**4*np.maximum(.34-.14*np.sqrt(ea),0)*cloud
    rn=np.maximum((1-settings['surface_albedo'])*rs-longwave,0)
    return 1.26*slope/(slope+.066)*rn/2450000.,rn
def route_runoff(grid,land,height,runoff):
    """Priority flood D4 drainage; periodic longitude, no polar wrap.

    Depression depth is a spill-level diagnostic. Basins spill rather than
    retain permanent closed lakes; no explicit groundwater/river dynamics.
    """
    size=land.size;h=height.ravel();visited=np.zeros(size,bool);parent=np.full(size,-1,int);filled=h.copy();queue=[];order=[]
    outlets=np.where(land.ravel()<.5)[0]
    if not len(outlets):outlets=np.array([np.argmin(h)])
    for k in outlets:visited[k]=True;heapq.heappush(queue,(h[k],int(k)))
    while queue:
        level,k=heapq.heappop(queue);order.append(k);j,i=divmod(k,grid.nx)
        neighbors=[j*grid.nx+(i-1)%grid.nx,j*grid.nx+(i+1)%grid.nx]
        if j>0:neighbors.append(k-grid.nx)
        if j<grid.ny-1:neighbors.append(k+grid.nx)
        for n in neighbors:
            if visited[n]:continue
            visited[n]=True;parent[n]=k;filled[n]=max(level,h[n]);heapq.heappush(queue,(filled[n],n))
    flux=(runoff*land*grid.area/1000).ravel().copy();local=flux.copy()
    for k in reversed(order):
        if parent[k]>=0:flux[parent[k]]+=flux[k]
    total=float(np.sum(local));outflow=float(flux[parent<0].sum());error=abs(total-outflow)/max(total,1)
    if error>1e-10:raise RuntimeError('Runoff routing conservation failed')
    return {'runoff_accumulation_m3_year':flux.reshape(land.shape),'upstream_water_m3_year':np.maximum(flux-local,0).reshape(land.shape),'depression_depth':np.maximum(filled-h,0).reshape(land.shape),'drainage_parent':parent.reshape(land.shape)}, {'source_runoff_m3_year':total,'outlet_runoff_m3_year':outflow,'relative_error':error}
def wetness(land,height,aridity,soil_fraction,routing):
    ai=np.clip(aridity/1.5,0,1);low=np.exp(-height/500);basin=1-np.exp(-routing['depression_depth']/100)
    upstream=1-np.exp(-routing['upstream_water_m3_year']/1e11)
    return np.clip(.35*soil_fraction+.25*ai+.2*upstream+.2*np.maximum(low*ai,basin),0,1)*(land>0)
def run_model(grid,land,height,config):
    s=config['v21'];days=config['planet']['orbital_days']/12;dt=days*86400;capacity=s['soil_capacity_mm'];critical=capacity*s['soil_critical_fraction']
    distance=grid.coast_distance(land);sea,q,diag=energy_balance(grid,land,distance,config)
    temperature=sea-config['energy']['lapse_k_per_m']*height
    potential,rn=pet(temperature,q,s);potential*=dt
    matrices=[];ks=[];uv=[];oro=[]
    diff=grid.diffusion(s['eddy_diffusivity_m2_s']/grid.radius**2,s['eddy_diffusivity_m2_s']/grid.radius**2)
    for month in range(12):
        u,v,bg=winds(grid,month,config);enhance=uplift(grid,height,u,v)/config['moisture']['condensation_height_m'];k=bg+enhance
        matrices.append(transport_operator(grid,u,v)-diff);ks.append(k);uv.append((u,v));oro.append(enhance/k)
    soil=np.zeros_like(land);snow=np.zeros_like(land);old=None;drift=None;water_residual=[];soil_residual=[]
    # LU factorization is cached for repeated active sets across spinup years.
    solvers={};records=[]
    for year in range(s['hydrology_spinup_years']):
        records=[]
        for month in range(12):
            t=temperature[month];p=potential[month];k=ks[month];liquid=(t>0).astype(float)
            melt=np.minimum(snow,np.maximum(t,0)*config['moisture']['degree_day_melt_mm_k_day']*days)
            beta=np.where(liquid>0,p/(critical+p+1e-15),0);available=soil+melt
            saturated=np.zeros_like(land,bool)
            for iteration in range(20):
                # ET=beta*(old storage + liquid precipitation), or ET=PET.
                coef=np.where(saturated,0,beta);fixed=np.where(saturated,p,coef*available)
                key=(month,saturated.tobytes())
                if key not in solvers:solvers[key]=splu(matrices[month]+sparse.diags((k*(1-land*coef*liquid)).ravel())).solve
                w=solvers[key](((1-land)*p+land*fixed).ravel()/dt).reshape(land.shape)
                rain=k*w*dt;raw_et=beta*(available+liquid*rain)
                updated=(raw_et>=p)&(p>1e-10)&(liquid>0)&(land>0)
                if np.array_equal(updated,saturated):break
                saturated=updated
            else:raise RuntimeError('Land ET active set failed to converge')
            actual_land=np.where(saturated,p,raw_et);actual_land=np.maximum(actual_land,0)
            evaporation=(1-land)*p+land*actual_land
            before=soil.copy();water=np.where(land>0,soil+liquid*rain+melt-actual_land,0)
            runoff=np.maximum(water-capacity,0);soil=np.clip(water,0,capacity)
            snow=np.where(land>0,snow+(1-liquid)*rain-melt,0)
            water_residual.append(abs(grid.mean(rain-evaporation)))
            soil_residual.append(float(np.max(abs(soil+runoff-before-liquid*rain-melt+actual_land)*(land>0))))
            if np.min(w)<-1e-7 or np.min(water)<-1e-6:raise RuntimeError('Negative water in coupled hydrology')
            records.append((rain,p,evaporation,w,soil.copy(),runoff,snow.copy(),melt,actual_land))
        drift=float(np.max(abs(soil-old))) if old is not None else float('inf');old=soil.copy()
        if year>=3 and drift<s['soil_periodic_tolerance_mm']:break
    if drift>=s['soil_periodic_tolerance_mm']:print('WARNING soil periodicity tolerance not met',drift,flush=True)
    arrays=[np.array([r[i] for r in records]) for i in range(9)];rain,p,evap,w,store,runoff,swe,melt,et_land=arrays
    annual_p=rain.sum(axis=0);aridity=annual_p/np.maximum(p.sum(axis=0),1);snowfraction=np.mean(swe>=10,axis=0)*(land>0)
    routed,rdiag=route_runoff(grid,land,height,runoff.sum(axis=0));wet=wetness(land,height,aridity,store.mean(axis=0)/capacity,routed)
    fields={'monthly_temperature':temperature,'monthly_precipitation':rain,'monthly_pet':p,'monthly_evaporation':evap,'monthly_column_water':w,'monthly_soil_storage':store,'monthly_runoff':runoff,'monthly_swe':swe,'monthly_net_radiation':rn,
      'annual_temperature':temperature.mean(axis=0),'annual_precipitation':annual_p,'aridity_index':aridity,'snow_fraction':snowfraction,'snow_season_months':snowfraction*12,'temperature_seasonality':np.ptp(temperature,axis=0),'land_fraction':land,'elevation':height,'coast_distance':distance,
      'prevailing_wind_u':np.array([p[0] for p in uv]),'prevailing_wind_v':np.array([p[1] for p in uv]),'monthly_orographic_rain_fraction':np.array(oro),'moisture_convergence':rain-evap,
      'annual_runoff':runoff.sum(axis=0),'soil_moisture_fraction':store.mean(axis=0)/capacity,'wetness_index':wet,'koppen_class':koppen(temperature,rain,grid.lat,land),**routed}
    diag.update(water_balance_max_monthly_residual_mm=max(water_residual),soil_balance_max_cell_residual_mm=max(soil_residual),soil_spinup_years=year+1,soil_periodic_drift_mm=drift,soil_converged=drift<s['soil_periodic_tolerance_mm'],runoff_routing=rdiag,global_annual_precipitation_mm=grid.mean(annual_p),maximum_precipitation_mm=float(annual_p.max()),snow_storage_note='Persistent snow can accumulate indefinitely on subzero terrain; no glacier discharge or sea ice dynamics. Soil periodicity tested; SWE not required periodic.')
    return fields,diag
def extremes(grid,fields):
    order=np.argsort(fields['annual_precipitation'].ravel())[-20:][::-1];rows=[]
    for k in order:
        j,i=divmod(int(k),grid.nx)
        rows.append(dict(lon=float(grid.lon[i]),lat=float(grid.lat[j]),land_fraction=float(fields['land_fraction'][j,i]),elevation=float(fields['elevation'][j,i]),wind_u=float(fields['prevailing_wind_u'][:,j,i].mean()),wind_v=float(fields['prevailing_wind_v'][:,j,i].mean()),precipitation=float(fields['annual_precipitation'][j,i]),pet=float(fields['monthly_pet'][:,j,i].sum()),moisture_convergence=float(fields['moisture_convergence'][:,j,i].sum()),orographic_rain_fraction=float(np.sum(fields['monthly_orographic_rain_fraction'][:,j,i]*fields['monthly_precipitation'][:,j,i])/fields['annual_precipitation'][j,i])))
    return rows
