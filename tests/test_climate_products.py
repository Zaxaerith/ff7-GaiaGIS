# SPDX-License-Identifier: GPL-3.0-only
"""Independent numerical, evidence, saved product and V1 preservation checks."""
import hashlib,json,sqlite3,unittest
from contextlib import closing
from pathlib import Path
import numpy as np
from scipy.io import netcdf_file
from gaiagis.climate.settings import ROOT,settings,evidence_settings
from gaiagis.climate.grid import Grid
from gaiagis.climate.latitude import LatitudeMapping,v1_latitude
from gaiagis.climate.evidence import score_evidence
from gaiagis.climate.geography import load_source,rasterize_raw,remap_raw
from gaiagis.climate.gcm import t21_grid

OUT=ROOT/'output/climate_v2'

class EvidenceAndRasterTests(unittest.TestCase):
    def test_score_follows_climate_not_preassigned_latitude(self):
        g=Grid(30);shape=(g.ny,g.nx);config=settings();m=LatitudeMapping('control',v1_latitude(np.linspace(0,1,7),7/9),7/9,True)
        source={'raw':np.array([[[30,50,0]]*3,[[60,50,0]]*3]),'width':100,'height':100,'ids':np.array([[0,0,0,0,25,0],[0,0,0,1,2,0]]),'area_v1':np.ones(2)}
        fields={'monthly_temperature':np.full((12,*shape),25.),'annual_precipitation':np.full(shape,2400.),'aridity_index':np.ones(shape),
                'snow_season_months':np.zeros(shape),'snow_fraction':np.zeros(shape),'monthly_precipitation':np.full((12,*shape),200.),'annual_temperature':np.full(shape,25.),'koppen_class':np.ones(shape,dtype=int)}
        hot,_,scores=score_evidence(source,m,g,fields,evidence_settings());self.assertGreater(hot,.5);self.assertTrue(np.isnan(scores[1]))
        fields['monthly_temperature'][:]=-10
        cold,_,_=score_evidence(source,m,g,fields,evidence_settings());self.assertLess(cold,.01)
    def test_raw_raster_height_interpolation_and_ocean_mapping(self):
        c=settings();c['geometry']['raw_sample_rows']=8;c['geometry']['raw_sample_columns']=8
        source={'width':8,'height':8,'raw':np.array([[[0,0,0],[8,0,80],[0,8,80]],[[8,0,80],[8,8,160],[0,8,80]]]),'ids':np.array([[0,0,0,0,0,0],[0,0,0,1,3,0]])}
        raw,d=rasterize_raw(source,c);self.assertEqual(d['uncovered_fraction'],0);self.assertTrue(set(np.unique(raw['land']))=={0.,1.})
        yy,xx=np.indices((8,8));expected=(xx+yy+1)*10
        np.testing.assert_allclose(raw['height_raw'][raw['land']==1],expected[raw['land']==1]);self.assertTrue(np.all(raw['height_raw'][raw['land']==0]==0))
    def test_periodic_gaussian_remap_has_no_missing_lon_strip(self):
        c=settings();g=t21_grid(c['planet']['radius_m']);m=LatitudeMapping('control',v1_latitude(np.linspace(0,1,7),7/9),7/9,True)
        raw={'land':np.ones((24,48)),'height_raw':np.zeros((24,48)),'unknown':np.zeros((24,48))}
        land,_,d=remap_raw(raw,m,g,c);np.testing.assert_allclose(land,np.broadcast_to(land[:,[0]],land.shape),atol=1e-13)
        self.assertLess(d['relative_remap_land_area_error'],1e-12)

