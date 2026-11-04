"""Original synthetic bytes only; no proprietary fixtures or dialogue."""
# SPDX-License-Identifier: GPL-3.0-only
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'src'))
from gaiagis.field_context import parse_script
from gaiagis.field_provenance import LEGACY, CMUSC8, EN_ARCHIVE, MAPLIST, source_decoder, context_decoder
from gaiagis.field_transaction import FILES, JOURNAL, commit, digest, recover, rollback, workspace_lease
from gaiagis import field_transaction as transaction

ROOT=Path(__file__).resolve().parents[2]


def section(code, entry=104):
    data=bytearray(104+len(code));struct.pack_into('<HBBHH',data,0,0x502,1,0,len(data),0)
    data[24:29]=b'synth';struct.pack_into('<32H',data,40,*([entry]*32));data[104:]=code
    return bytes(data)


class DecoderTest(unittest.TestCase):
    def test_source_gate(self):
        good={'flevel.lgp':EN_ARCHIVE,'maplist':MAPLIST}
        self.assertEqual(source_decoder(good),CMUSC8)
        for changed in ({**good,'flevel.lgp':'a'*64},{**good,'maplist':'a'*64},{'fflevel.lgp':EN_ARCHIVE,'maplist':MAPLIST}):
            self.assertEqual(source_decoder(changed),LEGACY)
            with self.assertRaises(ValueError):context_decoder(dict(version=6,scriptDecoder=CMUSC8,sources=changed))
        self.assertEqual(context_decoder(dict(version=3,sources=good)),LEGACY)

    def test_zero_parameter_is_not_ret(self):
        data=section(bytes([0xfd,1,0,0,1,0,0,0,0x40,0,0,0]))
        old=parse_script(data,evidence=True);new=parse_script(data,evidence=True,decoder=CMUSC8)
        self.assertEqual(old[2][0]['opcode'],253)
        self.assertEqual([(r['offset'],r['length']) for r in new[3]['instructions']],[(104,8),(112,3),(115,1)])
        self.assertEqual(new[3]['successors'][104],[112]);self.assertFalse(new[2])
        self.assertTrue(new[3]['instructions'][1]['entryReachable'])

    def test_nonzero_parameter_truncation_and_entry_into_operand(self):
        self.assertEqual(parse_script(section(bytes([253,1,2,3,4,5,6,7,0])),evidence=True,decoder=CMUSC8)[3]['instructions'][0]['length'],8)
        for data in (section(bytes([253,0,0,0,0,0,0])),section(bytes([253,0,0,0,0,0,0,0,0]),110)):
            with self.assertRaises(ValueError):parse_script(data,evidence=True,decoder=CMUSC8)

    def test_geometry_reuse_does_not_depend_on_script_revision(self):
        from gaiagis.build_workspace import reusable,ASSETS
        with tempfile.TemporaryDirectory(dir=ROOT/'output/dev/current/runtime') as folder:
            root=Path(folder);sources={'flevel.lgp':EN_ARCHIVE,'field-poi.json':'a'*64,'field-transitions.json':'b'*64}
            assets=[]
            for name,revision in (('gaia-field-walkmesh.bin','field-context-6'),('gaia-field-visual.bin','field-visual-4')):
                data=b'authored geometric fixture';(root/name).write_bytes(data)
                assets.append(dict(filename=name,generator_version=revision,bytes=len(data),sha256=digest(data),dependencies=ASSETS[name][2]))
            manifest=dict(schema='gaiagis-workspace',version=1,tool_version='5.11.0',generator_version='workspace-1',sources=sources,assets=assets)
            # There is deliberately no reusable Context; geometry is independent.
            self.assertTrue(reusable(manifest,sources,root,['gaia-field-walkmesh.bin']))
            self.assertTrue(reusable(manifest,sources,root,['gaia-field-visual.bin']))
            self.assertFalse(reusable(manifest,{**sources,'flevel.lgp':'f'*64},root,['gaia-field-walkmesh.bin']))

    def test_link_refresh_retains_legacy_and_recovered_decoder_identity(self):
        from gaiagis import gameplay
        from types import SimpleNamespace
        sources={'flevel.lgp':EN_ARCHIVE,'maplist':MAPLIST}
        for version in (1,2):
            with self.subTest(version=version),tempfile.TemporaryDirectory(dir=ROOT/'output/dev/current/runtime') as folder:
                root=Path(folder);context=dict(version=3 if version==1 else 6,sources=sources)
                if version==2:context['scriptDecoder']=CMUSC8
                raw=json.dumps(context).encode();(root/'gaia-field-context.json').write_bytes(raw)
                gp=dict(schema='gaiagis-gameplay',version=version,generator_revision=f'gameplay-{version}',sourceLanguage='en',sources=sources,contextSHA256=digest(raw),field={},battle={},links={'fieldBattles':[]})
                if version==2:gp['decoder']=CMUSC8
                data=json.dumps(gp).encode();(root/'gaia-gameplay.json').write_bytes(data)
                manifest=dict(schema='gaiagis-workspace',version=1,sources={'gameplay-inputs.json':'e'*64},assets=[dict(filename='gaia-field-context.json',sha256=digest(raw),bytes=len(raw)),dict(filename='gaia-gameplay.json',sha256=digest(data),bytes=len(data),generator_version=f'gameplay-{version}')])
                (root/'gaia-workspace.json').write_text(json.dumps(manifest),encoding='utf8')
                ds=SimpleNamespace(language='en',field_name='flevel.lgp')
                with patch.object(gameplay,'discover',return_value=ds),patch.object(gameplay,'input_profile',return_value=('e'*64,sources)),patch.object(gameplay,'_world_script_links',return_value=[]),patch.object(gameplay,'_workspace_links',return_value={'worldBattles':[],'encounters':[]}),patch.object(gameplay,'reviewed_boss_mappings',return_value=[]):
                    gameplay.refresh_links(ds,root)
                after=json.loads((root/'gaia-gameplay.json').read_bytes())
                self.assertEqual(after['version'],version)
                self.assertEqual(after.get('decoder'),CMUSC8 if version==2 else None)


