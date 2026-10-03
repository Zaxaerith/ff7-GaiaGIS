import csv
import json
import math
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"src"))
from gaiagis.lzss import decompress, FormatError
from gaiagis.map_reader import decode_mesh, parse_map, Mesh, Vertex, Triangle
from gaiagis.constants import SECTION_SIZE, LAYOUTS, ALTERNATIVES
from gaiagis.dataset import discover, fingerprint
from gaiagis.safety import WORKSPACE_ROOT, SOURCE_ROOT, output_path
from gaiagis.lgp import inventory
from gaiagis.analysis import circular_mean, circular_span, topology, geography, geometry_summary
from gaiagis.orientation import probe_orientation

TEMP=WORKSPACE_ROOT/"output"/"tmp"
TEMP.mkdir(parents=True,exist_ok=True)

def literals(data):
    return b"".join(bytes([(1<<len(data[i:i+8]))-1])+data[i:i+8] for i in range(0,len(data),8))

def decoded_triangle(ids=0,flag=0,indices=(0,1,2)):
    vectors=b"".join(struct.pack("<hhhH",*v,0) for v in ((0,0,0),(8192,10,0),(0,-10,8192)))
    normals=struct.pack("<hhhH",0,-4096,0,0)*3
    return struct.pack("<HH",1,3)+struct.pack("<10BH",*indices,flag,0,0,31,0,0,31,ids)+vectors+normals

def section(payload=None):
    payload=literals(decoded_triangle() if payload is None else payload)
    result=bytearray(SECTION_SIZE)
    cursor=64
    for i in range(16):
        struct.pack_into("<I",result,i*4,cursor)
        struct.pack_into("<I",result,cursor,len(payload))
        result[cursor+4:cursor+4+len(payload)]=payload
        cursor=(cursor+4+len(payload)+3)&~3
    return bytes(result)

class LzssTests(unittest.TestCase):
    def test_literals_partial_group(self):
        self.assertEqual(decompress(literals(b"independent fixture")),b"independent fixture")
    def test_zero_initial_dictionary(self):
        self.assertEqual(decompress(bytes([0,0,0])),b"\0"*3)
    def test_overlapping_reference(self):
        self.assertEqual(decompress(bytes([7,65,66,67,0xee,0xf6])),b"ABC"*4)
    def test_ring_wrap(self):
        initial=bytes(i%251 for i in range(4104))
        tail=literals(initial)+bytes([0,0xee,0xf0])
        self.assertEqual(decompress(tail),initial+initial[4096:4099])
    def test_truncated_reference(self):
        with self.assertRaises(FormatError): decompress(b"\0\1")
    def test_empty_control(self):
        with self.assertRaises(FormatError): decompress(b"\xff")
    def test_output_limit(self):
        with self.assertRaises(FormatError): decompress(b"\0\0\x0f",17)

