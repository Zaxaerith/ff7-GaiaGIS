"""Synthetic default-launch Visual upgrade rollback; no original game fixtures."""
# SPDX-License-Identifier: GPL-3.0-only
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'src'))
from gaiagis import build_workspace as workspace
from gaiagis.safety import WORKSPACE_ROOT


class VisualWorkspaceFailureTests(unittest.TestCase):
    def setUp(self):
        folder = Path(os.environ.get('GAIAGIS_TEST_OUTPUT', str(WORKSPACE_ROOT/'output/dev/current/python-tests')))/'visual-workspace'
        folder.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=folder)
        self.root = Path(self.temp.name)
        self.source = self.root/'source'; self.wm = self.source/'wm'; self.field = self.source/'field'
        self.wm.mkdir(parents=True); self.field.mkdir()
        self.archive = self.field/'flevel.lgp'; self.archive.write_bytes(b'synthetic archive')
        self.output = self.root/'workspace'; self.output.mkdir()
        self.fingerprint = dict(files=[dict(filename='wm0.map', sha256='a'*64), dict(filename='world_us.lgp', sha256='b'*64)])
        self.pack_sources = {'flevel.lgp': workspace.sha256(self.archive), 'maplist': 'c'*64}
        for name, content in (
            ('gaia-meta.json', b'{"synthetic":true}'), ('gaia-mesh.bin', b'synthetic mesh'),
            ('gaia-poi.json', b'{"synthetic":true}'),
            ('gaia-field-context.json', json.dumps({'sources':self.pack_sources}).encode()),
        ):
            (self.output/name).write_bytes(content)
        self.sources = dict((r['filename'],r['sha256']) for r in self.fingerprint['files'])
        self.sources.update({'flevel.lgp': self.pack_sources['flevel.lgp'], 'field-poi.json': workspace.sha256(self.output/'gaia-poi.json')})
        self.old_pack = self.legacy_pack()
        (self.output/'gaia-field-visual.bin').write_bytes(self.old_pack)
        manifest = workspace.write_manifest(self.output, self.sources)
        visual = next(a for a in manifest['assets'] if a['filename'] == 'gaia-field-visual.bin')
        visual['generator_version'] = 'field-visual-2'
        self.old_record = dict(visual)
        self.old_manifest = (json.dumps(manifest,sort_keys=True,indent=2)+'\n').encode()
        (self.output/'gaia-workspace.json').write_bytes(self.old_manifest)
        self.real_reusable = workspace.reusable

    def tearDown(self):
        self.temp.cleanup()

    def legacy_pack(self):
        meta = json.dumps(dict(schema='gaiagis-field-visual', version=1, generator_revision='field-visual-2',
                               sources=self.pack_sources, scenes=[])).encode()
        return b'GAIACAM\0'+struct.pack('<II',1,len(meta))+meta

    def run_upgrade(self, action, *, fingerprints=None, manifest_writer=None, allow=True, clean=False):
        # All unrelated exporters are reused. The fallback still uses the real
        # recursive source/hash/dependency checks with an explicit old revision.
        def reuse(manifest, sources, directory, names, visited=None, **kwargs):
            if names == ['gaia-field-visual.bin'] or kwargs.get('visual_revision') is not None:
                return self.real_reusable(manifest,sources,directory,names,visited,**kwargs)
            return True
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch.object(workspace,'discover',return_value=SimpleNamespace(wm_directory=self.wm)))
            stack.enter_context(patch.object(workspace,'fingerprint',side_effect=fingerprints or [self.fingerprint,self.fingerprint]))
            stack.enter_context(patch.object(workspace,'curated_hash',return_value='d'*64))
            stack.enter_context(patch.object(workspace,'reusable',side_effect=reuse))
            stack.enter_context(patch.object(workspace,'build_field_visual',side_effect=action))
            if manifest_writer is not None:
                stack.enter_context(patch.object(workspace,'write_manifest',side_effect=manifest_writer))
            stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
            return workspace.build_workspace(self.source,self.output,allow_optional_failure=allow,clean_invalid=clean)

    def assert_original_pair(self):
        self.assertEqual((self.output/'gaia-field-visual.bin').read_bytes(),self.old_pack)
        self.assertEqual((self.output/'gaia-workspace.json').read_bytes(),self.old_manifest)

    def test_optional_failed_upgrade_retains_old_codec_and_source_bound_entry(self):
        def fail(source, directory):
            (directory/'gaia-field-visual.bin').write_bytes(b'partially replaced synthetic candidate')
            raise OSError('synthetic visual upgrade failure')
        report = self.run_upgrade(fail)
        self.assertEqual((self.output/'gaia-field-visual.bin').read_bytes(),self.old_pack)
        manifest = json.loads((self.output/'gaia-workspace.json').read_bytes())
        self.assertEqual(next(a for a in manifest['assets'] if a['filename']=='gaia-field-visual.bin'),self.old_record)
        self.assertEqual(manifest['sources']['flevel.lgp'],self.pack_sources['flevel.lgp'])
        self.assertTrue(next(s for s in report['steps'] if s['step']=='field-visual')['upgrade_unavailable'])

    def test_clean_invalid_does_not_delete_valid_old_pack_before_attempt(self):
        def fail(source, directory):
            self.assertEqual((directory/'gaia-field-visual.bin').read_bytes(),self.old_pack)
            raise OSError('synthetic failure before replacement')
        self.run_upgrade(fail,clean=True)
        self.assertEqual((self.output/'gaia-field-visual.bin').read_bytes(),self.old_pack)

    def test_fatal_visual_failure_rolls_back_pair(self):
        def fail(source, directory):
            (directory/'gaia-field-visual.bin').write_bytes(b'synthetic changed visual')
            raise OSError('synthetic fatal visual failure')
        with self.assertRaisesRegex(OSError,'fatal visual'):
            self.run_upgrade(fail,allow=False)
        self.assert_original_pair()

    def test_later_source_verification_failure_restores_old_pair(self):
        def replace(source, directory):
            (directory/'gaia-field-visual.bin').write_bytes(b'synthetic new visual')
        with self.assertRaisesRegex(RuntimeError,'source verification'):
            self.run_upgrade(replace,fingerprints=[self.fingerprint,RuntimeError('synthetic source verification failure')])
        self.assert_original_pair()

    def test_manifest_failure_after_replacement_restores_old_pair(self):
        real_writer = workspace.write_manifest
        def replace(source, directory):
            (directory/'gaia-field-visual.bin').write_bytes(b'synthetic new visual')
        def fail_manifest(*args,**kwargs):
            real_writer(*args,**kwargs)
            raise OSError('synthetic post-publication failure')
        with self.assertRaisesRegex(OSError,'post-publication'):
            self.run_upgrade(replace,manifest_writer=fail_manifest)
        self.assert_original_pair()

    def test_old_visual_with_different_source_is_not_retained_or_relabelled(self):
        self.archive.write_bytes(b'a different synthetic archive')
        def fail(source, directory):
            raise OSError('synthetic source mismatch failure')
        self.run_upgrade(fail)
        manifest = json.loads((self.output/'gaia-workspace.json').read_bytes())
        self.assertFalse(any(a['filename']=='gaia-field-visual.bin' for a in manifest['assets']))


if __name__ == '__main__':
    unittest.main()
