# SPDX-License-Identifier: GPL-3.0-only
import hashlib,os,struct,sys,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from gaiagis.world_models import parse_hrc,parse_rsd,parse_p,parse_animation,resource_name
from gaiagis.explorer_export import source_surface,build_explorer
from gaiagis.lzss import FormatError
from gaiagis.lgp import inventory,read_entry
from gaiagis.dataset import discover

def p_fixture(box=False):
    h=[1,1,1,3,3,0,0,3,0,1,0,0,1,1,int(box),1]+[0]*16
    vertices=struct.pack('<9f',0,0,0,1,0,0,0,1,0);normals=struct.pack('<9f',*([0,0,1]*3));colors=bytes([0,0,255,255]*3)
    poly=struct.pack('<12H',0,0,1,2,0,1,2,0,0,0,0,0);group=struct.pack('<14I',1,0,1,0,3,0,0,0,0,0,0,0,0,0)
    return struct.pack('<32I',*h)+vertices+normals+colors+bytes(4)+poly+bytes(100)+group+(bytes(28) if box else b'')+bytes(12)

class ModelTests(unittest.TestCase):
    def test_hrc_hierarchy(self):
        h=parse_hrc(b':HEADER_BLOCK 2\n:SKELETON example\n:BONES 2\na\nroot\n1\n1 ABC\nb\na\n2\n0\n');self.assertEqual(h['bones'][1]['parent'],0);self.assertEqual(h['bones'][0]['resources'],['abc.rsd'])
    def test_rigid_zero_bones(self):self.assertEqual(parse_hrc(b':HEADER_BLOCK 2\n:SKELETON rigid\n:BONES 0\nnull\nroot\n1\n1 ABC\n')['bone_count'],0)
    def test_bad_parent(self):
        with self.assertRaises(FormatError):parse_hrc(b':HEADER_BLOCK 2\n:SKELETON x\n:BONES 1\na\na\n1\n0\n')
    def test_truncated_hrc(self):
        with self.assertRaises(FormatError):parse_hrc(b':HEADER_BLOCK 2\n:SKELETON x\n:BONES 1\n')
    def test_resource_path(self):
        for name in ['../a.p','C:\\a.p','a/p.p','a b.p']:
            with self.subTest(name=name),self.assertRaises(FormatError):resource_name(name)
    def test_rsd_resolution(self):self.assertEqual(parse_rsd(b'@RSD940102\nPLY=abc.PLY\nNTEX=1\nTEX[0]=def.TIM\n'),dict(mesh='abc.p',textures=['def.tex']))
    def test_rsd_missing_texture(self):
        with self.assertRaises(FormatError):parse_rsd(b'@RSD940102\nPLY=a.PLY\nNTEX=1\n')
    def test_animation(self):
        a=parse_animation(struct.pack('<3I4B5I',1,1,1,1,0,2,0,*([0]*5))+struct.pack('<9f',*range(9)),1);self.assertEqual(a['values'],list(range(9)));self.assertEqual(a['rotation_order'],[1,0,2]);self.assertFalse(a['runtime_timing_verified'])
    def test_animation_length(self):
        with self.assertRaises(FormatError):parse_animation(struct.pack('<3I4B5I',1,1,1,1,0,2,0,*([0]*5)))
    def test_animation_bone_mismatch(self):
        with self.assertRaises(FormatError):parse_animation(struct.pack('<3I4B5I',1,1,0,1,0,2,0,*([0]*5))+bytes(24),2)
    def test_p_groups_and_colors(self):
        p=parse_p(p_fixture());self.assertEqual(p['triangle_count'],1);self.assertEqual(p['groups'][0]['colors'][:4],[1,0,0,1])
    def test_bbox_marker(self):self.assertEqual(parse_p(p_fixture(True))['vertex_count'],3)
    def test_p_truncation(self):
        with self.assertRaises(FormatError):parse_p(p_fixture()[:-1])
    def test_p_bad_vertex(self):
        b=bytearray(p_fixture());struct.pack_into('<H',b,128+72+12+4+2,3)
        with self.assertRaises(FormatError):parse_p(b)
    def test_p_nonfinite(self):
        b=bytearray(p_fixture());struct.pack_into('<f',b,128,float('nan'))
        with self.assertRaises(FormatError):parse_p(b)
    def test_bounded_surface(self):
        points=[(0,0,0),(10,0,0),(0,10,0),(10,10,0)];tris=[SimpleNamespace(indices=(0,1,2),ff7_terrain_type=0,script=0,triangle_id=0),SimpleNamespace(indices=(1,3,2),ff7_terrain_type=0,script=0,triangle_id=1)]
        mesh=SimpleNamespace(section_id=0,mesh_id=0,triangles=tris,position=lambda i:points[i]);data,stats=source_surface(SimpleNamespace(map_id=3,extent=(10,10),base_meshes=[mesh]));self.assertEqual(stats['edges'],1);self.assertEqual(len(data),112);self.assertEqual(struct.unpack_from('<3i',data,36),(1,-1,-1))
    def test_duplicates_block(self):
        t=SimpleNamespace(indices=(0,1,2),ff7_terrain_type=0,script=0,triangle_id=0);m=SimpleNamespace(section_id=0,mesh_id=0,triangles=[t,t],position=lambda i:[(0,0,0),(10,0,0),(0,10,0)][i]);data,stats=source_surface(SimpleNamespace(map_id=2,extent=(10,10),base_meshes=[m]));self.assertEqual(stats['duplicate_faces'],2);self.assertEqual(struct.unpack_from('<3i',data,36),(-1,-1,-1))

@unittest.skipUnless(os.environ.get('GAIAGIS_SOURCE_ROOT'),'Requires optional local FF7 source')
class SourceModelTests(unittest.TestCase):
    def test_all_actual_resources(self):
        archive=discover(Path(os.environ['GAIAGIS_SOURCE_ROOT'])).files['world_us.lgp'];parsers={'.hrc':parse_hrc,'.rsd':parse_rsd,'.p':parse_p,'.a':parse_animation}
        for entry in inventory(archive)['entries']:
            ext=Path(entry['filename']).suffix
            if ext in parsers:
                with self.subTest(resource=entry['filename']):parsers[ext](read_entry(archive,entry))
    def test_deterministic_pack(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'output') as temp:
            a=build_explorer(Path(os.environ['GAIAGIS_SOURCE_ROOT']),Path(temp)/'one.bin');b=build_explorer(Path(os.environ['GAIAGIS_SOURCE_ROOT']),Path(temp)/'two.bin');self.assertEqual(a['sha256'],b['sha256']);self.assertEqual(a['surface_stats']['WM0']['edges'],213301);self.assertEqual(a['models'],8)
if __name__=='__main__':unittest.main()
