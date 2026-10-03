# SPDX-License-Identifier: GPL-3.0-only
"""Finite-volume seasonal diffusive EBM, linear OLR, land/slab thermal storage."""
import numpy as np
from scipy import sparse
from scipy.sparse.linalg import splu
from .insolation import monthly_insolation
def energy_balance(grid,land,distance,config):
    p,e=config['planet'],config['energy'];shape=land.shape
    insolation=np.broadcast_to(monthly_insolation(grid.lat,p)[:,:,None],(12,*shape)).copy()
    albedo=land*e['land_planetary_albedo']+(1-land)*e['ocean_planetary_albedo']
    capacity=land*e['land_capacity_j_m2_k']*(1+e['coastal_capacity_multiplier']*np.exp(-distance/e['coastal_length_m']))+(1-land)*e['water_capacity_j_m3_k']*e['mixed_layer_m']
    diffusion=grid.diffusion(e['meridional_diffusivity_w_m2_k'],e['zonal_diffusivity_w_m2_k'])
    forcing=e['co2_forcing_w_m2']*np.log(p['co2_ppm']/p['reference_co2_ppm'])
    flux=insolation*(1-albedo)-e['olr_a_w_m2']+forcing
    b=e['olr_b_w_m2_k'];dt=p['orbital_days']*86400/12
    equilibrium=splu(sparse.eye(land.size,format='csc')*b-diffusion).solve(flux.mean(axis=0).ravel())
    mass=capacity.ravel()/dt;solve=splu((sparse.diags(mass+b)-diffusion).tocsc()).solve
    temperature=equilibrium;previous=None;records=[];residuals=[];converged=False
    for year in range(e['spinup_max_years']):
        records=[];residuals=[];toa=[]
        for month in range(12):
            old=temperature;temperature=solve(mass*old+flux[month].ravel())
            if not np.isfinite(temperature).all():raise RuntimeError('Nonfinite EBM temperature')
            records.append(temperature.reshape(shape).copy())
            net=flux[month].ravel()-b*temperature
            storage=mass*(temperature-old);transport=diffusion@temperature
            residuals.append(float(np.max(np.abs(storage-net-transport))))
            toa.append(grid.mean(net.reshape(shape)))
        records=np.array(records)
        drift=float(np.max(np.abs(records-previous))) if previous is not None else float('inf')
        if year+1>=e['spinup_min_years'] and drift<e['periodic_tolerance_k']:converged=True;break
        previous=records.copy()
    if not converged:raise RuntimeError(f'EBM failed periodic convergence: drift {drift}')
    return records,insolation,{'spinup_years':year+1,'periodic_max_drift_k':drift,'energy_equation_max_residual_w_m2':max(residuals),
                              'annual_global_toa_imbalance_w_m2':float(np.mean(toa)),'annual_global_sealevel_temperature_c':grid.mean(records.mean(axis=0))}
