"""Synthetic launcher/security tests. Inputs and temporary files stay in output/."""
# SPDX-License-Identifier: GPL-3.0-only
from contextlib import ExitStack
import json
from pathlib import Path
import tempfile
import threading
import unittest
from contextlib import redirect_stderr
from io import StringIO
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from gaiagis.build_workspace import ASSETS, build_workspace, reusable, write_manifest, ensure_stage1
from gaiagis.web_export import sha256
from gaiagis.local import validate_source, workspace_path, make_server, choose_source, main
from gaiagis.safety import WORKSPACE_ROOT


class LocalTests(unittest.TestCase):
    def setUp(self):
        folder=WORKSPACE_ROOT/'output/local-launcher-validation/test-tmp';folder.mkdir(parents=True,exist_ok=True)
        self.tmp=tempfile.TemporaryDirectory(dir=folder);self.root=Path(self.tmp.name)
        self.sources={'wm0.map':'a'*64,'world_us.lgp':'b'*64}
    def tearDown(self):self.tmp.cleanup()
    def seed(self):
        for name in ('gaia-meta.json','gaia-mesh.bin','gaia-poi.json'):(self.root/name).write_bytes(b'{}')
        return write_manifest(self.root,self.sources)
    def source(self,layout=('ff7','workingdir','data')):
        root=self.root/'source';data=root.joinpath(*layout);wm=data/'WM';wm.mkdir(parents=True)
        for name in ('wm0.map','wm2.map','wm3.map','wm0.bot','wm2.bot','wm3.bot','world_us.lgp'):(wm/name.upper()).write_bytes(b'synthetic')
        field=data/'FIELD';field.mkdir();(field/'FLEVEL.LGP').write_bytes(b'synthetic field')
        return root,wm
    def test_source_discovery_steam_case_insensitive(self):
        root,_=self.source();report=validate_source(root);self.assertEqual(len(report['files']),8)
        self.assertIn('unknown dataset',report['compatibility'])
    def test_classic_layout(self):
        root,_=self.source(('data',));self.assertEqual(len(validate_source(root)['files']),8)
    def test_invalid_root_friendly(self):
        with self.assertRaisesRegex(ValueError,'FF7 installation not recognized'):validate_source(self.root/'invalid')
    def test_missing_bot(self):
        root,wm=self.source();(wm/'WM2.BOT').unlink()
        with self.assertRaisesRegex(ValueError,'Missing wm2.bot'):validate_source(root)
    def test_missing_field(self):
        root,_=self.source();(root/'ff7/workingdir/data/FIELD/FLEVEL.LGP').unlink()
        with self.assertRaisesRegex(ValueError,'flevel.lgp'):validate_source(root)
    def test_source_not_output(self):
        root,_=self.source()
        with self.assertRaisesRegex(ValueError,'inside game source'):workspace_path(root/'out',root)
    def test_sealed_evidence_rejected(self):
        for name in ('climate_v2','climate_v21','climate_v22','gis','3d','validation'):
            with self.assertRaises(ValueError):workspace_path(WORKSPACE_ROOT/'output'/name/'workspace',self.root/'source')
    def test_outside_output_rejected(self):
        with self.assertRaises(ValueError):workspace_path(WORKSPACE_ROOT/'src',self.root/'source')
    def test_source_persistence_is_explicit(self):
        source,_=self.source();config=self.root/'.gaiagis-local.json'
        with patch('gaiagis.local.CONFIG',config):
            choose_source(source);self.assertFalse(config.exists())
            choose_source(source,True);self.assertEqual(choose_source(None)[0],source)
    def test_dependency_hash_invalidates_only_dependents(self):
        manifest=self.seed();(self.root/'gaia-mesh.bin').write_bytes(b'corrupt')
        self.assertFalse(reusable(manifest,self.sources,self.root,['gaia-poi.json']))
    def test_unrelated_source_change_reuses_geometry(self):
        manifest=self.seed();self.assertTrue(reusable(manifest,{**self.sources,'wm3.map':'c'*64},self.root,['gaia-mesh.bin']))
    def test_generator_mismatch(self):
        manifest=self.seed();manifest['generator_version']='unsupported'
        self.assertFalse(reusable(manifest,self.sources,self.root,['gaia-mesh.bin']))
    def test_malformed_old_manifest_rebuilds(self):
        for manifest in ([],['bad'],{'assets':['bad']}):self.assertFalse(reusable(manifest,self.sources,self.root,['gaia-mesh.bin']))
    def test_local_stage1_cache_reused_without_gdal(self):
        from types import SimpleNamespace
        source=self.root/'wm0-source';source.write_bytes(b'synthetic WM0')
        cache=self.root/'cache';(cache/'gis').mkdir(parents=True);(cache/'gis/gaia_geographic.gpkg').write_bytes(b'cache sentinel')
        (cache/'reconstruction').mkdir();(cache/'reconstruction/build_metadata.json').write_text(json.dumps({'source_fingerprint':{'before':{'files':[{'filename':'wm0.map','sha256':sha256(source)}]}}}))
        with patch('gaiagis.build_workspace.discover',return_value=SimpleNamespace(files={'wm0.map':source})):
            self.assertEqual(ensure_stage1(self.root,self.root/'absent-stage1',cache),cache)
    def test_missing_qgis_friendly_error(self):
        source,_=self.source();stderr=StringIO()
        with patch('gaiagis.local.build_workspace',side_effect=ModuleNotFoundError(name='osgeo')),patch.dict('os.environ',{'GAIAGIS_QGIS_ROOT':str(self.root/'missing-qgis')}),redirect_stderr(stderr):
            code=main(['--source',str(source),'--workspace',str(self.root/'workspace'),'--no-open'])
        self.assertEqual(code,1);self.assertIn('QGIS/GDAL environment unavailable',stderr.getvalue());self.assertNotIn('Traceback',stderr.getvalue())
    def test_browser_opens_only_after_server_ready_and_closes_on_interrupt(self):
        source,_=self.source();out=self.root/'workspace';out.mkdir()
        server=MagicMock();server.server_port=5174;server.serve_forever.side_effect=KeyboardInterrupt
        with patch('gaiagis.local.build_workspace',return_value={'assets':13}),patch('gaiagis.local.prepare_viewer',return_value=self.root),patch('gaiagis.local.make_server',return_value=server),patch('gaiagis.local.webbrowser.open') as opened:
            self.assertEqual(main(['--source',str(source),'--workspace',str(out)]),0)
            opened.assert_called_once_with('http://127.0.0.1:5174/');server.server_close.assert_called_once()
    def build_fixture(self,fail=False):
        source=self.root/'source';source.mkdir();out=self.root/'workspace'
        from types import SimpleNamespace
        dataset=SimpleNamespace(wm_directory=source,files={})
        calls=[]
        def geometry(base,target):
            for name in ('gaia-meta.json','gaia-mesh.bin'):(target/name).write_bytes(b'{}')
        def exporter(label):
            def export(*args,**kwargs):
                calls.append(label)
                if fail and label=='locations':raise ValueError('Synthetic optional failure')
                Path(args[-1]).write_bytes(b'{}')
            return export
        def native(command,**kwargs):
            label=command[-1];calls.append(label)
            name=next(n for n,v in ASSETS.items() if v[0]==label)
            (out/name).write_bytes(b'{}')
        stack=ExitStack()
        stack.enter_context(patch('gaiagis.build_workspace.discover',return_value=dataset))
        stack.enter_context(patch('gaiagis.build_workspace.child_ci',return_value=None))
        stack.enter_context(patch('gaiagis.build_workspace.fingerprint',return_value={'files':[{'filename':k,'sha256':v} for k,v in self.sources.items()]}))
        stack.enter_context(patch('gaiagis.build_workspace.ensure_stage1',return_value=self.root))
        stack.enter_context(patch('gaiagis.build_workspace.build_web_assets',side_effect=geometry))
        for module,fn,label in [('poi','build_poi','locations'),('encounters','build_encounters','encounters'),('world_events','build_events','events'),('routing','export_routing','routing'),('texture_pack','build_texture_pack','textures'),('explorer_export','build_explorer','explorer'),('presentation','build_presentation','presentation')]:
            stack.enter_context(patch('gaiagis.'+module+'.'+fn,side_effect=exporter(label)))
        def atlas(target):
            calls.append('atlas')
            if not (target/'gaia-poi.json').is_file():raise ValueError('POI unavailable')
            (target/'gaia-atlas.json').write_bytes(b'{}')
        stack.enter_context(patch('gaiagis.build_workspace.build_atlas',side_effect=atlas))
        stack.enter_context(patch('gaiagis.build_workspace.subprocess.run',side_effect=native))
        self.addCleanup(stack.close)
        return source,out,calls
    def test_warm_reuse_and_partial_rebuild(self):
        source,out,calls=self.build_fixture();build_workspace(source,out);calls.clear()
        report=build_workspace(source,out);self.assertTrue(all(r['reused'] for r in report['steps']));self.assertEqual(calls,[])
        (out/'gaia-events.json').write_bytes(b'bad');calls.clear();report=build_workspace(source,out)
        self.assertEqual(calls,['events']);self.assertEqual([r['step'] for r in report['steps'] if not r['reused']],['events'])
    def test_explorer_generator_upgrade_only_rebuilds_explorer(self):
        source,out,calls=self.build_fixture();build_workspace(source,out)
        manifest=json.loads((out/'gaia-workspace.json').read_text())
        next(a for a in manifest['assets'] if a['type']=='explorer')['generator_version']='workspace-1'
        (out/'gaia-workspace.json').write_text(json.dumps(manifest));calls.clear()
        build_workspace(source,out);self.assertEqual(calls,['explorer'])
    def test_removed_audio_source_only_rebuilds_presentation(self):
        source,out,calls=self.build_fixture();build_workspace(source,out);calls.clear()
        manifest=json.loads((out/'gaia-workspace.json').read_text())
        manifest['sources']['audio.dat']='f'*64
        (out/'gaia-workspace.json').write_text(json.dumps(manifest))
        build_workspace(source,out);self.assertEqual(calls,['presentation'])
    def test_audio_optional_failure_preserves_core_without_flag(self):
        source,out,calls=self.build_fixture()
        with patch('gaiagis.presentation.build_presentation',side_effect=ValueError('Optional audio unavailable')):
            report=build_workspace(source,out)
        self.assertEqual(report['assets'],14)
        self.assertTrue((out/'gaia-mesh.bin').is_file())
    def test_optional_failure_is_not_published(self):
        source,out,_=self.build_fixture(True);report=build_workspace(source,out,allow_optional_failure=True)
        manifest=json.loads((out/'gaia-workspace.json').read_text())
        self.assertEqual(report['assets'],13);self.assertNotIn('gaia-poi.json',[a['filename'] for a in manifest['assets']])
    def test_rebuild_and_clean_invalid(self):
        source,out,calls=self.build_fixture();build_workspace(source,out);calls.clear()
        report=build_workspace(source,out,rebuild=True,clean_invalid=True)
        self.assertTrue(all(not r['reused'] for r in report['steps']));self.assertEqual(len(calls),13)


