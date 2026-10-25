"""Bounded language selection, provenance, cache isolation and bounded Field recovery."""
# SPDX-License-Identifier: GPL-3.0-only
import os
import json
import struct
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from gaiagis.constants import GAME_DATA_LANGUAGES
from gaiagis.dataset import discover, fingerprint, archive_key, same_dependencies
from gaiagis.local import validate_source, choose_source, parser
from gaiagis.safety import WORKSPACE_ROOT
from gaiagis.poi import parse_maplist
from gaiagis.lzss import FormatError

QA_OUTPUT=Path(os.environ.get('GAIAGIS_TEST_OUTPUT',str(WORKSPACE_ROOT/'output/dev/current/python-tests')))


class SourceLanguageTests(unittest.TestCase):
    def setUp(self):
        folder=Path(os.environ.get('GAIAGIS_TEST_OUTPUT',str(WORKSPACE_ROOT/'output/dev/current/python-tests')))
        folder.mkdir(parents=True,exist_ok=True)
        self.tmp=tempfile.TemporaryDirectory(dir=folder);self.root=Path(self.tmp.name)
        self.wm=self.root/'data/wm';self.field=self.root/'data/field'
        self.wm.mkdir(parents=True);self.field.mkdir()
        for name in ('wm0.map','wm2.map','wm3.map','wm0.bot','wm2.bot','wm3.bot'):
            (self.wm/name).write_bytes(b'synthetic shared geometry')
        for language,(world,field) in GAME_DATA_LANGUAGES.items():
            (self.wm/world).write_bytes(('synthetic '+language+' World').encode())
            (self.field/field).write_bytes(('synthetic '+language+' Field').encode())

    def tearDown(self):self.tmp.cleanup()

    def test_explicit_pairs_default_and_preserved_selection(self):
        self.assertEqual(discover(self.root).language,'en')
        for language,(world,field) in GAME_DATA_LANGUAGES.items():
            ds=discover(self.root,language)
            self.assertIs(discover(ds),ds)
            self.assertEqual(ds.world_archive.name,world)
            self.assertEqual(ds.field_archive().name,field)
            report=validate_source(self.root,language)
            self.assertEqual(report['game_data_language'],language)
            self.assertEqual({r['filename'] for r in report['files']}&set(sum(GAME_DATA_LANGUAGES.values(),())),{world,field})
            if language!='en':self.assertFalse(any(r['known_match'] for r in fingerprint(ds)['files']))
        with self.assertRaises(ValueError):discover(discover(self.root,'fr'),'de')

    def test_missing_pair_never_falls_back_and_override_rejects_mix(self):
        (self.field/'fflevel.lgp').unlink()
        with self.assertRaisesRegex(ValueError,'fflevel'):validate_source(self.root,'fr')
        with self.assertRaisesRegex(ValueError,'paired'):discover(self.root,'de').field_archive(self.field/'flevel.lgp')
        (self.wm/'world_sp.lgp').unlink()
        with self.assertRaises(ValueError):discover(self.root,'es')
        with self.assertRaises(ValueError):discover(self.root,'ja')

    def test_launcher_remembers_explicit_language_and_old_config_defaults_to_en(self):
        import json
        config=self.root.parent/(self.root.name+'-config.json')
        try:
            with patch('gaiagis.local.CONFIG',config):
                choose_source(self.root,True,'fr')
                self.assertEqual(choose_source(None)[1]['game_data_language'],'fr')
                self.assertEqual(choose_source(self.root)[1]['game_data_language'],'en')
                config.write_text(json.dumps({'source':str(self.root)}),encoding='utf8')
                self.assertEqual(choose_source(None)[1]['game_data_language'],'en')
                self.assertEqual(parser().parse_args(['--game-language','de']).game_language,'de')
        finally:config.unlink(missing_ok=True)

    @unittest.skipIf(os.name=='nt','Windows filesystem cannot create case-only siblings')
    def test_case_ambiguity(self):
        (self.wm/'WORLD_FR.LGP').write_bytes(b'collision')
        with self.assertRaisesRegex(ValueError,'Ambiguous'):discover(self.root,'fr')

    def test_role_and_hash_cache_not_missing_english_aliases(self):
        previous=None
        for language in ('fr','de','es','en'):
            world,field=GAME_DATA_LANGUAGES[language]
            current={world:'a'*64,field:'b'*64,'wm0.map':'c'*64}
            self.assertTrue(same_dependencies(current,current,['@world','@field','wm0.map']))
            if previous:
                self.assertFalse(same_dependencies(previous,current,['@world']))
                self.assertFalse(same_dependencies(previous,current,['@field']))
                self.assertTrue(same_dependencies(previous,current,['wm0.map']))
            previous=current
        self.assertFalse(same_dependencies({}, {}, ['@world']))
        self.assertFalse(same_dependencies({'world_fr.lgp':'a'*64},{'world_fr.lgp':'b'*64},['@world']))
        for mixed in ({'world_fr.lgp':'a','gflevel.lgp':'b'},{'world_fr.lgp':'a','world_us.lgp':'b'}):
            with self.assertRaises(ValueError):archive_key(mixed,'world')
        from gaiagis.field_context import native_relations
        with self.assertRaises(ValueError):
            native_relations({'sources':{'world_gm.lgp':'a'*64},'transitions':[]},set(),{'world_fr.lgp':'a'*64})

    def test_field_reader_revision_invalidates_all_dependent_packs_only(self):
        from gaiagis.build_workspace import write_manifest,reusable
        for name in ('gaia-meta.json','gaia-mesh.bin'):(self.root/name).write_bytes(b'synthetic')
        sources={'wm0.map':'a'*64,'world_us.lgp':'b'*64,'flevel.lgp':'c'*64}
        field_names=['gaia-field-context.json','gaia-field-walkmesh.bin','gaia-field-visual.bin','gaia-field-interaction.bin','gaia-field-script-evidence.bin']
        for name in ['gaia-poi.json',*field_names]:(self.root/name).write_bytes(b'synthetic')
        manifest=write_manifest(self.root,sources)
        self.assertTrue(reusable(manifest,sources,self.root,field_names))
        for record in manifest['assets']:
            if record['filename'] in ('gaia-field-context.json','gaia-field-walkmesh.bin'):record['generator_version']='field-context-7'
        for name in field_names:self.assertFalse(reusable(manifest,sources,self.root,[name]))
        self.assertTrue(reusable(manifest,sources,self.root,['gaia-meta.json','gaia-mesh.bin','gaia-poi.json']))


