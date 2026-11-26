"""Original synthetic GeoPackage tables for the loopback database query contract."""
# SPDX-License-Identifier: GPL-3.0-only
from contextlib import closing
from hashlib import sha256
from http.client import HTTPConnection
import json
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
from threading import Thread
from unittest import TestCase
from unittest.mock import patch

from gaiagis.field_evidence_gis import ATTRIBUTES, FILES, REVISION, SCHEMA as PROTOCOL
from gaiagis.field_gis import table_fields
from gaiagis.field_transaction import JOURNAL
from gaiagis.local import _make_server, make_server
from gaiagis.local_database import FEATURES, LocalDatabase, MAX_RESPONSE, QUERIES, query_parameters, response_bytes
from gaiagis.safety import WORKSPACE_ROOT

PREFIX = '/__gaiagis_local__/db/'
DATABASE_ROOT = WORKSPACE_ROOT / 'output/exports/fieldlocal'


def digest(data):
    return sha256(data).hexdigest()


class LocalDatabaseTests(TestCase):
    def setUp(self):
        DATABASE_ROOT.mkdir(parents=True, exist_ok=True)
        tmp = self.enterContext(TemporaryDirectory(prefix='test-local-db-', dir=DATABASE_ROOT))
        self.path = Path(tmp) / 'synthetic.gpkg'
        self.root = Path(tmp) / 'workspace'
        self.root.mkdir()
        self.dist = Path(tmp) / 'viewer'
        self.dist.mkdir()
        (self.dist / 'index.html').write_text('<html><head></head><body>Test</body></html>', encoding='utf8')
        self.original = {'id': 0, 'name': 'made_up', 'stats': {'triangles': 2}, 'raw': b'walkmesh sample',
                         'context': {'version': 6, 'scriptDecoder': 'legacy-stop', 'archive': 'flevel.lgp',
                                     'sources': {'flevel.lgp': 'a'*64, 'maplist': 'b'*64}}}
        associated = ('context', 'walkmesh', 'dialogue', 'gameplay', 'script')
        records = {}
        for role in associated:
            name = FILES[role]
            data = role.encode()
            (self.root / name).write_bytes(data)
            records[name] = dict(filename=name, bytes=len(data), sha256=digest(data), generator_version=role+'-test')
        self.manifest = {'assets': list(records.values())}
        raw = json.dumps(self.manifest).encode()
        (self.root / 'gaia-workspace.json').write_bytes(raw)
        self.original.update(root=self.root, manifest_hash=digest(raw), assets=records)
        member, section1, section8 = (digest(name) for name in (b'member', b'section1', b'section8'))
        mesh = digest(self.original['raw'])
        span = dict(fieldId=0, name='made_up', memberSHA256=member, section1SHA256=section1,
                    section5SHA256=mesh, section8SHA256=section8, section1Bytes=100)
        self.enterContext(patch('gaiagis.local_database.load_field', return_value=self.original))
        self.enterContext(patch('gaiagis.local_database.read_cfg_metadata', return_value=({'field': {'scenes': [span]}, 'scenes': [span]}, 'test')))
        with closing(sqlite3.connect(self.path)) as db, db:
            db.executescript("""PRAGMA application_id=1196444487;
            CREATE TABLE gpkg_contents (table_name TEXT PRIMARY KEY, data_type TEXT NOT NULL);
            CREATE TABLE gpkg_geometry_columns (table_name TEXT PRIMARY KEY, srs_id INT, z INT, m INT);""")
            for name, fields in table_fields(3).items():
                if name == 'field_metadata':
                    db.execute(f'CREATE TABLE field_metadata ({",".join(fields)})')
                elif name == 'script_lines':
                    db.execute('CREATE TABLE script_lines(field_id INT, instruction_offset INT, UNIQUE(field_id,instruction_offset))')
                else:
                    db.execute(f'CREATE TABLE {name} (fid INTEGER PRIMARY KEY)')
            for name, declaration in ATTRIBUTES.items():
                db.execute(f'CREATE TABLE {name} (id INTEGER PRIMARY KEY, {declaration})')
            db.executemany('INSERT INTO gpkg_contents VALUES (?,?)', (
                (name, 'features' if name in FEATURES else 'attributes') for name in set(table_fields(3)) | ATTRIBUTES.keys()))
            db.executemany('INSERT INTO gpkg_geometry_columns VALUES (?,-1,1,0)', [(name,) for name in FEATURES])
            db.execute("""INSERT INTO field_metadata(schema,version,field_id,field_name,coordinate_space,source_file,
                source_sha256,maplist_sha256,context_version,walkmesh_version,section5_sha256,triangle_count,access_count)
                VALUES ('gaiagis-fieldlocal-gpkg',3,0,'made_up','FieldLocal','flevel.lgp',?,?,6,1,?,2,6)""", ('a'*64, 'b'*64, mesh))
            db.execute("""INSERT INTO analysis_runs(field_id,field_name,protocol,protocol_version,software_version,decoder,
                       revision,workspace_sha256,status,complete,budget_json)
                VALUES(0,'made_up',?,1,'test','legacy-stop',?,?,'complete',1,'{}')""", (PROTOCOL, REVISION, digest(raw)))
            for role, name in FILES.items():
                record = records.get(name, {})
                status = 'available' if record else 'unavailable'
                db.execute('INSERT INTO evidence_sources(role,asset,sha256,byte_count,revision,status) VALUES(?,?,?,?,?,?)',
                           (role, name, record.get('sha256'), record.get('bytes'), record.get('generator_version'), status))
                db.execute('INSERT INTO analysis_status(channel,status,row_count) VALUES(?,?,?)',
                           (role, status, 1 if role in ('dialogue','gameplay') else None))
            db.executemany('INSERT INTO evidence_sources(role,asset,sha256,status) VALUES(?,?,?,\'available\')', [
                ('manifest', None, digest(raw)), ('archive', 'flevel.lgp', 'a'*64), ('maplist', None, 'b'*64),
                ('member', None, member), ('section1', None, section1), ('section5', None, mesh), ('section8', None, section8)])
            db.execute("INSERT INTO analysis_status(channel,status,row_count) VALUES('conditional','complete',2)")
            db.execute('INSERT INTO script_entries(root_offset) VALUES(0)')
            db.execute("INSERT INTO conditional_roots(root_offset,status) VALUES(0,'accepted')")
            db.executemany("INSERT INTO script_instructions(instruction_offset,width,opcode,reachable,cfg_status) VALUES(?,1,?,1,'verified')",
                           ((0, 20), (5, 64), (8, 88)))
            db.execute("INSERT INTO script_conditions(instruction_offset,operands_json) VALUES(0,'{}')")
            db.executemany('INSERT INTO script_events(instruction_offset,kind,reachable) VALUES(?,?,1)', [(5,'MESSAGE'), (8,'STITM')])
            db.execute("INSERT INTO dialogue_references(instruction_offset,kind,text_id,text_table_status,text_status,operands_json) VALUES(5,'MESSAGE',0,'valid','valid','{}')")
            db.execute("INSERT INTO gameplay_events(source_record_id,instruction_offset,kind,status,operands_json) VALUES('0:8',8,'item','static','{}')")
            db.execute("""INSERT INTO conditional_controls(root_offset,if_offset,successor,target_offset,is_standard,is_strong,is_core,basis_json)
                          VALUES (0,0,5,5,1,1,1,'{}'), (0,0,5,8,1,0,0,'{}')""")
        self.expected = self.path.read_bytes()

    def sql(self, query):
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute(query)

    def test_fixed_joins_pagination_and_nulls_leave_the_database_unchanged(self):
        database = LocalDatabase(self.path, self.root, self.manifest)
        _, status = database.request('status', '')
        self.assertEqual((status['fieldId'], status['tableCount'], status['spatialLayerCount']), (0, 37, 7))
        self.assertTrue(status['sourceMatched'])
        _, page = database.request('events', 'limit=1')
        self.assertEqual((page['total'], page['hasMore'], page['rows'][0]['textId'], page['rows'][0]['gameplayKind']), (2, True, 0, None))
        _, page = database.request('events', 'limit=1&offset=1&instruction_offset=8')
        self.assertEqual((page['total'], page['rows']), (1, []))
        _, page = database.request('events', 'kind=STITM')
        self.assertEqual((page['total'], page['rows'][0]['textId']), (1, None))
        _, page = database.request('events', 'instruction_offset=0')
        self.assertEqual((page['total'], page['rows']), (0, []))
        for grade, count in [('standard', 2), ('strong', 1), ('core', 1)]:
            _, page = database.request('controls', f'if_offset=0&grade={grade}')
            self.assertEqual(page['total'], count)
            self.assertEqual(page['rows'][0]['targetOffset'], 5)
        self.assertEqual(self.path.read_bytes(), self.expected)
        self.assertEqual(len(list(self.path.parent.glob('*.gpkg*'))), 1)

    def test_bad_arguments_and_budget(self):
        for args in ('limit=0','limit=51','offset=10001','limit=1&limit=2','table=script_events','instruction_offset=-1',
                     'instruction_offset=1.5','kind=%27%20OR%20true','instruction_offset=1e2','kind=%ff','kind='+'x'*600):
            with self.subTest(args=args):
                with self.assertRaises(ValueError):
                    query_parameters('events', args)
        for args in ('','if_offset=','if_offset=65536','if_offset=0&grade=unsupported'):
            with self.assertRaises(ValueError):
                query_parameters('controls', args)
        self.assertEqual(response_bytes(200, {'value':'x'*MAX_RESPONSE})[0], 500)
        self.assertIn(':if_offset', QUERIES['controls'][0])

    def test_bad_schema_and_source_fail_closed(self):
        self.sql("UPDATE analysis_runs SET workspace_sha256=printf('%064d',0)")
        self.assertEqual(LocalDatabase(self.path, self.root, self.manifest).request('status','')[1]['status'], 'source_mismatch')
        self.sql('UPDATE field_metadata SET version=2')
        self.assertEqual(LocalDatabase(self.path, self.root, self.manifest).request('status','')[1]['status'], 'incompatible')

    def test_section_conflict_and_file_tamper(self):
        database = LocalDatabase(self.path, self.root, self.manifest)
        self.sql("UPDATE evidence_sources SET sha256=printf('%064d',0) WHERE role='member'")
        self.assertEqual(database.request('events','')[1]['status'], 'database_changed')
        self.assertEqual(LocalDatabase(self.path, self.root, self.manifest).request('status','')[1]['status'], 'source_mismatch')
        self.path.write_bytes(self.expected)
        self.assertEqual(database.request('status','')[1]['status'], 'database_changed')

    def test_limited_analysis_is_not_a_complete_empty_relation(self):
        self.sql('DELETE FROM conditional_controls')
        self.sql("UPDATE analysis_runs SET status='limited',complete=0")
        self.sql("UPDATE analysis_status SET status='limited',row_count=NULL WHERE channel='conditional'")
        database = LocalDatabase(self.path, self.root, self.manifest)
        self.assertEqual(database.request('status','')[1]['channels']['conditional'], 'limited')
        self.assertEqual(database.request('controls','if_offset=0')[1]['status'], 'conditional_limited')

    def test_unsafe_journal_and_pending_workspace_recovery(self):
        sidecar = self.path.with_name(self.path.name+'-journal')
        sidecar.write_bytes(b'synthetic sidecar')
        self.assertEqual(LocalDatabase(self.path, self.root, self.manifest).request('status','')[1]['status'], 'unsafe_journal')
        self.assertEqual(sidecar.read_bytes(), b'synthetic sidecar')
        journal = self.root / JOURNAL
        journal.parent.mkdir()
        journal.write_bytes(b'pending')
        with self.assertRaisesRegex(ValueError,'CFG recovery required'):
            make_server(self.root,self.dist,port=0,field_db=self.path,serve_existing=True)
        self.assertEqual(journal.read_bytes(), b'pending')
        self.assertFalse((journal.parent/'field-cfg.lock').exists())

    def test_loopback_headers_methods_and_public_file_boundary(self):
        with patch('gaiagis.local.server_manifest', return_value=self.manifest):
            for configured in (None, self.path):
                with _make_server(self.root, self.dist, port=0, field_db=configured) as server:
                    running = Thread(target=server.serve_forever, kwargs={'poll_interval':0.01})
                    running.start()
                    try:
                        def request(path='status', method='GET', headers=None):
                            with closing(HTTPConnection('127.0.0.1', server.server_port, timeout=3)) as client:
                                client.request(method, PREFIX+path, headers={'X-GaiaGIS-DB':'1'} if headers is None else headers)
                                response = client.getresponse()
                                body = response.read()
                                return response.status, response.headers, json.loads(body) if body else None
                        code, headers, result = request()
                        self.assertEqual((code, result['status']), (200, 'available' if configured else 'not_configured'))
                        self.assertEqual(headers['Cache-Control'], 'no-store')
                        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
                        self.assertEqual(headers['Cross-Origin-Resource-Policy'], 'same-origin')
                        self.assertIsNone(headers['Access-Control-Allow-Origin'])
                        for supplied in ({}, {'X-GaiaGIS-DB':'1','Host':'outside.example'},
                                         {'X-GaiaGIS-DB':'1','Origin':f'http://localhost:{server.server_port}'},
                                         {'X-GaiaGIS-DB':'1','Sec-Fetch-Site':'cross-site'}):
                            self.assertEqual(request(headers=supplied)[0],403)
                        for method in ('POST','HEAD','PUT','DELETE','OPTIONS'):
                            code, headers, _ = request(method=method)
                            self.assertEqual((code,headers['Allow']),(405,'GET'))
                        self.assertEqual(request('events?table=script_events')[0],400)
                        self.assertEqual(request('synthetic.gpkg')[0],404)
                        self.assertEqual(request('events?kind=MESSAGE')[0],200 if configured else 409)
                    finally:
                        server.shutdown()
                        running.join(3)