class Interrupted(BaseException):pass


class PrivateBoundaryTest(unittest.TestCase):
    @unittest.skipUnless((ROOT/'output/local-workspace/local-launch.json').is_file(),'optional private EN source configuration')
    def test_three_real_zero_parameter_ret_counterexamples(self):
        from gaiagis.dataset import discover
        from gaiagis.lgp import inventory,read_entry
        from gaiagis.field_context import field_sections
        from gaiagis.field_bundle import read_pack
        root=ROOT/'output/local-workspace'
        fields=root/'gaia-field-dialogue.bin'
        if not fields.is_file():self.skipTest('optional private Dialogue absent')
        header,scenes,_=read_pack(fields.read_bytes(),fields.name)
        if header.get('decoder')!=CMUSC8:self.skipTest('Workspace has not been migrated')
        config=json.loads((root/'local-launch.json').read_bytes())
        archive=discover(config['source_before']['wm_directory'],'en').field_archive()
        entries={e['filename']:e for e in inventory(archive)['entries']}
        samples=[(199,'mktinn',1829,36,[1840]),(343,'farm',1951,20,[1965,2085]),(345,'frcyo',12518,16,[12625]),(345,'frcyo',39059,21,[39074,39728])]
        cache={}
        for fid,name,pc,op,successors in samples:
            if name not in cache:
                member=read_entry(archive,entries[name]);script,*_=field_sections(member,archive='flevel.lgp',member=name)
                self.assertEqual(digest(member),scenes[fid]['memberSHA256']);self.assertEqual(digest(script),scenes[fid]['section1SHA256']);cache[name]=script
            script=cache[name];trace=parse_script(script,evidence=True,decoder=CMUSC8)[3]
            self.assertEqual(script[pc],253);self.assertEqual(script[pc+6:pc+8],b'\0\0')
            node=next(n for n in trace['instructions'] if n['offset']==pc+8)
            self.assertEqual(node['opcode'],op);self.assertEqual(trace['successors'][pc+8],successors)


class TransactionTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=ROOT/'output/dev/current/runtime');self.root=Path(self.temp.name)
        self.old={n:('old:'+n).encode() for n in FILES};self.new={n:('new:'+n).encode() for n in FILES}
        for n,data in self.old.items():(self.root/n).write_bytes(data)
        self.snapshot={n:digest(data) for n,data in self.old.items()}
    def tearDown(self):self.temp.cleanup()
    def assert_group(self,expected):
        self.assertEqual({n:(self.root/n).read_bytes() for n in FILES},expected)
    def test_success_manifest_last_and_explicit_rollback(self):
        observed=[]
        with workspace_lease(self.root):
            ident=commit(self.root,self.new,self.snapshot,fault=observed.append)
            self.assert_group(self.new);self.assertEqual(observed[-1],'after:gaia-workspace.json')
            self.assertEqual(recover(self.root),'clean');self.assertEqual(rollback(self.root,ident),'restored-old')
            self.assert_group(self.old)
    def test_backup_failure_leaves_old_files(self):
        for name in FILES:
            def fail(point):
                if point=='backup:'+name:raise OSError('synthetic disk full')
            with self.subTest(name=name),workspace_lease(self.root):
                with self.assertRaises(OSError):commit(self.root,self.new,self.snapshot,fault=fail)
                self.assert_group(self.old);self.assertEqual(recover(self.root),'clean')
    def test_every_replace_before_after_failure_restores_old(self):
        for phase in ('before:','after:'):
            for name in FILES:
                def fail(point):
                    if point==phase+name:raise OSError('synthetic replace failure')
                with self.subTest(phase=phase,name=name),workspace_lease(self.root):
                    with self.assertRaises(OSError):commit(self.root,self.new,self.snapshot,fault=fail)
                    self.assert_group(self.old);self.assertEqual(recover(self.root),'clean')
    def test_interrupted_commit_recovers_idempotently(self):
        for name in FILES[:-1]:
            def crash(point):
                if point=='after:'+name:raise Interrupted()
            with self.subTest(name=name),workspace_lease(self.root):
                with self.assertRaises(Interrupted):commit(self.root,self.new,self.snapshot,fault=crash)
                self.assertTrue((self.root/JOURNAL).exists());self.assertEqual(recover(self.root),'restored-old');self.assertEqual(recover(self.root),'clean');self.assert_group(self.old)
    def test_process_exit_releases_lease_and_recovery_restores_old(self):
        program="""import os,sys;from pathlib import Path
from gaiagis.field_transaction import *
r=Path(sys.argv[1]);old={n:digest((r/n).read_bytes()) for n in FILES}
with workspace_lease(r):
 commit(r,{n:('new:'+n).encode() for n in FILES},old,fault=lambda p:os._exit(73) if p=='after:gaia-field-context.json' else None)
"""
        import os
        env={**os.environ,'PYTHONPATH':str(ROOT/'src'),'PYTHONDONTWRITEBYTECODE':'1'}
        result=subprocess.run([sys.executable,'-B','-c',program,str(self.root)],env=env,capture_output=True)
        self.assertEqual(result.returncode,73)
        with workspace_lease(self.root):self.assertEqual(recover(self.root),'restored-old');self.assert_group(self.old)
    def test_write_failure_and_tampered_backup_do_not_serve_mixed_assets(self):
        original=transaction.atomic_write;failed=False
        def write(path,data):
            nonlocal failed
            if Path(path)==self.root/FILES[2] and not failed:failed=True;raise OSError('synthetic write')
            return original(path,data)
        with workspace_lease(self.root),patch.object(transaction,'atomic_write',write):
            with self.assertRaises(OSError):commit(self.root,self.new,self.snapshot)
            self.assert_group(self.old)
    def test_busy_lease_and_changed_snapshot_rejected(self):
        with workspace_lease(self.root):
            with self.assertRaises(ValueError):
                with workspace_lease(self.root):pass
            (self.root/FILES[0]).write_bytes(b'changed')
            with self.assertRaises(ValueError):commit(self.root,self.new,self.snapshot)

    def test_crash_after_manifest_accepts_verified_complete_new_group(self):
        def crash(point):
            if point=='after:gaia-workspace.json':raise Interrupted()
        with workspace_lease(self.root):
            with self.assertRaises(Interrupted):commit(self.root,self.new,self.snapshot,fault=crash)
            self.assertEqual(recover(self.root),'verified-new');self.assert_group(self.new)

    def test_failed_rollback_retains_journal_and_blocks_server_inventory(self):
        from gaiagis.local import server_manifest
        original=transaction.atomic_write
        def fail(path,data):
            if Path(path)==self.root/FILES[1]:raise OSError('persistent disk failure')
            return original(path,data)
        with workspace_lease(self.root),patch.object(transaction,'atomic_write',fail):
            with self.assertRaises(OSError):commit(self.root,self.new,self.snapshot)
            self.assertTrue((self.root/JOURNAL).exists())
            with self.assertRaisesRegex(ValueError,'recovery required'):server_manifest(self.root)
        with workspace_lease(self.root):self.assertEqual(recover(self.root),'restored-old');self.assert_group(self.old)


if __name__=='__main__':unittest.main()
