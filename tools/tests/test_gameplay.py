"""Small synthetic incremental/identity tests; no distributed game fixtures."""
# SPDX-License-Identifier: GPL-3.0-only
import json
from pathlib import Path
import tempfile
import unittest
from copy import deepcopy
from unittest.mock import patch

from gaiagis.dataset import SourceDataset
from gaiagis.gameplay import (FILENAME, GENERATOR_VERSION, encoded, digest, resource_paths,
                             input_profile, field_battle_links, atlas_links, update_workspace,
                             _world_script_links, _workspace_links, refresh_links,
                             reviewed_boss_mappings, atlas_content_hash)
from gaiagis.safety import WORKSPACE_ROOT
from gaiagis.build_workspace import reusable


class GameplayTests(unittest.TestCase):
    def setUp(self):
        folder = WORKSPACE_ROOT/'output/dev/current/python-tests'
        folder.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=folder)
        self.root = Path(self.temp.name)
        self.wm = self.root/'game/data/wm'
        self.wm.mkdir(parents=True)
        self.ds = SourceDataset(self.root/'game', self.wm, {}, 'synthetic', 'fr')
        self.out = self.root/'workspace'
        self.out.mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def seed(self):
        context = b'{"synthetic":true}'
        (self.out/'gaia-field-context.json').write_bytes(context)
        (self.out/'untouched.bin').write_bytes(b'unrelated asset bytes')
        old = dict(schema='gaiagis-workspace', version=1, tool_version='5.5.0',
            generator_version='workspace-1', timestamp_policy='omitted', sources={}, assets=[
                dict(filename='gaia-field-context.json', type='field-context', mapId='WM0',
                     bytes=len(context), sha256=digest(context), dependencies=['gaia-poi.json'], generator_version='old-kept'),
                dict(filename='untouched.bin', bytes=21, sha256='a'*64, dependencies=[])])
        (self.out/'gaia-workspace.json').write_bytes(encoded(old))
        value = dict(contextSHA256=digest(context), sources={'scene.bin':'b'*64},
                     field={'coverage':{'scenes':1}}, battle={'coverage':{'scenes':1}},
                     links={'worldBattles':[],'fieldBattles':[],'encounters':[]})
        return old, value

    def test_selected_language_resources_precede_shared_files(self):
        for folder, payload in [('lang-fr/battle',b'French'), ('battle',b'shared')]:
            path=self.wm.parent/folder;path.mkdir(parents=True);(path/'scene.bin').write_bytes(payload)
        paths=resource_paths(self.ds)
        self.assertEqual(paths['scene'].read_bytes(),b'French')
        self.assertIsNone(paths['kernel'])

    def test_missing_and_present_input_do_not_share_cache_token(self):
        empty,_=input_profile(self.ds,self.out)
        kernel=self.wm.parent/'kernel';kernel.mkdir();(kernel/'kernel.bin').write_bytes(b'synthetic')
        present,_=input_profile(self.ds,self.out)
        self.assertNotEqual(empty,present)
        manifest=dict(schema='gaiagis-workspace',version=1,tool_version='5.5.1',generator_version='workspace-1',sources={},assets=[])
        self.assertFalse(reusable(manifest,{},self.out,[FILENAME]))
        with patch('gaiagis.gameplay.boss_content_hash',return_value='0'*64):
            changed,_=input_profile(self.ds,self.out)
        self.assertNotEqual(changed,present)

    def test_field_and_world_number_spaces_are_not_conflated(self):
        field={'scenes':[dict(fieldId=5,records=[dict(id='5:9',kind='battle',status='static',operands=[dict(name='formation',kind='literal',value=8)]),
            dict(id='5:15',kind='battle',status='unknown',operands=[dict(name='formation',kind='literal',value=8)])])]}
        battle={'formations':[dict(id=8,battleId=8,sceneId=2,slot=0,status='parsed')]}
        links=field_battle_links(field,battle)
        self.assertEqual(links[0]['formationId'],8)
        self.assertEqual(links[0]['sourceKind'],'field_script')
        self.assertEqual(links[1]['status'],'unknown')
        self.assertIsNone(links[1]['formationId'])

    def test_atlas_links_use_only_authored_or_verified_field_identity(self):
        content={'entities':[dict(id='a',spatialBinding=dict(kind='field_identity',fieldNames=['a'])),
                             dict(id='p',spatialBinding=dict(kind='parent_location',locationId='place'))]}
        context={'bindings':[dict(locationId='place',fieldId=7,status='verified_direct'),
                             dict(locationId='place',fieldId=8,status='unresolved')]}
        with patch('gaiagis.atlas.load_content',return_value=content):
            links=atlas_links(context,{'scenes':[dict(fieldId=6,name='a')]})
        self.assertEqual(links,[dict(entityId='a',fieldIds=[6],relation='authored_scene'),
                               dict(entityId='p',fieldIds=[7],relation='verified_entrance_field')])
        self.assertNotIn('recordId',str(links))

    def test_increment_preserves_every_unrelated_asset_record_and_bytes(self):
        old,value=self.seed()
        with patch('gaiagis.gameplay.discover',return_value=self.ds),patch('gaiagis.gameplay.encode_gameplay',return_value=(encoded(value),value)):
            report=update_workspace(self.root/'game',self.out)
        new=json.loads((self.out/'gaia-workspace.json').read_bytes())
        self.assertEqual(new['assets'][:-1],old['assets'])
        self.assertEqual(new['assets'][-1]['generator_version'],GENERATOR_VERSION)
        self.assertEqual(new['assets'][-1]['dependencies'],['gaia-field-context.json'])
        self.assertEqual((self.out/'untouched.bin').read_bytes(),b'unrelated asset bytes')
        self.assertEqual(report['assets'],3)

    def test_manifest_failure_rolls_back_only_new_asset_and_manifest(self):
        _,value=self.seed();before=(self.out/'gaia-workspace.json').read_bytes()
        from gaiagis.field_interaction import atomic_write
        failed=False
        def writer(path,payload):
            nonlocal failed
            if Path(path).name=='gaia-workspace.json' and not failed:
                failed=True;raise OSError('synthetic write failure')
            atomic_write(path,payload)
        with patch('gaiagis.gameplay.discover',return_value=self.ds),patch('gaiagis.gameplay.encode_gameplay',return_value=(encoded(value),value)),patch('gaiagis.field_interaction.atomic_write',side_effect=writer):
            with self.assertRaises(OSError):update_workspace(self.root/'game',self.out)
        self.assertEqual((self.out/'gaia-workspace.json').read_bytes(),before)
        self.assertFalse((self.out/FILENAME).exists())

    def test_conflicting_original_source_rejects_before_writing(self):
        old,value=self.seed();old['sources']['scene.bin']='c'*64
        (self.out/'gaia-workspace.json').write_bytes(encoded(old))
        with patch('gaiagis.gameplay.discover',return_value=self.ds),patch('gaiagis.gameplay.encode_gameplay',return_value=(encoded(value),value)):
            with self.assertRaisesRegex(ValueError,'differs'):update_workspace(self.root/'game',self.out)
        self.assertFalse((self.out/FILENAME).exists())

    def test_world_encounter_member_is_verified_before_existing_table_link(self):
        world=self.wm/'world_fr.lgp';world.write_bytes(b'archive')
        ds=SourceDataset(self.root/'game',self.wm,{'world_fr.lgp':world},'synthetic','fr')
        ev,enc=b'script',b'encounters'
        context={'sources':{'world_fr.lgp':digest(b'archive'),'wm0.ev':digest(ev)}}
        sources={};battle={'formations':[dict(id=8,battleId=8,status='parsed')]}
        inventory={'entries':[{'filename':'wm0.ev'},{'filename':'enc_w.bin'}]}
        with patch('gaiagis.lgp.inventory',return_value=inventory),patch('gaiagis.lgp.read_entry',side_effect=[ev,enc]),patch('gaiagis.world_events.analyze_ev',return_value={'observations':[]}):
            self.assertEqual(_world_script_links(ds,context,sources,battle),[])
        self.assertEqual(sources['enc_w.bin'],digest(enc))
        table={'sources':sources,'encounter_sets':[dict(id='0:0',records={'normal':[dict(weight=2,scene_id=8,byte_offset=1)]})]}
        (self.out/'gaia-encounters.json').write_bytes(encoded(table))
        links=_workspace_links(self.out,sources,context,battle)
        self.assertEqual(links['encounters'][0]['formationId'],8)
        self.assertEqual(links['assets']['gaia-encounters.json']['status'],'matched')
        wrong={**sources,'enc_w.bin':'0'*64}
        self.assertEqual(_workspace_links(self.out,wrong,context,battle)['encounters'],[])

    def test_link_refresh_reuses_snapshot_and_preserves_other_records(self):
        field_sha='f'*64
        context={'sources':{'fflevel.lgp':field_sha}}
        context_bytes=encoded(context);(self.out/'gaia-field-context.json').write_bytes(context_bytes)
        field={'scenes':[{'records':[{'id':'kept'}]}]};battle={'formations':[]}
        value=dict(schema='gaiagis-gameplay',version=1,generator_revision=GENERATOR_VERSION,sourceLanguage='fr',
                   sources={'fflevel.lgp':field_sha},contextSHA256=digest(context_bytes),field=field,battle=battle,
                   links={'fieldBattles':[]},atlasLinks=[])
        payload=encoded(value);(self.out/FILENAME).write_bytes(payload)
        token,_=input_profile(self.ds,self.out,value['sources'])
        records=[dict(filename='gaia-field-context.json',sha256=digest(context_bytes),bytes=len(context_bytes)),
                 dict(filename=FILENAME,sha256=digest(payload),bytes=len(payload),generator_version=GENERATOR_VERSION)]
        manifest={'assets':records,'sources':{'gameplay-inputs.json':token}}
        (self.out/'gaia-workspace.json').write_bytes(encoded(manifest))
        with patch('gaiagis.gameplay.discover',return_value=self.ds),patch('gaiagis.gameplay._world_script_links',return_value=[]):
            result=refresh_links(self.root/'game',self.out)
        refreshed=json.loads((self.out/FILENAME).read_bytes())
        self.assertEqual(refreshed['field'],field);self.assertEqual(refreshed['battle'],battle)
        self.assertEqual(json.loads((self.out/'gaia-workspace.json').read_bytes())['assets'][0],records[0])
        self.assertEqual(result['links']['encounters'],{'records':0,'matched':0})

    def test_public_atlas_hash_is_line_ending_portable_without_changing_binary_hashes(self):
        with patch('gaiagis.atlas.curated_bytes',return_value=b'public\r\ntext\r\n'):
            self.assertEqual(atlas_content_hash(),digest(b'public\ntext\n'))
        self.assertNotEqual(digest(b'binary\r\n'),digest(b'binary\n'))

    def boss_fixture(self):
        profiles=json.loads((WORKSPACE_ROOT/'src/gaiagis/atlas_data/boss-evidence.json').read_text(encoding='utf8'))
        field={'scenes':[]};battle={'scenes':[],'formations':[],'enemies':[]}
        for p in profiles:
            record=dict(id=p['recordId'],kind='battle',opcode=0x70,status='static',offset=int(p['recordId'].split(':')[1]),
                        raw=(bytes([0x70,0])+p['formationId'].to_bytes(2,'little')).hex(),owners=[p['owner']],
                        operands=[dict(name='formation',kind='literal',bank=0,value=p['formationId'])])
            field['scenes'].append(dict(fieldId=p['fieldId'],name=p['fieldName'],status='indexed',stops=[],
                memberSHA256=p['memberSHA256'],section1SHA256=p['section1SHA256'],records=[record]))
            battle['scenes'].append(dict(id=p['sceneId'],sha256=p['sceneSHA256']))
            battle['formations'].append(dict(id=p['formationId'],battleId=p['formationId'],sceneId=p['sceneId'],
                slot=p['formationId']%4,status='parsed',enemyIds=[p['enemyId']]))
            battle['enemies'].append(dict(sceneId=p['sceneId'],id=p['enemyId'],name=p['enemyName'],nameStatus='decoded'))
        return field,battle

    def test_reviewed_boss_profiles_match_only_exact_source_chain_and_authored_references(self):
        field,battle=self.boss_fixture();mappings=reviewed_boss_mappings(field,battle)
        self.assertEqual([m['entityId'] for m in mappings],['wutai-pagoda','glacier-materia'])
        self.assertTrue(all(m['evidence']=='reviewed_static_profile' for m in mappings))
        self.assertEqual(mappings[0]['sources'],['pagoda-guide','wutai'])
        self.assertNotIn('position',mappings[0]);self.assertNotIn('owner',mappings[0])
        changes=[lambda f,b:f['scenes'][0].update(memberSHA256='0'*64),
                 lambda f,b:f['scenes'][0].update(section1SHA256='0'*64),
                 lambda f,b:b['scenes'][0].update(sha256='0'*64),
                 lambda f,b:f['scenes'][0].update(status='partial'),
                 lambda f,b:f['scenes'][0]['records'][0].update(status='unknown'),
                 lambda f,b:f['scenes'][0]['records'][0]['owners'][0].update(entry=1),
                 lambda f,b:f['scenes'][0]['records'][0]['operands'][0].update(kind='variable'),
                 lambda f,b:b['formations'][0].update(enemyIds=[999]),
                 lambda f,b:b['enemies'][0].update(name='similar Godo')]
        for change in changes:
            f,b=deepcopy(field),deepcopy(battle);change(f,b)
            self.assertEqual([m['entityId'] for m in reviewed_boss_mappings(f,b)],['glacier-materia'])
        with patch('gaiagis.atlas.load_content',return_value={'entities':[],'sources':[]}):
            self.assertEqual(reviewed_boss_mappings(field,battle),[])


if __name__ == '__main__':
    unittest.main()
