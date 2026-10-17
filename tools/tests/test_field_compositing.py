"""Independent public synthetic integer PC blend/source-span regressions."""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
import struct
import unittest
from test_field_background import fixture
from gaiagis.field_background import parse_background_v2, source_span, DESCRIPTOR
from gaiagis.field_compositing import blend_rgb, reference_rgba


class CompositingTests(unittest.TestCase):
    def test_all_byte_pairs_add_sub_saturate_and_do_not_quantize_back_to_five_bits(self):
        for back in range(256):
            for front in range(256):
                self.assertEqual(blend_rgb((back,)*3,(front,)*3,1),(min(back+front,255),)*3)
                self.assertEqual(blend_rgb((back,)*3,(front,)*3,2),(max(back-front,0),)*3)
        for mode in (0,3,4,255):
            with self.assertRaises(ValueError):
                blend_rgb((0,0,0),(255,255,255),mode)

    def test_source_spans_exact_edges_and_invalid_operands(self):
        for offset,length,total,want in ((0,0,0,True),(8_000_000,0,8_000_000,True),
                (7_999_999,1,8_000_000,True),(7_999_999,2,8_000_000,False),
                (0,1,0,False),(-1,0,8,False),(0,-1,8,False),(1.5,1,8,False),
                (2**64,1,8_000_000,False),(0,0,8_000_001,False),(True,0,8,False)):
            self.assertEqual(source_span(offset,length,total),want)

    def test_generator_profiles_preserve_old_omissions_and_new_32px_pixels(self):
        for layer in (1,2,3):
            p,b=fixture(layer=layer,blend=1)
            b=bytearray(b)
            # Obtain the exact source record offset from the unchanged parser.
            from gaiagis.field_background import background_structure
            start=background_structure(p,b)['tiles'][0]['sourceOffset'];b[start+28]=1
            old,_,s0=parse_background_v2(p,b)
            new,raw,s=parse_background_v2(p,b,revision='field-visual-4')
            self.assertEqual(old['pixelBytes'],0)
            self.assertEqual(new['pixelBytes'],256 if layer==1 else 1024)
            self.assertEqual(new['section9Bytes'],len(b))
            self.assertEqual(s['tiles'][0]['supportCode'],0 if layer==1 else 5)
            self.assertEqual(new['supportedTileCount'],int(layer==1))
            self.assertEqual(DESCRIPTOR.unpack_from(raw)[4],16 if layer==1 else 32)
            rgba=reference_rgba(s['tiles'],p,s['flags'],s['pages'],new['bounds'],layers=(layer,),raw_layers=layer>1)
            self.assertEqual(set(rgba[3::4]),{255})
            self.assertEqual(rgba[:4],bytes((0,255,0,255)))

    def test_new_profile_does_not_materialize_fractional_or_pc16_blends(self):
        from gaiagis.field_background import background_structure
        for depth,mode in ((1,0),(1,3),(1,255),(2,1),(2,2)):
            p,b=fixture(layer=1,blend=1,depth=depth);b=bytearray(b)
            b[background_structure(p,b)['tiles'][0]['sourceOffset']+28]=mode
            m,raw,s=parse_background_v2(p,b,revision='field-visual-4')
            self.assertEqual((m['pixelBytes'],m['omitted']),(0,1))

    def test_transparent_pixels_do_not_blend_and_raw_layer_toggle_does_not_rescale(self):
        p,b=fixture(layer=2)
        meta,raw,s=parse_background_v2(p,b,revision='field-visual-4')
        empty=reference_rgba(s['tiles'],p,s['flags'],s['pages'],meta['bounds'])
        image=reference_rgba(s['tiles'],p,s['flags'],s['pages'],meta['bounds'],layers=(2,),raw_layers=True)
        self.assertEqual(empty,bytes(32*32*4));self.assertEqual(image,bytes((0,255,0,255))*1024)
        self.assertEqual(hashlib.sha256(image).hexdigest(),'56419a079049271b37eea3515c12bbafb46578e6ac4db012c61395ef8b2e5a68')
