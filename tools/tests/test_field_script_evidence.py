"""Public synthetic script evidence boundaries, contracts and safe publication."""
# SPDX-License-Identifier: GPL-3.0-only
from copy import deepcopy
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import zlib

from gaiagis.field_context import parse_script
from gaiagis import field_script_evidence as evidence
from gaiagis.lzss import FormatError
from gaiagis.safety import WORKSPACE_ROOT


def script(body, extra_entries=()):
    base = 104; code = b'\0'+body; end = base+len(code)
    header = struct.pack('<HBBHHH6x8s8s', 0x502, 1, 0, end, 0, 512, b'author', b'fixture')
    entries = [base, base+1, *[base+1+i for i in extra_entries]]
    return header+b'entity'.ljust(8, b'\0')+struct.pack('<32H', *entries, *([end]*(32-len(entries))))+code


def pack_for(section, *, sources=None, context_hash='c'*64):
    value = evidence.scene_evidence(section, bytes(536), 170, 'fixture')
    raw = evidence.encode_json(value); compressed = zlib.compress(raw)
    span = dict(fieldId=170, name='fixture', section1SHA256=value['section1SHA256'], section8SHA256=value['section8SHA256'], offset=0, bytes=len(compressed), rawBytes=len(raw), sha256=evidence.digest(raw))
    sources = sources or {'flevel.lgp': 'a'*64, 'maplist': 'b'*64}
    meta = dict(schema=evidence.SCHEMA, version=1, generator_revision=evidence.GENERATOR_VERSION, sources=sources, contextSHA256=context_hash, scenes=[span])
    encoded = evidence.encode_json(meta)
    payload = evidence.MAGIC+struct.pack('<II', 1, len(encoded))+encoded+compressed
    return payload, meta, value


