# SPDX-License-Identifier: GPL-3.0-only
"""Seasonally migrating Earth-like background cells; not a momentum solver."""
import numpy as np
from .insolation import declination
def winds(grid,month,config):
    p,m=config['planet'],config['moisture'];lat=grid.lat[:,None]
    shift=m['itcz_migration_fraction']*np.rad2deg(declination((month+.5)*p['orbital_days']/12,p))
    relative=lat-shift;absolute=np.abs(lat);sign=np.sign(relative)
    hadley=-m['trade_meridional_m_s']*sign*np.exp(-(relative/18)**2)
    ferrel=m['ferrel_meridional_m_s']*np.sign(lat)*np.exp(-((absolute-48)/14)**2)
    polar=-m['polar_meridional_m_s']*np.sign(lat)*np.exp(-((absolute-78)/12)**2)
    v=hadley+ferrel+polar
    # Hemisphere sign changes meridional flow and Coriolis deflection together.
    u=m['zonal_wind_multiplier']*(sign*hadley+np.sign(lat)*(ferrel+polar))*24/p['rotation_hours']
    wet_itcz=np.exp(-(relative/m['zone_width_deg'])**2)
    subtropical=np.exp(-((np.abs(relative)-m['subtropical_center_deg'])/m['zone_width_deg'])**2)
    storm=np.exp(-((absolute-m['storm_center_deg'])/m['zone_width_deg'])**2)
    tau=m['background_rain_days']-(m['background_rain_days']-m['itcz_rain_days'])*wet_itcz+(m['subtropical_rain_days']-m['background_rain_days'])*subtropical-(m['background_rain_days']-m['storm_rain_days'])*storm
    shape=(grid.ny,grid.nx)
    return np.broadcast_to(u,shape).copy(),np.broadcast_to(v,shape).copy(),np.broadcast_to(1/(tau*86400),shape).copy()
