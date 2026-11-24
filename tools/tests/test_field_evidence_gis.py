# SPDX-License-Identifier: GPL-3.0-only
from contextlib import closing
from copy import deepcopy
import sqlite3
import struct
import sys
import tempfile
import unittest
from pathlib import Path
import zlib

from gaiagis.field_evidence_gis import (_decode,_fallback,_process,validate_reply,write_tables)
from gaiagis.field_provenance import CMUSC8,EN_ARCHIVE,MAPLIST
from gaiagis.safety import WORKSPACE_ROOT


def workspace_scope():
    return dict(id=1,name='original-fixture',context=dict(archive='flevel.lgp',version=6,scriptDecoder=CMUSC8,
                sources={'flevel.lgp':EN_ARCHIVE,'maplist':MAPLIST}),raw=b'synthetic geometry',manifest_hash='a'*64,
                hashes={'gaia-field-context.json':'e'*64,'gaia-field-walkmesh.bin':'f'*64},assets={
                    'gaia-field-context.json':dict(sha256='e'*64,bytes=12,generator_version='field-context-9'),
                    'gaia-field-walkmesh.bin':dict(sha256='f'*64,bytes=12,generator_version='field-walkmesh-1'),
                    'gaia-field-dialogue.bin':dict(sha256='1'*64,bytes=12,generator_version='field-dialogue-2'),
                })


def reply(scene):
    data=_fallback(scene,None,'not_registered','node_missing')
    data['timing']=dict(analysisMs=2,projectionMs=1)
    data['assets']['dialogue'][:2]=['available',None]
    data['observed']={k:r[2:4] for k,r in data['assets'].items() if r[0]=='available'}
    for role in ('gameplay','script'):data['assets'][role][1]='not_registered'
    data['identity'].update(section1SHA256='b'*64,section8SHA256='c'*64,memberSHA256='d'*64)
    data['run'].update(status='complete',complete=True,problems=[],stats=dict(complete=True,
        rawRoots=2,aliases=3,acceptedRoots=1,rejectedRoots=1,standardRelations=1,strongRelations=1,coreRelations=0,coreEvents=0,
        askCandidates=1,askLocalPairs=0,requestCount=1,requestEventPairs=0))
    data['tables'].update(
        script_actors=[[0],[1]],
        script_entries=[[32,4,3],[44,3,3]],
        script_entry_aliases=[[0,'table',0,32],[0,'main',0,32],[1,'table',0,44]],
        script_instructions=[[32,6,20,1,38,44,38,44,'verified'],[38,3,64,1,None,None,None,None,'verified'],
                             [41,3,3,1,None,None,None,None,'verified'],[44,7,72,1,100,None,None,None,'unverified']],
        script_instruction_owners=[[32,0,'table',0,32],[38,0,'table',0,32],[38,1,'table',0,44],[44,1,'table',0,44]],
        script_conditions=[[32,'{"reads":[]}']],
        script_events=[[38,'MESSAGE',1],[41,'REQEW',1],[44,'ASK',1]],
        dialogue_references=[[38,'MESSAGE',0,'valid','valid',None,'{}'],[44,'ASK',1,'unavailable','unavailable','table_bounds','{}']],
        conditional_roots=[[32,'accepted',None],[44,'rejected','cycle']],
        conditional_controls=[[32,32,38,38,1,1,0,'{"targetPostdominatesSuccessor":true,"targetPostdominatesIf":false,"ifDominatesTarget":true}']],
        ask_if_relations=[],
        request_edges=[[41,3,2,0,0,32,'resolved']],
    )
    # No localized ASK/IF relation is present in this synthetic run.
    data['run']['stats'].update(askCandidates=0)
    return data


