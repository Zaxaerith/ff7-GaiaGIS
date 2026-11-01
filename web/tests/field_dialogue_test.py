# SPDX-License-Identifier: GPL-3.0-only
"""Original synthetic bytes only. No game text or original archive fixture."""
import unittest,sys,struct,tempfile,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'src'))
from gaiagis.field_dialogue import scene_dialogue,text_table,text_span,validate_scene,matches_context,EN_ARCHIVE,DECODER,GENERATOR_VERSION,digest,PC_MAPLIST_SHA256
from gaiagis.field_context import parse_script

def synthetic(texts=None):
    texts=texts or [b'4%34\xff',b'!3+\xff',b'5.2%&\xff']
    start=104;code=bytearray(30)
    code[2:9]=bytes([0x48,5,0,0,0,1,7])
    code[9:15]=bytes([0x14,0x50,7,2,0,11])
    code[15:18]=bytes([0x40,0,1])
    code[19:22]=bytes([0x40,0,0])
    code[26:29]=bytes([3,0,6*32+1])
    end=start+len(code);section=bytearray(end);struct.pack_into('<HBBHH',section,0,0x502,1,0,end,0);section[24:29]=b'synth';section[32:35]=b'ACT'
    slots=[104]*32;slots[1]=106;slots[2]=106;slots[3]=119;slots[4]=130
    struct.pack_into('<32H',section,40,*slots);section[start:end]=code
    offset=2+2*len(texts);table=bytearray(struct.pack('<H',len(texts)));pool=bytearray()
    for t in texts:table+=struct.pack('<H',offset+len(pool));pool+=t
    return bytes(section+table+pool)

class DialogueTest(unittest.TestCase):
    def scene(self,body=True):return scene_dialogue(synthetic(),bytes(740),bytes(4),0,'synth','a'*64,with_text=body)
    def test_boundaries_aliases_unreachable_and_requests(self):
        s=validate_scene(self.scene());by={r['offset']:r for r in s['records']}
        self.assertEqual(sum(r['entryReachable'] and r['opcode'] in (64,72) for r in s['records']),2)
        self.assertFalse(by[123]['entryReachable']);self.assertEqual(by[123]['owners'],[])
        owners=[s['entries'][i] for i in by[106]['owners']];self.assertEqual([o['slot'] for o in owners],[1,2]);self.assertEqual(by[130]['opcode'],3)
    def test_metadata_only_and_referenced_bodies(self):
        self.assertTrue(all(t['body'] is None for t in self.scene(False)['textTable']['texts']))
        texts=self.scene()['textTable']['texts'];self.assertIsNotNone(texts[0]['body']);self.assertIsNone(texts[2]['body'])
    def test_zero_255_and_invalid_256(self):
        section=synthetic([b'!\xff']*256);t=text_table(section,{0,255},True);self.assertEqual(len(t['texts']),256);self.assertIsNotNone(t['texts'][255]['body'])
        bad=synthetic([b'!\xff']*257);self.assertEqual(text_table(bad,set(),True)['status'],'unavailable')
    def test_missing_terminator_and_control_payload(self):
        self.assertEqual(text_span(b'ABC',0,3),(None,'no_terminator'))
        self.assertEqual(text_span(bytes([0xfe,0xdd,255,0,255]),0,5),(5,None))
        self.assertEqual(text_span(bytes([0xfe,0xe2,0]),0,3)[1],'truncated_control')
        self.assertEqual(text_span(bytes([0xfe,0x01,255]),0,3)[1],'unknown_control')
    def test_pointer_at_extra_and_no_text_region(self):
        s=bytearray(synthetic());at=struct.unpack_from('<H',s,4)[0];s=s[:at]+struct.pack('<HH',1,4)
        self.assertEqual(text_table(s,set(),True)['reason'],'text_pointer')
        s=s[:at];struct.pack_into('<H',s,4,at);self.assertEqual(text_table(s,set(),True)['reason'],'no_text_region')
    def test_bad_text_stays_unavailable(self):
        s=scene_dialogue(synthetic([b'!\xff',b'ABC']),bytes(740),None,0,'synth','a'*64,with_text=True)
        self.assertEqual(s['textTable']['texts'][1]['status'],'unavailable');self.assertIsNone(s['textTable']['texts'][1]['body'])
    def test_incremental_context_binding(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[2]/'.cache') as folder:
            p=Path(folder);context=p/'context.json';context.write_bytes(b'{}')
            header=dict(generator_revision=GENERATOR_VERSION,decoder=DECODER,sources={'flevel.lgp':EN_ARCHIVE,'maplist':PC_MAPLIST_SHA256},contextSHA256=digest(b'{}'))
            data=json.dumps(header).encode();asset=p/'dialogue.bin';asset.write_bytes(b'GAIADLG\0'+struct.pack('<II',1,len(data))+data)
            self.assertTrue(matches_context(asset,context));context.write_bytes(b'{ }');self.assertFalse(matches_context(asset,context))

    def test_cmusc_stops_are_unchanged(self):
        s=bytearray(synthetic());s[119]=253
        result=scene_dialogue(bytes(s),bytes(740),None,0,'synth','a'*64,with_text=False)
        self.assertEqual(result['status'],'partial');self.assertTrue(any(r['opcode']==253 for r in result['stops']))
        self.assertEqual(parse_script(bytes(s),evidence=True)[2],result['stops'])

if __name__=='__main__':unittest.main()