class MapTests(unittest.TestCase):
    def test_all_bit_fields(self):
        for terrain in range(32):
            for region in range(32):
                for texture in (0,1,255,511):
                    for chocobo in (0,1):
                        raw=texture|(region<<9)|0x4000|(chocobo<<15)
                        ts,vs,ns=decode_mesh(decoded_triangle(raw,terrain|(7<<5)))
                        t=ts[0]
                        self.assertEqual((t.ff7_terrain_type,t.region,t.texture,t.script,t.unknown_bit14,t.is_chocobo),
                                         (terrain,region,texture,7,1,bool(chocobo)))
                        self.assertEqual(t.raw_ids,raw)
    def test_raw_axes_signed(self):
        ts,vs,ns=decode_mesh(decoded_triangle())
        mesh=Mesh(0,"fixture",10,5,64,1,1,vs,ns,ts,10)
        self.assertEqual(mesh.cell,(5,5))
        self.assertEqual(mesh.position(2),(40960,49152,-10))
    def test_triangle_reference(self):
        with self.assertRaises(FormatError): decode_mesh(decoded_triangle(indices=(0,1,3)))
    def test_buffer_length(self):
        for data in (b"",decoded_triangle()[:-1],decoded_triangle()+b"\0"):
            with self.assertRaises(FormatError): decode_mesh(data)
    def test_vertex_table_byte_limit(self):
        with self.assertRaises(FormatError): decode_mesh(struct.pack("<HH",0,257)+b"\0"*(257*16))
    def test_section_divisibility(self):
        with tempfile.TemporaryDirectory(dir=TEMP) as td:
            p=Path(td)/"fixture.map"
            for data in (b"",b"\0"*(SECTION_SIZE-1)):
                p.write_bytes(data)
                with self.assertRaises(FormatError): parse_map(p,0)
    def test_offset_bounds_alignment_compressed_length_overlap(self):
        with tempfile.TemporaryDirectory(dir=TEMP) as td:
            p=Path(td)/"fixture.map"
            for off in (0,65,SECTION_SIZE,0xffffffff):
                data=bytearray(section());struct.pack_into("<I",data,0,off);p.write_bytes(data)
                self.assertTrue(parse_map(p,0).failures)
            data=bytearray(section());struct.pack_into("<I",data,64,SECTION_SIZE);p.write_bytes(data)
            self.assertTrue(parse_map(p,0).failures)
            data=bytearray(section());struct.pack_into("<I",data,4,64);p.write_bytes(data)
            self.assertTrue(any("Overlapping" in f['error'] for f in parse_map(p,0).failures))
    def test_alternative_placement(self):
        for s,b in ALTERNATIVES.items():
            m=Mesh(0,"fixture",s,15,64,1,1,[],[],[],b)
            self.assertEqual(m.cell,(b%9*4+3,b//9*4+3))
            self.assertFalse(m.is_base)

class DatasetTests(unittest.TestCase):
    def test_discovery_layouts_case_insensitive(self):
        for parts in ((),("DATA","WM"),("ff7","WORKINGDIR","data","wm")):
            with tempfile.TemporaryDirectory(dir=TEMP) as td:
                root=Path(td);wm=root.joinpath(*parts);wm.mkdir(parents=True,exist_ok=True)
                for name in ("WM0.MAP","wm2.map","Wm3.MaP","WORLD_US.LGP"): (wm/name).touch()
                for selection in (root,wm,*([wm.parent.parent] if len(parts)==4 else [])):
                    self.assertEqual(discover(selection).wm_directory,wm.resolve())
    def test_ambiguous_dataset(self):
        with tempfile.TemporaryDirectory(dir=TEMP) as td:
            root=Path(td)
            for wm in (root,root/"data"/"wm"):
                wm.mkdir(parents=True,exist_ok=True)
                for name in ("wm0.map","wm2.map","wm3.map","world_us.lgp"): (wm/name).touch()
            with self.assertRaises(ValueError): discover(root)
    def test_unknown_hash_does_not_prevent_parse(self):
        with tempfile.TemporaryDirectory(dir=TEMP) as td:
            root=Path(td)
            for name in ("wm0.map","wm2.map","wm3.map","world_us.lgp"): (root/name).write_bytes(section())
            d=discover(root)
            self.assertIn("unknown dataset",fingerprint(d)["compatibility"])
            self.assertEqual(len(parse_map(d.files['wm0.map'],0).meshes),16)
    def test_output_isolation(self):
        self.assertEqual(output_path(TEMP),TEMP.resolve())
        for p in (SOURCE_ROOT/"new.txt",WORKSPACE_ROOT.parent/"new.txt",WORKSPACE_ROOT/".."/"new.txt"):
            with self.assertRaises(ValueError): output_path(p)

class StatisticsTests(unittest.TestCase):
    def test_circular_mean_across_seam(self):
        mean,r=circular_mean([(99,1),(1,1)],100)
        self.assertAlmostEqual(mean,0)
        self.assertGreater(r,.99)
    def test_uniform_circular_mean_undefined(self):
        self.assertIsNone(circular_mean([(0,1),(25,1),(50,1),(75,1)],100)[0])
    def test_minimal_arc_cross_seam(self):
        self.assertEqual(circular_span([(0,5),(95,100)],100),(95,5,10,True))
    def test_full_support(self):
        self.assertEqual(circular_span([(0,50),(50,100)],100)[2],100)
    def test_lgp_bounds_and_header_identity(self):
        with tempfile.TemporaryDirectory(dir=TEMP) as td:
            p=Path(td)/"fixture.lgp"
            for data in (b"",b"\0"*12+struct.pack("<I",100000)):
                p.write_bytes(data)
                with self.assertRaises(FormatError): inventory(p)
    def test_lgp_synthetic_inventory_and_corruption(self):
        with tempfile.TemporaryDirectory(dir=TEMP) as td:
            p=Path(td)/'fixture.lgp'
            name=b'test.txt'.ljust(20,b'\0')
            off=16+27+3600+2
            data=(b'\0\0SQUARESOFT'+struct.pack('<I',1)+struct.pack('<20sIBH',name,off,14,0)
                  +b'\0'*3602+name+struct.pack('<I',3)+b'abc'+b'FINAL FANTASY7')
            p.write_bytes(data)
            a=inventory(p)
            self.assertEqual((a['entries'][0]['filename'],a['entries'][0]['offset'],a['entries'][0]['size']),('test.txt',off,3))
            self.assertTrue(a['standard_creator_signature'] and a['standard_footer'])
            for location,value in ((off,ord('X')),(off+20,255)):
                bad=bytearray(data);bad[location]=value;p.write_bytes(bad)
                with self.assertRaises(FormatError): inventory(p)

@unittest.skipUnless(os.environ.get("GAIAGIS_SOURCE_ROOT"),"Set GAIAGIS_SOURCE_ROOT to run real source integration tests")
class SourceIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset=discover(Path(os.environ["GAIAGIS_SOURCE_ROOT"]))
        cls.before=fingerprint(cls.dataset)
        cls.worlds={i:parse_map(cls.dataset.files[f'wm{i}.map'],i) for i in (0,2,3)}
        cls.topo,cls.grid=topology(cls.worlds[0])
    @classmethod
    def tearDownClass(cls):
        if fingerprint(cls.dataset)!=cls.before: raise AssertionError("Source hash changed during tests")
    def test_section_counts_from_bytes(self):
        for i,w in self.worlds.items():
            self.assertEqual(w.section_count,w.path.stat().st_size//SECTION_SIZE)
            self.assertEqual(w.section_count,LAYOUTS[i][0]*LAYOUTS[i][1]+(6 if i==0 else 0))
    def test_mesh_invariants_all_maps_all_alternatives(self):
        for w in self.worlds.values():
            self.assertEqual(w.failures,[])
            self.assertEqual(len(w.meshes),w.section_count*16)
            for m in w.meshes:
                self.assertEqual(len(m.vertices),len(m.normals))
                self.assertEqual(m.decoded_size,4+12*len(m.triangles)+16*len(m.vertices))
                self.assertLessEqual(m.offset+4+m.compressed_size,SECTION_SIZE)
                for t in m.triangles:
                    self.assertTrue(all(0<=j<len(m.vertices) for j in t.indices))
                    self.assertTrue(0<=t.ff7_terrain_type<=31 and 0<=t.region<=31 and 0<=t.texture<=511)
    def test_base_grid_and_extent(self):
        for i,w in self.worlds.items():
            nx,ny=LAYOUTS[i]
            self.assertEqual({m.cell for m in w.base_meshes},{(x,y) for x in range(nx*4) for y in range(ny*4)})
            ps=[m.position(j) for m in w.base_meshes for j in range(len(m.vertices))]
            self.assertEqual((min(p[0] for p in ps),max(p[0] for p in ps)),(0,w.extent[0]))
            self.assertEqual((min(p[1] for p in ps),max(p[1] for p in ps)),(0,w.extent[1]))
    def test_periodic_boundary_geometry_and_attributes(self):
        for key in ("west_east","low_high_north"):
            s=self.topo[key]
            self.assertEqual(s['segments_a'],s['segments_b'])
            self.assertEqual(s['exact_position_and_height_matches'],s['segments_a'])
            self.assertEqual(s['ambiguous_segments'],0)
            for attr in ('terrain','region','script','normals','texture'):
                self.assertEqual(s['attributes'][attr+'_equal'],s['segments_a'])
    def test_cut_no_hidden_land_or_script_triggers(self):
        for r in self.topo['cut_rows']:
            self.assertEqual(r['meshes'],36)
            self.assertEqual(r['pure_ocean_meshes'],r['meshes'])
            self.assertEqual(r['non_ocean_triangles'],0)
            self.assertEqual(r['script_trigger_triangles'],0)
            self.assertEqual(r['height_range'],[0,0])
    def test_geography_area_and_count_conservation(self):
        w=self.worlds[0];regions,terrains=geography(w);summary=geometry_summary(w)
        for rows in (regions,terrains):
            self.assertEqual(sum(r['triangle_count'] for r in rows),summary['triangles_base'])
            self.assertAlmostEqual(sum(r['horizontal_area_raw2'] for r in rows),summary['horizontal_area_sum_raw2'],places=2)
            self.assertTrue(all(0<=r['resultant_x']<=1.00000001 and 0<=r['resultant_y']<=1.00000001 for r in rows))
    def test_lgp_inventory(self):
        a=inventory(self.dataset.files['world_us.lgp'])
        names={e['filename'].lower() for e in a['entries']}
        self.assertTrue({'wm0.ev','wm2.ev','wm3.ev','field.tbl','enc_w.bin','mes'}<=names)
        self.assertGreater(a['tex_count'],0)
    def test_alternative_groups_external_perimeters(self):
        for group in self.topo['alternative_group_perimeters']:
            self.assertEqual(group['unmatched_base'],0)
            self.assertEqual(group['unmatched_alternative'],0)
    def test_orientation_candidates_remain_hypotheses(self):
        result=probe_orientation(self.worlds[0])
        self.assertEqual([c['id'] for c in result['candidates']],['A','B','C'])
        a,b,c=result['candidates']
        for name,metrics in a['evidence'].items():
            self.assertAlmostEqual(metrics['mean_hypothetical_latitude'],-b['evidence'][name]['mean_hypothetical_latitude'])
            self.assertEqual(metrics['fraction_abs_lat_ge50'],b['evidence'][name]['fraction_abs_lat_ge50'])
    def test_source_api_read_only(self):
        original=Path.open
        source_paths=set(self.dataset.files.values())
        seen=[]
        def guarded(path,mode='r',*args,**kwargs):
            if path in source_paths:
                self.assertEqual(mode,'rb');seen.append(path)
            return original(path,mode,*args,**kwargs)
        with patch.object(Path,'open',guarded):
            parse_map(self.dataset.files['wm3.map'],3)
            fingerprint(self.dataset)
            inventory(self.dataset.files['world_us.lgp'])
        self.assertGreater(len(seen),0)

if __name__=='__main__': unittest.main()
