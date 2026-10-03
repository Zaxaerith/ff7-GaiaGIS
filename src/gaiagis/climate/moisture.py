# SPDX-License-Identifier: GPL-3.0-only
"""Conservative finite-volume upwind column-water transport and rainout."""
import numpy as np
from scipy import sparse
from scipy.sparse.linalg import splu
def transport_operator(grid,u,v):
    rows=[];cols=[];data=[]
    def flux(a,b,rate):
        donor=a if rate>=0 else b;rate=abs(rate)
        rows.extend([donor,b if donor==a else a]);cols.extend([donor,donor]);data.extend([rate/grid.area.ravel()[donor],-rate/grid.area.ravel()[b if donor==a else a]])
    for j in range(grid.ny):
        length=grid.radius*np.deg2rad(grid.lat_edges[j+1]-grid.lat_edges[j])
        for i in range(grid.nx):
            a=j*grid.nx+i;ii=(i+1)%grid.nx
            flux(a,j*grid.nx+ii,(u[j,i]+u[j,ii])/2*length)
            if j<grid.ny-1:flux(a,a+grid.nx,(v[j,i]+v[j+1,i])/2*grid.radius*np.cos(np.deg2rad(grid.lat_edges[j+1]))*grid.dlambda)
    return sparse.coo_matrix((data,(rows,cols)),shape=(grid.nx*grid.ny,)*2).tocsc()
def uplift(grid,height,u,v):
    dzdx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))/(2*grid.radius*grid.dlambda*np.cos(np.deg2rad(grid.lat))[:,None])
    dzdy=np.gradient(height,np.deg2rad(grid.lat),axis=0)/grid.radius
    return np.maximum(0,u*dzdx+v*dzdy)
def potential_evaporation(temperature,insolation,config):
    m=config['moisture']
    saturation=0.6108*np.exp(17.27*temperature/(temperature+237.3));slope=4098*saturation/(temperature+237.3)**2
    radiation=np.maximum(0,insolation*m['surface_net_radiation_fraction'])
    return m['priestley_taylor_alpha']*slope/(slope+m['psychrometric_kpa_k'])*radiation/m['latent_heat_j_kg'] # mm/s
def moisture_month(grid,temperature,insolation,land,height,u,v,background,config):
    m=config['moisture'];potential=potential_evaporation(temperature,insolation,config)
    condensation=background+uplift(grid,height,u,v)/m['condensation_height_m']
    solver=splu(sparse.diags(condensation.ravel())+transport_operator(grid,u,v)).solve
    availability=np.full_like(land,0.5)
    for iteration in range(m['soil_iterations']):
        evaporation=potential*((1-land)+land*m['continental_evaporation_efficiency']*availability)
        water=solver(evaporation.ravel()).reshape(land.shape)
        rain=condensation*water
        updated=np.clip(rain/np.maximum(potential,1e-12),m['minimum_soil_availability'],1)
        availability=0.5*availability+0.5*updated
    if np.min(water)<-1e-8:raise RuntimeError('Negative atmospheric water')
    imbalance=grid.mean(rain-evaporation)
    days=config['planet']['orbital_days']/12;seconds=days*86400
    return rain*seconds,potential*seconds,evaporation*seconds,water,imbalance*seconds
