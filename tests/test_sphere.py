import json
import math
import os
from pathlib import Path
import sqlite3
import struct
import unittest

from gaiagis.reconstruction import (Mapping,SphereConfig,read_config,wrap_longitude,
                                    split_antimeridian,clip_horizon,visibility,clip_axis)
from gaiagis.caps import build_caps,derived_topology
from gaiagis.dataset import discover,fingerprint
from gaiagis.map_reader import parse_map
from gaiagis.safety import WORKSPACE_ROOT

MAPPING = Mapping(294912,229376,SphereConfig())

def area(points):
    return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(points,points[1:]+points[:1])))/2

class AnalyticMappingTests(unittest.TestCase):
    def test_longitude_endpoints_and_equator(self):
        for x,expected in ((0,-180),(147456,0),(294912,180)):
            lon,lat,z = MAPPING.game_to_geographic(x,114688,5)
            self.assertEqual(lon,expected)
            self.assertEqual(lat,0)
            self.assertEqual(z,5)

    def test_latitude_symmetry_and_equivalent_formula(self):
        for n in (0,12345,70000,114688,229376):
            lat = MAPPING.game_to_geographic(0,n,0)[1]
            reflected = MAPPING.game_to_geographic(0,229376-n,0)[1]
            alternate = math.degrees(2*math.atan(math.exp((229376/2-n)/MAPPING.raw_radius))-math.pi/2)
            self.assertAlmostEqual(lat,-reflected,places=12)
            self.assertAlmostEqual(lat,alternate,places=12)
        self.assertAlmostEqual(MAPPING.phi_max,MAPPING.game_to_geographic(0,0,0)[1],places=12)
        self.assertGreater(MAPPING.phi_max,80)
        self.assertLess(MAPPING.phi_max,81)

    def test_roundtrip_raw_coordinates_and_height(self):
        for east,north,height in ((0,0,-738),(294912,229376,4086),(98765,54321,17),(147456,114688,0)):
            actual = MAPPING.geographic_to_game(*MAPPING.game_to_geographic(east,north,height))
            for a,b in zip(actual,(east,north,height)):
                self.assertAlmostEqual(a,b,places=7)

    def test_wrap_periodicity_and_shifted_cut(self):
        for lon in (-720,-181,180,361,900):
            self.assertTrue(-180<=wrap_longitude(lon)<180)
            self.assertEqual(wrap_longitude(lon),wrap_longitude(lon+360))
        shifted = Mapping(294912,229376,SphereConfig(antimeridian_game_east=8192))
        self.assertEqual(shifted.game_to_geographic(8192,0,0)[0],-180)
        self.assertEqual(shifted.game_to_geographic(8192+294912,0,0)[0],180)

    def test_flip_flatten_scale_radius(self):
        flipped = Mapping(294912,229376,SphereConfig(flip_latitude=True,vertical_scale_m_per_raw_unit=2,radius_m=1000000))
        geo = flipped.game_to_geographic(7000,0,30)
        self.assertEqual(geo[1],-MAPPING.phi_max)
        self.assertEqual(geo[2],60)
        point = flipped.geographic_to_cartesian(*geo)
        self.assertAlmostEqual(math.sqrt(sum(v*v for v in point)),1000060,places=7)
        flat = Mapping(294912,229376,SphereConfig(flatten=True))
        self.assertEqual(flat.game_to_geographic(0,0,4086)[2],0)
        with self.assertRaisesRegex(ValueError,"not invertible"):
            flat.geographic_to_game(0,0,0)

    def test_cartesian_axes(self):
        r = MAPPING.config.radius_m
        for lon,lat,expected in ((0,0,(r,0,0)),(90,0,(0,r,0)),(0,90,(0,0,r)),(0,-90,(0,0,-r))):
            for a,b in zip(MAPPING.geographic_to_cartesian(lon,lat),expected):
                self.assertAlmostEqual(a,b,places=7)

    def test_invalid_config_and_pole_inverse(self):
        for values in (dict(radius_m=0),dict(radius_m=float("nan")),dict(ring_count=0),dict(method="climate_fit"),dict(mercator_max_latitude_deg=90)):
            with self.assertRaises(ValueError):
                SphereConfig(**values)
        with self.assertRaises(ValueError):
            MAPPING.geographic_to_game(0,90,0)
        self.assertEqual(read_config(WORKSPACE_ROOT/"config"/"default.toml"),SphereConfig())

