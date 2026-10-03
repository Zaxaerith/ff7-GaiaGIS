# SPDX-License-Identifier: GPL-3.0-only
"""External-model file interface. No ExoPlaSim source or runtime bundled."""
import json
import numpy as np
from .grid import Grid
from .geography import remap_raw
from .products import netcdf
def t21_grid(radius):
    g=Grid(5.625,radius);nodes,weights=np.polynomial.legendre.leggauss(32)
    g.x=nodes;g.xe=np.r_[-1,-1+np.cumsum(weights)];g.xe[-1]=1;g.dx=weights
    g.lat=np.rad2deg(np.arcsin(nodes));g.lat_edges=np.rad2deg(np.arcsin(np.clip(g.xe,-1,1)))
    # Cell centers include zero longitude, as in PlaSim T21.
    g.lon_edges-=g.dlambda*180/np.pi/2;g.lon=(g.lon_edges[:-1]+g.lon_edges[1:])/2
    g.area=np.broadcast_to((weights*radius**2*g.dlambda)[:,None],(32,64)).copy()
    return g
def sra(path,code,values):
    values=np.asarray(values);ny,nx=values.shape
    # Eight-integer header and eight floats per record are the SRA protocol,
    # independently written from the documented format, not upstream code.
    with path.open('w',encoding='ascii',newline='\n') as f:
        f.write(' '.join(str(x) for x in [code,0,20261002,0,nx,ny,0,0])+'\n')
        for row in values.ravel().reshape(-1,8):f.write(' '.join(f'{x:.6f}' for x in row)+'\n')
def prepare_gcm(directory,raw,mapping,config):
    directory.mkdir(parents=True,exist_ok=True);p=config['planet'];g=t21_grid(p['radius_m'])
    land,height,diagnostic=remap_raw(raw,mapping,g,config)
    order=np.argsort(g.lon%360);fractional=land[::-1][:,order];binary=(fractional>=.5).astype(float)
    land_elevation=np.divide(height,land,out=np.zeros_like(height),where=land>0)
    geopotential=land_elevation[::-1][:,order]*binary*p['gravity_m_s2']
    sra(directory/'gaia_surf_0172.sra',172,binary);sra(directory/'gaia_surf_0129.sra',129,geopotential)
    netcdf(directory/'boundary_fractional.nc',g,{'land_fraction':land,'elevation':height},{'candidate':mapping.name,'GCM_STATUS':'pending','orography_units':'m in nc; m2 s-2 in SRA'})
    cfg={'resolution':'T21','layers':10,'ncpus':1,'outputtype':'.nc','configure':{'flux':p['stellar_flux_w_m2'],'year':p['orbital_days'],'rotationperiod':p['rotation_hours']/24,
         'obliquity':p['obliquity_deg'],'eccentricity':p['eccentricity'],'fixedorbit':True,'gravity':p['gravity_m_s2'],
         'radius':p['radius_m']/6371000,'pressure':p['pressure_pa']/100000,'pCO2':p['pressure_pa']/100000*p['co2_ppm']*1e-6,
         'mldepth':config['energy']['mixed_layer_m'],'landmap':'gaia_surf_0172.sra','topomap':'gaia_surf_0129.sra'},
         'boundary_notes':{'lat_order':'Gaussian north-to-south','lon_order':'0,5.625,...354.375 degrees east','land_fraction_aggregation':'conservative before binary threshold >=0.5','orography':'land mean positive elevation * gravity, ocean=0','runtime_verified':False,'remap':diagnostic},
         'spinup':'first 1-5 years smoke only; continue until ts and TOA drifts stabilize; no equilibrated climatology yet'}
    (directory/'exoplasim-config.json').write_text(json.dumps(cfg,indent=2)+'\n',encoding='utf-8')
    return cfg
