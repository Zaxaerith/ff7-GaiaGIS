# SPDX-License-Identifier: GPL-3.0-only
import math
from fractions import Fraction
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from gaiagis.native_analysis import triangle_metrics, analyze, distance_xz, analyze_world, query_surfaces, transect_surfaces
from gaiagis.native_gis import safe_target
from gaiagis.safety import WORKSPACE_ROOT


class NativeAnalysisTests(unittest.TestCase):
    def test_fraction_plane_and_winding(self):
        p=[(-2, -3, 5),(5, -3, 7),(-2, 8, -1)]
        a=triangle_metrics(p); b=triangle_metrics(p[::-1])
        self.assertEqual(a['a'], Fraction(2,7)); self.assertEqual(a['b'], Fraction(-6,11))
        self.assertEqual(a['determinant'], -b['determinant']); self.assertEqual(a['area'], b['area'])
        self.assertEqual((a['a'],a['b']), (b['a'],b['b']))

    def test_vertical_is_not_3d_degenerate(self):
        m=triangle_metrics([(0,0,0),(0,0,10),(0,10,0)])
        self.assertTrue(m['zero_xz']); self.assertFalse(m['degenerate_3d'])
        self.assertIsNone(m['a']); self.assertIsNone(m['b'])

    def test_true_degenerate_and_flat(self):
        self.assertTrue(triangle_metrics([(0,0,0),(1,1,1),(2,2,2)])['degenerate_3d'])
        flat=triangle_metrics([(0,0,-7),(10,0,-7),(0,10,-7)])
        self.assertEqual((flat['a'],flat['b']), (0,0)); self.assertEqual(flat['area'],50)

    def test_all_integer_extremes(self):
        m=triangle_metrics([(-32768,-32768,-32768),(32767,-32768,32767),(-32768,32767,32767)])
        self.assertEqual(m['determinant'],65535**2); self.assertEqual((m['a'],m['b']), (1,1))

    def test_conservative_components_and_nonmanifold(self):
        p=[(0,0,0),(1,0,0),(0,1,0)]; q=[p[0],p[1],(0,-1,0)]
        two=analyze([p,q],[0,3]); self.assertEqual(two['summary']['components'],1)
        three=analyze([p,q,[p[0],p[1],(0,0,1)]],[0,3,15])
        self.assertEqual(three['summary']['incidence_gt2'],1)
        self.assertEqual(three['summary']['components'],3)

    def test_duplicate_members_not_union(self):
        p=[(0,0,0),(2,0,0),(0,2,0)]
        r=analyze([p,p[::-1]],[0,0]); self.assertEqual(r['summary']['duplicate_excess'],1)
        self.assertEqual([f['duplicate_count'] for f in r['faces']],[2,2])
        self.assertEqual(r['terrain'][0]['area'],4)

    def test_collapsed_repeated_incidence_is_occurrences(self):
        r=analyze([[(0,0,0),(0,0,0),(1,1,1)]],[0])
        self.assertEqual(r['summary']['collapsed_keys'],1)
        self.assertEqual(r['faces'][0]['repeated_edges'],2)
        self.assertEqual(sorted(r['faces'][0]['edge_incidence']),[1,2,2])

    def test_exact_height_does_not_weld(self):
        p=[(0,0,0),(2,0,0),(0,2,0)]
        q=[(0,0,1),(2,0,1),(0,2,1)]
        r=analyze([p,q],[0,0]); self.assertEqual(r['summary']['components'],2)

    def test_distance_raw_xz_ignores_height(self):
        self.assertEqual(distance_xz((0,0,-100),(3,4,100)),5)

    def test_invalid_inputs(self):
        for p in ([],[(0,0,0)],[(True,0,0)]*3,[(1.5,0,0)]*3,[(math.inf,0,0)]*3,[(1000001,0,0)]*3):
            with self.assertRaises(ValueError): triangle_metrics(p)
        for points, terrain in (([],[]),([[(0,0,0)]*3],[]),([[(0,0,0)]*3],[32])):
            with self.assertRaises(ValueError): analyze(points,terrain)

    def test_output_refuses_existing_and_outside(self):
        root=WORKSPACE_ROOT/'output/exports/native'
        root.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.test-native-',dir=root) as temp:
            p=Path(temp)/'new.gpkg'; self.assertEqual(safe_target(p),p)
            p.write_bytes(b'user data')
            with self.assertRaises(ValueError): safe_target(p)
            self.assertEqual(p.read_bytes(),b'user data')
            with self.assertRaises(ValueError): safe_target(Path(temp)/'project.qgz')
        for p in (WORKSPACE_ROOT/'output/local-workspace/a.gpkg',WORKSPACE_ROOT/'escape.gpkg'):
            with self.assertRaises(ValueError): safe_target(p)

    def test_source_world_rejects_wrong_map(self):
        from types import SimpleNamespace
        for map_id in (0,1,4):
            with self.assertRaises(ValueError): analyze_world(SimpleNamespace(map_id=map_id))