class SeamAndVisibilityTests(unittest.TestCase):
    def test_antimeridian_short_triangle_is_split(self):
        original = [(179,0,0),(-179,0,20),(179,2,40)]
        parts = split_antimeridian(original)
        self.assertEqual(len(parts),2)
        self.assertAlmostEqual(sum(area(p) for p in parts),2)
        for part in parts:
            self.assertLessEqual(max(p[0] for p in part)-min(p[0] for p in part),2)
            self.assertTrue(all(-180<=p[0]<=180 for p in part))
        crossings = [p for part in parts for p in part if abs(p[0])==180]
        self.assertIn((180,0,10),crossings)
        self.assertIn((-180,0,10),crossings)

    def test_sides_of_cut_and_source_degeneracy_retained(self):
        for lon in (-180,180):
            parts = split_antimeridian([(lon,0,0),(lon,1,0),(lon,2,0)])
            self.assertEqual(len(parts),1)
            self.assertEqual(len(parts[0]),3)
        self.assertEqual(len(split_antimeridian([(0,0,0)]*3)),1)

    def test_mercator_clipping_interpolates_height(self):
        parts = clip_axis([(0,80,0),(1,90,100),(2,80,0)],1,85,False)
        self.assertEqual(len(parts),4)
        self.assertTrue(all(p[1]<=85 for p in parts))
        self.assertTrue(all(p[2]==50 for p in parts if p[1]==85))

    def test_orthographic_horizon_clipping(self):
        clipped = clip_horizon([(89,0,0),(91,0,20),(89,2,40)])
        self.assertEqual(len(clipped),4)
        self.assertTrue(all(visibility(p,0,0)>=-1e-12 for p in clipped))
        self.assertEqual(clip_horizon([(170,0,0),(171,1,0),(172,0,0)]),[])
        # Non-equatorial, shifted center, not a longitude-only clipping shortcut.
        shifted = clip_horizon([(75,-50,0),(75,0,0),(76,0,0)],45,45)
        self.assertGreaterEqual(len(shifted),3)
        self.assertTrue(all(visibility(p,45,45)>=-1e-12 for p in shifted))

    def test_pole_on_horizon_does_not_introduce_hidden_vertex(self):
        triangle = [(-179,88,0),(-178,88,0),(-178.5,90,0)]
        clipped = clip_horizon(triangle)
        self.assertTrue(all(visibility(p,0,0)>=-1e-12 for p in clipped))
        self.assertTrue(all(abs(p[1]-90)<1e-12 for p in clipped))

class ProjectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from gaiagis.gis_export import make_crs
        cls.crs = make_crs(SphereConfig(),WORKSPACE_ROOT/"output"/"reconstruction"/"test_crs")

    def test_custom_crs_has_sphere_and_no_earth_authority(self):
        geographic = self.crs["geographic"]
        self.assertAlmostEqual(geographic.GetSemiMajor(),6371008.8)
        self.assertAlmostEqual(geographic.GetSemiMinor(),6371008.8)
        self.assertIsNone(geographic.GetAuthorityCode(None))
        self.assertIn("Gaia",geographic.ExportToWkt())

    def test_geopackage_creation_enables_wkt2_extension(self):
        from gaiagis.gis_export import Package
        path = WORKSPACE_ROOT/"output"/"reconstruction"/"test_crs"/"wkt2.gpkg"
        package = Package(path)
        layer = package.layer("test_surface",self.crs["geographic"])
        package.close()
        layer = None
        with sqlite3.connect(path) as db:
            wkt = db.execute("SELECT definition_12_063 FROM gpkg_spatial_ref_sys WHERE srs_name='Gaia Geographic'").fetchone()[0]
            self.assertTrue(wkt.startswith("GEODCRS[") or wkt.startswith("GEOGCRS["))
            self.assertIn("Gaia",wkt)

    def test_projection_roundtrips_with_z(self):
        from osgeo import osr
        for name in ("equirectangular","mercator","mollweide","orthographic"):
            forward = osr.CoordinateTransformation(self.crs["geographic"],self.crs[name])
            inverse = osr.CoordinateTransformation(self.crs[name],self.crs["geographic"])
            for point in ((0,0,15),(15,40,-738),(-45,-60,4086),(60,20,0)):
                projected = forward.TransformPoint(*point)
                self.assertTrue(all(math.isfinite(v) for v in projected))
                actual = inverse.TransformPoint(*projected)
                for a,b in zip(point,actual):
                    self.assertAlmostEqual(a,b,places=7,msg=f"{name}: {point}")

