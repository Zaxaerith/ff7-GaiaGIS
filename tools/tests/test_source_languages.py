"""Bounded language selection, provenance and cache isolation; synthetic files only."""
# SPDX-License-Identifier: GPL-3.0-only
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from gaiagis.constants import GAME_DATA_LANGUAGES
from gaiagis.dataset import discover, fingerprint, archive_key, same_dependencies
from gaiagis.local import validate_source, choose_source, parser
from gaiagis.safety import WORKSPACE_ROOT


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


if __name__=='__main__':unittest.main()
