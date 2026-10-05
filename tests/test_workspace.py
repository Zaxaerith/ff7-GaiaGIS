"""Synthetic workspace manifest and reuse invariants; no public game fixtures."""
# SPDX-License-Identifier: GPL-3.0-only
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from gaiagis.build_workspace import write_manifest,reusable,build_workspace,TOOL_VERSION,ASSETS
from gaiagis.safety import WORKSPACE_ROOT,output_path

class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        folder=WORKSPACE_ROOT/'output/v2_0/test-tmp';folder.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=folder);self.root=Path(self.temp.name)
        self.sources={'wm0.map':'a'*64,'world_us.lgp':'b'*64}
    def tearDown(self):self.temp.cleanup()
    def seed(self):
        (self.root/'gaia-meta.json').write_text('{"synthetic":true}',encoding='utf8')
        (self.root/'gaia-mesh.bin').write_bytes(b'synthetic geometry')
    def test_deterministic_manifest(self):
        self.seed();m=write_manifest(self.root,self.sources);b=(self.root/'gaia-workspace.json').read_bytes()
        write_manifest(self.root,self.sources);self.assertEqual(b,(self.root/'gaia-workspace.json').read_bytes())
        self.assertNotIn(str(self.root).encode(),b);self.assertEqual(m['timestamp_policy'],'omitted')
    def test_relative_names_and_separate_schema_version(self):
        self.seed();m=write_manifest(self.root,self.sources)
        self.assertEqual(m['version'],1);self.assertEqual(m['tool_version'],TOOL_VERSION)
        self.assertTrue(all('/' not in a['filename'] and '\\' not in a['filename'] for a in m['assets']))
    def test_valid_reuse(self):
        self.seed();m=write_manifest(self.root,self.sources)
        self.assertTrue(reusable(m,self.sources,self.root,['gaia-meta.json','gaia-mesh.bin']))
    def test_source_mismatch_rebuild(self):
        self.seed();m=write_manifest(self.root,self.sources)
        self.assertFalse(reusable(m,{**self.sources,'wm0.map':'c'*64},self.root,['gaia-mesh.bin']))
    def test_corrupt_payload_rebuild(self):
        self.seed();m=write_manifest(self.root,self.sources);(self.root/'gaia-mesh.bin').write_bytes(b'corrupt')
        self.assertFalse(reusable(m,self.sources,self.root,['gaia-mesh.bin']))
    def test_missing_asset_rebuild(self):
        self.seed();m=write_manifest(self.root,self.sources)
        self.assertFalse(reusable(m,self.sources,self.root,['gaia-routing.bin']))
    def test_tool_or_generator_change_rebuild(self):
        self.seed();m=write_manifest(self.root,self.sources)
        for key in ('tool_version','generator_version','version'):
            changed={**m,key:'unsupported'};self.assertFalse(reusable(changed,self.sources,self.root,['gaia-mesh.bin']))
    def test_dependency_failure_does_not_publish_manifest(self):
        (self.root/'gaia-poi.json').write_text('{}')
        with self.assertRaises(ValueError):write_manifest(self.root,self.sources)
        self.assertFalse((self.root/'gaia-workspace.json').exists())
    def test_outputs_cannot_escape_workspace(self):
        with self.assertRaises(ValueError):output_path(WORKSPACE_ROOT.parent/'invalid-workspace')
    def test_extracted_source_inside_workspace_is_also_read_only(self):
        target=self.root/'extracted/source-output'
        with self.assertRaises(ValueError):build_workspace(self.root/'extracted',target)
        self.assertFalse(target.exists())
    def test_inventory_covers_all_supported_asset_types(self):
        self.assertEqual(len(ASSETS),15)
        self.assertEqual(ASSETS['gaia-explorer.bin'][1],'shared')
        self.assertEqual(ASSETS['gaia-map-WM2.bin'][1],'WM2')

if __name__=='__main__':unittest.main()