class ScriptDecoderTests(unittest.TestCase):
    def test_optional_view_retains_old_return_contract_and_entry_aliases(self):
        source = script(bytes.fromhex('e0000400')+b'\0')
        old = parse_script(source)
        self.assertEqual(len(old), 3)
        view = parse_script(source, evidence=True)
        self.assertEqual(view[:2], old[:2]); self.assertEqual(old[2], [])
        self.assertEqual(len(parse_script(source, interactions=True)), 4)
        with self.assertRaises(ValueError):
            parse_script(source, evidence=True, interactions=True)
        value = evidence.scene_evidence(source, bytes(536), 170, 'fixture')
        self.assertEqual(value['status'], 'indexed')
        row = value['records'][0]
        self.assertEqual(row['association'], dict(group=4, stateBit=0, layer=None, palette=None))
        self.assertEqual({value['entries'][i]['kind'] for i in row['owners']}, {'table', 'main'})
        self.assertEqual(row['runtime'], 'unknown')

    def test_every_target_width_and_exact_raw_offset(self):
        body = b''.join(bytes([op])+bytes(size-1) for op, (_, size) in evidence.OPCODES.items())+b'\0'
        section = script(body)
        index = evidence.script_index(section)
        self.assertEqual(len(index['records']), 19)
        pc = 105
        for row, (op, (_, size)) in zip(index['records'], evidence.OPCODES.items()):
            self.assertEqual((row['offset'], row['length'], row['opcode']), (pc, size, op))
            self.assertEqual(row['raw'], section[pc:pc+size].hex()); pc += size
        payload, meta, _ = pack_for(section)
        evidence.validate_evidence(payload, meta['sources'], context_sha256='c'*64)

    def test_operand_patterns_never_create_target_instructions(self):
        body = bytes([0x25, 0xe0, 0xe1, 0xe4, 0xe5, 0xe6, 0xe7, 0x2c, 0x2d])+b'\0'
        self.assertEqual(evidence.script_index(script(body))['records'], [])

    def test_unknown_width_at_3982_stops_until_a_declared_entry(self):
        prefix = bytes([0x5f])*(3982-105)
        target = bytes.fromhex('e0000100')+b'\0'
        blocked = evidence.script_index(script(prefix+b'\xfd'+target))
        self.assertEqual(blocked['records'], [])
        self.assertEqual(blocked['status'], 'limited')
        self.assertEqual(blocked['stops'][0]['offset'], 3982)
        self.assertEqual(blocked['stops'][0]['opcode'], 253)
        restarted = evidence.script_index(script(prefix+b'\xfd'+target, (len(prefix)+1,)))
        self.assertEqual([r['offset'] for r in restarted['records']], [3983])
        self.assertEqual(restarted['status'], 'partial')
        self.assertTrue(all(restarted['entries'][i]['slot'] == 2 for i in restarted['records'][0]['owners']))

    def test_branch_into_operand_invalidates_all_script_evidence(self):
        section = script(bytes.fromhex('e0000400')+b'\0', (1,))
        with self.assertRaises(FormatError):
            parse_script(section, evidence=True)
        value = evidence.scene_evidence(section, bytes(536), 170, 'fixture')
        self.assertEqual(value['status'], 'invalid_source')
        self.assertEqual(value['records'], [])
        payload, meta, _ = pack_for(section)
        evidence.validate_evidence(payload, meta['sources'])

    def test_unreachable_target_is_known_width_but_is_not_indexed(self):
        value = evidence.script_index(script(b'\0'+bytes.fromhex('e0000400')))
        self.assertEqual(value['records'], [])
        self.assertGreater(sum(r['bytes'] for r in value['unreachable']), 0)
        self.assertEqual(value['uncovered'], [])

    def test_group_bit_banks_and_pdh_conflict_remain_distinct(self):
        literal = evidence.decode_record(bytes.fromhex('e0000402'))
        self.assertEqual(literal['association']['stateBit'], 2)
        variable = evidence.decode_record(bytes.fromhex('e0600402'))
        self.assertIsNone(variable['association']['group'])
        self.assertEqual(variable['operands'][0]['kind'], 'variable')
        out_of_mask = evidence.decode_record(bytes.fromhex('e0000408'))
        self.assertIsNone(out_of_mask['association']['stateBit'])
        self.assertEqual(evidence.decode_record(bytes.fromhex('e21004'))['association']['group'], 4)
        self.assertIsNone(evidence.decode_record(bytes.fromhex('e20104'))['association']['group'])
        for banks in (0x10, 0x01, 0x61):
            row = evidence.decode_record(bytes([0x2c, banks, 3, 0, 2]))
            self.assertEqual(row['operands'][1]['kind'], 'unknown')
            self.assertIn('bgpdh_bank_selection_conflict', row['unknown'])
        pdh = evidence.decode_record(bytes.fromhex('2c00030002'))
        self.assertEqual(pdh['association']['layer'], 3)
        self.assertEqual(pdh['operands'][1]['value'], 512)
        scroll = evidence.decode_record(bytes.fromhex('2d00020000f0ff'))
        self.assertEqual([r['value'] for r in scroll['operands']], [2, 0, -16])

    def test_palette_buffer_operands_never_become_palette_associations(self):
        for op in (0xdf, *range(0xe5, 0xf0)):
            row = evidence.decode_record(bytes([op])+bytes(evidence.OPCODES[op][1]-1))
            self.assertIsNone(row['association']['palette'])
            self.assertIn('palette_work_buffer_not_section4_identity', row['unknown'])

    def test_alias_entries_do_not_repeat_cfg_work(self):
        section = bytearray(script(bytes.fromhex('e0000400')+b'\0'))
        struct.pack_into('<32H', section, 40, *([105]*32))
        with patch.object(evidence, 'MAX_WALK', 4):
            value = evidence.script_index(bytes(section))
        self.assertEqual(len(value['records'][0]['owners']), 32)


    def test_record_owner_and_cfg_work_budgets_fail_closed(self):
        source = script(bytes.fromhex('e0000400')+b'\0')
        for budget, limit in [('MAX_RECORDS', 0), ('MAX_OWNERS', 1), ('MAX_WALK', 0)]:
            with self.subTest(budget=budget), patch.object(evidence, budget, limit):
                with self.assertRaisesRegex(FormatError, 'budget'):
                    evidence.script_index(source)


    def test_application_budget_is_never_classified_as_invalid_original_source(self):
        source = script(bytes.fromhex('e0000400')+b'\0')
        for budget, limit in [('MAX_RECORDS', 0), ('MAX_OWNERS', 1), ('MAX_WALK', 0)]:
            with self.subTest(budget=budget), patch.object(evidence, budget, limit):
                with self.assertRaises(evidence.EvidenceLimitError):
                    evidence.scene_evidence(source, bytes(536), 170, 'fixture')