class FieldEvidenceProtocolTests(unittest.TestCase):
    def test_rejects_duplicate_keys_nonfinite_and_wrong_protocol_or_scope(self):
        for contents in ('{"offset":1,"offset":1}','{"x":NaN}','{"x":1e999}'):
            with self.assertRaises(ValueError):_decode(contents)
        scene=workspace_scope();data=reply(scene)
        validate_reply(data,scene,None)
        for mapping,key,value in (('identity','fieldId',True),('identity','section5SHA256','5'*64),
                                  ('identity','manifestSHA256','3'*64),('assets','dialogue',['available',None,'a'*64,12,'field-dialogue-2']),
                                  ('run','complete',False),('run','revision','bad')):
            invalid=deepcopy(data);invalid[mapping][key]=value
            with self.assertRaises(ValueError):validate_reply(invalid,workspace_scope(),None)
        invalid=deepcopy(data);invalid['version']=2
        with self.assertRaises(ValueError):validate_reply(invalid,workspace_scope(),None)
        invalid=deepcopy(data);invalid['run'].update(status='limited',complete=False,stats=None,problems=['operation_limit'])
        with self.assertRaisesRegex(ValueError,'strict claims'):validate_reply(invalid,workspace_scope(),None)

    def test_receiving_side_limits_and_cancels_processes(self):
        for code,options,message in (
            ('print("x"*50000)',{'limit':100},'byte limit'),
            ('import time;time.sleep(10)',{'timeout':0.2},'timed out'),
            ('raise SystemExit(42)',{},'Node reader failed'),
        ):
            with self.assertRaisesRegex(ValueError,message):_process([sys.executable,'-B','-c',code],**options)

    def test_database_rejects_core_over_rejected_root_and_rolls_back_forged_relationships(self):
        def bad_core(data):data['tables']['conditional_controls'][0][6]=1
        def false_successor(data):data['tables']['conditional_controls'][0][2]=32
        def req_wrong_target(data):data['tables']['request_target_events']=[[41,44]]
        def dangling(data):data['tables']['script_instructions'][0][4]=data['tables']['script_instructions'][0][6]=101
        def duplicate(data):data['tables']['script_entry_aliases'].append(data['tables']['script_entry_aliases'][0])
        def bad_width(data):data['tables']['script_instructions'][0][1]=False
        with tempfile.TemporaryDirectory() as root:
            for i,mutate in enumerate((bad_core,false_successor,req_wrong_target,dangling,duplicate,bad_width,None)):
                with self.subTest(mutation=mutate):
                    path=Path(root)/f'{i}.gpkg'
                    with closing(sqlite3.connect(path)) as db:
                        db.executescript('CREATE TABLE gpkg_contents(table_name TEXT PRIMARY KEY,data_type TEXT,identifier TEXT);'
                                         'CREATE TABLE script_lines(field_id INTEGER,instruction_offset INTEGER);'
                                         'CREATE TABLE walkmesh_triangles(field_id INTEGER,triangle_id INTEGER);'
                                         'CREATE TABLE interaction_candidates(field_id INTEGER,record_type TEXT,record_id INTEGER,triangle_id INTEGER);')
                    data=reply(workspace_scope())
                    if mutate:
                        mutate(data)
                        with self.assertRaises((ValueError,sqlite3.IntegrityError)):write_tables(path,data)
                        with closing(sqlite3.connect(path)) as db:
                            self.assertEqual(db.execute('SELECT count(*) FROM gpkg_contents').fetchone(),(0,))
                            self.assertIsNone(db.execute("SELECT 1 FROM sqlite_master WHERE name='conditional_controls'").fetchone())
                    else:
                        write_tables(path,data)
                        with closing(sqlite3.connect(path)) as db:
                            self.assertEqual(db.execute("SELECT is_strong,is_core FROM conditional_controls").fetchone(),(1,0))
                            self.assertEqual(db.execute("SELECT raw_successor_0,successor_0,cfg_status FROM script_instructions WHERE instruction_offset=44").fetchone(),(100,None,'unverified'))
                            self.assertEqual(db.execute("SELECT status,row_count FROM analysis_status WHERE channel='gameplay'").fetchone(),('unavailable',None))
                            self.assertEqual(db.execute("SELECT count(*) FROM script_entry_aliases WHERE root_offset=32").fetchone(),(2,))


