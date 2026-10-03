# SPDX-License-Identifier: GPL-3.0-only
import json
import math
import os
from pathlib import Path
import struct
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.poi import (parse_maplist,parse_field_table,mesh_field_calls,trigger_components,
                        representative,spherical_center,group_locations,build_poi)
from gaiagis.map_reader import Mesh,Vertex,Triangle
from gaiagis.reconstruction import Mapping,SphereConfig
from gaiagis.lzss import FormatError

def event(code,header=0x8004):
    data=bytearray(struct.pack('<HH',0,0)+struct.pack('<HH',header,1)+struct.pack('<HH',65535,0)*254)
    data.extend(struct.pack('<'+'H'*(len(code)+1),0x203,*code));return bytes(data)

def triangle(i,indices):return Triangle(i,indices,7<<5,((0,0),)*3,2<<9)
def mesh():return Mesh(0,'fixture.map',0,0,64,1,1,
    [Vertex(x,h,z,0) for x,h,z in ((0,0,0),(3,3,0),(0,6,3),(3,9,3),(20,30,20),(23,33,20),(20,36,23))],[],
    [triangle(0,(0,1,2)),triangle(1,(1,3,2)),triangle(2,(4,5,6))],0)

class PoiParserTests(unittest.TestCase):
    def test_maplist_count_and_unused_slot(self):
        self.assertEqual(parse_maplist(struct.pack('<H',2)+b'fixture\0'.ljust(32,b'\0')+bytes(32)),['fixture',''])
    def test_maplist_corruption(self):
        for data in (b'',b'\1\0',b'\1\0'+b'X'*32,b'\1\0'+b'\xff'+bytes(31)):
            with self.assertRaises(FormatError):parse_maplist(data)
    def test_field_table_scenarios_and_local_coordinates(self):
        data=bytearray(1536);struct.pack_into('<hhHHB',data,12,-20,30,4,1,255)
        rows=parse_field_table(data,['dummy','fixture']);self.assertEqual(rows[(1,1)]['field_name'],'fixture')
        self.assertEqual(rows[(1,1)]['field_x'],-20);self.assertEqual(rows[(1,1)]['field_direction'],255)
        self.assertEqual(rows[(1,1)]['field_table_byte_offset'],12)
    def test_field_table_bounds(self):
        with self.assertRaises(FormatError):parse_field_table(bytes(12),['dummy'])
        data=bytearray(1536);struct.pack_into('<H',data,6,2)
        with self.assertRaises(FormatError):parse_field_table(data,['dummy'])
    def test_actual_instruction_boundaries(self):
        calls,unknown,_=mesh_field_calls(event([0x100,0x110,0x318,0x100,0x110,2,0x110,1,0x318,0x203]))
        self.assertFalse(unknown);self.assertEqual(len(calls),1);self.assertEqual(calls[0]['entrance_table_id'],2)
        self.assertEqual(calls[0]['scenario'],1);self.assertEqual(calls[0]['source_script'],4)
    def test_mesh_header_axes(self):
        calls,_,_=mesh_field_calls(event([0x110,1,0x110,0,0x318,0x203],0x8000|((12+36*7)<<4)|4))
        self.assertEqual((calls[0]['mesh_column'],calls[0]['mesh_row']),(12,7))
    def test_control_flow_multiple_scenarios(self):
        calls,_,_=mesh_field_calls(event([0x11b,8,0x201,13,0x100,0x110,3,0x110,0,0x318,0x200,20,
                                         0x100,0x110,3,0x110,1,0x318,0x203,0x203]))
        self.assertEqual({c['scenario'] for c in calls},{0,1})
    def test_branch_into_operand_rejected(self):
        with self.assertRaises(FormatError):mesh_field_calls(event([0x200,4,0x110,1,0x203]))
    def test_nonconstant_arguments_unresolved(self):
        calls,unknown,_=mesh_field_calls(event([0x11b,6,0x110,0,0x318,0x203]))
        self.assertFalse(calls);self.assertEqual(len(unknown),1)
    def test_unreachable_code_not_collected(self):
        calls,_,_=mesh_field_calls(event([0x203,0x110,1,0x110,0,0x318,0x203]));self.assertFalse(calls)
    def test_dynamic_model_calls_excluded(self):
        calls,_,_=mesh_field_calls(event([0x110,1,0x110,0,0x318,0x203],0x4004));self.assertFalse(calls)
    def test_trigger_components_and_height(self):
        m=mesh();parts=trigger_components(m,m.triangles)
        self.assertEqual([[t.triangle_id for t in c] for c in parts],[[0,1],[2]])
        raw,t=representative(m,parts[0]);self.assertEqual(t.triangle_id,0);self.assertEqual(raw,(1,1,3))
        self.assertEqual(t.region,2)
    def test_circular_spherical_center(self):
        c=spherical_center([dict(longitude=179,latitude=10),dict(longitude=-179,latitude=10)])
        self.assertAlmostEqual(abs(c['longitude']),180);self.assertGreater(c['latitude'],10)
        self.assertIsNone(spherical_center([dict(longitude=0,latitude=0),dict(longitude=180,latitude=0)]))
    def test_multientrance_identity_and_primary(self):
        items=[dict(id=str(i),field_name=f,scenario=0,entrance_table_id=i,section_id=0,longitude=179 if i==1 else -179,latitude=10,height=0) for i,f in ((1,'psdun_1'),(2,'psdun_2'))]
        locations=group_locations(items);self.assertEqual(len(locations),1);self.assertEqual(locations[0]['entrance_ids'],['1','2'])
        self.assertEqual(locations[0]['primary_entrance'],'1');self.assertEqual(items[1]['location_id'],'mythril-mine')
    def test_reuses_mesh_mapping_at_raw_coordinate(self):
        m=mesh();raw,_=representative(m,m.triangles[:2]);mapping=Mapping(294912,229376,SphereConfig())
        # Exactly the same callable used by the sphere exporter, with no POI approximation.
        self.assertEqual(mapping.game_to_geographic(*raw),Mapping(294912,229376,SphereConfig()).game_to_geographic(*raw))
        east,north,height=mapping.geographic_to_game(*mapping.game_to_geographic(*raw))
        self.assertAlmostEqual(east,raw[0]);self.assertAlmostEqual(north,raw[1]);self.assertEqual(height,raw[2])
    def test_output_cannot_target_game(self):
        with self.assertRaises(ValueError):build_poi(ROOT,Path('D:/SteamLibrary/steamapps/common/FINAL FANTASY VII Steam Edition/poi.json'))

