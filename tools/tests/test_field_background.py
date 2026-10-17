"""Public synthetic v2 background boundary/pixel tests; no FF7 assets."""
# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import struct
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'src'))
from gaiagis.field_background import BackgroundError, DESCRIPTOR, background_structure, parse_background_v2


def fixture(*, depth=1, raw_depth=None, count=1, tail=b'END', layer=0, blend=0, group=0, mask=0):
    palette = struct.pack('<I4H', 12+512*count, 0, 480, 256, count) + struct.pack('<256H', *([31,992]+[0]*254))*count
    data = bytearray(40); data[4] = 1; data[5:12] = b'PALETTE'; data[12] = 1; data[36:40] = b'BACK'
    for lid in range(4):
        if lid and lid != layer:
            data += b'\0'; continue
        header = bytearray(12 if lid == 0 else 27 if lid == 1 else 21)
        if lid:
            header[0] = 1
        struct.pack_into('<hhH', header, bool(lid), 32, 32, int(lid == layer))
        data += header
        if lid == layer:
            tile = bytearray(52); tile[24:27] = bytes([group,mask,blend]); tile[34] = depth if raw_depth is None else raw_depth
            data += tile
    data += b'TEXTURE' + struct.pack('<3H', 1, 0, depth)
    data += (bytes([0x21])*32768 if depth == 0 else bytes([1])*65536 if depth == 1 else struct.pack('<H',0xf800)*65536)
    data += bytes(41*2) + tail
    return palette, bytes(data)


class BackgroundV2Tests(unittest.TestCase):
    def test_exact_original_footer_variant_and_closed_tail(self):
        for tail in (b'END', b'ENDFINAL FANTASY7'):
            p,b = fixture(tail=tail); meta,raw,s = parse_background_v2(p,b)
            self.assertEqual(meta['status'], 'static_complete'); self.assertEqual(s['tail'], tail.decode())
        for tail in (b'ENDx', b'END\0', b'END'+b'FINAL FANTASY7junk', b'EN'):
            with self.assertRaises(BackgroundError):
                background_structure(*fixture(tail=tail))

    def test_page_depth_is_authoritative_but_missing_page_and_uv_still_rejected(self):
        p,b = fixture(raw_depth=0)
        meta,raw,s = parse_background_v2(p,b)
        self.assertEqual((s['tiles'][0]['rawDepth'],s['tiles'][0]['depth']), (0,1))
        self.assertEqual(meta['pixelBytes'],256)
        for offset,value in ((52+30,42),(52+8,250),(52+20,1),(52+10,65535)):
            bad = bytearray(b); struct.pack_into('<H',bad,offset,value)
            with self.assertRaises(BackgroundError):
                background_structure(p,bad)

    def test_four_bit_low_nibble_first_and_source_descriptor(self):
        p,b = fixture(depth=0)
        meta,raw,s = parse_background_v2(p,b)
        self.assertEqual(list(raw[-256:-252]), [1,2,1,2])
        d = DESCRIPTOR.unpack_from(raw)
        self.assertEqual(d[:8], (0,0,0,0,16,52,0,0))
        self.assertEqual(d[10],0); self.assertEqual(d[-1],0)
        self.assertEqual(meta['rawBytes'],36+512+256)

    def test_conditional_masks_and_unsupported_blend_remain_distinct_from_base(self):
        p,b = fixture(layer=1,group=4,mask=5)
        meta,raw,s = parse_background_v2(p,b)
        self.assertEqual(meta['baseTileCount'],0); self.assertEqual(meta['conditionalTileCount'],1)
        self.assertEqual(meta['supportedTileCount'],1); self.assertEqual(meta['status'],'unsupported')
        self.assertTrue(s['tiles'][0]['mask'] & (1 << 2)); self.assertFalse(s['tiles'][0]['mask'] & (1 << 1))
        p,b = fixture(layer=1,blend=1)
        meta,raw,s = parse_background_v2(p,b)
        self.assertEqual(meta['omitted'],1); self.assertEqual(meta['pixelBytes'],0)
        self.assertEqual(DESCRIPTOR.unpack_from(raw)[15],1); self.assertEqual(DESCRIPTOR.unpack_from(raw)[-1],0xffffffff)

    def test_large_tiles_are_32px_evidence_without_invented_parallax(self):
        p,b = fixture(layer=2)
        meta,raw,s = parse_background_v2(p,b)
        self.assertEqual(meta['bounds'],[0,0,32,32]); self.assertEqual(s['tiles'][0]['size'],32)
        self.assertEqual(s['tiles'][0]['supportCode'],2); self.assertEqual(meta['pixelBytes'],0)

    def test_zero_palette_only_permits_direct_source_and_inconsistent_length_rejects(self):
        p,b = fixture(depth=2,count=0)
        self.assertEqual(background_structure(p,b)['paletteHeader'][-1],0)
        with self.assertRaises(BackgroundError):
            background_structure(*fixture(count=0))
        p,b = fixture(); bad = bytearray(p); struct.pack_into('<I',bad,0,len(p)-2)
        with self.assertRaises(BackgroundError):
            background_structure(bad,b)

    def test_truncation_in_layers_pages_and_pixel_payload_is_rejected(self):
        p,b = fixture()
        for size in (0,39,51,70,104,110,200,len(b)-1):
            with self.subTest(size=size), self.assertRaises(BackgroundError):
                background_structure(p,b[:size])


