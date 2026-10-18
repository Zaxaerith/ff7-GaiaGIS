"""Public synthetic integration of the optional script evidence asset graph."""
# SPDX-License-Identifier: GPL-3.0-only
from copy import deepcopy
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from gaiagis import build_workspace as workspace
from gaiagis.field_script_evidence import FILENAME, GENERATOR_VERSION
from gaiagis.local import server_manifest
from gaiagis.safety import WORKSPACE_ROOT


class ScriptEvidenceWorkspaceTests(unittest.TestCase):
    def setUp(self):
        folder = Path(os.environ.get('GAIAGIS_TEST_OUTPUT', str(WORKSPACE_ROOT/'output/dev/current/python-tests')))/'script-workspace'
        folder.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=folder)
        self.root = Path(self.temp.name)
        self.sources = {'wm0.map': 'a'*64, 'world_us.lgp': 'b'*64, 'flevel.lgp': 'c'*64, 'maplist': 'd'*64}
        self.names = ['gaia-meta.json', 'gaia-mesh.bin', 'gaia-poi.json', 'gaia-field-context.json', 'gaia-field-walkmesh.bin', 'gaia-field-visual.bin', 'gaia-field-interaction.bin', FILENAME]
        for name in self.names:
            (self.root/name).write_bytes(('synthetic '+name).encode('ascii'))
        self.manifest = workspace.write_manifest(self.root, self.sources)
        self.original = {name: (self.root/name).read_bytes() for name in self.names if name != FILENAME}

    def tearDown(self):
        self.temp.cleanup()

    def reusable(self, name, *, manifest=None, sources=None):
        return workspace.reusable(self.manifest if manifest is None else manifest, self.sources if sources is None else sources, self.root, [name])

    def assert_unrelated_unchanged(self):
        self.assertEqual({name: (self.root/name).read_bytes() for name in self.original}, self.original)

    def test_manifest_has_independent_type_generator_hash_and_exact_context_dependency(self):
        self.assertEqual(len(workspace.ASSETS), 20)
        self.assertEqual(workspace.ASSETS[FILENAME], ('field-script-evidence', 'shared', ['gaia-field-context.json']))
        self.assertEqual(workspace.SOURCE_DEPENDENCIES[FILENAME], ['flevel.lgp'])
        record = next(r for r in self.manifest['assets'] if r['filename'] == FILENAME)
        self.assertEqual(record, dict(filename=FILENAME, type='field-script-evidence', mapId='shared', sha256=workspace.sha256(self.root/FILENAME), bytes=(self.root/FILENAME).stat().st_size, dependencies=['gaia-field-context.json'], generator_version=GENERATOR_VERSION))
        self.assertEqual(server_manifest(self.root), self.manifest)
        first = (self.root/'gaia-workspace.json').read_bytes()
        workspace.write_manifest(self.root, self.sources)
        self.assertEqual((self.root/'gaia-workspace.json').read_bytes(), first)
        self.assertNotIn(str(self.root).encode(), first)

    def test_absent_optional_resource_keeps_all_old_products_reusable(self):
        (self.root/FILENAME).unlink()
        old = workspace.write_manifest(self.root, self.sources)
        self.assertFalse(any(r['filename'] == FILENAME for r in old['assets']))
        self.assertFalse(self.reusable(FILENAME, manifest=old))
        for name in self.original:
            self.assertTrue(self.reusable(name, manifest=old), name)
        self.assertEqual(server_manifest(self.root), old)
        self.assert_unrelated_unchanged()

    def test_only_script_corruption_missing_or_revision_invalidates_script(self):
        for variant in ('corrupt', 'missing', 'revision', 'dependency'):
            with self.subTest(variant=variant):
                manifest = deepcopy(self.manifest)
                (self.root/FILENAME).write_bytes(('synthetic '+FILENAME).encode('ascii'))
                record = next(r for r in manifest['assets'] if r['filename'] == FILENAME)
                if variant == 'corrupt':
                    (self.root/FILENAME).write_bytes(b'changed script candidate')
                elif variant == 'missing':
                    (self.root/FILENAME).unlink()
                elif variant == 'revision':
                    record['generator_version'] = 'unsupported'
                else:
                    record['dependencies'] = ['gaia-field-walkmesh.bin']
                self.assertFalse(self.reusable(FILENAME, manifest=manifest))
                for name in self.original:
                    self.assertTrue(self.reusable(name, manifest=manifest), name)
                self.assert_unrelated_unchanged()

    def test_context_change_invalidates_dependents_but_not_world_geometry(self):
        (self.root/'gaia-field-context.json').write_bytes(b'changed Context')
        for name in [FILENAME, 'gaia-field-context.json', 'gaia-field-walkmesh.bin', 'gaia-field-visual.bin', 'gaia-field-interaction.bin']:
            self.assertFalse(self.reusable(name), name)
        for name in ['gaia-meta.json', 'gaia-mesh.bin', 'gaia-poi.json']:
            self.assertTrue(self.reusable(name), name)

    def test_walkmesh_or_visual_changes_do_not_invalidate_independent_script_index(self):
        for name in ['gaia-field-walkmesh.bin', 'gaia-field-visual.bin', 'gaia-field-interaction.bin']:
            (self.root/name).write_bytes(b'changed independent product')
        self.assertTrue(self.reusable(FILENAME))
        self.assertTrue(self.reusable('gaia-field-context.json'))
        for name in ['gaia-meta.json', 'gaia-mesh.bin', 'gaia-poi.json']:
            self.assertTrue(self.reusable(name), name)

    def test_field_source_invalidates_script_but_unrelated_native_source_does_not(self):
        self.assertTrue(self.reusable(FILENAME, sources={**self.sources, 'wm2.map': 'e'*64}))
        changed = {**self.sources, 'flevel.lgp': 'e'*64}
        for name in [FILENAME, 'gaia-field-context.json', 'gaia-field-walkmesh.bin', 'gaia-field-visual.bin', 'gaia-field-interaction.bin']:
            self.assertFalse(self.reusable(name, sources=changed), name)
        for name in ['gaia-meta.json', 'gaia-mesh.bin']:
            self.assertTrue(self.reusable(name, sources=changed), name)
        self.assert_unrelated_unchanged()

    def test_manifest_rejects_missing_context_and_server_rejects_wrong_evidence_profile(self):
        (self.root/'gaia-field-context.json').unlink()
        before = (self.root/'gaia-workspace.json').read_bytes()
        with self.assertRaisesRegex(ValueError, 'dependency missing'):
            workspace.write_manifest(self.root, self.sources)
        self.assertEqual((self.root/'gaia-workspace.json').read_bytes(), before)
        (self.root/'gaia-field-context.json').write_bytes(self.original['gaia-field-context.json'])
        for key, value in [('generator_version', 'unsupported'), ('bytes', 4_000_001), ('dependencies', [])]:
            manifest = deepcopy(self.manifest)
            next(r for r in manifest['assets'] if r['filename'] == FILENAME)[key] = value
            (self.root/'gaia-workspace.json').write_text(json.dumps(manifest), encoding='utf8')
            with self.assertRaises(ValueError):
                server_manifest(self.root)

    def test_incremental_builder_generates_only_the_missing_optional_index(self):
        for name in workspace.ASSETS:
            if not (self.root/name).exists():
                (self.root/name).write_bytes(('synthetic '+name).encode('ascii'))
        sources = {**self.sources, 'atlas-content.json': 'e'*64,
            'atlas-transitions.json': workspace.sha256(self.root/'gaia-transitions.json'),
            'field-poi.json': workspace.sha256(self.root/'gaia-poi.json'),
            'field-transitions.json': workspace.sha256(self.root/'gaia-transitions.json')}
        workspace.write_manifest(self.root, sources)
        (self.root/FILENAME).unlink()
        before = {name: (self.root/name).read_bytes() for name in workspace.ASSETS if name != FILENAME}
        source = self.root/'synthetic-source'; source.mkdir()
        fingerprint = {'files': [{'filename': k, 'sha256': v} for k, v in sources.items()]}
        calls = []
        def export_index(source_path, destination):
            self.assertEqual(source_path, source)
            self.assertEqual(destination, self.root)
            self.assertEqual((destination/'gaia-field-context.json').read_bytes(), before['gaia-field-context.json'])
            calls.append(FILENAME)
            (destination/FILENAME).write_bytes(b'new synthetic script evidence')
        with patch.object(workspace, 'discover', return_value=SimpleNamespace(wm_directory=source)), patch.object(workspace, 'child_ci', return_value=None), patch.object(workspace, 'fingerprint', return_value=fingerprint), patch.object(workspace, 'curated_hash', return_value='e'*64), patch.object(workspace, 'build_field_script_evidence', side_effect=export_index):
            result = workspace.build_workspace(source, self.root)
        self.assertEqual(calls, [FILENAME])
        self.assertEqual(result['assets'], 20)
        self.assertEqual(len(result['steps']), 18)
        self.assertEqual([r['step'] for r in result['steps'] if not r['reused']], ['field-script-evidence'])
        self.assertEqual({name: (self.root/name).read_bytes() for name in before}, before)
        manifest = server_manifest(self.root)
        self.assertEqual(next(r for r in manifest['assets'] if r['filename'] == FILENAME)['generator_version'], GENERATOR_VERSION)


if __name__ == '__main__':
    unittest.main()
