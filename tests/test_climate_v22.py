# SPDX-License-Identifier: GPL-3.0-only
import unittest
import numpy as np
from shapely import Polygon
from gaiagis.climate.grid import Grid
from gaiagis.climate.v22.pet_reference import penman_monteith,convert_units,valid_domain,bounded,rules
from gaiagis.climate.v22.gate import assert_no_leakage,CALIBRATION_ROLES,VALIDATION_ROLES,region_mask,regime_checks,regional_values,dataset_roles
from gaiagis.climate.v22.diagnostics import reservoir_kind
from gaiagis.climate.v22.overlap import labels,select_surfaces,fragment_source
from gaiagis.climate.v22.common import OUT,ROOT,target,read
from gaiagis.climate.v22.periodic_bucket import saturated_periodic_bucket

class PETTests(unittest.TestCase):
    def test_fao56_example18(self):
        # Official Uccle worked example, FAO56 chapter4: ET0 approximately3.9mm/day.
        p=100.1;ea=1.409;q=.622*ea/(p-.378*ea)
        et,data=penman_monteith(np.array(16.9),np.array(12.3),np.array(21.5),p,q,10/3.6,np.array(22.07),np.array(41.09),100)
        self.assertAlmostEqual(float(et),3.88,delta=.04);self.assertAlmostEqual(float(data['wind2_m_s']),2.078,delta=.01)
    def test_humidity_mass_unit(self):np.testing.assert_allclose(convert_units('specific_humidity',np.array([10.]),'grams/kg'),[.01])
    def test_reject_undocumented_unit(self):
        with self.assertRaises(ValueError):convert_units('pressure',np.ones(1),'hPa')
    def test_pascal_alias(self):np.testing.assert_array_equal(convert_units('pressure',np.array([100000]),'Pascals'),[100000])
    def test_radiation_unit_conversion(self):self.assertAlmostEqual(100*86400/1e6,100*.0864)
    def fixture(self):
        t=np.ones((12,1,1))*20
        return {'land_fraction':np.ones((1,1)),'monthly_temperature':t,'annual_temperature':t.mean(axis=0),'snow_fraction':np.zeros((1,1))}
    def test_valid_crop_domain(self):self.assertTrue(valid_domain(self.fixture(),np.array([[1000]]),rules()).item())
    def test_low_pet_excluded(self):self.assertFalse(valid_domain(self.fixture(),np.array([[99]]),rules()).item())
    def test_frozen_domain_excluded(self):
        ref=self.fixture();ref['annual_temperature'][:]=-1
        self.assertFalse(valid_domain(ref,np.array([[1000]]),rules()).item())
    def test_persistent_snow_excluded(self):
        ref=self.fixture();ref['snow_fraction'][:]=.6
        self.assertFalse(valid_domain(ref,np.array([[1000]]),rules()).item())
    def test_too_few_thawed_months_excluded(self):
        ref=self.fixture();ref['monthly_temperature'][:]=-1;ref['monthly_temperature'][:2]=20
        self.assertFalse(valid_domain(ref,np.array([[1000]]),rules()).item())
    def test_bounded_zero_and_extremes(self):np.testing.assert_allclose(bounded(np.array([0,0,1,1000000]),np.array([0,1,0,1])),[0,0,1,1000000/1000001])

class ValidationTests(unittest.TestCase):
    def test_role_separation(self):assert_no_leakage(CALIBRATION_ROLES,VALIDATION_ROLES)
    def test_actual_new_validation_files_never_calibration_inputs(self):
        roles=dataset_roles();self.assertFalse(roles['parameter_retuning_in_v22']);self.assertEqual(len(roles['validation_only_meteorology']),4)
    def test_leakage_rejected(self):
        with self.assertRaises(ValueError):assert_no_leakage({'aridity'},{'aridity'})
    def test_region_halfopen_boundary(self):
        grid=Grid(30);mask=region_mask(grid,[-30,30,-30,30]);self.assertEqual(int(mask.sum()),4)
    def test_regime_failure_reported(self):self.assertFalse(regime_checks({'temperature_min':18},17,0,0,0)['temperature_min'])
    def test_no_cold_infinite_regional_aridity(self):
        f={key:np.ones((1,1)) for key in ['annual_temperature','annual_precipitation','snow_fraction']}
        self.assertIsNone(regional_values(f,np.zeros((1,1)),np.ones((1,1)))['aridity'])
    def test_soil_snow_separation(self):
        self.assertEqual(reservoir_kind(np.array([-5,-1]),100,0),'persistent_ice_accumulation_soil_inactive')
        self.assertEqual(reservoir_kind(np.array([-5,5]),0,.2),'soil_slow_or_nonperiodic')
    def test_source_path_output_rejected(self):
        with self.assertRaises(ValueError):target(ROOT/'src/prohibited.json')
    def test_predeclared_rules_unchanged_after_reference(self):
        from gaiagis.climate.v22.common import digest
        record=read(OUT/'earth/pet_reference.json')
        self.assertEqual(record['configuration_sha256'],digest(ROOT/'config/climate/v22/aridity_validation.toml'))
        self.assertEqual(record['design_sha256'],digest(ROOT/'docs/climate/v22/validation-design.md'))
    def test_instrumentation_matches_frozen_baseline(self):
        for family in ['weak','medium','strong']:
            record=read(OUT/f'soil/{family}_diagnostics.json')
            self.assertLess(max(record['baseline_max_absolute_differences'].values()),1e-8)
    def test_no_gaia_eligibility_bypass(self):
        gate=read(OUT/'earth/heldout_metrics.json');conclusion=read(OUT/'gaia_ensemble/conclusion.json')
        self.assertLess(gate['acceptable_family_count'],3);self.assertEqual(conclusion['status'],'not_run_earth_gate_failed');self.assertFalse(conclusion['formal_v2_mapping'])

