# SPDX-License-Identifier: GPL-3.0-only
import copy,json,unittest
from unittest.mock import patch
import numpy as np
from gaiagis.climate.grid import Grid
from gaiagis.climate.latitude import LatitudeMapping
from gaiagis.climate.v21.rasterization import aggregate,moments,triangle_moments,mappings,clip
from gaiagis.climate.v21.model import pet,route_runoff,wetness,extremes
from gaiagis.climate.v21.ensemble import evidence,pareto,factor_range,SCALES,SCHEMES
from gaiagis.climate.v21.common import OUT,ROOT,target
from gaiagis.climate.v21.benchmark import correlation

class AreaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.grid=Grid(30);cls.mapping=LatitudeMapping('linear',[60,0,-60],1)
        cls.source={'width':100,'height':100,'raw':np.array([[[0,0,100],[100,0,100],[0,100,100]],[[100,0,100],[100,100,100],[0,100,100]]],float),'ids':np.array([[0,0,0,0,0,0],[0,0,0,1,3,0]]),'area_v1':np.ones(2)}
        cls.fields,cls.audit=aggregate(cls.source,cls.mapping,cls.grid)
    def test_additive_land_and_terrain_conservation(self):
        self.assertLess(self.audit['maximum_additive_relative_error'],1e-10)
        self.assertAlmostEqual(self.audit['polygon_land_area_m2']/self.audit['raster_additive_land_area_m2'],1,places=11)
    def test_fractional_mixed_land(self):
        f=self.fields['land_fraction'];self.assertTrue(np.any((f>0)&(f<1)));self.assertTrue(np.all(f>=0));self.assertTrue(np.all(f<=1+1e-12))
    def test_fractional_terrain_and_caps_sum(self):
        f=self.fields;np.testing.assert_allclose(f['terrain_fraction'].sum(axis=0)+f['unknown_fraction'],1,atol=1e-12)
        np.testing.assert_allclose(f['land_fraction']+f['ocean_fraction']+f['unknown_fraction'],1,atol=1e-12)
    def test_weighted_height_and_variance(self):
        f=self.fields;land=f['land_fraction']>0
        np.testing.assert_allclose(f['mean_elevation_land_raw'][land],100,atol=1e-8);self.assertLess(f['elevation_std_land_raw'].max(),1e-4)
        np.testing.assert_allclose(f['mean_elevation_raw'],100*f['land_fraction'],atol=1e-8)
    def test_zero_horizontal_lineage_is_counted(self):
        s=copy.deepcopy(self.source);s['raw'][1,:,0]=0;_,a=aggregate(s,self.mapping,self.grid);self.assertEqual(a['source_triangles'],2);self.assertEqual(a['collapsed_horizontal_triangles'],1)
    def test_negative_height_clips_without_inventing_land(self):
        s=copy.deepcopy(self.source);s['raw'][0,:,2]=-50;f,_=aggregate(s,self.mapping,self.grid);self.assertEqual(f['mean_elevation_raw'].max(),0)
    def test_vector_and_scalar_quadrature_agree(self):
        full,affine=triangle_moments(self.source['raw'],self.mapping,100,100,self.grid.radius)
        for k in range(2):np.testing.assert_allclose(full[k],moments(self.source['raw'][k,:,:2],self.mapping,100,100,self.grid.radius,affine[k]),rtol=1e-11)
    def test_empty_clipping_has_valid_dimension(self):
        self.assertEqual(clip(np.array([[0,0],[1,0],[0,1]],float),0,2,True).shape,(0,2))

class PhysicsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.settings=json.loads((OUT/'earth_benchmark/parameter_families.json').read_text())[1]['config']['v21']
    def test_pet_radiation_monotonic(self):
        value,rn=pet(np.full(3,20.),np.array([100.,200.,400.]),self.settings);self.assertTrue(np.all(np.diff(value)>0));self.assertTrue(np.all(rn>=0))
    def test_pet_temperature_sanity(self):
        value,_=pet(np.array([-20.,0.,20.,30.]),np.full(4,300.),self.settings);self.assertTrue(np.all(np.diff(value)>0));self.assertTrue(np.all(value>=0))
    def test_runoff_goes_downhill_and_conserves(self):
        g=Grid(30);land=np.ones_like(g.area);land[:,0]=0;height=np.tile(np.arange(g.nx)*100,(g.ny,1));r,a=route_runoff(g,land,height,np.ones_like(land)*200)
        self.assertLess(a['relative_error'],1e-12)
        parent=r['drainage_parent'].ravel();h=height.ravel();selected=parent>=0;self.assertTrue(np.all(h[parent[selected]]<=h[selected]))
    def test_basin_is_wetter_than_coastal_interior(self):
        s=json.loads((OUT/'synthetic/results.json').read_text());self.assertGreater(s['closed_basin']['interior_wetness'],s['coastal_plain']['interior_wetness']);self.assertGreater(s['closed_basin']['maximum_depression_depth'],0)
    def test_upwind_barrier_and_continental_drying(self):
        s=json.loads((OUT/'synthetic/results.json').read_text());self.assertLess(s['mountain_barrier']['wind_u_at_25'],0);self.assertGreater(s['mountain_barrier']['east_flank_precipitation'],s['mountain_barrier']['west_flank_precipitation']);self.assertGreater(s['flat_continent']['coastal_tropical_precipitation'],s['flat_continent']['interior_tropical_precipitation'])
    def test_extreme_audit_columns_and_order(self):
        g=Grid(2.5);f=dict(np.load(OUT/'earth_benchmark/strong_fields.npz'));rows=extremes(g,f);self.assertEqual(len(rows),20);self.assertTrue(all(rows[k]['precipitation']>=rows[k+1]['precipitation'] for k in range(19)));self.assertIn('orographic_rain_fraction',rows[0]);self.assertIn('moisture_convergence',rows[0])
    def test_actual_surface_water_budget(self):
        f=dict(np.load(OUT/'earth_benchmark/strong_fields.npz'));s=f['monthly_soil_storage'];p=f['monthly_precipitation'];t=f['monthly_temperature'];swe=f['monthly_swe']
        self.assertTrue(np.all((s>=0)&(s<=150)));self.assertTrue(np.all(p>=0));d=json.loads((OUT/'earth_benchmark/strong_metrics.json').read_text())['diagnostics'];self.assertLess(d['soil_balance_max_cell_residual_mm'],1e-9);self.assertLess(d['water_balance_max_monthly_residual_mm'],1e-8)
    def test_earth_zonal_structure(self):
        m=json.loads((OUT/'earth_benchmark/strong_metrics.json').read_text());s=m['structures'];self.assertGreater(s['tropical_minus_polar_temperature_c'],20);self.assertGreater(s['tropical_minus_subtropical_precipitation_mm'],100);self.assertGreater(s['midlatitude_minus_subtropical_precipitation_mm'],0)
    def test_reference_land_conservation(self):
        m=json.loads((OUT/'earth_benchmark/reference_metadata.json').read_text());self.assertLess(m['mask_audit']['relative_error'],1e-10)

