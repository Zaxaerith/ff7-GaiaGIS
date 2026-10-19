# SPDX-License-Identifier: GPL-3.0-only
import math
from fractions import Fraction
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from gaiagis.native_analysis import triangle_metrics, analyze, distance_xz, analyze_world
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


if __name__=='__main__': unittest.main()