@unittest.skipUnless((OUT/'best_fast_model.nc').exists(),'Run V2 export for saved-product checks')
class SavedClimateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with netcdf_file(OUT/'best_fast_model.nc','r',mmap=False) as nc:
            cls.fields={k:v.data.copy() for k,v in nc.variables.items()};cls.metadata=json.loads(nc.history)
        cls.mapping=json.loads((OUT/'latitude_mapping.json').read_text())
    def test_netcdf_shapes_finite_ranges_and_area(self):
        f=self.fields;self.assertEqual(f['monthly_temperature'].shape,(12,72,144))
        for key,value in f.items():self.assertTrue(np.isfinite(value).all(),key)
        self.assertTrue(np.all((f['land_fraction']>=-1e-6)&(f['land_fraction']<=1+1e-6)))
        self.assertGreaterEqual(f['monthly_precipitation'].min(),0)
        self.assertAlmostEqual(f['cell_area'].sum()/(4*np.pi*6371008.8**2),1,places=12)
    def test_pure_ocean_snow_diagnostic_is_not_sea_ice(self):
        pure=self.fields['land_fraction']==0
        self.assertTrue(np.all(self.fields['snow_fraction'][pure]==0))
    def test_geopackage_every_source_lineage_and_original_corners(self):
        source=load_source(ROOT);lookup={tuple(r[:4]):k for k,r in enumerate(source['ids'])}
        with closing(sqlite3.connect((OUT/'gaia_climate_v2.gpkg').as_uri()+'?mode=ro&immutable=1',uri=True)) as db:
            rows=db.execute('SELECT map_id,section_id,mesh_id,triangle_id,part_id,raw_game_corners_json,v1_corners_json,v2_corners_json,latitude_delta,climate_grid_degrees,climate_model FROM gaia_climate_v2')
            seen=set()
            for a,b,c,d,part,raw,geo,v2,delta,res,model in rows:
                key=(a,b,c,d);seen.add(key);index=lookup[key]
                np.testing.assert_array_equal(json.loads(raw),source['raw'][index]);np.testing.assert_array_equal(json.loads(geo),source['geo'][index])
                old=np.array(json.loads(geo));new=np.array(json.loads(v2));np.testing.assert_array_equal(new[:,[0,2]],old[:,[0,2]])
                self.assertEqual(res,2.5);self.assertIn('GCM pending',model)
            self.assertEqual(seen,set(lookup))
    def test_raster_north_up_pixels_and_custom_gaia_crs(self):
        from osgeo import gdal
        ds=gdal.Open(str(OUT/'temperature_annual.tif'));self.assertEqual(ds.GetGeoTransform(),(-180.,2.5,0.,90.,0.,-2.5))
        np.testing.assert_allclose(ds.ReadAsArray(),self.fields['annual_temperature'][::-1],atol=1e-6)
        self.assertIn('Gaia',ds.GetProjection());self.assertNotIn('EPSG","4326',ds.GetProjection())
    def test_gcm_sra_units_and_orientation_against_netcdf(self):
        directory=OUT/'gcm'/self.mapping['recommended']['name']
        with netcdf_file(directory/'boundary_fractional.nc','r',mmap=False) as nc:
            land=nc.variables['land_fraction'].data.copy();height=nc.variables['elevation'].data.copy();lon=nc.variables['lon'].data.copy()
        order=np.argsort(lon%360);binary=(land[::-1][:,order]>=.5).astype(float)
        z=np.divide(height,land,out=np.zeros_like(height),where=land>0)[::-1][:,order]*binary*settings()['planet']['gravity_m_s2']
        for code,expected in [(172,binary),(129,z)]:
            text=(directory/f'gaia_surf_{code:04}.sra').read_text().split();header=list(map(int,text[:8]));actual=np.array(text[8:],dtype=float).reshape(32,64)
            self.assertEqual(header[0],code);self.assertEqual(header[4:6],[64,32]);np.testing.assert_allclose(actual,expected,atol=.01,rtol=1e-6)
    def test_all_candidates_satisfy_numerical_budgets_and_provenance(self):
        state=json.loads((OUT/'run-settings.json').read_text());runs=list((OUT/'candidate_runs').glob('*.json'));self.assertEqual(len(runs),64)
        for path in runs:
            run=json.loads(path.read_text());r=run['record'];self.assertEqual(run['provenance_signature'],state['signature'])
            self.assertLess(r['periodic_max_drift_k'],.02);self.assertLess(r['energy_equation_max_residual_w_m2'],1e-7)
            self.assertLess(abs(r['annual_global_toa_imbalance_w_m2']),.1);self.assertLess(r['water_balance_max_monthly_residual_mm'],1e-8)

class PreservationTests(unittest.TestCase):
    def test_every_frozen_v1_file_unchanged(self):
        manifest=json.loads((OUT/'v1-freeze.json').read_text())['v1_files']
        for name,expected in manifest.items():
            path=ROOT/name;h=hashlib.sha256()
            with path.open('rb') as stream:
                for data in iter(lambda:stream.read(1048576),b''):h.update(data)
            self.assertEqual({'size':path.stat().st_size,'sha256':h.hexdigest()},expected,name)