class NativeQueryTests(unittest.TestCase):
    sloped = [(0,0,0),(4,0,4),(0,4,8)]
    vertical = [(0,0,0),(4,0,0),(0,0,8)]

    def test_multi_height_shared_edge_and_duplicate_occurrences(self):
        higher = [(x,z,h+10) for x,z,h in self.sloped]
        hits = query_surfaces([self.sloped, self.sloped[::-1], higher], ('1/3','1/3'))
        self.assertEqual([r['heights'] for r in hits], [(1,1),(1,1),(11,11)])
        edge = [(4,0,4),(4,4,12),(0,4,8)]
        self.assertEqual(len(query_surfaces([self.sloped,edge], (2,2))), 2)

    def test_exact_boundary_without_snapping(self):
        self.assertEqual(query_surfaces([self.sloped], ('-0.000000000001',0)), [])
        self.assertEqual(query_surfaces([self.sloped], (0,'4.000000000000000001')), [])
        self.assertEqual(len(query_surfaces([self.sloped], (0,'3.999999999999999999'))), 1)

    def test_vertical_and_true_degenerate(self):
        d = [(1,0,0),(1,0,3),(1,0,9)]
        hits = query_surfaces([self.vertical,d], (1,0))
        self.assertEqual([(r['kind'],r['heights']) for r in hits], [('vertical',(0,6)),('degenerate',(0,9))])

    def test_fraction_transect_and_unconnected_sources(self):
        far = [(x+8,z,h) for x,z,h in self.sloped]
        rows = transect_surfaces([self.sloped,far], (-1,1), (13,1))
        self.assertEqual([r['path'] for r in rows], [[(Fraction(1,14),2),(Fraction(2,7),5)],[(Fraction(9,14),2),(Fraction(6,7),5)]])
        reverse = transect_surfaces([self.sloped], (5,1), (-1,1))
        self.assertEqual(reverse[0]['path'][0][1], 5)

    def test_vertical_cross_band_and_touch(self):
        cross = transect_surfaces([self.vertical], (1,-1), (1,1))
        self.assertEqual(cross[0], dict(face=0,kind='vertical_event',path=[(Fraction(1,2),0),(Fraction(1,2),6)]))
        along = transect_surfaces([self.vertical], (0,0), (4,0))
        self.assertEqual(along[0]['kind'], 'vertical_band')
        self.assertIn((0,8), along[0]['path'])
        self.assertEqual(transect_surfaces([self.sloped], (-1,0), (0,0))[0]['kind'], 'touch')
        with self.assertRaises(ValueError): transect_surfaces([self.sloped], (0,0), (0,0))

    def test_real_native_query_samples(self):
        import json, struct
        root = WORKSPACE_ROOT/'output/local-workspace'
        if not (root/'gaia-map-WM2.bin').exists(): self.skipTest('Optional private Native workspace absent')
        for name in ('WM2','WM3'):
            data = (root/f'gaia-map-{name}.bin').read_bytes()
            n = struct.unpack_from('<I',data,12)[0]
            header = json.loads(data[16:16+n]); raw = data[16+n:-32]
            faces = [tuple(tuple(struct.unpack_from('<3i',raw,i*72+j*12)) for j in range(3)) for i in range(header['triangle_count'])]
            if name == 'WM2':
                rows = query_surfaces(faces, (20932,Fraction(151699,3)))
                self.assertEqual([r['heights'][0] for r in rows], [Fraction(-10136,3),Fraction(-463279721,342423),0])
                self.assertEqual(len(query_surfaces(faces,(4096,4096))),2)
                self.assertEqual(sum(r['kind']=='vertical' for r in query_surfaces(faces,(Fraction(70139,3),32768))),4)
                self.assertEqual(sum(r['kind']=='degenerate' for r in query_surfaces(faces,(48128,37888))),4)
                for a,b,kind in (((Fraction(70139,3),32704),(Fraction(70139,3),32832),'vertical_event'),((Fraction(69947,3),32768),(Fraction(70331,3),32768),'vertical_band')):
                    self.assertEqual(sum(r['kind']==kind for r in transect_surfaces(faces,a,b)),4)
            else:
                self.assertEqual(len(query_surfaces(faces,(512,512))),2)
                self.assertEqual(sum(r['kind']=='surface' for r in transect_surfaces(faces,(0,512),(2048,512))),4)
            self.assertEqual(query_surfaces(faces,(-1,-1)),[])


if __name__=='__main__': unittest.main()
