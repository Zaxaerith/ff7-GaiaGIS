# SPDX-License-Identifier: GPL-3.0-only
import hashlib
import struct
import sys
import unittest
import zlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from gaiagis.texture_pack import atlas_layout,build_atlas,png_rgba,catalog,build_texture_pack
from gaiagis.tex import TexImage
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(r'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition')

class AtlasTests(unittest.TestCase):
    def setUp(self):
        self.resources=[dict(id=1,width=2,height=2),dict(id=2,width=3,height=1)]
        self.images={1:TexImage(2,2,bytes([1,2,3,255,4,5,6,255,7,8,9,255,10,11,12,255]),{}),2:TexImage(3,1,bytes([30,40,50,255])*3,{})}
    def test_deterministic_order(self):self.assertEqual(atlas_layout(self.resources),atlas_layout(self.resources[::-1]))
    def test_bounds_and_no_overlap(self):
        side,rows=atlas_layout(self.resources)
        for r in rows:self.assertTrue(r['x']>=4 and r['y']>=4 and r['x']+r['width']+4<=side and r['y']+r['height']+4<=side)
        a,b=rows;self.assertTrue(a['x']+a['width']+4<=b['x']-4 or a['y']+a['height']+4<=b['y']-4)
    def test_extended_edge_corners(self):
        side,rows,pixels=build_atlas(self.resources,self.images);r=next(r for r in rows if r['id']==1)
        def pixel(x,y):return pixels[(y*side+x)*4:(y*side+x+1)*4]
        self.assertEqual(pixel(r['x']-4,r['y']-4),bytes([1,2,3,255]))
        self.assertEqual(pixel(r['x']+5,r['y']+5),bytes([10,11,12,255]))
    def test_png_lossless_and_deterministic(self):
        side,_,pixels=build_atlas(self.resources,self.images);a=png_rgba(side,side,pixels)
        self.assertEqual(a,png_rgba(side,side,pixels));offset=8;compressed=b''
        while offset<len(a):
            n=struct.unpack_from('>I',a,offset)[0];kind=a[offset+4:offset+8];content=a[offset+8:offset+8+n]
            self.assertEqual(zlib.crc32(kind+content)&0xffffffff,struct.unpack_from('>I',a,offset+8+n)[0])
            if kind==b'IDAT':compressed+=content
            offset+=n+12
        raw=zlib.decompress(compressed);self.assertEqual(b''.join(raw[y*(side*4+1)+1:(y+1)*(side*4+1)] for y in range(side)),pixels)
    def test_oversized_resource(self):
        with self.assertRaises(ValueError):atlas_layout([dict(id=0,width=4096,height=4096)])
    def test_map_specific_catalog(self):
        rows=catalog();self.assertEqual(len(set(r['id'] for r in rows)),len(rows))
        with self.assertRaises(ValueError):catalog('WM2')
    def test_png_size_rejection(self):
        with self.assertRaises(ValueError):png_rgba(2,2,b'')

@unittest.skipUnless(SOURCE.exists() and (ROOT/'web/public/data/gaia-meta.json').exists(),'Own FF7 installation/V1 data absent')
class LocalTextureTests(unittest.TestCase):
    def test_real_export_determinism(self):
        out=ROOT/'output/v1_7/texture-test/gaia-textures.bin'
        a=build_texture_pack(SOURCE,ROOT/'web/public/data/gaia-meta.json',out);b=build_texture_pack(SOURCE,ROOT/'web/public/data/gaia-meta.json',out)
        self.assertEqual(a,b);self.assertEqual(a['missing'],[]);self.assertEqual(a['sha256'],hashlib.sha256(out.read_bytes()).hexdigest())
    def test_output_cannot_escape_workspace(self):
        with self.assertRaises(ValueError):build_texture_pack(SOURCE,ROOT/'web/public/data/gaia-meta.json',SOURCE/'gaia-textures.bin')

if __name__=='__main__':unittest.main()
