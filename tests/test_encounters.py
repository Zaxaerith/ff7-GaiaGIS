# SPDX-License-Identifier: GPL-3.0-only
"""Synthetic source-only tests; opt-in read-only real dataset integration."""
import os
from pathlib import Path
import struct
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.encounters import (ENC_W_BYTES,TABLE_OFFSET,parse_encounters,decode_record,
    resolve_encounter,yuffie_scene,chocobo_rating,build_encounters,TERRAIN_LOOKUP)
from gaiagis.lzss import FormatError

def fixture():
    data=bytearray(ENC_W_BYTES)
    for i in range(8):struct.pack_into('<HH',data,i*4,(i+1)*10,100+i*2)
    for i in range(32):struct.pack_into('<HH',data,32+i*4,9999,0)
    struct.pack_into('<HH',data,32,23,4)
    for r,s in ((0,0),(2,2),(5,2)):
        offset=TABLE_OFFSET+(r*4+s)*32;data[offset]=3;data[offset+1]=20
        for i in range(14):struct.pack_into('<H',data,offset+2+i*2,(i+1)<<10|23)
    return bytes(data)

class EncounterTests(unittest.TestCase):
    def setUp(self):self.asset=parse_encounters(fixture())
    def test_section_sizes(self):
        self.assertEqual(ENC_W_BYTES,2208);self.assertEqual(len(self.asset['encounter_sets']),64)
        self.assertEqual(len(self.asset['yuffie']),8);self.assertEqual(len(self.asset['chocobo_ratings']),32)
    def test_truncated_and_trailing_rejected(self):
        for d in (fixture()[:-1],fixture()+b'\0',b''):
            with self.assertRaises(FormatError):parse_encounters(d)
    def test_bit_packing_boundaries(self):
        for scene in (0,255,256,1023):
            for weight in (0,1,63):
                r=decode_record(weight<<10|scene,'normal',2)
                self.assertEqual((r['scene_id'],r['weight']),(scene,weight))
    def test_active_bit_only(self):
        self.assertTrue(self.asset['encounter_sets'][0]['active'])
        d=bytearray(fixture());d[160]=2;self.assertFalse(parse_encounters(d)['encounter_sets'][0]['active'])
    def test_inactive_records_retained(self):
        s=self.asset['encounter_sets'][1];self.assertFalse(s['active']);self.assertEqual(s['encounter_rate'],0)
        self.assertEqual(len(s['records']['normal']),6)
    def test_normal(self):self.assertEqual(self.asset['encounter_sets'][0]['records']['normal'][5]['weight'],6)
    def test_special(self):
        groups=self.asset['encounter_sets'][0]['records']
        self.assertEqual([len(groups[k]) for k in ('back_attack','side_attack','both_sides')],[2,1,1])
        self.assertEqual(groups['both_sides'][0]['byte_offset'],180)
    def test_chocobo(self):
        self.assertEqual(len(self.asset['encounter_sets'][0]['records']['chocobo']),4)
        self.assertEqual(chocobo_rating(self.asset,23),4);self.assertIsNone(chocobo_rating(self.asset,9999))
    def test_first_rating_match(self):
        self.asset['chocobo_ratings'][1].update(scene_id=23,rating=8,valid=True)
        self.assertEqual(chocobo_rating(self.asset,23),4)
    def test_lookup_first_match(self):
        self.assertEqual(resolve_encounter(self.asset,1,0)['slot'],0)
        self.assertEqual(resolve_encounter(self.asset,2,1)['slot'],2)
    def test_terrain_alias(self):
        self.assertEqual(resolve_encounter(self.asset,0,16)['effective_terrain'],0)
        self.assertEqual(resolve_encounter(self.asset,4,24)['slot'],2)
    def test_region_clamp(self):
        self.assertEqual(resolve_encounter(self.asset,31,1)['effective_region'],15)
        self.assertEqual(resolve_encounter(self.asset,-1,0)['effective_region'],0)
    def test_unmatched_fallback(self):
        r=resolve_encounter(self.asset,17,3);self.assertEqual(r['slot'],0);self.assertTrue(r['fallback'])
    def test_input_bounds(self):
        for terrain in (-1,32,1.2):
            with self.assertRaises(ValueError):resolve_encounter(self.asset,0,terrain)
    def test_yuffie_upper_bound_and_jungle(self):
        self.assertEqual(yuffie_scene(self.asset,10,1),100);self.assertEqual(yuffie_scene(self.asset,11,25),103)
        self.assertEqual(yuffie_scene(self.asset,1000,1),114)
        with self.assertRaises(ValueError):yuffie_scene(self.asset,10,0)
    def test_decreasing_level_rejected(self):
        d=bytearray(fixture());struct.pack_into('<H',d,4,0)
        with self.assertRaises(FormatError):parse_encounters(d)
    def test_lookup_all_regions_all_terrains(self):
        for region in range(32):
            for terrain in range(32):
                r=resolve_encounter(self.asset,region,terrain)
                self.assertEqual(r['encounter_set']['region_id'],min(region,15));self.assertIn(r['slot'],range(4))
    def test_output_safety(self):
        with self.assertRaises(ValueError):build_encounters(ROOT,Path('D:/SteamLibrary/steamapps/common/FINAL FANTASY VII Steam Edition/encounters.json'))

@unittest.skipUnless(os.environ.get('GAIAGIS_SOURCE_ROOT'),'Local FF7 dataset required')
class EncounterIntegrationTests(unittest.TestCase):
    def test_source_and_deterministic_export(self):
        path=ROOT/'output/v1_2/test-encounters.json';source=Path(os.environ['GAIAGIS_SOURCE_ROOT'])
        a=build_encounters(source,path);before=path.read_bytes();build_encounters(source,path)
        self.assertEqual(before,path.read_bytes());self.assertEqual(a['source_record']['size'],ENC_W_BYTES)
        self.assertEqual(a['regions'][2]['terrain_slots'],list(TERRAIN_LOOKUP[2]))
        self.assertTrue(all(len(v)==64 for v in a['sources'].values()))
        for s in a['encounter_sets']:
            for group in s['records'].values():
                for r in group:self.assertEqual(r['packed'],r['scene_id']|(r['weight']<<10))

if __name__=='__main__':unittest.main()