@unittest.skipUnless(os.environ.get("GAIAGIS_SOURCE_ROOT"),"Real source path not specified")
class SphereDatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.world = parse_map(discover(Path(os.environ["GAIAGIS_SOURCE_ROOT"])).files["wm0.map"],0)
        cls.mapping = Mapping(*cls.world.extent,SphereConfig())
        cls.caps = build_caps(cls.world,cls.mapping)
        cls.output = WORKSPACE_ROOT/"output"

    def test_cap_attachment_and_poles_closed_without_source_repair(self):
        diagnostic = derived_topology(self.world,self.caps)
        self.assertEqual(diagnostic["cap_or_attachment_open_edges"],0)
        self.assertEqual(diagnostic["cap_or_attachment_nonmanifold_edges"],0)
        self.assertEqual(diagnostic["source_repairs_performed"],0)
        without = derived_topology(self.world,[])
        self.assertEqual(without["open_edges"]-diagnostic["open_edges"],sum(c.boundary_count for c in self.caps))
        for cap in self.caps:
            self.assertEqual(len(cap.vertices)-cap.boundary_count,8*cap.boundary_count+1)
            self.assertEqual(len(cap.triangles),(8*2+1)*cap.boundary_count)
            self.assertEqual(len([p for p in cap.vertices if abs(p[1])==90]),1)
            self.assertTrue(all(p[2]==0 for p in cap.vertices))
            for t in cap.triangles:
                for p in cap.polygon(t):
                    self.assertTrue(all(math.isfinite(v) for v in self.mapping.geographic_to_cartesian(*p)))

    def test_flip_caps_follow_geographic_hemisphere(self):
        flipped = build_caps(self.world,Mapping(*self.world.extent,SphereConfig(flip_latitude=True,ring_count=2)))
        self.assertEqual(flipped[0].hemisphere,"south")
        self.assertEqual(flipped[1].hemisphere,"north")
        self.assertEqual(derived_topology(self.world,flipped)["cap_or_attachment_nonmanifold_edges"],0)

    def test_shifted_longitude_cut_splits_real_meshes_without_losing_lineage(self):
        from gaiagis.gis_export import geographic_features
        shifted = Mapping(*self.world.extent,SphereConfig(antimeridian_game_east=3500))
        caps = build_caps(self.world,shifted)
        identities = set()
        split_count = 0
        for points,attributes in geographic_features(self.world,caps,shifted):
            self.assertLessEqual(max(p[0] for p in points)-min(p[0] for p in points),180+1e-9)
            self.assertTrue(all(-180-1e-9<=p[0]<=180+1e-9 for p in points))
            if attributes["geometry_origin"]=="ff7":
                identities.add((attributes["section_id"],attributes["mesh_id"],attributes["triangle_id"]))
                split_count += attributes["part_id"]>0
        expected = {(m.section_id,m.mesh_id,t.triangle_id) for m in self.world.base_meshes for t in m.triangles}
        self.assertEqual(identities,expected)
        self.assertGreater(split_count,0)

    def test_geographic_preserves_every_source_identity_and_null_cap_lineage(self):
        with sqlite3.connect(self.output/"gis"/"gaia_geographic.gpkg") as db:
            rows = db.execute("SELECT section_id,mesh_id,triangle_id,terrain_id,region_id,script_id,texture_id,is_chocobo,source_vertex_indices FROM gaia_ff7_surface").fetchall()
            expected = {(m.section_id,m.mesh_id,t.triangle_id):(t.ff7_terrain_type,t.region,t.script,t.texture,int(t.is_chocobo),list(t.indices)) for m in self.world.base_meshes for t in m.triangles}
            actual = {}
            for s,m,t,terrain,region,script,texture,chocobo,indices in rows:
                attributes = (terrain,region,script,texture,chocobo,json.loads(indices))
                self.assertEqual(expected[(s,m,t)],attributes)
                actual[(s,m,t)] = attributes
            self.assertEqual(actual,expected)
            invalid = db.execute("SELECT count(*) FROM gaia_polar_caps WHERE source_file IS NOT NULL OR map_id IS NOT NULL OR section_id IS NOT NULL OR mesh_id IS NOT NULL OR triangle_id IS NOT NULL OR terrain_id IS NOT NULL OR region_id IS NOT NULL OR script_id IS NOT NULL OR texture_id IS NOT NULL").fetchone()[0]
            self.assertEqual(invalid,0)
            srs = db.execute("SELECT organization,organization_coordsys_id,definition_12_063 FROM gpkg_spatial_ref_sys WHERE srs_id=(SELECT srs_id FROM gpkg_contents WHERE table_name='gaia_surface')").fetchone()
            self.assertNotEqual((srs[0],srs[1]),("EPSG",4326))
            self.assertIn("Gaia",srs[2])

    def test_glb_original_indices_and_float32_radial_precision(self):
        data = (self.output/"3d"/"gaia_sphere.glb").read_bytes()
        magic,version,total = struct.unpack_from("<4sII",data)
        self.assertEqual((magic,version,total),(b"glTF",2,len(data)))
        length,kind = struct.unpack_from("<I4s",data,12)
        self.assertEqual(kind,b"JSON")
        document = json.loads(data[20:20+length])
        binary = memoryview(data)[28+length:]
        error = 0.0
        for mesh,source in zip(document["meshes"],self.world.base_meshes):
            primitive = mesh["primitives"][0]
            access = document["accessors"][primitive["indices"]]
            view = document["bufferViews"][access["bufferView"]]
            indices = struct.unpack_from("<"+str(access["count"])+"I",binary,view["byteOffset"])
            self.assertEqual(indices,tuple(i for t in source.triangles for i in t.indices))
            access = document["accessors"][primitive["attributes"]["POSITION"]]
            view = document["bufferViews"][access["bufferView"]]
            for i in range(access["count"]):
                p = struct.unpack_from("<fff",binary,view["byteOffset"]+i*12)
                expected = 6371008.8+source.position(i)[2]
                error = max(error,abs(math.sqrt(sum(v*v for v in p))-expected))
        self.assertLess(error,0.6)
        for mesh,cap in zip(document["meshes"][len(self.world.base_meshes):],self.caps,strict=True):
            primitive = mesh["primitives"][0]
            access = document["accessors"][primitive["indices"]]
            view = document["bufferViews"][access["bufferView"]]
            indices = struct.unpack_from("<"+str(access["count"])+"I",binary,view["byteOffset"])
            self.assertEqual(indices,tuple(i for t in cap.triangles for i in t))
            access = document["accessors"][primitive["attributes"]["POSITION"]]
            view = document["bufferViews"][access["bufferView"]]
            self.assertEqual(access["count"],len(cap.vertices))
            for i in range(access["count"]):
                p = struct.unpack_from("<fff",binary,view["byteOffset"]+i*12)
                self.assertLess(abs(math.sqrt(sum(v*v for v in p))-6371008.8),0.6)

    def test_all_exported_polygons_have_finite_coordinates_and_short_geo_spans(self):
        from osgeo import ogr
        for filename in ("gaia_geographic.gpkg","gaia_projections.gpkg"):
            dataset = ogr.Open(str(self.output/"gis"/filename),0)
            self.assertIsNotNone(dataset)
            for layer in dataset:
                if layer.GetName()=="gaia_cap_vertices":
                    continue
                for feature in layer:
                    ring = feature.GetGeometryRef().GetGeometryRef(0)
                    points = [ring.GetPoint(i) for i in range(ring.GetPointCount())]
                    self.assertTrue(all(math.isfinite(v) for p in points for v in p))
                    if filename=="gaia_geographic.gpkg":
                        self.assertLessEqual(max(p[0] for p in points)-min(p[0] for p in points),180+1e-8)
            dataset = None

    def test_build_metadata_source_unchanged_and_project_reopened(self):
        metadata = json.loads((self.output/"reconstruction"/"build_metadata.json").read_text(encoding="utf-8"))
        self.assertEqual(metadata["ff7_source_modified"],"NO")
        self.assertTrue(all(r["unchanged"] for r in metadata["source_fingerprint"]["comparison"]))
        self.assertTrue(metadata["qgis"]["reopened"])
        self.assertEqual(metadata["qgis"]["valid_layers"],8)
        current = fingerprint(discover(Path(os.environ["GAIAGIS_SOURCE_ROOT"])))
        self.assertEqual(current["files"],metadata["source_fingerprint"]["after"]["files"])