class EvidenceContractTests(unittest.TestCase):
    def setUp(self):
        self.payload, self.meta, self.value = pack_for(script(bytes.fromhex('e0000400')+b'\0'))

    def test_roundtrip_selected_scene_and_optional_source_binding(self):
        context = dict(nodes=[dict(id=170, name='fixture', status='available')])
        found = evidence.validate_evidence(self.payload, self.meta['sources'], context_sha256='c'*64, context=context, field_id=170)
        self.assertEqual(found, self.value)
        with self.assertRaisesRegex(ValueError, 'Context/source'):
            evidence.validate_evidence(self.payload, self.meta['sources'], context_sha256='d'*64)
        with self.assertRaisesRegex(ValueError, 'Context/source'):
            evidence.validate_evidence(self.payload, {'flevel.lgp': 'e'*64, 'maplist': 'b'*64})
        with self.assertRaisesRegex(ValueError, 'Context identity'):
            evidence.validate_evidence(self.payload, self.meta['sources'], context=dict(nodes=[dict(id=170, name='wrong', status='available')]))

    def test_noninvalid_code_start_cannot_alias_zero_invalid_source_sentinel(self):
        _, meta, value = pack_for(script(b'\0'))
        value.update(status='empty', reason=None, entries=[], records=[], stops=[],
                     decodedInstructions=0, reachableInstructions=0,
                     decodedBytes=0, reachableBytes=0, uncovered=[], unreachable=[])
        for offset in (0, 1, 31):
            with self.subTest(offset=offset):
                value.update(codeStart=offset, codeEnd=offset)
                with self.assertRaises(ValueError):
                    evidence.validate_scene(value, meta['scenes'][0])
        value.update(codeStart=32, codeEnd=32)
        evidence.validate_scene(value, meta['scenes'][0])
        rejected = evidence.scene_evidence(script(bytes.fromhex('e0000400')+b'\0', (1,)), bytes(536), 170, 'fixture')
        self.assertEqual((rejected['status'], rejected['codeStart'], rejected['codeEnd']), ('invalid_source', 0, 0))
        rejected_span = dict(meta['scenes'][0], section1SHA256=rejected['section1SHA256'])
        evidence.validate_scene(rejected, rejected_span)

    def test_last_complete_instruction_may_end_at_section_code_boundary(self):
        payload, meta, value = pack_for(script(bytes.fromhex('e0000400')))
        record = value['records'][0]
        self.assertEqual(record['offset']+record['length'], value['codeEnd'])
        evidence.validate_evidence(payload, meta['sources'])
        record['offset'] += 1
        with self.assertRaises(ValueError):
            evidence.validate_scene(value, meta['scenes'][0])

    def test_hostile_json_nesting_is_rejected_as_validation_error(self):
        strings = dict(brackets='['*100+'}'*100, escaped='a\"b\\c')
        self.assertEqual(evidence._decode(evidence.encode_json(strings)), strings)
        with self.assertRaisesRegex(ValueError, 'JSON nesting'):
            evidence._decode(b'['*2000+b'0'+b']'*2000)

    def test_duplicate_source_keys_and_scene_ids_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'duplicate JSON'):
            evidence._decode(b'{"x":1,"x":2}')
        meta = deepcopy(self.meta); meta['scenes'].append(meta['scenes'][0])
        raw = evidence.encode_json(meta)
        candidate = evidence.MAGIC+struct.pack('<II', 1, len(raw))+raw+self.payload[16+struct.unpack_from('<I', self.payload, 12)[0]:]
        with self.assertRaisesRegex(ValueError, 'duplicate Field'):
            evidence.validate_evidence(candidate, meta['sources'])

    def test_transport_metadata_count_ranges_and_generator_are_bounded(self):
        with self.assertRaises(ValueError): evidence.validate_evidence(self.payload+b'x', self.meta['sources'])
        with self.assertRaises(ValueError): evidence.validate_evidence(self.payload[:-1], self.meta['sources'])
        candidate = bytearray(self.payload); struct.pack_into('<I', candidate, 12, evidence.MAX_HEADER+1)
        with self.assertRaises(ValueError): evidence.validate_evidence(candidate, self.meta['sources'])
        for field, value in [('offset', -1), ('offset', 2**64), ('bytes', 0), ('rawBytes', evidence.MAX_SCENE+1)]:
            meta = deepcopy(self.meta); meta['scenes'][0][field] = value
            raw = evidence.encode_json(meta)
            candidate = evidence.MAGIC+struct.pack('<II', 1, len(raw))+raw+self.payload[16+struct.unpack_from('<I', self.payload, 12)[0]:]
            with self.assertRaises(ValueError): evidence.validate_evidence(candidate, meta['sources'])

    def test_inflation_hash_trailing_and_count_limits(self):
        span = self.meta['scenes'][0]
        with self.assertRaises(ValueError): evidence._inflate(zlib.compress(evidence.encode_json(self.value))+b'x', span)
        broken = deepcopy(span); broken['sha256'] = 'f'*64
        with self.assertRaises(ValueError): evidence._inflate(zlib.compress(evidence.encode_json(self.value)), broken)
        with patch.object(evidence, 'MAX_SCENE', 100):
            with self.assertRaises(ValueError): evidence._inflate(zlib.compress(evidence.encode_json(self.value)), span)

    def test_scene_false_association_owners_and_coverage_are_rejected(self):
        for edit in (
            lambda v: v['records'][0]['association'].update(group=9),
            lambda v: v['records'][0].update(raw='e0000900'),
            lambda v: v['records'][0].update(owners=[99]),
            lambda v: v['records'][0].update(owners=[0, 0]),
            lambda v: v.update(decodedBytes=0),
            lambda v: v.update(status='empty'),
            lambda v: v.update(unreachable=[dict(offset=105, bytes=4)]),
        ):
            value = deepcopy(self.value); edit(value)
            with self.assertRaises(ValueError): evidence.validate_scene(value, self.meta['scenes'][0])


    def test_boolean_operands_cannot_impersonate_integer_evidence(self):
        value = deepcopy(self.value)
        value['records'][0]['association']['stateBit'] = False
        with self.assertRaisesRegex(ValueError, 'operand/association'):
            evidence.validate_scene(value, self.meta['scenes'][0])

    def test_targets_must_fit_reachable_instruction_and_byte_counts(self):
        value = deepcopy(self.value)
        value['reachableInstructions'] = 0
        with self.assertRaisesRegex(ValueError, 'target count'):
            evidence.validate_scene(value, self.meta['scenes'][0])
        value = deepcopy(self.value)
        value['reachableBytes'] = 3
        value['unreachable'] = [dict(offset=104, bytes=3)]
        with self.assertRaises(ValueError):
            evidence.validate_scene(value, self.meta['scenes'][0])

    def test_uncovered_ranges_are_a_subset_of_unreachable_ranges(self):
        _, meta, value = pack_for(script(b'\xfd'+bytes([0x5f])*10))
        self.assertEqual(value['uncovered'], [dict(offset=105, bytes=11)])
        value['unreachable'] = [dict(offset=104, bytes=11)]
        with self.assertRaisesRegex(ValueError, 'reachable/decoded coverage'):
            evidence.validate_scene(value, meta['scenes'][0])

    def test_unreachable_stops_cannot_claim_entry_owners(self):
        _, meta, value = pack_for(script(b'\xfd'))
        self.assertTrue(value['stops'][0]['owners'])
        value['stops'][0]['entryReachable'] = False
        with self.assertRaisesRegex(ValueError, 'unreachable stop ownership'):
            evidence.validate_scene(value, meta['scenes'][0])


