# SPDX-License-Identifier: GPL-3.0-only
import base64,io,json,os,struct,sys,tempfile,unittest,wave
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from gaiagis.field_models import parse_field_models,field_model_section
from gaiagis.presentation import parse_audio_fmt,decode_ms_adpcm,pcm_wav,build_presentation
from gaiagis.explorer_export import build_explorer,EXTENDED
from gaiagis.build_workspace import reusable,write_manifest

def binding():
    def text(v):return struct.pack('<H',len(v))+v
    return bytes(2)+struct.pack('<HH',1,512)+text(b'synthetic.char')+bytes(2)+b'TEST.HRC'+b'512\0'+struct.pack('<H',2)+bytes(30)+text(b'IDLE.aki')+bytes(2)+text(b'MOVE.aki')+bytes(2)

class FieldBindingTests(unittest.TestCase):
    def test_original_animation_bindings(self):
        r=parse_field_models(binding())[0];self.assertEqual(r['hrc'],'test.hrc');self.assertEqual([a['resource'] for a in r['animations']],['idle.a','move.a']);self.assertEqual(r['byte_offset'],6)
    def test_truncation(self):
        for n in (0,4,10,len(binding())-1):
            with self.subTest(n=n),self.assertRaises(ValueError):parse_field_models(binding()[:n])
    def test_trailing(self):
        with self.assertRaises(ValueError):parse_field_models(binding()+b'x')
    def test_unsafe_hrc(self):
        with self.assertRaises(ValueError):parse_field_models(binding().replace(b'TEST.HRC',b'../x.HRC'))
    def test_invalid_compressed_length(self):
        with self.assertRaises(ValueError):field_model_section(bytes(50))
    def test_six_explicit_field_sources(self):
        self.assertEqual(len(EXTENDED),6);self.assertEqual(len({s for _,s,_ in EXTENDED}),6)

class AudioTests(unittest.TestCase):
    def record(self):return dict(format=2,channels=1,bits=4,block_align=8,extra=struct.pack('<HHhh',4,1,256,0))
    def test_predictor_and_nibble_order(self):
        pcm=decode_ms_adpcm(struct.pack('<BHhhB',0,16,100,80,0x1f),self.record());self.assertEqual(struct.unpack('<4h',pcm),(80,100,116,100))
    def test_signed_and_clamped(self):
        pcm=decode_ms_adpcm(struct.pack('<BHhhB',0,200,32760,32760,0x77),self.record());self.assertEqual(struct.unpack('<4h',pcm)[-2:],(32767,32767))
    def test_predictor_reject(self):
        with self.assertRaises(ValueError):decode_ms_adpcm(bytes([1])+bytes(7),self.record())
    def test_short_block_reject(self):
        with self.assertRaises(ValueError):decode_ms_adpcm(bytes(6),self.record())
    def test_stereo_not_silently_decoded(self):
        with self.assertRaises(ValueError):decode_ms_adpcm(bytes(8),self.record()|dict(channels=2))
    def test_coefficients(self):
        with self.assertRaises(ValueError):decode_ms_adpcm(bytes(8),self.record()|dict(extra=bytes(4)))
    def test_wav_pcm(self):
        pcm=struct.pack('<4h',1,-1,32767,-32768)
        with wave.open(io.BytesIO(pcm_wav(pcm,44100))) as w:self.assertEqual(w.getframerate(),44100);self.assertEqual(w.getnchannels(),1);self.assertEqual(w.readframes(4),pcm)
    def test_audio_fmt_bounds(self):
        b=struct.pack('<6IHHIIHHH',8,0,0,0,0,0,2,1,44100,22050,8,4,8)+self.record()['extra'];self.assertEqual(parse_audio_fmt(b,8)[0]['sample_rate'],44100)
        with self.assertRaises(ValueError):parse_audio_fmt(b,7)
    def test_empty_allocator_record(self):
        self.assertEqual(len(parse_audio_fmt(bytes(24)+b'\xcd'*18,0)),1)

@unittest.skipUnless(os.environ.get('GAIAGIS_SOURCE_ROOT'),'Optional original FF7 data unavailable')
class SourcePresentationTests(unittest.TestCase):
    def test_party_source_and_determinism(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'output') as tmp:
            a=build_explorer(Path(os.environ['GAIAGIS_SOURCE_ROOT']),Path(tmp)/'a.bin',version=2);b=build_explorer(Path(os.environ['GAIAGIS_SOURCE_ROOT']),Path(tmp)/'b.bin',version=2)
            self.assertEqual(a['sha256'],b['sha256']);self.assertEqual(len(a['party_models']),9);self.assertEqual(a['models'],14);self.assertEqual(a['unavailable_models'],[])
            for m in a['party_models']:self.assertGreaterEqual(len(m['clips']),2);self.assertGreater(m['bones'],0)
    def test_original_ui_pack(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'output') as tmp:
            path=Path(tmp)/'gaia-presentation.json';a=build_presentation(Path(os.environ['GAIAGIS_SOURCE_ROOT']),path);b=build_presentation(Path(os.environ['GAIAGIS_SOURCE_ROOT']),path);self.assertEqual(a,b);self.assertEqual(a['records'],750)
            p=json.loads(path.read_text());self.assertEqual([x['source_record'] for x in p['audio']],[4,2,1]);self.assertNotIn('SteamLibrary',path.read_text())
            for x in p['audio']:
                with wave.open(io.BytesIO(base64.b64decode(x['wav']))) as w:self.assertEqual(w.getframerate(),44100);self.assertEqual(w.getnframes(),x['decoded_samples'])