class FieldSectionRecoveryTests(unittest.TestCase):
    """Small fabricated containers; original compressed members stay private."""
    def script(self):
        end=110
        header=struct.pack('<HBBHHH6x8s8s',0x502,1,0,end,1,512,b'author',b'fixture')
        return header+b'entity\0\0'+struct.pack('<I32H',117,108,109,*([end]*30))+b'\0\0'+struct.pack('<HH',1,4)+b'hi\xffAKAO'+bytes(4)
    def payload(self, *, script=None, footer=b'', mutate=None, delta=4):
        sections=[b'\0']*9;sections[0]=self.script() if script is None else script
        sections[1]=bytes(38);sections[4]=struct.pack('<I12h3H',1,*([0]*12),65535,65535,65535);sections[7]=bytes(536);sections[8]=b'END'
        offsets=[];body=b''
        for section in sections:offsets.append(42+len(body));body+=struct.pack('<I',len(section))+section
        raw=bytearray(struct.pack('<HI9I',0,9,*offsets)+body+footer)
        declared=len(sections[0])-delta;struct.pack_into('<I',raw,42,declared)
        if mutate:mutate(raw,offsets)
        compressed=b''.join(bytes([(1<<len(raw[i:i+8]))-1])+raw[i:i+8] for i in range(0,len(raw),8))
        return struct.pack('<I',len(compressed))+compressed,(declared,len(sections[0]))
    def read(self, payload, lengths, **kwargs):
        import hashlib
        from unittest.mock import patch
        from gaiagis import field_context as fields
        pin=('fflevel.lgp','fixture',hashlib.sha256(payload).hexdigest())
        with patch.dict(fields.SECTION1_RECOVERIES,{pin:lengths},clear=True):
            return fields.field_sections(payload,archive='fflevel.lgp',member='fixture',**kwargs)
    def test_exact_member_pin_bounds_and_original_declared_length(self):
        from gaiagis.field_context import field_sections,parse_script,parse_walkmesh
        for delta in (4,-2,8):
            payload,lengths=self.payload(delta=delta);diagnostics=[]
            script,_,mesh=self.read(payload,lengths,walkmesh=True,recoveries=diagnostics)
            self.assertEqual(script,self.script());self.assertFalse(parse_script(script,evidence=True)[2]);self.assertEqual(parse_walkmesh(mesh)['triangles'],1)
            self.assertEqual((diagnostics[0]['declaredBytes'],diagnostics[0]['usedBytes']),lengths)
            for archive,member in [('fflevel.lgp','fixture'),('gflevel.lgp','fixture'),('fflevel.lgp','losin3')]:
                with self.assertRaisesRegex(FormatError,'unverified source'):field_sections(payload,archive=archive,member=member)
    def test_non_monotonic_overlapping_and_out_of_file_offsets_reject(self):
        changes=[lambda b,o:struct.pack_into('<I',b,6+4*4,o[3]),lambda b,o:struct.pack_into('<I',b,6+4*4,len(b)+1),lambda b,o:struct.pack_into('<I',b,6+2*4,o[1]+2)]
        for change in changes:
            payload,lengths=self.payload(mutate=change)
            with self.assertRaises(FormatError):self.read(payload,lengths,walkmesh=True)
    def test_script_entry_jump_text_and_akao_checks_are_not_bypassed(self):
        changes=[('operand|overlapping',lambda b:(b.__setitem__(slice(108,110),bytes([0x10,0])),struct.pack_into('<H',b,44,109))),
                 ('outside code',lambda b:b.__setitem__(slice(108,110),bytes([0x10,255]))),
                 ('text offsets',lambda b:struct.pack_into('<H',b,112,65535)),
                 ('text terminator',lambda b:b.__setitem__(116,0)),
                 ('AKAO bounds',lambda b:struct.pack_into('<I',b,40,len(b)+1))]
        for reason,change in changes:
            script=bytearray(self.script());change(script)
            payload,lengths=self.payload(script=bytes(script))
            with self.assertRaisesRegex(FormatError,reason):self.read(payload,lengths)
    def test_unknown_visual_trailer_stays_rejected_after_script_recovery(self):
        for footer,allowed in [(b'',True),(b'FINAL FANTASY7',True),(b'FINAL FANTASY7Y7',False),(b'junk',False)]:
            payload,lengths=self.payload(footer=footer)
            self.read(payload,lengths,walkmesh=True)
            if allowed:self.assertEqual(len(self.read(payload,lengths,visual=True)),3)
            else:
                with self.assertRaisesRegex(FormatError,'unsupported trailing bytes'):self.read(payload,lengths,visual=True)

    @unittest.skipUnless(os.environ.get('GAIAGIS_SOURCE_ROOT'),'Read-only original Field data required')
    def test_six_original_members_script_mesh_interaction_evidence_and_visual(self):
        import hashlib
        from gaiagis.dataset import discover
        from gaiagis.lgp import inventory,read_entry
        from gaiagis.field_context import SECTION1_RECOVERIES,field_sections,parse_script,parse_walkmesh,parse_gateways
        from gaiagis.field_camera import parse_cameras
        from gaiagis.field_background import parse_background_v2,GENERATOR_VERSION
        from gaiagis.field_interaction import scene_interactions
        from gaiagis.field_script_evidence import scene_evidence
        expected={'losin3':(224,71,3),'trnad_2':(377,133,2),'itown_w':(931,37,0),'itown_i':(559,23,0),'itown_m':(552,29,0),'cosmin7':(174,76,1)}
        for language in ('fr','de'):
            ds=discover(Path(os.environ['GAIAGIS_SOURCE_ROOT']),language);archive=ds.field_archive();entries={e['filename']:e for e in inventory(archive)['entries']}
            names=parse_maplist(read_entry(archive,entries['maplist']))
            for (key,name,digest),lengths in SECTION1_RECOVERIES.items():
                if key!=ds.field_name:continue
                with self.subTest(language=language,member=name):
                    raw=read_entry(archive,entries[name]);self.assertEqual(hashlib.sha256(raw).hexdigest(),digest);before=raw
                    diagnostics=[];script,gateway,mesh=field_sections(raw,walkmesh=True,archive=key,member=name,recoveries=diagnostics)
                    _,_,stops,code=parse_script(script,evidence=True);self.assertFalse(stops)
                    self.assertEqual((len(code['instructions']),parse_walkmesh(mesh)['triangles'],len(parse_gateways(gateway))),expected[name])
                    self.assertEqual((diagnostics[0]['declaredBytes'],diagnostics[0]['usedBytes']),lengths)
                    fid=names.index(name);interactions=scene_interactions(raw,fid,name,archive=key);evidence=scene_evidence(script,gateway,fid,name)
                    self.assertEqual(interactions['section1SHA256'],hashlib.sha256(script).hexdigest());self.assertEqual(evidence['fieldId'],fid)
                    with self.assertRaisesRegex(FormatError,'unverified source'):field_sections(raw,archive=key,member='wrong')
                    with self.assertRaisesRegex(FormatError,'unverified source'):field_sections(raw[:-1]+bytes([raw[-1]^1]),archive=key,member=name)
                    if name.startswith('itown_'):
                        with self.assertRaisesRegex(FormatError,'unsupported trailing bytes'):field_sections(raw,visual=True,archive=key,member=name)
                    else:
                        camera,palette,background=field_sections(raw,visual=True,archive=key,member=name)
                        self.assertEqual(len(parse_cameras(camera)),2 if name=='trnad_2' else 1)
                        meta,_,_=parse_background_v2(palette,background,revision=GENERATOR_VERSION)
                        self.assertEqual(meta['status'],'static_partial' if name=='trnad_2' else 'static_complete')
                    self.assertEqual(raw,before)

    @unittest.skipUnless(os.environ.get('GAIAGIS_SOURCE_ROOT'),'Read-only original Field data required')
    def test_bounded_original_member_generation_uses_shared_recovery(self):
        import hashlib,tempfile
        from unittest.mock import patch
        from gaiagis import field_context as fields
        from gaiagis.dataset import discover
        from gaiagis.lgp import inventory,read_entry
        from gaiagis.field_background import build_field_visual
        from gaiagis.field_interaction import build_field_interaction
        from gaiagis.field_script_evidence import build_field_script_evidence
        from gaiagis.web_export import sha256
        # Real maplist/archives, but only the six requested entries are exposed
        # to the generators. This is a disposable component fixture, no WM/GIS.
        QA_OUTPUT.mkdir(parents=True,exist_ok=True)
        for language,count in (('fr',5),('de',1)):
            ds=discover(Path(os.environ['GAIAGIS_SOURCE_ROOT']),language);archive=ds.field_archive()
            wanted={name for key,name,_ in fields.SECTION1_RECOVERIES if key==ds.field_name}
            original=inventory(archive);limited={**original,'entries':[e for e in original['entries'] if e['filename'] in wanted|{'maplist'}]}
            entries={e['filename']:e for e in original['entries']};world={e['filename']:e for e in inventory(ds.world_archive)['entries']}
            sources={ds.field_name:sha256(archive),ds.world_name:sha256(ds.world_archive),'wm0.map':sha256(ds.files['wm0.map']),
                     'maplist':hashlib.sha256(read_entry(archive,entries['maplist'])).hexdigest(),
                     **{name:hashlib.sha256(read_entry(ds.world_archive,world[name])).hexdigest() for name in ('wm0.ev','field.tbl')}}
            def bounded(path):return limited if path==archive else inventory(path)
            with tempfile.TemporaryDirectory(dir=QA_OUTPUT) as folder:
                out=Path(folder);(out/'gaia-poi.json').write_text(json.dumps(dict(sources=sources,entrances=[])),encoding='utf8')
                with patch.object(fields,'inventory',side_effect=bounded):context=fields.build_field_context(ds,out)
                self.assertEqual(context['version'],5);self.assertEqual(len(context['section1Recoveries']),count)
                self.assertEqual({n['name'] for n in context['nodes'] if n['status']=='available'},wanted)
                mesh=(out/'gaia-field-walkmesh.bin').read_bytes();meta=json.loads(mesh[16:16+struct.unpack_from('<I',mesh,12)[0]])
                self.assertEqual(sum(s['status']=='available' for s in meta['scenes']),count)
                self.assertEqual(build_field_interaction(ds,out)['fields'],count)
                self.assertEqual(build_field_script_evidence(ds,out)['fields'],count)
                with patch('gaiagis.lgp.inventory',side_effect=bounded):visual=build_field_visual(ds,out)
                self.assertEqual(visual['backgrounds'],2 if language=='fr' else 1)
                payload=(out/'gaia-field-visual.bin').read_bytes();header=json.loads(payload[16:16+struct.unpack_from('<I',payload,12)[0]])
                for scene in header['scenes']:
                    if scene['background']['status']=='unknown':self.assertIn('unsupported trailing bytes',scene['reason'])


if __name__=='__main__':unittest.main()
