# SPDX-License-Identifier: GPL-3.0-only
"""Synthetic source-difference and no-clobber contracts; no original assets."""
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from gaiagis.world_variants import compare_faces, edge_comparison, safe_target, signatures
from gaiagis.native_analysis import triangle_metrics


def face(identity, points, terrain=0, uv=((0, 0), (1, 0), (0, 1)), normals=((0, 1, 0),)*3):
    return dict(id=identity, points=points, terrain_script_byte=terrain, raw_ids=0, uv=uv, normals=normals, metrics=triangle_metrics(points))


class WorldVariantTests(unittest.TestCase):
    def setUp(self):
        self.p = ((0, 0, 0), (10, 0, 0), (0, 10, 0))

    def test_equal_coordinates_are_not_equal_identities(self):
        r = compare_faces([face('50/0/0', self.p)], [face('63/8/99', self.p)])
        self.assertEqual(r['stats']['geometry_common'], 1)
        self.assertEqual(r['relations'][0]['base'], ['50/0/0'])
        self.assertEqual(r['relations'][0]['alternative'], ['63/8/99'])

    def test_duplicates_preserve_ambiguity_and_contribution(self):
        r = compare_faces([face('b', self.p)], [face('a1', self.p), face('a2', self.p)])
        self.assertEqual(r['stats']['alternative_only'], 1)
        self.assertEqual(r['stats']['area_contribution_delta'], 50)
        self.assertTrue(r['relations'][0]['ambiguous'])
        self.assertEqual(len(r['relations'][0]['alternative']), 2)

    def test_attribute_uv_normal_are_separate(self):
        b = face('b', self.p); a = deepcopy(b); a['id'] = 'a'
        for key, value, counter in [('terrain_script_byte', 1, 'attribute_common'), ('raw_ids', 32768, 'attribute_common'),
                                    ('uv', ((3, 0), (1, 0), (0, 1)), 'uv_common'),
                                    ('normals', ((2, 0, 0),)*3, 'normal_common')]:
            c = deepcopy(a); c[key] = value
            s = compare_faces([b], [c])['stats']
            self.assertEqual(s['geometry_common'], 1)
            self.assertEqual(s[counter], 0)

    def test_reversed_winding_is_not_a_changed_footprint(self):
        b = face('b', self.p); a = face('a', self.p[::-1], uv=b['uv'][::-1])
        s = compare_faces([b], [a])['stats']
        self.assertEqual((s['geometry_common'], s['winding_common'], s['area_contribution_delta']), (1, 0, 0))

    def test_retriangulation_not_entity_matching(self):
        b = face('b', self.p)
        a = [face('a1', (self.p[0], (5, 0, 0), self.p[2])), face('a2', ((5, 0, 0), self.p[1], self.p[2]))]
        s = compare_faces([b], a)['stats']
        self.assertEqual((s['base_only'], s['alternative_only'], s['area_contribution_delta']), (1, 2, 0))

    def test_vertical_and_multiple_heights(self):
        vertical = face('v', ((0, 0, 0), (0, 0, 10), (10, 0, 0)))
        self.assertTrue(vertical['metrics']['zero_xz'])
        self.assertFalse(vertical['metrics']['degenerate_3d'])
        self.assertIsNone(vertical['metrics']['a'])
        elevated = face('high', tuple((x, z, h+10) for x, z, h in self.p))
        self.assertNotEqual(signatures(vertical)[0], signatures(elevated)[0])
        self.assertEqual(compare_faces([face('low', self.p), elevated], [face('other', self.p)])['stats']['base_only'], 1)

    def test_negative_coordinates_and_fraction_oracle(self):
        points = ((-30, -20, 7), (-9, -20, 2), (-30, 13, 17))
        m = triangle_metrics(points)
        self.assertEqual(m['determinant'], 21*33)
        self.assertEqual((m['a'], m['b']), (Fraction(-5, 21), Fraction(10, 33)))
        moved = tuple((x+200, z-100, h) for x, z, h in points)
        self.assertEqual(m['area'], triangle_metrics(moved)['area'])

    def test_edge_comparison_is_3d_and_occurrence_aware(self):
        a = {((0, 0, 0), (1, 0, 0)): ['a', 'a2']}
        b = {((0, 0, 0), (1, 0, 1)): ['b']}
        self.assertEqual(edge_comparison(a, b), dict(a=2, b=1, exact=0, unmatched_a=2, unmatched_b=1))

    def test_duplicate_source_id_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            compare_faces([face('id', self.p)], [face('id', self.p)])

    def test_output_paths_are_no_clobber_and_scoped(self):
        from gaiagis.safety import WORKSPACE_ROOT
        with self.assertRaises(ValueError):
            safe_target(WORKSPACE_ROOT/'README.md', '.json', 'output/dev/current')
        with tempfile.TemporaryDirectory(dir=WORKSPACE_ROOT/'output/dev/current') as tmp:
            p = Path(tmp)/'candidate.json'; p.write_text('user data')
            with self.assertRaisesRegex(ValueError, 'exists'):
                safe_target(p, '.json', 'output/dev/current')
            self.assertEqual(p.read_text(), 'user data')

    def test_unverified_source_profile_is_rejected_before_decoding(self):
        from gaiagis.safety import WORKSPACE_ROOT
        from gaiagis.world_variants import load_source
        with tempfile.TemporaryDirectory(dir=WORKSPACE_ROOT/'output/dev/current') as tmp:
            source = Path(tmp)/'synthetic.map'; source.write_bytes(bytes(69*47104))
            with self.assertRaisesRegex(ValueError, 'fingerprint'):
                load_source(source)


if __name__ == '__main__':
    unittest.main()