class EvidencePublicationTests(unittest.TestCase):
    def setUp(self):
        base = WORKSPACE_ROOT/'output/dev/current/python-tests'
        base.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='script-evidence-', dir=base)
        self.root = Path(self.temp.name)
        self.workspace = self.root/'workspace'; self.workspace.mkdir()
        self.stage = self.root/'stage'; self.stage.mkdir()
        context = dict(schema='gaiagis-field-context', version=3, sources={'flevel.lgp': 'a'*64, 'maplist': 'b'*64}, nodes=[dict(id=170, name='fixture', status='available')])
        context_raw = evidence.encode_json(context)
        (self.workspace/'gaia-field-context.json').write_bytes(context_raw)
        self.payload, self.meta, _ = pack_for(script(bytes.fromhex('e0000400')+b'\0'), context_hash=evidence.digest(context_raw))
        self.manifest = dict(sources=context['sources'], assets=[])
        self.old_manifest = evidence.encode_json(self.manifest)
        (self.workspace/'gaia-workspace.json').write_bytes(self.old_manifest)
        self.report = dict(sources=context['sources'], contextSHA256=evidence.digest(context_raw))

    def tearDown(self):
        self.temp.cleanup()

    def publish(self):
        with patch('gaiagis.local.server_manifest', return_value=deepcopy(self.manifest)), patch.object(evidence, 'encode_evidence', return_value=(self.payload, self.report)):
            return evidence._update_workspace(self.root, self.workspace, audit_path=None, staging=self.stage)

    def test_success_changes_only_manifest_and_new_pack_and_keeps_recovery(self):
        unrelated = self.workspace/'user-research.json'; unrelated.write_bytes(b'private')
        self.publish()
        self.assertEqual((self.workspace/evidence.FILENAME).read_bytes(), self.payload)
        self.assertEqual(unrelated.read_bytes(), b'private')
        backup = self.workspace/'.build/script-evidence-recovery'/evidence.digest(self.old_manifest)
        self.assertEqual((backup/'gaia-workspace.json').read_bytes(), self.old_manifest)
        self.assertFalse((backup/evidence.FILENAME).exists())
        self.assertFalse((self.stage/'candidate.bin').exists())

    def test_manifest_failure_rolls_back_old_matching_pair(self):
        from gaiagis.field_interaction import atomic_write
        old_pack = b'old private resource'; (self.workspace/evidence.FILENAME).write_bytes(old_pack)
        once = [True]
        def fail(path, data):
            if Path(path).name == 'gaia-workspace.json' and Path(path).parent == self.workspace and once[0]:
                once[0] = False
                raise OSError('synthetic manifest publication failure')
            atomic_write(path, data)
        with patch('gaiagis.field_interaction.atomic_write', side_effect=fail):
            with self.assertRaisesRegex(OSError, 'synthetic manifest'):
                self.publish()
        self.assertEqual((self.workspace/evidence.FILENAME).read_bytes(), old_pack)
        self.assertEqual((self.workspace/'gaia-workspace.json').read_bytes(), self.old_manifest)

    def test_first_publication_manifest_failure_removes_only_new_pack(self):
        from gaiagis.field_interaction import atomic_write
        once = [True]
        def fail(path, data):
            if Path(path) == self.workspace/'gaia-workspace.json' and once[0]:
                once[0] = False
                raise OSError('synthetic first publication failure')
            atomic_write(path, data)
        with patch('gaiagis.field_interaction.atomic_write', side_effect=fail):
            with self.assertRaisesRegex(OSError, 'synthetic first'):
                self.publish()
        self.assertFalse((self.workspace/evidence.FILENAME).exists())
        self.assertEqual((self.workspace/'gaia-workspace.json').read_bytes(), self.old_manifest)

    def test_failed_recovery_write_never_leaves_partial_durable_pair(self):
        from gaiagis.field_interaction import atomic_write
        def fail(path, data):
            if Path(path).parent.name == 'recovery':
                raise OSError('synthetic recovery write failure')
            atomic_write(path, data)
        with patch('gaiagis.field_interaction.atomic_write', side_effect=fail):
            with self.assertRaisesRegex(OSError, 'synthetic recovery'):
                self.publish()
        backup = self.workspace/'.build/script-evidence-recovery'/evidence.digest(self.old_manifest)
        self.assertFalse(backup.exists())
        self.assertFalse((self.workspace/evidence.FILENAME).exists())
        self.assertEqual((self.workspace/'gaia-workspace.json').read_bytes(), self.old_manifest)

    def test_conflicting_recovery_and_changed_manifest_are_preserved(self):
        backup = self.workspace/'.build/script-evidence-recovery'/evidence.digest(self.old_manifest)
        backup.mkdir(parents=True)
        research = backup/'gaia-workspace.json'; research.write_bytes(b'private recovery')
        with self.assertRaisesRegex(ValueError, 'recovery identity conflict'):
            self.publish()
        self.assertEqual(research.read_bytes(), b'private recovery')
        self.assertFalse((self.workspace/evidence.FILENAME).exists())
        (self.workspace/'gaia-workspace.json').write_text('{"changed":true}', encoding='utf8')
        with self.assertRaisesRegex(RuntimeError, 'Manifest changed'):
            self.publish()

    def test_unknown_existing_audit_or_workspace_assets_cannot_be_overwritten(self):
        research = self.root/'research.json'; research.write_text('{"private":true}', encoding='utf8')
        for path in (research, self.workspace/'gaia-field-context.json', WORKSPACE_ROOT/'output/local-workspace/gaia-poi.json'):
            with self.assertRaises(ValueError): evidence.audit_output(path)
        own = self.root/'audit.json'
        self.assertEqual(evidence.audit_output(own), own.resolve())
        own.write_text('{"schema":"gaiagis-field-script-evidence-audit","version":1}', encoding='utf8')
        self.assertEqual(evidence.audit_output(own), own.resolve())

    def test_concurrent_context_change_is_rejected_before_publication(self):
        (self.workspace/'gaia-field-context.json').write_text('{"changed":true}', encoding='utf8')
        with self.assertRaisesRegex(RuntimeError, 'Context changed'):
            self.publish()
        self.assertFalse((self.workspace/evidence.FILENAME).exists())
        self.assertEqual((self.workspace/'gaia-workspace.json').read_bytes(), self.old_manifest)


if __name__ == '__main__':
    unittest.main()
