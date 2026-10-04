# SPDX-License-Identifier: GPL-3.0-only
import struct
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from gaiagis.tex import decode_tex
from gaiagis.lzss import FormatError

def fixture(paletted=True, key=0, alpha=255, direct_bytes=2):
    h=[0]*59
    h[0]=1;h[2]=key;h[15]=2;h[16]=1;h[49]=128
    if paletted:
        h[12]=1;h[13]=2;h[14]=4;h[19]=1;h[20]=8;h[22]=2;h[26]=1
        payload=bytes([10,20,30,alpha,40,50,60,254,0,1])
    else:
        h[26]=direct_bytes;h[25]=direct_bytes*8
        bits=(5,6,5,0) if direct_bytes==2 else (8,8,8,8 if direct_bytes==4 else 0)
        shifts=(11,5,0,0) if direct_bytes==2 else (16,8,0,24 if direct_bytes==4 else 0)
        h[27:31]=bits;h[31:35]=[((1<<n)-1)<<s for n,s in zip(bits,shifts)];h[35:39]=shifts
        payload=bytes(direct_bytes)+((0xffff if direct_bytes==2 else 0xffaabbcc).to_bytes(4,'little')[:direct_bytes])
    return struct.pack('<59I',*h)+payload

class TexTests(unittest.TestCase):
    def test_index_storage_and_channel_order(self):
        image=decode_tex(fixture())
        self.assertEqual(image.rgba,bytes([30,20,10,255,60,50,40,128]))
    def test_color_key_not_black_rgb(self):
        self.assertEqual(decode_tex(fixture(key=1)).rgba[3],0)
        self.assertEqual(decode_tex(fixture(key=0)).rgba[3],255)
    def test_alpha_preserved(self):
        self.assertEqual(decode_tex(fixture(alpha=64)).rgba[3],64)
    def test_per_palette_color_key_array(self):
        b=bytearray(fixture(key=1));struct.pack_into('<I',b,0xBC,1)
        self.assertEqual(decode_tex(bytes(b)+b'\0').rgba[3],255)
        self.assertEqual(decode_tex(bytes(b)+b'\1').rgba[3],0)
    def test_rgb565_full_white(self):
        self.assertEqual(decode_tex(fixture(False)).rgba,bytes([0,0,0,255,255,255,255,255]))
    def test_rgb24_and_rgba32(self):
        self.assertEqual(decode_tex(fixture(False,direct_bytes=3)).rgba[4:],bytes([170,187,204,255]))
        self.assertEqual(decode_tex(fixture(False,direct_bytes=4)).rgba[4:],bytes([170,187,204,255]))
    def test_direct_key(self):
        self.assertEqual(decode_tex(fixture(False,key=1)).rgba[3],0)
    def test_invalid_header(self):
        for data in (b'',fixture()[:100],bytes(236),fixture()[:-1],fixture()+b'\0'):
            with self.subTest(length=len(data)),self.assertRaises(FormatError):decode_tex(data)
    def test_invalid_dimensions_and_format(self):
        for offset,value in ((0,2),(0x3C,0),(0x40,100_000_000),(0x68,5),(0x58,3)):
            data=bytearray(fixture());struct.pack_into('<I',data,offset,value)
            with self.subTest(offset=offset),self.assertRaises(FormatError):decode_tex(bytes(data))
    def test_index_bounds(self):
        data=bytearray(fixture());data[-1]=2
        with self.assertRaises(FormatError):decode_tex(bytes(data))
    def test_direct_invalid_masks(self):
        data=bytearray(fixture(False));struct.pack_into('<I',data,0x80,0xffff)
        with self.assertRaises(FormatError):decode_tex(bytes(data))
    def test_palette_selection_bounds(self):
        with self.assertRaises(FormatError):decode_tex(fixture(),1)
    def test_deterministic(self):self.assertEqual(decode_tex(fixture()),decode_tex(fixture()))

if __name__=='__main__':unittest.main()