class DecisionTests(unittest.TestCase):
    def fields(self):
        g=Grid(30);shape=g.area.shape;f={'monthly_temperature':np.full((12,*shape),25.),'annual_temperature':np.full(shape,25.),'monthly_precipitation':np.full((12,*shape),200.),'annual_precipitation':np.full(shape,2400.),'aridity_index':np.ones(shape),'snow_fraction':np.zeros(shape),'snow_season_months':np.zeros(shape),'wetness_index':np.full(shape,.8),'evidence_reference_area':np.ones((32,*shape))};return f
    def test_jungle_requires_warm_wet_no_snow(self):
        f=self.fields();_,a=evidence(f,'default');good=a['jungle']['soft_score'];f['monthly_temperature'][:]=-10;_,b=evidence(f,'default');self.assertLess(b['jungle']['soft_score'],good/10)
        f=self.fields();f['snow_fraction'][:]=1;_,c=evidence(f,'default');self.assertEqual(c['jungle']['soft_score'],0)
        f=self.fields();f['annual_precipitation'][:]=100;_,d=evidence(f,'default');self.assertLess(d['jungle']['soft_score'],good/5)
    def test_desert_is_aridity_not_precipitation_threshold(self):
        f=self.fields();f['aridity_index'][:]=.1;_,a=evidence(f,'default');f['aridity_index'][:]=2;_,b=evidence(f,'default');self.assertGreater(a['desert']['soft_score'],b['desert']['soft_score']+.5)
    def test_fixed_shortlist_reproducible_without_search(self):
        a=[m.document() for m in mappings()];b=[m.document() for m in mappings()];self.assertEqual(a,b);self.assertEqual([m['name'] for m in a],['v1_baseline','candidate_052','candidate_056','candidate_017']);self.assertEqual(4*len(SCALES)*3*len(SCHEMES),180)
    def test_pareto_tradeoffs_and_dominance(self):
        rows=[{'candidate':'A','climate_median':.4,'climate_min':.3,'latitude_rms_delta_deg':0},{'candidate':'B','climate_median':.6,'climate_min':.4,'latitude_rms_delta_deg':5},{'candidate':'C','climate_median':.5,'climate_min':.35,'latitude_rms_delta_deg':6}]
        r=pareto(rows);self.assertEqual([v['pareto_frontier'] for v in r],[True,True,False]);self.assertEqual(pareto([{'climate_median':None}]),[])
    def test_factor_sensitivity_holds_other_axes_fixed(self):
        rows=[{'vertical_scale_m_per_raw':s,'physics_family':p,'evidence_scheme':'default','climate_consistency':v} for s,p,v in [(.5,'weak',.2),(1.,'weak',.3),(.5,'strong',.8),(1.,'strong',.9)]]
        self.assertAlmostEqual(factor_range(rows,'vertical_scale_m_per_raw'),.1);self.assertAlmostEqual(factor_range(rows,'physics_family'),.6);self.assertEqual(factor_range([], 'evidence_scheme'),None)
    def test_earth_failure_cannot_promote_gaia(self):
        families=json.loads((OUT/'earth_benchmark/parameter_families.json').read_text());c=json.loads((OUT/'gaia_ensemble/conclusion.json').read_text())
        self.assertEqual(c['accepted_family_count'],sum(f['accepted'] for f in families))
        if not c['accepted_family_count']:self.assertEqual(c['evaluated_scenarios'],0);self.assertFalse(c['formal_v2']);self.assertIsNone(c['balanced_role'])
    def test_output_boundary_rejects_frozen_paths(self):
        with self.assertRaises(ValueError):target(ROOT/'output/climate_v2/must_not_write.json')
        with self.assertRaises(ValueError):target(ROOT/'web/should_not_write.txt')

class SavedV21Products(unittest.TestCase):
    def test_all_four_actual_rasters_conserve_additive_areas(self):
        for m in mappings():
            f=dict(np.load(OUT/f'rasterization/{m.name}.npz'));audit=json.loads((OUT/f'rasterization/{m.name}_audit.json').read_text())
            self.assertLess(audit['maximum_additive_relative_error'],1e-10)
            np.testing.assert_allclose(f['land_fraction']+f['ocean_fraction']+f['unknown_fraction'],1,atol=1e-12)
            self.assertTrue(np.all(f['terrain_fraction']>=0));self.assertTrue(np.all(f['mean_elevation_land_raw']<=f['max_elevation_raw']+1e-7))
            self.assertTrue(np.all(f['mean_elevation_land_raw']>=f['min_elevation_raw']-1e-7))
            self.assertEqual(f['terrain_fraction'].shape,(32,72,144));self.assertEqual(audit['source_triangles'],142586)
    def test_wetness_product_explicitly_earth_not_gaia(self):
        from osgeo import gdal
        meta=json.loads((OUT/'hydrology/wetness_index_metadata.json').read_text());self.assertEqual(meta['body'],'Earth')
        ds=gdal.Open(str(OUT/'wetness_index.tif'));self.assertIn('WGS 84',ds.GetProjection());self.assertEqual(ds.GetGeoTransform()[5],-2.5)
        data=ds.ReadAsArray();self.assertTrue(np.all((data>=0)&(data<=1)))
    def test_ensemble_missing_scores_are_blank_not_zero(self):
        import csv
        with (OUT/'candidate_ensemble.csv').open() as stream:rows=list(csv.DictReader(stream))
        self.assertEqual(len(rows),180)
        for r in rows:
            if r['earth_gate_passed']=='False':self.assertEqual(r['status'],'not_run_earth_gate_failed');self.assertEqual(r['climate_consistency'],'')
