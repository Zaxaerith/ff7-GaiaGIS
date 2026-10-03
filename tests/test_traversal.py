# SPDX-License-Identifier: GPL-3.0-only
"""Synthetic functional reference cases, plus opt-in WM0 field integration."""
import os
from pathlib import Path
import sys
import unittest
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from gaiagis.traversal import (PROFILE, PROFILES, STATES, evaluate, mask_allows,
                             reference_gate, chocobo_exit_height_compatible)


class TraversalTests(unittest.TestCase):
    def test_all_32_terrain_codes_and_profiles(self):
        self.assertEqual(len(PROFILES), 10)
        for p in PROFILES:
            for t in range(32):
                self.assertIn(evaluate(p, t)['state'], STATES)

    def test_invalid_terrain_and_script(self):
        for t in (-1, 32, 1.5, True):
            with self.assertRaises(ValueError): evaluate('foot', t)
        with self.assertRaises(ValueError): evaluate('foot', 0, 8)

    def test_unknown_profiles_and_models(self):
        with self.assertRaises(ValueError): evaluate('airborne-highwind', 0)
        for model in (9, 41, 42, 255): self.assertIsNone(reference_gate(model, 0))

    def test_human_examples_and_special_terrain(self):
        for t in (0, 1, 13, 14, 20, 29, 30):
            self.assertEqual(evaluate('foot', t)['state'], 'allowed')
        for t in (2, 3, 4, 5, 6, 12, 15, 18, 21, 22, 23, 27, 31):
            self.assertEqual(evaluate('foot', t)['state'], 'blocked')

    def test_bridge_context_is_current_not_destination(self):
        self.assertTrue(reference_gate(0, 0))
        self.assertFalse(reference_gate(0, 0, current_model=0, current_terrain=13))
        self.assertTrue(reference_gate(0, 29, current_model=0, current_terrain=14))
        self.assertTrue(reference_gate(0, 0, current_model=3, current_terrain=13))

    def test_buggy_water_crossing_not_deep_water(self):
        self.assertTrue(reference_gate(6, 4));self.assertFalse(reference_gate(6, 5))
        self.assertFalse(reference_gate(6, 3));self.assertTrue(reference_gate(6, 24))

    def test_buggy_departure_is_separate(self):
        self.assertEqual(evaluate('buggy', 4)['state'], 'allowed')
        self.assertEqual(evaluate('buggy', 4)['enter_exit_initiation'], 'blocked')

    def test_bronco_water_and_exit(self):
        for t in (4, 5, 6): self.assertTrue(reference_gate(5, t))
        for t in (3, 17, 22, 26): self.assertFalse(reference_gate(5, t))
        for t in (11, 17): self.assertTrue(reference_gate(5, t, leave_state=2))
        self.assertFalse(reference_gate(5, 6, leave_state=2))

    def test_bronco_airborne_branch(self):
        self.assertTrue(reference_gate(5, 2, airborne=True))
        self.assertFalse(reference_gate(5, 2, airborne=True, flight_state=-1))
        self.assertTrue(reference_gate(5, 6, airborne=True, flight_state=-1))
        self.assertFalse(reference_gate(5, 17, airborne=True, leave_state=2))

    def test_highwind_air_and_landing_distinct(self):
        self.assertTrue(reference_gate(3, 3))
        self.assertFalse(reference_gate(3, 3, flight_state=-1))
        self.assertTrue(reference_gate(3, 0, flight_state=-1))
        self.assertEqual(evaluate('highwind-landing', 1)['state'], 'blocked')

    def test_highwind_northern_cave_script_path(self):
        r=evaluate('highwind-landing', 27)
        self.assertEqual(r['state'], 'conditional');self.assertEqual(r['evidence'], 'script_dependent')

    def test_script_7_exit_gate_is_not_encounter_gate(self):
        self.assertTrue(reference_gate(6, 0 | (1 << 5), leave_state=2))
        self.assertFalse(reference_gate(6, 0 | (7 << 5), leave_state=2))
        self.assertTrue(reference_gate(0, 0 | (7 << 5)))
        self.assertTrue(reference_gate(5, 17 | (7 << 5), leave_state=2))
        self.assertEqual(evaluate('highwind-landing', 0, 7)['state'], 'conditional')

    def test_chocobo_variants(self):
        capabilities={'chocobo-yellow':(False,False,False),'chocobo-green':(True,False,False),
                      'chocobo-blue':(False,True,False),'chocobo-black':(True,True,False),'chocobo-gold':(True,True,True)}
        for p,expected in capabilities.items():
            self.assertEqual(tuple(evaluate(p,t)['state']=='allowed' for t in (2,6,3)),expected)

    def test_chocobo_exit_uses_yellow_mask(self):
        self.assertTrue(reference_gate(19, 2, tint=4))
        self.assertFalse(reference_gate(19, 2, tint=4, leave_state=2))
        self.assertFalse(reference_gate(4, 2, tint=4))
        with self.assertRaises(ValueError): reference_gate(19, 0, tint=5)

    def test_chocobo_exit_height_strict_boundary(self):
        for delta in (-199, 0, 199): self.assertTrue(chocobo_exit_height_compatible(-500, -500+delta))
        for delta in (-200, 200, 201): self.assertFalse(chocobo_exit_height_compatible(-500, -500+delta))
        with self.assertRaises(ValueError): chocobo_exit_height_compatible(0, float('nan'))

    def test_submarine_surface_not_wm2(self):
        for t in (3, 15, 18, 26): self.assertEqual(evaluate('submarine-surface',t)['state'],'allowed')
        self.assertEqual(evaluate('submarine-surface',18)['enter_exit_initiation'],'allowed')
        self.assertEqual(evaluate('submarine-surface',3)['enter_exit_initiation'],'blocked')

    def test_high_terrain_info_bits_do_not_change_masks(self):
        for m in (0,3,4,5,6,8,13,19,100):
            for t in range(32):
                self.assertEqual(reference_gate(m,t),reference_gate(m,t|0xFF00))

    def test_unsigned_bit_31_and_bounds(self):
        self.assertTrue(mask_allows('0x80000000',31))
        for bad in (-1,65536,True):
            with self.assertRaises(ValueError): reference_gate(0,bad)

    def test_missing_source_has_no_fabricated_compatibility(self):
        self.assertEqual(evaluate('foot',None)['state'],'unknown')
        self.assertEqual(evaluate('foot',0,origin=1)['state'],'unknown')

    def test_evidence_and_no_reachability(self):
        r=evaluate('foot',0)
        self.assertEqual(r['evidence'],'verified_reference_logic')
        self.assertEqual(r['movement_compatible'],'unknown')
        self.assertEqual(r['enter_exit_compatible'],'unknown')
        self.assertEqual(evaluate('highwind-landing',0)['terrain_compatible'],'unknown')
        self.assertEqual(r['runtime_available'],'not_simulated')
        self.assertEqual(PROFILE['runtime_equivalence'],'not-verified-steam2026')

    def test_determinism(self):
        a=[[evaluate(p,t,s) for t in range(32) for s in range(8)] for p in PROFILES]
        self.assertEqual(a,[[evaluate(p,t,s) for t in range(32) for s in range(8)] for p in PROFILES])

    @unittest.skipUnless(os.environ.get('GAIAGIS_SOURCE_ROOT'),'Private FF7 source not supplied')
    def test_real_wm0_fields_without_second_parser(self):
        from gaiagis.dataset import discover
        from gaiagis.map_reader import parse_map
        world=parse_map(discover(Path(os.environ['GAIAGIS_SOURCE_ROOT'])).files['wm0.map'],0)
        for mesh in world.base_meshes:
            for t in mesh.triangles:
                for p in PROFILES.values():
                    result=evaluate(p['id'],t.ff7_terrain_type,t.script)
                    self.assertIn(result['state'],STATES)
                    self.assertEqual(reference_gate(p['model_id'],t.terrain_script_byte,tint=p['tint'] or 0),
                                     reference_gate(p['model_id'],t.terrain_script_byte|((t.raw_ids>>8)<<8),tint=p['tint'] or 0))


if __name__=='__main__':unittest.main()
