# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import hashlib
import json
import os
import struct
import sys
import tempfile
import unittest
from types import SimpleNamespace
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.native_export import encode_native,export_native,RECORD
from gaiagis.map_spaces import MapId,engine_position,native_position,native_space
from gaiagis.map_reader import Mesh,Triangle,Vertex,parse_map
from gaiagis.texture_pack import catalog,build_texture_pack
from gaiagis.map_transitions import transition_record,engine_links,analyze_transitions
from gaiagis.world_events import point_coordinates,analyze_ev
from gaiagis.dataset import discover

def ev(words,header=0):
    table=bytearray(b'\xff'*1024);struct.pack_into('<HH',table,4,header,1)
    return bytes(table)+struct.pack('<'+'H'*(len(words)+1),0,*words)

class MultiMapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        (ROOT/'output').mkdir(exist_ok=True)
    def test_spaces(self):
        self.assertEqual(native_space('WM2'),'WM2Native');self.assertNotEqual(native_space('WM3'),'GaiaGame')
    def test_identity_rejection(self):
        with self.assertRaises(ValueError):MapId('WM1')
    def test_engine_offset(self):
        self.assertEqual(engine_position('WM2',0,0),(98304,65536))
    def test_engine_roundtrip(self):
        for p in [(0,0),(98304,131072),(2000,3000)]:self.assertEqual(native_position('WM2',*engine_position('WM2',*p)),p)
    def test_glacier_is_independent(self):
        self.assertEqual(engine_position('WM3',50,60),(50,60))
    def test_native_mesh_position(self):
        mesh=Mesh(2,'synthetic',4,5,64,1,1,[Vertex(1,-5,2,0)],[Vertex(0,4096,0,0)],[],4)
        self.assertEqual(mesh.position(0),(40961,40962,-5))
    def test_texture_namespaces(self):
        self.assertEqual(len(catalog('WM2')),8);self.assertEqual(len(catalog('WM3')),4)
        self.assertNotEqual(catalog('WM2')[0]['name'],catalog('WM3')[0]['name'])
    def test_glacier_source_offset(self):self.assertEqual(catalog('WM3')[2]['v_offset'],64)
    def test_catalog_invalid(self):
        with self.assertRaises(ValueError):catalog('WM1')
    def test_map_specific_point_bounds(self):
        self.assertEqual(point_coordinates((12,8),(1,2),'WM2'),(98305,65538))
        self.assertIsNone(point_coordinates((0,0),(1,2),'WM2'))
        self.assertIsNone(point_coordinates((8,0),(1,2),'WM3'))
    def test_analyzer_map_guard(self):
        with self.assertRaises(ValueError):analyze_ev(ev([0x203]),map_id='WM1')
    def test_branch_cycle(self):
        a=analyze_ev(ev([0x200,1]),map_id='WM3');self.assertLess(a['visited_instructions'],10)
    def test_dynamic_transition(self):
        world=SimpleNamespace(map_id=2,base_meshes=[])
        records,_=analyze_transitions(ev([0x100,0x33c,0x203]),world,{})
        self.assertEqual(records[0]['to_map'],'WM0');self.assertIsNone(records[0]['from_native_position'])
    def test_field_exit_exact(self):
        records,_=analyze_transitions(ev([0x110,2,0x110,0,0x318,0x203]),SimpleNamespace(map_id=3,base_meshes=[]),{(2,0):{'field_id':123,'field_name':'synthetic'}})
        self.assertEqual(records[0]['field_id'],123);self.assertIsNone(records[0]['to_native_position'])
    def test_unknown_destination(self):
        records,_=analyze_transitions(ev([0x114,1,0x110,0,0x318,0x203]),SimpleNamespace(map_id=3,base_meshes=[]),{})
        self.assertEqual(records[0]['evidence_class'],'unresolved')
    def test_engine_links_no_fake_points(self):
        self.assertTrue(all(r['from_native_position'] is None and r['to_native_position'] is None for r in engine_links()))
    def test_record_determinism(self):
        self.assertEqual(transition_record('WM2','WM0','synthetic'),transition_record('WM2','WM0','synthetic'))
    def test_record_bytes(self):self.assertEqual(RECORD.size,72)
    def test_synthetic_native_encode(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'output') as tmp:
            path=Path(tmp)/'input.synthetic';path.write_bytes(b'synthetic')
            mesh=Mesh(3,str(path),0,0,64,1,1,[Vertex(0,-1,0,0),Vertex(8192,10,0,0),Vertex(0,0,8192,0)],[Vertex(0,4096,0,0)]*3,[Triangle(0,(0,1,2),5,((0,64),(63,64),(0,127)),2)],0)
            world=SimpleNamespace(map_id=3,failures=[],unknown_sections=[],section_count=4,path=path,base_meshes=[mesh],extent=(65536,65536))
            binary,h=encode_native(world);self.assertIsNone(h['global_mapping']);self.assertEqual(h['triangle_count'],1)
            self.assertEqual(hashlib.sha256(binary[:-32]).digest(),binary[-32:]);self.assertEqual(binary,encode_native(world)[0])
            with self.assertRaises(ValueError):export_native(world,ROOT.parent/'bad.bin')
    def test_wm0_transport_protected(self):
        with self.assertRaises(ValueError):encode_native(SimpleNamespace(map_id=0))

@unittest.skipUnless(os.environ.get('GAIAGIS_SOURCE_ROOT'),'Own FF7 installation required')
class RealNativeTests(unittest.TestCase):
    def test_actual_maps(self):
        ds=discover(Path(os.environ['GAIAGIS_SOURCE_ROOT']))
        for i in (2,3):
            world=parse_map(ds.files[f'wm{i}.map'],i);self.assertFalse(world.failures)
            self.assertEqual(world.section_count,{2:12,3:4}[i]);self.assertEqual(len(world.meshes),world.section_count*16)
            self.assertEqual(sum(len(m.triangles) for m in world.meshes),{2:9967,3:8268}[i]);self.assertTrue(all(len(m.vertices)==len(m.normals) for m in world.meshes))
            a,h=encode_native(world);self.assertEqual(a,encode_native(world)[0])
    def test_native_texture_determinism(self):
        ds=discover(Path(os.environ['GAIAGIS_SOURCE_ROOT']))
        with tempfile.TemporaryDirectory(dir=ROOT/'output') as tmp:
            out=Path(tmp)
            for i in (2,3):
                meta=export_native(parse_map(ds.files[f'wm{i}.map'],i),out/f'WM{i}.bin')
                first=build_texture_pack(ds.selected_path,out/f'WM{i}.json',out/'a.bin',f'WM{i}')
                second=build_texture_pack(ds.selected_path,out/f'WM{i}.json',out/'b.bin',f'WM{i}')
                self.assertEqual(first,second);self.assertEqual((out/'a.bin').read_bytes(),(out/'b.bin').read_bytes())

if __name__=='__main__':unittest.main()