class EndpointTests(unittest.TestCase):
    def setUp(self):
        LocalTests.setUp(self);LocalTests.seed(self);self.dist=self.root/'dist';self.dist.mkdir()
        (self.dist/'index.html').write_text('<html><head></head></html>')
        (self.dist/'private.map').write_bytes(b'never serve')
        self.server=make_server(self.root,self.dist,port=0)
        self.thread=threading.Thread(target=self.server.serve_forever,kwargs={'poll_interval':.01});self.thread.start()
        self.url='http://127.0.0.1:'+str(self.server.server_port)
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join(timeout=2);LocalTests.tearDown(self)
    def get(self,path,headers=None):return urlopen(Request(self.url+path,headers=headers or {}),timeout=3)
    def test_status_and_manifest_no_private_paths(self):
        with self.get('/__gaiagis_local__/status') as r:self.assertTrue(json.load(r)['local_mode'])
        with self.get('/__gaiagis_local__/workspace') as r:self.assertNotIn(str(self.root).encode(),r.read())
    def test_manifest_asset_and_bootstrap_marker(self):
        with self.get('/__gaiagis_local__/assets/gaia-mesh.bin') as r:self.assertEqual(r.read(),b'{}')
        with self.get('/') as r:self.assertIn(b'name="gaiagis-local"',r.read())
    def test_path_traversal_and_game_files_rejected(self):
        for path in ('/../private.map','/%2e%2e/private.map','/%252e%252e/private.map','/__gaiagis_local__/assets/../gaia-mesh.bin','/__gaiagis_local__/assets/world_us.lgp','/__gaiagis_local__/assets/wm0.map','/__gaiagis_local__/assets/flevel.lgp','/private.map','/.gaiagis-local.json','/local-launch.json','/src/gaiagis/local.py'):
            with self.assertRaises(HTTPError) as error:self.get(path)
            self.assertEqual(error.exception.code,404,path)
            error.exception.close()
    def test_replaced_asset_rejected(self):
        (self.root/'gaia-mesh.bin').write_bytes(b'changed')
        with self.assertRaises(HTTPError) as error:self.get('/__gaiagis_local__/assets/gaia-mesh.bin')
        error.exception.close()
    def test_cross_origin_and_dns_rebinding_rejected(self):
        for headers in ({'Origin':'https://evil.example'},{'Host':'evil.example:'+str(self.server.server_port)}):
            with self.assertRaises(HTTPError) as error:self.get('/__gaiagis_local__/workspace',headers)
            self.assertEqual(error.exception.code,403)
            error.exception.close()
    def test_port_conflict_and_shutdown(self):
        other=make_server(self.root,self.dist,port=self.server.server_port)
        self.assertNotEqual(other.server_port,self.server.server_port);port=other.server_port;other.server_close()
        replacement=make_server(self.root,self.dist,port=port);self.assertEqual(replacement.server_port,port);replacement.server_close()
    def test_unlisted_asset_manifest_rejected(self):
        manifest=json.loads((self.root/'gaia-workspace.json').read_text());manifest['assets'][0]['filename']='world_us.lgp'
        (self.root/'gaia-workspace.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError,'Unapproved'):make_server(self.root,self.dist,port=0)


if __name__=='__main__':unittest.main()
