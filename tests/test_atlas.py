"""Synthetic Atlas identity/provenance tests; no proprietary coordinate fixture."""
# SPDX-License-Identifier: GPL-3.0-only
from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest

from gaiagis.atlas import LOCALES, validate_content, bind_content, load_content, build_atlas, curated_hash
from gaiagis.build_workspace import write_manifest, reusable
from gaiagis.safety import WORKSPACE_ROOT


def fixture():
    summary = {lang: 'Synthetic place.' for lang in LOCALES}
    source = dict(id='reference', provider='Synthetic', title='Synthetic reference', url='https://example.org/reference',
                  reviewed='2026-10-06', type='reference', notes='Synthetic fixture.')
    entity = dict(id='synthetic-place', kind='town', canonicalName='Synthetic Place', localizedNames=summary,
                  aliases=['example'], summary=summary, region='unknown', tags=['place'], spoilerLevel='none',
                  spatialBinding=dict(kind='location', locationId='synthetic-place'), relatedLocations=['synthetic-place'],
                  relatedEntities=[], collectibles=[], secrets=[], sources=['reference'], facts=[], notes=[])
    content = dict(schema='gaiagis-atlas-content', version=1, sources=[source], entities=[entity], exclusions=[])
    poi = dict(schema='gaiagis-poi', version=1, sources={'wm0.map':'a'*64},
               locations=[dict(id='synthetic-place', primary_entrance='entry-1', entrance_ids=['entry-1'],
                               field_names=['synthetic'], name_source='manual_verified_field_identity')],
               entrances=[dict(id='entry-1', location_id='synthetic-place', source_kind='derived_from_entry_trigger',
                               triangle_id=4, trigger_triangle_ids=[4], script_calls=[{'call_table_record':1}])])
    return content, poi


class AtlasTests(unittest.TestCase):
    def test_curated_dataset_schema_and_five_locales(self):
        content = load_content()
        self.assertEqual(len(content['entities']), 58)
        self.assertTrue(all(set(e['summary']) == set(LOCALES) for e in content['entities']))

    def test_valid_synthetic_entity(self):
        content, _ = fixture()
        self.assertIs(validate_content(content), content)

    def reject(self, mutate):
        content, _ = fixture()
        mutate(content)
        with self.assertRaises((ValueError, TypeError)):
            validate_content(content)

    def test_missing_source(self):
        self.reject(lambda c: c['entities'][0].update(sources=[]))

    def test_invalid_kind(self):
        self.reject(lambda c: c['entities'][0].update(kind='invented'))

    def test_invalid_relation(self):
        self.reject(lambda c: c['entities'][0].update(relatedEntities=['missing']))

    def test_invalid_spoiler(self):
        self.reject(lambda c: c['entities'][0].update(spoilerLevel='unknown'))

    def test_duplicate_entity(self):
        self.reject(lambda c: c['entities'].append(deepcopy(c['entities'][0])))

    def test_broken_source_reference(self):
        self.reject(lambda c: c['entities'][0].update(sources=['missing']))

    def test_unsafe_source_url(self):
        self.reject(lambda c: c['sources'][0].update(url='javascript:alert(1)'))

    def test_unsourced_fact(self):
        self.reject(lambda c: c['entities'][0]['facts'].append(dict(kind='reward', text=c['entities'][0]['summary'], spoilerLevel='minor', sources=[])))

    def test_coordinates_forbidden_in_public_content(self):
        self.reject(lambda c: c['entities'][0]['spatialBinding'].update(longitude=1))

    def test_no_fabricated_anchor_for_interior_rewards(self):
        content, poi = fixture()
        for kind in ('parent_location', 'field_parent', 'non_spatial', 'unresolved'):
            with self.subTest(kind=kind):
                child = deepcopy(content['entities'][0])
                child.update(id='reward', relatedLocations=[], spatialBinding={'kind':kind})
                if kind in ('parent_location','field_parent'):
                    child['spatialBinding']['locationId']='synthetic-place'
                if kind=='field_parent':
                    child['spatialBinding']['fieldNames']=['synthetic']
                trial = deepcopy(content);trial['entities'].append(child)
                b = bind_content(trial, poi)['reward']
                self.assertFalse(b['marker']);self.assertIsNone(b['entranceId'])
                self.assertFalse({'longitude','latitude','triangle_id'} & set(b))

    def test_source_evidence_required(self):
        content, poi = fixture();poi['entrances'][0]['script_calls']=[]
        with self.assertRaisesRegex(ValueError,'evidence'):
            bind_content(content, poi)

    def test_missing_named_location_requires_exclusion(self):
        content, poi = fixture();extra=deepcopy(poi['locations'][0]);extra['id']='new-named';poi['locations'].append(extra)
        with self.assertRaisesRegex(ValueError,'uncovered'):
            bind_content(content, poi)
        content['exclusions']=[dict(locationId='new-named',reason='Not yet independently identified.')]
        bind_content(content, poi)

    def test_wrong_field_parent_rejected(self):
        content, poi=fixture();child=deepcopy(content['entities'][0]);child.update(id='reward',spatialBinding=dict(kind='field_parent',locationId='synthetic-place',fieldNames=['wrong']))
        content['entities'].append(child)
        with self.assertRaisesRegex(ValueError,'field-parent'):
            bind_content(content,poi)

    def test_local_asset_reuse_hash_schema_corrupt_missing_and_old(self):
        base=WORKSPACE_ROOT/'output/v2_2/test-tmp';base.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base) as folder:
            root=Path(folder)
            for name in ('gaia-meta.json','gaia-mesh.bin','gaia-poi.json','gaia-atlas.json'):
                (root/name).write_text('synthetic',encoding='utf8')
            sources={'wm0.map':'a'*64,'world_us.lgp':'b'*64,'flevel.lgp':'c'*64,'atlas-content.json':curated_hash()}
            manifest=write_manifest(root,sources)
            self.assertTrue(reusable(manifest,sources,root,['gaia-atlas.json']))
            changed={**sources,'atlas-content.json':'d'*64}
            self.assertFalse(reusable(manifest,changed,root,['gaia-atlas.json']))
            self.assertTrue(reusable(manifest,changed,root,['gaia-mesh.bin']))
            changed=deepcopy(manifest);next(a for a in changed['assets'] if a['filename']=='gaia-atlas.json')['generator_version']='old'
            self.assertFalse(reusable(changed,sources,root,['gaia-atlas.json']))
            self.assertFalse(reusable({},sources,root,['gaia-atlas.json']))
            (root/'gaia-atlas.json').write_text('corrupt',encoding='utf8')
            self.assertFalse(reusable(manifest,sources,root,['gaia-atlas.json']))
            (root/'gaia-atlas.json').unlink()
            self.assertFalse(reusable(manifest,sources,root,['gaia-atlas.json']))

    def test_actual_generated_pack_no_coordinates(self):
        # Actual-source checks are optional in a clean public checkout.
        root=WORKSPACE_ROOT/'output/local-workspace'
        if not (root/'gaia-poi.json').is_file():self.skipTest('No private workspace')
        content=load_content();poi=json.loads((root/'gaia-poi.json').read_text(encoding='utf8'))
        bindings=bind_content(content,poi)
        named={l['id'] for l in poi['locations'] if l['name_source']=='manual_verified_field_identity'}
        self.assertEqual(len(named),34)
        self.assertEqual({b['locationId'] for b in bindings.values() if b['marker']},named)
        self.assertTrue(all(b['precision']=='entrance_level' for b in bindings.values() if b['marker']))


if __name__ == '__main__':unittest.main()
