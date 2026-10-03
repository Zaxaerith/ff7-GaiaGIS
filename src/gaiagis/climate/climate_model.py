# SPDX-License-Identifier: GPL-3.0-only
import numpy as np
from .energy_balance import energy_balance
from .circulation import winds
from .moisture import moisture_month
from .classification import koppen,snow_diagnostic
def run_model(grid,land,height,config):
    distance=grid.coast_distance(land)
    sea,insolation,diagnostics=energy_balance(grid,land,distance,config)
    # Bulk environmental lapse approximation, applied after the TOA EBM.
    # Energy diagnostics apply to sea-level EBM, not this downscaled temperature.
    temperature=sea-config['energy']['lapse_k_per_m']*height[None,:,:]
    rain=[];pet=[];evap=[];wind_u=[];wind_v=[];water=[];imbalance=[]
    for month in range(12):
        u,v,k=winds(grid,month,config)
        p,e,actual,q,residual=moisture_month(grid,temperature[month],insolation[month],land,height,u,v,k,config)
        rain.append(p);pet.append(e);evap.append(actual);water.append(q);wind_u.append(u);wind_v.append(v);imbalance.append(residual)
    rain=np.array(rain);pet=np.array(pet);snow,months=snow_diagnostic(temperature,rain,config)
    # Snow diagnostics apply to the land component of a fractional cell.
    # An ocean snow bucket would imply unmodelled sea ice; do not export it.
    snow=np.where(land>0,snow,0);months=np.where(land>0,months,0)
    annual_p=rain.sum(axis=0);annual_pet=pet.sum(axis=0)
    fields={'monthly_temperature':temperature,'monthly_precipitation':rain,'monthly_insolation':insolation,
            'monthly_pet':pet,'monthly_evaporation':np.array(evap),'monthly_column_water':np.array(water),
            'annual_temperature':temperature.mean(axis=0),'annual_precipitation':annual_p,'annual_insolation':insolation.mean(axis=0),
            'insolation_seasonality':np.ptp(insolation,axis=0),'temperature_seasonality':np.ptp(temperature,axis=0),
            'aridity_index':annual_p/np.maximum(annual_pet,1),'precipitation_deficit':np.maximum(0,annual_pet-annual_p),
            'snow_fraction':snow,'snow_season_months':months,'prevailing_wind_u':np.array(wind_u),'prevailing_wind_v':np.array(wind_v),
            'land_fraction':land,'elevation':height,'coast_distance':distance,'koppen_class':koppen(temperature,rain,grid.lat,land)}
    diagnostics['water_balance_max_monthly_residual_mm']=float(max(abs(x) for x in imbalance))
    diagnostics['global_annual_precipitation_mm']=grid.mean(annual_p)
    return fields,diagnostics