class SurfaceTests(unittest.TestCase):
    def fixture(self):
        p=Polygon([(0,0),(2,0),(0,2)]);polys=[p,p];affine=np.array([[0.,0,0],[0,0,10]])
        return polys,affine,[(0,1,p)],np.array([0,13])
    def test_duplicate_class(self):
        tags=labels(0,1,True,np.zeros(3),np.array([0,0]),np.array([0,0]),np.array([0,0]),np.zeros((2,3)))
        self.assertEqual(tags,['exact_duplicate'])
    def test_bridge_height_classes(self):
        tags=labels(0,1,True,np.ones(3)*10,np.array([0,13]),np.array([0,0]),np.array([0,0]),np.zeros((2,3)))
        self.assertIn('same_xy_different_height',tags);self.assertIn('bridge_like',tags);self.assertIn('gameplay_alternate_hypothesis',tags)
    def test_tunnel_and_cliff_classes(self):
        tags=labels(0,1,False,np.ones(3),np.array([12,15]),np.zeros(2),np.zeros(2),np.zeros((2,3)))
        self.assertIn('tunnel_like',tags);self.assertIn('cliff_vertical_like',tags)
    def test_unknown_preserved(self):self.assertEqual(labels(0,1,False,np.ones(3),np.zeros(2),np.zeros(2),np.zeros(2),np.zeros((2,3))),['unknown'])
    def test_highest_lowest_union_conservation(self):
        polys,affine,pairs,terrain=self.fixture()
        for policy in ['highest','lowest','natural_priority']:
            selected=select_surfaces(polys,affine,pairs,terrain,policy)
            self.assertAlmostEqual(sum(selected.get(i,p).area for i,p in enumerate(polys)),2.)
        self.assertEqual(select_surfaces(polys,affine,pairs,terrain,'highest')[0].area,0)
        self.assertEqual(select_surfaces(polys,affine,pairs,terrain,'lowest')[1].area,0)
    def test_natural_priority_excludes_bridge(self):
        polys,affine,pairs,terrain=self.fixture();self.assertEqual(select_surfaces(polys,affine,pairs,terrain,'natural_priority')[1].area,0)
    def test_crossing_planes_fragment_union(self):
        polys,affine,pairs,terrain=self.fixture();affine[1]=[1,0,-.5]
        selected=select_surfaces(polys,affine,pairs,terrain,'highest')
        self.assertAlmostEqual(sum(selected.get(i,p).area for i,p in enumerate(polys)),2.)
        self.assertGreater(selected[0].area,0);self.assertGreater(selected[1].area,0)
    def test_same_height_tie_lineage(self):
        polys,affine,pairs,terrain=self.fixture();affine[:]=0
        selected=select_surfaces(polys,affine,pairs,terrain,'highest');self.assertEqual(selected[1].area,0);self.assertEqual(selected.get(0,polys[0]).area,2.)
    def test_fragment_preserves_original_plane_and_lineage(self):
        polys,affine,pairs,terrain=self.fixture();selected=select_surfaces(polys,affine,pairs,terrain,'highest')
        raw=np.array([[[0,0,0],[2,0,0],[0,2,0]],[[0,0,10],[2,0,10],[0,2,10]]])
        source={'raw':raw,'ids':np.array([[0,1,2,3,0,0],[0,1,2,4,13,0]]),'area_v1':np.array([2.,2.])}
        f=fragment_source(source,polys,selected,affine)
        self.assertTrue(np.all(f['raw'][:,:,2]==10));self.assertTrue(np.all(f['ids'][:,3]==4));np.testing.assert_array_equal(source['raw'],raw)
    def test_actual_surface_union_and_sphere_conservation(self):
        import csv
        with (OUT/'overlap/policy_summary.csv').open() as f:rows=list(csv.DictReader(f))
        self.assertEqual(len(rows),3)
        for row in rows:
            self.assertLess(float(row['union_conservation_relative_error']),1e-10)
            self.assertLess(float(row['additive_relative_error']),1e-8)
            self.assertLess(float(row['maximum_cover_ratio']),1+1e-9)

class PeriodicBucketTests(unittest.TestCase):
    def test_periodic_positive_net_import_spills(self):
        start,store,runoff=saturated_periodic_bucket([10,-4],150)
        self.assertEqual(start,146);np.testing.assert_allclose(store,[150,146]);self.assertAlmostEqual(runoff.sum(),6)
    def test_periodic_mass_budget(self):
        start,store,runoff=saturated_periodic_bucket([1,-.5,2,-.1],150)
        before=np.r_[start,store[:-1]]
        np.testing.assert_allclose(store+runoff-before,[1,-.5,2,-.1],atol=1e-12);self.assertAlmostEqual(store[-1],start)
    def test_negative_net_not_saturated_spill_solution(self):
        with self.assertRaises(ValueError):saturated_periodic_bucket([-1,-2],150)
    def test_repair_preserves_climate_and_snow(self):
        for name in ['weak','medium']:
            old=dict(np.load(OUT/f'soil/{name}_fields.npz'));new=dict(np.load(OUT/f'soil/{name}_periodic_fields.npz'))
            for key in ['monthly_precipitation','monthly_evaporation','monthly_land_et','monthly_melt','monthly_swe','annual_temperature']:
                np.testing.assert_array_equal(old[key],new[key])
            self.assertLess(float(abs(new['soil_year_drift']).max()),.05)