class FieldEvidenceContainerTests(unittest.TestCase):
    def test_v1_and_v2_interaction_headers_set_the_existing_v2_metadata_field(self):
        from contextlib import closing
        import hashlib
        import json
        from gaiagis.field_context import parse_walkmesh
        from gaiagis.field_gis import export_field
        try:from osgeo import ogr
        except ImportError:self.skipTest('GDAL-enabled Python required')
        export_root=WORKSPACE_ROOT/'output/exports/fieldlocal'
        export_root.mkdir(parents=True,exist_ok=True)
        encode=lambda value:json.dumps(value).encode()
        sha=lambda value:hashlib.sha256(value).hexdigest()
        def container(magic,version,meta,payload):
            header=encode(meta)
            return magic+struct.pack('<II',version,len(header))+header+payload
        with tempfile.TemporaryDirectory(prefix='.qa-public-field-evidence-',dir=export_root) as stage:
            for version in (1,2):
                folder=Path(stage)/f'ws{version}';folder.mkdir()
                world_sources={'flevel.lgp':'a'*64,'maplist':'b'*64}
                context=dict(schema='gaiagis-field-context',version=3 if version==1 else 6,
                             archive='flevel.lgp',coordinateSpace='FieldLocalIdentity',sources=world_sources.copy(),
                             nodes=[dict(id=0,name='invented',status='available'),dict(id=1,name='disabled',status='missing')],
                             edges=[],exits=[],unresolved=[],gateways=[],
                             entrances=[dict(entry=i//2+1,scenario=i%2,field_id=1,field_name='disabled',status='placeholder',
                                             field_table_record=i,field_table_byte_offset=i*12) for i in range(128)])
                if version==2:
                    context['sources']['world_us.lgp']='c'*64
                    context['scriptDecoder']='legacy-stop'
                section5=struct.pack('<I12h3H',1,0,0,1,9,0,5,2,8,7,2,3,6,65535,65535,65535)
                walk_scene=dict(fieldId=0,status='available',offset=0,bytes=len(section5),**parse_walkmesh(section5))
                walks=container(b'GAIAFLD\0',1,dict(schema='gaiagis-field-walkmesh',version=1,coordinateSpace='FieldLocal',
                    sources=world_sources,generator_revision='field-walkmesh-1',scenes=[walk_scene]),section5)
                interaction=encode(dict(fieldId=0,name='invented',triangles=1,meshReason=None,section1Bytes=45,section8Bytes=536,
                    section1SHA256='d'*64,section8SHA256='e'*64,section5SHA256=sha(section5),unusedTriggers=12,triggers=[],scripts=[],stops=[]))
                compressed=zlib.compress(interaction)
                context_bytes=encode(context)
                meta=dict(schema='gaiagis-field-interaction',version=version,coordinateSpace='FieldLocal',sources=world_sources,
                          generator_revision=f'field-interaction-{version}',scenes=[dict(fieldId=0,name='invented',triangles=1,
                          section5SHA256=sha(section5),offset=0,bytes=len(compressed),rawBytes=len(interaction),sha256=sha(interaction))])
                if version==2:meta.update(decoder='legacy-stop',contextSHA256=sha(context_bytes))
                packed=container(b'GAIAINT\0',version,meta,compressed)
                assets=[]
                for name,kind,map_id,deps,revision,payload in (
                    ('gaia-meta.json','metadata','WM0',[],'test',b'{}'),
                    ('gaia-mesh.bin','geometry','WM0',['gaia-meta.json'],'test',b'synthetic'),
                    ('gaia-poi.json','locations','WM0',['gaia-mesh.bin'],'test',b'{}'),
                    ('gaia-field-context.json','field-context','WM0',['gaia-poi.json'],'field-context-9',context_bytes),
                    ('gaia-field-walkmesh.bin','field-walkmesh','shared',['gaia-field-context.json'],'field-walkmesh-1',walks),
                    ('gaia-field-interaction.bin','field-interaction','shared',['gaia-field-context.json','gaia-field-walkmesh.bin'],f'field-interaction-{version}',packed),
                ):
                    (folder/name).write_bytes(payload)
                    assets.append(dict(filename=name,type=kind,mapId=map_id,dependencies=deps,generator_version=revision,bytes=len(payload),sha256=sha(payload)))
                (folder/'gaia-workspace.json').write_bytes(encode(dict(schema='gaiagis-workspace',version=1,tool_version='5.16.0',
                    timestamp_policy='omitted',sources=context['sources'],assets=assets)))
                target=Path(stage)/f'export{version}.gpkg'
                out=export_field(folder,'invented',target,format_version=2)
                self.assertEqual(out['pack_timing']['container_version'],version)
                with closing(sqlite3.connect(target)) as db:
                    self.assertEqual(db.execute('SELECT version,interaction_version FROM field_metadata').fetchone(),(2,version))
