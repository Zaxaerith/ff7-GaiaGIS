# SPDX-License-Identifier: GPL-3.0-only
import copy,unittest
import numpy as np
from gaiagis.climate.settings import settings
from gaiagis.climate.grid import Grid
from gaiagis.climate.insolation import daily_insolation,monthly_insolation
from gaiagis.climate.energy_balance import energy_balance
from gaiagis.climate.circulation import winds
from gaiagis.climate.moisture import moisture_month
from gaiagis.climate.climate_model import run_model
from gaiagis.climate.classification import koppen,CLASSES,snow_diagnostic
from gaiagis.climate.latitude import LatitudeMapping,v1_latitude,candidates
from gaiagis.climate.geography import overlap_matrix,remap_raw

class ClimatePhysicsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config=settings();cls.grid=Grid(10);g=cls.grid
        cls.aqua,cls.diagnostics=run_model(g,np.zeros((g.ny,g.nx)),np.zeros((g.ny,g.nx)),cls.config)
    def test_insolation_equinox_geometry(self):
        flux=daily_insolation(np.array([0,45,90,-90]),0,1361)
        np.testing.assert_allclose(flux,[1361/np.pi,1361/np.pi/np.sqrt(2),0,0],atol=1e-12)
    def test_solstice_polar_day_night_and_circle(self):
        d=np.deg2rad(23.44)
        self.assertGreater(daily_insolation(90,d),500);self.assertEqual(daily_insolation(-90,d),0)
        self.assertEqual(daily_insolation(80,-d),0);self.assertGreater(daily_insolation(66.56,d),400)
    def test_season_hemisphere_symmetry(self):
        np.testing.assert_allclose(daily_insolation([20,60],.3),daily_insolation([-20,-60],-.3),atol=1e-12)
    def test_global_solar_geometry_budget(self):
        g=Grid(2.5);q=monthly_insolation(g.lat,self.config['planet']).mean(axis=0)
        global_mean=np.sum(q*g.dx)/2
        self.assertAlmostEqual(global_mean,self.config['planet']['stellar_flux_w_m2']/4,delta=.2)
    def test_diffusion_conserves_weighted_energy_and_constant_fields(self):
        g=self.grid;l=g.diffusion(.555,.12);field=np.random.default_rng(4).normal(size=(g.ny,g.nx))
        np.testing.assert_allclose(l@np.ones(field.size),0,atol=1e-10)
        self.assertAlmostEqual(g.mean((l@field.ravel()).reshape(field.shape)),0,delta=1e-10)
    def test_periodic_ebm_convergence_and_energy_balance(self):
        self.assertLess(self.diagnostics['periodic_max_drift_k'],.02)
        self.assertLess(self.diagnostics['energy_equation_max_residual_w_m2'],1e-8)
        self.assertLess(abs(self.diagnostics['annual_global_toa_imbalance_w_m2']),.1)
        self.assertTrue(np.isfinite(self.aqua['monthly_temperature']).all())
    def test_aquaplanet_zonal_symmetry_and_latitude_physics(self):
        a=self.aqua
        self.assertLess(np.max(np.ptp(a['annual_temperature'],axis=1)),1e-8)
        self.assertLess(np.max(np.ptp(a['annual_precipitation'],axis=1)),1e-7)
        self.assertGreater(a['annual_temperature'][9,0],a['annual_temperature'][-1,0]+20)
        self.assertGreater(a['temperature_seasonality'][-2,0],a['temperature_seasonality'][9,0])
    def test_aquaplanet_tropical_wet_subtropical_dry_tendency(self):
        g=self.grid;p=self.aqua['annual_precipitation'].mean(axis=1)
        tropical=p[np.abs(g.lat)<10].mean();sub=p[(np.abs(g.lat)>25)&(np.abs(g.lat)<40)].mean()
        self.assertGreater(tropical,sub)
    def test_water_conservation(self):self.assertLess(self.diagnostics['water_balance_max_monthly_residual_mm'],1e-7)
    def test_trade_wind_hemisphere_sign_and_midlatitude_westerlies(self):
        c=copy.deepcopy(self.config);c['planet']['obliquity_deg']=0;u,v,_=winds(self.grid,2,c);lat=self.grid.lat
        n=np.argmin(abs(lat-15));s=np.argmin(abs(lat+15));mid=np.argmin(abs(lat-45))
        self.assertLess(u[n,0],0);self.assertLess(u[s,0],0);self.assertLess(v[n,0],0);self.assertGreater(v[s,0],0);self.assertGreater(u[mid,0],0)
    def test_lapse_rate_reduces_land_surface_temperature(self):
        g=self.grid;land=np.ones((g.ny,g.nx));distance=np.full_like(land,100000)
        sea,_,_=energy_balance(g,land,distance,self.config)
        near=sea-self.config['energy']['lapse_k_per_m']*2000
        self.assertGreater(float(sea.mean()-near.mean()),10)
    def test_slab_ocean_has_less_seasonality_than_land(self):
        g=self.grid;land=np.ones((g.ny,g.nx));distance=np.full_like(land,1e7)
        t,_,_=energy_balance(g,land,distance,self.config)
        j=np.argmin(abs(g.lat-45));self.assertGreater(np.ptp(t[:,j,0]),np.ptp(self.aqua['monthly_temperature'][:,j,0]))
    def test_orographic_barrier_and_leeward_shadow(self):
        g=self.grid;shape=(g.ny,g.nx);land=np.zeros(shape);land[:,9:27]=1
        height=np.broadcast_to(3500*np.exp(-((np.arange(g.nx)-15)/1.5)**2),shape).copy()
        p,*_=moisture_month(g,np.full(shape,20),np.full(shape,400),land,height,np.full(shape,5),np.zeros(shape),np.full(shape,1/(9*86400)),self.config)
        self.assertGreater(p[:,12:15].mean(),p[:,17:20].mean()*1.3)
    def test_snow_accumulation_and_melt(self):
        t=np.full((12,1,2),-8.);t[:,:,1]=15;p=np.full_like(t,70)
        fraction,months=snow_diagnostic(t,p,self.config);np.testing.assert_array_equal(months,[[12,0]]);np.testing.assert_allclose(fraction,[[1,0]])
    def test_koppen_known_climate_regimes(self):
        t=np.array([[25,25,15,-10]]*12).reshape(12,1,4);p=np.array([[200,1,80,20]]*12).reshape(12,1,4)
        codes=koppen(t,p,[0],np.ones((1,4)));self.assertEqual([CLASSES[i] for i in codes[0]],['Af','BWh','Cfb','EF'])
    def test_monotone_mapping_roundtrip_and_constraints(self):
        s=self.config['search'];aspect=229376/294912;m=LatitudeMapping('test',v1_latitude(np.linspace(0,1,7),aspect),aspect)
        m.validate(s)
        for u in np.linspace(0,1,13):self.assertAlmostEqual(m.inverse(m(u)),u,places=10)
        self.assertTrue(np.all(m.derivative(np.linspace(0,1,999))<0))
        with self.assertRaises(ValueError):LatitudeMapping('bad',[80,30,40,-80],aspect)
        with self.assertRaises(ValueError):LatitudeMapping('bad',[80,79.9,79.8,0,-20,-50,-80],aspect).validate(s)
    def test_optimizer_reproducibility(self):
        c=copy.deepcopy(self.config);c['search']['candidate_count']=8
        a,p=candidates(229376/294912,c);b,q=candidates(229376/294912,c)
        self.assertEqual([m.document() for m in a],[m.document() for m in b]);self.assertEqual(p,q)
    def test_fractional_conservative_raster_remap(self):
        g=Grid(30);a=229376/294912;m=LatitudeMapping('baseline',v1_latitude(np.linspace(0,1,7),a),a,True)
        raw={'land':np.full((24,48),.3),'height_raw':np.full((24,48),100),'unknown':np.zeros((24,48))}
        land,h,d=remap_raw(raw,m,g,self.config);self.assertLess(d['relative_remap_land_area_error'],1e-12)
        self.assertTrue(np.all((land>=0)&(land<=1)));self.assertTrue(np.any((land>0)&(land<1)))
    def test_periodic_ocean_distance(self):
        g=self.grid;land=np.ones((g.ny,g.nx));land[:,0]=0;distance=g.coast_distance(land)
        self.assertLess(distance[9,-1],distance[9,g.nx//2])
if __name__=='__main__':unittest.main()
