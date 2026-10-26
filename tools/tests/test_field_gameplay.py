"""Synthetic, public Field gameplay instruction and provenance checks."""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

from gaiagis.field_gameplay import decode_gameplay_operands, scene_gameplay, index_field_gameplay
from gaiagis.lzss import FormatError
from gaiagis.safety import WORKSPACE_ROOT


def script(body):
    base = 104
    code = b'\0'+body
    end = base+len(code)
    header = struct.pack('<HBBHHH6x8s8s', 0x502, 1, 0, end, 0, 512, b'author', b'fixture')
    return header+b'entity'.ljust(8,b'\0')+struct.pack('<32H',base,base+1,*([end]*30))+code


class FieldGameplayTests(unittest.TestCase):
    def test_constant_and_variable_items_preserve_full_id_quantity_and_banks(self):
        literal = decode_gameplay_operands(bytes.fromhex('5800341203'))
        self.assertEqual(literal, [dict(name='item',kind='literal',bank=0,value=0x1234),dict(name='quantity',kind='literal',bank=0,value=3)])
        variable = decode_gameplay_operands(bytes.fromhex('5829341203'))
        self.assertEqual([(p['kind'],p['bank']) for p in variable],[('variable',2),('variable',9)])

    def test_materia_id_and_three_ap_bytes_have_four_separate_banks(self):
        operands = decode_gameplay_operands(bytes.fromhex('5b123407112233'))
        self.assertEqual([p['name'] for p in operands],['materia','ap0','ap1','ap2'])
        self.assertEqual([p['bank'] for p in operands],[1,2,3,4])
        self.assertEqual([p['value'] for p in operands],[7,17,34,51])
        literal = scene_gameplay(script(bytes.fromhex('5b00000711223300')),4,'fixture')
        self.assertEqual(literal['records'][0]['status'],'static')

    def test_battle_uses_second_bank_and_does_not_mask_or_name_a_boss(self):
        self.assertEqual(decode_gameplay_operands(bytes.fromhex('70a03412')),[dict(name='formation',kind='literal',bank=0,value=0x1234)])
        self.assertEqual(decode_gameplay_operands(bytes.fromhex('70023412'))[0]['kind'],'variable')

    def test_flag_writes_are_evidence_not_a_verified_pickup_or_save_flag(self):
        section = script(bytes.fromhex('580001000182202402830024028020240100'))
        value = scene_gameplay(section,1,'fixture')
        self.assertEqual(value['status'],'indexed')
        self.assertEqual([r['kind'] for r in value['records']],['item','flag','flag','flag'])
        self.assertTrue(all(r['status']=='unknown' for r in value['records'][1:]))
        self.assertTrue(all(r['flagLinks']==[] and r['position'] is None for r in value['records']))

    def test_original_instruction_offset_owner_and_field_identity_are_retained(self):
        section = script(bytes.fromhex('580001000100'))
        a = scene_gameplay(section,1,'fixture',member_sha256='a'*64)
        b = scene_gameplay(section,2,'second',member_sha256='b'*64)
        self.assertEqual(a['records'][0]['id'],'1:105')
        self.assertEqual(b['records'][0]['id'],'2:105')
        self.assertEqual(a['records'][0]['raw'],'5800010001')
        self.assertEqual({o['kind'] for o in a['records'][0]['owners']},{'table','main'})
        self.assertEqual(a['records'][0]['owners'][0]['actor'],0)
        self.assertEqual(a['section1SHA256'],hashlib.sha256(section).hexdigest())
        self.assertEqual(a['memberSHA256'],'a'*64)

    def test_variable_grant_never_becomes_a_static_reward(self):
        value = scene_gameplay(script(bytes.fromhex('581001000100')),3,'fixture')
        self.assertEqual(value['records'][0]['status'],'unknown')

    def test_unknown_opcode_stops_branch_and_prevents_definite_partial_conclusions(self):
        value = scene_gameplay(script(bytes.fromhex('58000100010c5b00000700000000')),1,'fixture')
        self.assertEqual(value['status'],'partial')
        self.assertEqual(len(value['records']),1)
        self.assertEqual(value['records'][0]['status'],'unknown')
        self.assertEqual(value['stops'][0]['reason'],'unsupported_opcode')
        self.assertEqual(value['stops'][0]['opcode'],0x0c)

    def test_operand_bytes_are_not_scanned_for_target_patterns(self):
        value = scene_gameplay(script(bytes([0x25,0x58,0x5b,0x70,0x80,0x82,0x83,0,0,0])),1,'fixture')
        self.assertEqual(value['records'],[])

    def test_invalid_script_and_target_width_are_rejected(self):
        value = scene_gameplay(script(bytes.fromhex('580001')),1,'fixture')
        self.assertEqual(value['status'],'unavailable')
        self.assertEqual(value['records'],[])
        for raw in (b'',b'\x58',bytes(5),bytes.fromhex('580000000000')):
            with self.assertRaises(FormatError):
                decode_gameplay_operands(raw)

    def test_archive_and_maplist_source_identity_must_match_before_indexing(self):
        output = WORKSPACE_ROOT/'output/dev/current/python-tests'
        output.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=output) as directory:
            path=Path(directory)/'flevel.lgp';path.write_bytes(b'fixture')
            context=dict(sources={'flevel.lgp':'a'*64,'maplist':'b'*64},nodes=[])
            with self.assertRaisesRegex(FormatError,'archive source mismatch'):
                index_field_gameplay(path,context)
            context['sources']['flevel.lgp']=hashlib.sha256(b'fixture').hexdigest()
            with patch('gaiagis.field_gameplay.inventory',return_value={'entries':[dict(filename='maplist')]}),patch('gaiagis.field_gameplay.read_entry',return_value=b'not-maplist'):
                with self.assertRaisesRegex(FormatError,'maplist source mismatch'):
                    index_field_gameplay(path,context)


if __name__=='__main__':
    unittest.main()