@unittest.skipUnless(os.environ.get('GAIAGIS_SOURCE_ROOT'),'Local FF7 dataset required')
class PoiIntegrationTests(unittest.TestCase):
    def test_source_binding_invariants_and_repeatability(self):
        out=ROOT/'output/v1_1/test-poi.json';asset=build_poi(Path(os.environ['GAIAGIS_SOURCE_ROOT']),out)
        before=out.read_bytes();build_poi(Path(os.environ['GAIAGIS_SOURCE_ROOT']),out);self.assertEqual(before,out.read_bytes())
        mapping=Mapping(*asset['world_extent'],SphereConfig())
        self.assertTrue(asset['locations']);self.assertTrue(asset['entrances'])
        for e in asset['entrances']:
            self.assertEqual(tuple(e[k] for k in ('longitude','latitude','height')),mapping.game_to_geographic(e['game_x'],e['game_north'],e['game_height']))
            self.assertIn(e['triangle_id'],e['trigger_triangle_ids']);self.assertTrue(e['script_calls'])
            self.assertEqual(e['field_table_byte_offset'],12*e['field_table_record']);self.assertIsNone(e['availability'])
        ids={e['id'] for e in asset['entrances']}
        self.assertEqual({i for l in asset['locations'] for i in l['entrance_ids']},ids)

if __name__=='__main__':unittest.main()