class BackgroundV2WorkspaceTests(unittest.TestCase):
    """Exercise real local replacement/rollback using only synthetic payloads."""
    def setUp(self):
        import json
        import tempfile
        from unittest.mock import patch
        from gaiagis import field_background as background
        root = Path(__file__).resolve().parents[2]/'output/dev/current'
        root.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='background-public-', dir=root)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.workspace = self.root/'workspace'
        self.workspace.mkdir()
        self.source = self.root/'synthetic-input'
        self.sources = {'flevel.lgp':'a'*64, 'maplist':'b'*64}
        self.manifest = dict(schema='gaiagis-workspace', version=1, tool_version='4.2.0',
            sources=self.sources.copy(), assets=[])
        self.old_manifest = json.dumps(self.manifest, sort_keys=True).encode()
        self.old_pack = b'original synthetic visual bytes'
        (self.workspace/'gaia-workspace.json').write_bytes(self.old_manifest)
        (self.workspace/background.FILENAME).write_bytes(self.old_pack)
        (self.workspace/'gaia-field-context.json').write_text(json.dumps({'sources':self.sources}), encoding='utf8')
        self.unrelated = {'gaia-field-interaction.bin':b'preserved synthetic interaction',
            'research.gpkg':b'preserved synthetic research', 'research.qgz':b'preserved synthetic project'}
        for name,data in self.unrelated.items():
            (self.workspace/name).write_bytes(data)
        self.payload = self.candidate(self.sources)
        self.report = dict(sources=self.sources.copy(), bytes=len(self.payload))
        # The file transaction does not need a complete geometry Workspace.
        self.server = self.enterContext(patch('gaiagis.local.server_manifest',
            side_effect=lambda directory:json.loads(self.old_manifest)))
        self.real_encode = background.encode_visual
        self.encode = self.enterContext(patch.object(background, 'encode_visual',
            return_value=(self.payload, self.report)))

    @staticmethod
    def candidate(sources):
        import json
        metadata = dict(schema='gaiagis-field-visual', version=2,
            generator_revision='field-visual-4', sources=sources.copy(), scenes=[])
        encoded = json.dumps(metadata, separators=(',',':'), sort_keys=True).encode()
        return b'GAIACAM\0'+struct.pack('<II',2,len(encoded))+encoded

    def assert_unrelated_unchanged(self):
        for name,data in self.unrelated.items():
            self.assertEqual((self.workspace/name).read_bytes(),data)

    def test_manifest_replace_failure_restores_old_pair_with_and_without_pack(self):
        from unittest.mock import patch
        from gaiagis import field_background as background
        from gaiagis.field_interaction import atomic_write
        manifest_path = self.workspace/'gaia-workspace.json'
        pack_path = self.workspace/background.FILENAME
        for had_pack in (True,False):
            with self.subTest(had_pack=had_pack):
                manifest_path.write_bytes(self.old_manifest)
                if had_pack:
                    pack_path.write_bytes(self.old_pack)
                else:
                    pack_path.unlink(missing_ok=True)
                failed = False
                def fail_manifest_once(path, data):
                    nonlocal failed
                    if Path(path)==manifest_path and not failed:
                        failed = True
                        raise OSError('synthetic final Manifest replacement failure')
                    atomic_write(path,data)
                with patch('gaiagis.field_interaction.atomic_write',side_effect=fail_manifest_once):
                    with self.assertRaisesRegex(OSError,'synthetic final Manifest'):
                        background.update_workspace(self.source,self.workspace)
                self.assertTrue(failed)
                self.assertEqual(manifest_path.read_bytes(),self.old_manifest)
                if had_pack:
                    self.assertEqual(pack_path.read_bytes(),self.old_pack)
                else:
                    self.assertFalse(pack_path.exists())
                recovery = self.workspace/'.build/visual-recovery'
                self.assertEqual((recovery/'gaia-workspace.json').read_bytes(),self.old_manifest)
                if had_pack:
                    self.assertEqual((recovery/background.FILENAME).read_bytes(),self.old_pack)
                self.assert_unrelated_unchanged()

    def test_source_mismatch_rejects_before_staging_or_recovery_writes(self):
        import json
        from gaiagis import field_background as background
        for mismatch in ('context-maplist','manifest-flevel'):
            with self.subTest(mismatch=mismatch):
                context = self.sources.copy()
                self.manifest['sources'] = self.sources.copy()
                if mismatch=='context-maplist':
                    context['maplist']='c'*64
                else:
                    self.manifest['sources']['flevel.lgp']='c'*64
                (self.workspace/'gaia-field-context.json').write_text(json.dumps({'sources':context}),encoding='utf8')
                manifest = json.dumps(self.manifest,sort_keys=True).encode()
                self.server.side_effect = lambda directory:json.loads(manifest)
                (self.workspace/'gaia-workspace.json').write_bytes(manifest)
                with self.assertRaisesRegex(ValueError,'source mismatch'):
                    background.update_workspace(self.source,self.workspace)
                self.assertEqual((self.workspace/background.FILENAME).read_bytes(),self.old_pack)
                self.assertEqual((self.workspace/'gaia-workspace.json').read_bytes(),manifest)
                self.assertFalse((self.workspace/'.build').exists())
                self.assert_unrelated_unchanged()

    def test_candidate_validation_rejects_before_replacing_existing_files(self):
        from gaiagis import field_background as background
        self.encode.return_value=(b'not a Visual Pack',self.report)
        with self.assertRaisesRegex(ValueError,'candidate header'):
            background.update_workspace(self.source,self.workspace)
        self.assertEqual((self.workspace/background.FILENAME).read_bytes(),self.old_pack)
        self.assertEqual((self.workspace/'gaia-workspace.json').read_bytes(),self.old_manifest)
        self.assertFalse((self.workspace/'.build').exists())
        self.assert_unrelated_unchanged()

    def test_success_changes_only_visual_manifest_and_keeps_matching_recovery_pair(self):
        import json
        from gaiagis import field_background as background
        report=background.update_workspace(self.source,self.workspace)
        self.assertEqual(report,self.report)
        self.assertEqual((self.workspace/background.FILENAME).read_bytes(),self.payload)
        manifest=json.loads((self.workspace/'gaia-workspace.json').read_bytes())
        self.assertEqual(manifest['sources'],self.sources)
        self.assertEqual(manifest['assets'],[dict(filename=background.FILENAME,type='field-visual',mapId='shared',
            dependencies=['gaia-field-context.json'],generator_version='field-visual-4',
            bytes=len(self.payload),sha256=background.digest(self.payload))])
        recovery=self.workspace/'.build/visual-recovery'
        self.assertEqual((recovery/background.FILENAME).read_bytes(),self.old_pack)
        self.assertEqual((recovery/'gaia-workspace.json').read_bytes(),self.old_manifest)
        self.assert_unrelated_unchanged()

    def test_existing_recovery_pair_is_never_replaced_by_a_later_upgrade(self):
        from gaiagis import field_background as background
        recovery=self.workspace/'.build/visual-recovery';recovery.mkdir(parents=True)
        first_manifest=b'first recovery manifest';first_pack=b'first recovery pack'
        (recovery/'gaia-workspace.json').write_bytes(first_manifest)
        (recovery/background.FILENAME).write_bytes(first_pack)
        background.update_workspace(self.source,self.workspace)
        self.assertEqual((recovery/'gaia-workspace.json').read_bytes(),first_manifest)
        self.assertEqual((recovery/background.FILENAME).read_bytes(),first_pack)
        retained=recovery/background.digest(self.old_manifest)
        self.assertEqual((retained/'gaia-workspace.json').read_bytes(),self.old_manifest)
        self.assertEqual((retained/background.FILENAME).read_bytes(),self.old_pack)

    def test_publication_rejects_a_mismatched_generator_even_if_old_payload_is_valid(self):
        import json
        from gaiagis import field_background as background
        size=struct.unpack_from('<I',self.payload,12)[0]
        meta=json.loads(self.payload[16:16+size]);meta['generator_revision']='field-visual-3'
        encoded=json.dumps(meta).encode();self.encode.return_value=(b'GAIACAM\0'+struct.pack('<II',2,len(encoded))+encoded,self.report)
        with self.assertRaisesRegex(ValueError,'generator publication'):
            background.update_workspace(self.source,self.workspace)
        self.assertEqual((self.workspace/background.FILENAME).read_bytes(),self.old_pack)

    def test_concurrent_pack_change_is_preserved_without_rollback_overwrite(self):
        from gaiagis import field_background as background
        concurrent=b'synthetic concurrent writer result'
        def concurrent_encode(*args,**kwargs):
            (self.workspace/background.FILENAME).write_bytes(concurrent)
            return self.payload,self.report
        self.encode.side_effect=concurrent_encode
        with self.assertRaisesRegex(RuntimeError,'changed during generation'):
            background.update_workspace(self.source,self.workspace)
        self.assertEqual((self.workspace/background.FILENAME).read_bytes(),concurrent)
        self.assertEqual((self.workspace/'gaia-workspace.json').read_bytes(),self.old_manifest)
        self.assert_unrelated_unchanged()

    def test_v2_total_budget_is_bounded_independently_from_legacy_v1(self):
        from unittest.mock import patch
        from gaiagis import field_background as background
        from gaiagis import field_camera as legacy
        self.assertEqual((background.MAX_PACK,legacy.MAX_PACK),(96_000_000,64_000_000))
        # Small synthetic bounds exercise exact-limit inclusion and total-size
        # rejection without allocating a production-sized 96 MB byte buffer.
        import json
        meta=json.loads(self.payload[16:]);meta['generator_revision']='field-visual-3'
        legacy_meta=json.dumps(meta).encode();legacy_payload=b'GAIACAM\0'+struct.pack('<II',2,len(legacy_meta))+legacy_meta
        for payload,limit in ((legacy_payload,'MAX_PACK'),(self.payload,'MAX_COMPOSITING_PACK')):
            with patch.object(background,limit,len(payload)):
                self.assertEqual(background.validate_visual(payload,self.sources)['version'],2)
            with patch.object(background,limit,len(payload)-1):
                with self.assertRaisesRegex(ValueError,'candidate (header|profile budget)'):
                    background.validate_visual(payload,self.sources)
        class Oversized:
            def __len__(self):
                return 100_000_001
            def __getitem__(self,key):
                raise AssertionError('An oversized payload must be rejected before any read')
        with self.assertRaisesRegex(ValueError,'candidate header'):
            background.validate_visual(Oversized(),self.sources)

    def test_encoder_counts_metadata_in_total_budget_before_any_workspace_write(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        from gaiagis import field_background as background
        # No real archive or Field data: an empty synthetic maplist isolates
        # the total-file guard, including its 16-byte header and metadata.
        archive=self.source/'data/field/flevel.lgp'
        dataset=SimpleNamespace(wm_directory=self.source/'data/wm')
        with patch('gaiagis.dataset.discover',return_value=dataset), \
             patch('gaiagis.dataset.child_ci',side_effect=[archive.parent,archive]), \
             patch('gaiagis.web_export.sha256',return_value='a'*64), \
             patch('gaiagis.lgp.inventory',return_value={'entries':[{'filename':'maplist'}]}), \
             patch('gaiagis.lgp.read_entry',return_value=b'synthetic maplist'), \
             patch('gaiagis.poi.parse_maplist',return_value=[]), \
             patch.object(background,'MAX_COMPOSITING_PACK',16):
            # Bypass only the updater's mock, exercising the actual encoder.
            with self.assertRaisesRegex(ValueError,'metadata/size budget'):
                self.real_encode(self.source,self.workspace)
        self.assertEqual((self.workspace/background.FILENAME).read_bytes(),self.old_pack)
        self.assertEqual((self.workspace/'gaia-workspace.json').read_bytes(),self.old_manifest)
        self.assert_unrelated_unchanged()


class BackgroundV2EvidenceBoundaryTests(unittest.TestCase):
    def test_inconsistent_group_and_mask_remain_unsupported_evidence(self):
        for group,mask in ((0,1),(4,0)):
            with self.subTest(group=group,mask=mask):
                meta,raw,structure=parse_background_v2(*fixture(layer=1,group=group,mask=mask))
                tile=structure['tiles'][0]
                self.assertEqual((tile['group'],tile['mask'],tile['supportCode']),(group,mask,3))
                self.assertEqual((meta['pixelBytes'],meta['omitted']),(0,1))
                self.assertEqual(DESCRIPTOR.unpack_from(raw)[-1],0xffffffff)

    def test_out_of_preview_target_keeps_raw_descriptor_and_reference_checks(self):
        palette,original=fixture()
        second=bytearray(original[52:104])
        struct.pack_into('<h',second,0,10000)
        data=bytearray(original[:104]+second+original[104:])
        struct.pack_into('<H',data,44,2)
        meta,raw,structure=parse_background_v2(palette,data)
        self.assertEqual((meta['status'],meta['bounds'],meta['tileCount'],meta['omitted']),
            ('static_partial',[0,0,16,16],2,1))
        tile=structure['tiles'][1]
        self.assertEqual((tile['x'],tile['sourceOffset'],tile['supportCode']),(10000,104,4))
        descriptor=DESCRIPTOR.unpack_from(raw,36)
        self.assertEqual((descriptor[0],descriptor[5],descriptor[15],descriptor[-1]),(10000,104,4,0xffffffff))
        # An omitted target still cannot hide a damaged texture or Palette ref.
        for offset,value in ((104+30,42),(104+8,250),(104+20,1)):
            bad=bytearray(data);struct.pack_into('<H',bad,offset,value)
            with self.subTest(offset=offset),self.assertRaises(BackgroundError):
                background_structure(palette,bad)

    def test_blend_type_is_u8_and_unused_following_byte_is_not_its_high_byte(self):
        palette,data=fixture(layer=1)
        source=background_structure(palette,data)['tiles'][0]['sourceOffset']
        modified=bytearray(data);modified[source+28]=3;modified[source+29]=255
        meta,raw,structure=parse_background_v2(palette,modified)
        self.assertEqual(structure['tiles'][0]['blendType'],3)
        self.assertEqual(meta['supportedTileCount'],1)
        self.assertEqual(DESCRIPTOR.unpack_from(raw)[14],3)


class BackgroundV2AuditOutputTests(unittest.TestCase):
    def setUp(self):
        import tempfile
        from gaiagis.safety import WORKSPACE_ROOT
        base=WORKSPACE_ROOT/'output/dev/current'
        base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(prefix='background-audit-public-',dir=base)
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.source=self.root/'synthetic-input'
        self.workspace=self.root/'synthetic-workspace'
        self.workspace.mkdir()

    def test_unused_bytes_after_u8_source_operands_do_not_change_decode(self):
        for layer,blend in ((0,0),(1,0),(1,1)):
            with self.subTest(layer=layer,blend=blend):
                palette,data=fixture(layer=layer,blend=blend)
                original=background_structure(palette,data)
                at=original['tiles'][0]['sourceOffset']
                modified=bytearray(data)
                for unused in (9,11,13,15,21,31,33,35):
                    modified[at+unused]=255
                parsed=background_structure(palette,modified)
                self.assertEqual(parsed['tiles'],original['tiles'])
                self.assertEqual(parsed['tiles'][0]['rawDepth'],1)
                self.assertEqual(parse_background_v2(palette,modified)[1],parse_background_v2(palette,data)[1])

    def test_audit_path_cannot_target_workspace_research_source_or_outside_current(self):
        from gaiagis.field_background import audit_output
        from gaiagis.safety import WORKSPACE_ROOT
        for name in ('gaia-workspace.json','gaia-field-visual.bin','research.gpkg','research.qgz','source.py'):
            with self.subTest(name=name):
                target=self.workspace/name
                original=b'{"schema":"synthetic-protected-file"}'
                target.write_bytes(original)
                with self.assertRaises(ValueError):
                    audit_output(target)
                self.assertEqual(target.read_bytes(),original)
        with self.assertRaisesRegex(ValueError,'output/dev/current'):
            audit_output(WORKSPACE_ROOT/'output/exports/not-an-audit-target.json')
        self.assertFalse((WORKSPACE_ROOT/'output/exports/not-an-audit-target.json').exists())

    def test_only_new_json_or_existing_owned_report_is_accepted_without_writes(self):
        import json
        from gaiagis.field_background import audit_output
        target=self.root/'report.json'
        self.assertEqual(audit_output(target),target.resolve())
        self.assertFalse(target.exists())
        for value in (b'not JSON',b'[]',b'{}',b'\xff',
                b'{"schema":"gaiagis-field-background-audit","version":2}',
                b'{"schema":"gaiagis-field-background-audit","version":"1"}'):
            with self.subTest(value=value):
                target.write_bytes(value)
                with self.assertRaisesRegex(ValueError,'owned report'):
                    audit_output(target)
                self.assertEqual(target.read_bytes(),value)
        owned=json.dumps(dict(schema='gaiagis-field-background-audit',version=1,fields=[])).encode()
        target.write_bytes(owned)
        self.assertEqual(audit_output(target),target.resolve())
        self.assertEqual(target.read_bytes(),owned)
        directory=self.root/'directory.json';directory.mkdir()
        with self.assertRaisesRegex(ValueError,'owned report'):
            audit_output(directory)

    def encode_empty_audit(self,target):
        from types import SimpleNamespace
        from unittest.mock import patch
        from gaiagis.field_background import encode_visual
        archive=self.source/'data/field/flevel.lgp'
        dataset=SimpleNamespace(wm_directory=self.source/'data/wm')
        with patch('gaiagis.dataset.discover',return_value=dataset), \
             patch('gaiagis.dataset.child_ci',side_effect=[archive.parent,archive]), \
             patch('gaiagis.web_export.sha256',return_value='a'*64), \
             patch('gaiagis.lgp.inventory',return_value={'entries':[{'filename':'maplist'}]}), \
             patch('gaiagis.lgp.read_entry',return_value=b'synthetic maplist'), \
             patch('gaiagis.poi.parse_maplist',return_value=[]):
            return encode_visual(self.source,self.workspace,audit_path=target)

    def test_encoder_writes_report_with_owned_schema_through_atomic_writer(self):
        import json
        from unittest.mock import patch
        from gaiagis.field_interaction import atomic_write
        target=self.root/'report.json'
        with patch('gaiagis.field_interaction.atomic_write',wraps=atomic_write) as write:
            payload,report=self.encode_empty_audit(target)
        write.assert_called_once()
        self.assertEqual(Path(write.call_args.args[0]),target)
        saved=json.loads(target.read_bytes())
        self.assertEqual((saved['schema'],saved['version'],saved['fields']),
            ('gaiagis-field-background-audit',1,[]))
        self.assertEqual(saved['bytes'],len(payload))
        self.assertEqual(report['scenes'],0)
        self.assertFalse(any(target.parent.glob('.interaction-*.tmp')))

    def test_failed_atomic_audit_replace_preserves_owned_report_and_cleans_stage(self):
        import json
        from unittest.mock import patch
        target=self.root/'report.json'
        original=json.dumps(dict(schema='gaiagis-field-background-audit',version=1,fields=['old synthetic audit'])).encode()
        target.write_bytes(original)
        with patch('gaiagis.field_interaction.os.replace',side_effect=OSError('synthetic audit replacement failure')):
            with self.assertRaisesRegex(OSError,'synthetic audit replacement'):
                self.encode_empty_audit(target)
        self.assertEqual(target.read_bytes(),original)
        self.assertFalse(any(target.parent.glob('.interaction-*.tmp')))


class BackgroundV2MetadataTamperTests(unittest.TestCase):
    def test_scene_metadata_tampering_rejects_without_changing_pixel_hash(self):
        import copy
        import hashlib
        import json
        import zlib
        from gaiagis.field_background import validate_visual
        palette,data=fixture()
        background,raw,structure=parse_background_v2(palette,data)
        compressed=zlib.compress(raw)
        background.update(offset=0,bytes=len(compressed),sha256=hashlib.sha256(raw).hexdigest())
        metadata=dict(schema='gaiagis-field-visual',version=2,generator_revision='field-visual-3',
            sources={'flevel.lgp':'a'*64,'maplist':'b'*64},
            scenes=[dict(fieldId=0,cameras=[],background=background)])
        def pack(meta):
            encoded=json.dumps(meta,separators=(',',':'),sort_keys=True).encode()
            return b'GAIACAM\0'+struct.pack('<II',2,len(encoded))+encoded+compressed
        validate_visual(pack(metadata))
        changes=(
            ('range',lambda b:b.update(bounds=[0,0,5000,16])),
            ('area',lambda b:b.update(bounds=[-4096,-4096,4096,4096])),
            ('integer',lambda b:b.update(bounds=[0,0,16.5,16])),
            ('footprint',lambda b:b.update(bounds=[0,0,32,16])),
            ('status',lambda b:b.update(status='static_partial')),
            ('duplicate page',lambda b:b['pages'].append(copy.deepcopy(b['pages'][0]))),
            ('page depth',lambda b:b['pages'][0].update(depth=3)),
            ('page length',lambda b:b['pages'][0].update(bytes=1)),
            ('page offset',lambda b:b['pages'][0].update(sourceOffset=-1)),
            ('hash pair',lambda b:b.pop('section9SHA256')),
            ('missing static payload',lambda b:b.clear() or b.update(status='static_complete')),
        )
        for name,mutate in changes:
            with self.subTest(name=name):
                changed=copy.deepcopy(metadata)
                mutate(changed['scenes'][0]['background'])
                if 'sha256' in changed['scenes'][0]['background']:
                    self.assertEqual(changed['scenes'][0]['background']['sha256'],background['sha256'])
                payload=pack(changed)
                self.assertTrue(payload.endswith(compressed))
                with self.assertRaises(ValueError):
                    validate_visual(payload)

    def test_application_input_layer_count_and_dimension_budgets_are_not_invalid_source(self):
        palette,data=fixture()
        cases=[('input data',palette,b'\0'*8_000_001),
            ('input Palette',b'\0'*131085,data)]
        for name,offset,value,fmt in (('width',40,4097,'<h'),('height',42,4097,'<h'),('count',44,8193,'<H')):
            modified=bytearray(data);struct.pack_into(fmt,modified,offset,value)
            cases.append((name,palette,modified))
        # 8192+8192 are individually bounded; adding one Layer-2 tile exceeds
        # only the independent 16384-scene preview budget.
        many=bytearray(data[:40])
        for layer,count in ((0,8192),(1,8192),(2,1)):
            header=bytearray(12 if layer==0 else 27 if layer==1 else 21)
            if layer:header[0]=1
            struct.pack_into('<hhH',header,bool(layer),32,32,count)
            many+=header
            if layer<2:many+=bytes(52*count)
        cases.append(('total tile count',palette,many))
        for name,p,b in cases:
            with self.subTest(name=name),self.assertRaises(BackgroundError) as caught:
                background_structure(p,b)
            self.assertEqual(caught.exception.status,'unsupported')

    def test_unverified_negative_dimensions_and_confirmed_bad_spans_stay_distinct(self):
        palette,data=fixture()
        negative=bytearray(data);struct.pack_into('<h',negative,40,-1)
        with self.assertRaises(BackgroundError) as caught:
            background_structure(palette,negative)
        self.assertEqual(caught.exception.status,'unknown')
        malformed=[data[:103]]
        for offset,value in ((52+30,42),(52+20,1)):
            modified=bytearray(data);modified[offset]=value;malformed.append(modified)
        for bad in malformed:
            with self.subTest(length=len(bad)),self.assertRaises(BackgroundError) as caught:
                background_structure(palette,bad)
            self.assertEqual(caught.exception.status,'invalid_source')


if __name__ == '__main__':
    unittest.main()
