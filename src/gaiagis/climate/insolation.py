# SPDX-License-Identifier: GPL-3.0-only
"""Daily-mean TOA irradiance from spherical solar geometry, circular orbit."""
import numpy as np
def declination(day,planet):
    return np.arcsin(np.sin(np.deg2rad(planet['obliquity_deg']))*np.sin(2*np.pi*(np.asarray(day)/planet['orbital_days']-0.218)))
def daily_insolation(latitude,solar_declination,solar_constant=1361.0):
    phi=np.deg2rad(np.asarray(latitude));delta=np.asarray(solar_declination)
    argument=-np.sin(phi)*np.sin(delta)/np.maximum(np.cos(phi)*np.cos(delta),1e-15)
    hour=np.arccos(np.clip(argument,-1,1))
    return np.maximum(0,solar_constant/np.pi*(hour*np.sin(phi)*np.sin(delta)+np.cos(phi)*np.cos(delta)*np.sin(hour)))
def monthly_insolation(latitudes,planet):
    if planet['eccentricity']!=0:raise ValueError('Level A currently supports explicit circular orbit only')
    result=[]
    for month in range(12):
        days=(month+(np.arange(30)+0.5)/30)*planet['orbital_days']/12
        result.append(daily_insolation(np.asarray(latitudes)[None,:],declination(days,planet)[:,None],planet['stellar_flux_w_m2']).mean(axis=0))
    return np.array(result)
