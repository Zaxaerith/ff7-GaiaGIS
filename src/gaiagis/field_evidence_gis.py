"""Local Field Evidence protocol, relational writer and readback."""
# SPDX-License-Identifier: GPL-3.0-only
from contextlib import closing
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
from threading import Event, Timer

from ._version import __version__
from .clean_output import reject_links
from .field_provenance import context_decoder
from .safety import WORKSPACE_ROOT
from .web_export import sha256

MAX_BYTES = 8_000_000
MAX_ROWS = 250_000
TIMEOUT = 90
SCHEMA = 'gaiagis-local-field-evidence'
REVISION = 'field-conditional-1'
LIMITS = dict(maxRootNodes=8192, maxTotalVisits=8_000_000, maxBitsetBytes=32*1024*1024,
              maxRelations=100_000, maxOperations=100_000_000)
FILES = {role:f'gaia-field-{role}.bin' for role in ('walkmesh','interaction','dialogue')}
FILES.update(context='gaia-field-context.json', gameplay='gaia-gameplay.json', script='gaia-field-script-evidence.bin')
HASH = re.compile('[a-f0-9]{64}')

ATTRIBUTES = {
 'evidence_sources': 'role TEXT NOT NULL UNIQUE, asset TEXT, sha256 TEXT CHECK(sha256 IS NULL OR length(sha256)=64), byte_count INTEGER, revision TEXT, status TEXT NOT NULL, reason TEXT',
 'analysis_runs': 'field_id INTEGER NOT NULL UNIQUE, field_name TEXT NOT NULL, protocol TEXT NOT NULL, protocol_version INTEGER NOT NULL, software_version TEXT NOT NULL, decoder TEXT NOT NULL, revision TEXT NOT NULL, workspace_sha256 TEXT NOT NULL, status TEXT NOT NULL, complete INTEGER NOT NULL CHECK(complete IN (0,1)), budget_json TEXT NOT NULL, stats_json TEXT',
 'analysis_status': 'channel TEXT NOT NULL UNIQUE, status TEXT NOT NULL, reason TEXT, row_count INTEGER CHECK(row_count IS NULL OR row_count>=0)',
 'script_actors': 'actor_id INTEGER NOT NULL UNIQUE CHECK(actor_id BETWEEN 0 AND 63)',
 'script_entries': 'root_offset INTEGER NOT NULL UNIQUE CHECK(root_offset<=65535), node_count INTEGER, edge_count INTEGER',
 'script_entry_aliases': "actor_id INTEGER NOT NULL REFERENCES script_actors(actor_id), kind TEXT NOT NULL CHECK(kind IN ('main','table')), raw_slot INTEGER NOT NULL CHECK(raw_slot<=31 AND (kind='table' OR raw_slot=0)), root_offset INTEGER NOT NULL REFERENCES script_entries(root_offset), UNIQUE(actor_id,kind,raw_slot,root_offset), UNIQUE(actor_id,kind,raw_slot)",
 'script_instructions': """instruction_offset INTEGER NOT NULL UNIQUE CHECK(instruction_offset<=65535), width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 65535), opcode INTEGER NOT NULL CHECK(opcode<=255), reachable INTEGER NOT NULL CHECK(reachable IN (0,1)),
 raw_successor_0 INTEGER CHECK(raw_successor_0<=65535), raw_successor_1 INTEGER CHECK(raw_successor_1<=65535),
 successor_0 INTEGER REFERENCES script_instructions(instruction_offset) DEFERRABLE INITIALLY DEFERRED,
 successor_1 INTEGER REFERENCES script_instructions(instruction_offset) DEFERRABLE INITIALLY DEFERRED,
 cfg_status TEXT NOT NULL CHECK(cfg_status IN ('verified','unverified','not_indexed')),
 CHECK(successor_0 IS NULL OR successor_0 IS raw_successor_0), CHECK(successor_1 IS NULL OR successor_1 IS raw_successor_1),
 CHECK(cfg_status!='verified' OR (successor_0 IS raw_successor_0 AND successor_1 IS raw_successor_1))""",
 'script_instruction_owners': 'instruction_offset INTEGER NOT NULL REFERENCES script_instructions(instruction_offset), actor_id INTEGER NOT NULL, kind TEXT NOT NULL, raw_slot INTEGER NOT NULL, root_offset INTEGER NOT NULL, UNIQUE(instruction_offset,actor_id,kind,raw_slot,root_offset), FOREIGN KEY(actor_id,kind,raw_slot,root_offset) REFERENCES script_entry_aliases(actor_id,kind,raw_slot,root_offset)',
 'script_conditions': 'instruction_offset INTEGER NOT NULL UNIQUE REFERENCES script_instructions(instruction_offset), operands_json TEXT NOT NULL',
 'script_events': "instruction_offset INTEGER NOT NULL UNIQUE REFERENCES script_instructions(instruction_offset), kind TEXT NOT NULL CHECK(kind IN ('MESSAGE','ASK','STITM','SMTRA','BATTLE','REQ','REQSW','REQEW')), reachable INTEGER NOT NULL CHECK(reachable IN (0,1))",
 'gameplay_events': "source_record_id TEXT NOT NULL UNIQUE, instruction_offset INTEGER NOT NULL UNIQUE REFERENCES script_instructions(instruction_offset), kind TEXT NOT NULL CHECK(kind IN ('item','materia','battle','flag')), status TEXT NOT NULL CHECK(status IN ('static','unknown')), operands_json TEXT NOT NULL",
 'dialogue_references': "instruction_offset INTEGER NOT NULL UNIQUE REFERENCES script_events(instruction_offset), kind TEXT NOT NULL CHECK(kind IN ('MESSAGE','ASK')), text_id INTEGER NOT NULL CHECK(text_id<=255), text_table_status TEXT NOT NULL CHECK(text_table_status IN ('valid','unavailable')), text_status TEXT NOT NULL CHECK(text_status IN ('valid','unavailable')), text_reason TEXT, operands_json TEXT NOT NULL",
 'event_interaction_candidates': "event_offset INTEGER NOT NULL REFERENCES script_events(instruction_offset), field_id INTEGER NOT NULL, line_offset INTEGER NOT NULL, association TEXT NOT NULL CHECK(association IN ('same_actor','same_entry')), UNIQUE(event_offset,field_id,line_offset), FOREIGN KEY(field_id,line_offset) REFERENCES script_lines(field_id,instruction_offset)",
 'conditional_roots': "root_offset INTEGER NOT NULL UNIQUE REFERENCES script_entries(root_offset), status TEXT NOT NULL CHECK(status IN ('accepted','rejected')), reason TEXT, CHECK((status='accepted')=(reason IS NULL))",
 'conditional_controls': 'root_offset INTEGER NOT NULL REFERENCES conditional_roots(root_offset), if_offset INTEGER NOT NULL REFERENCES script_conditions(instruction_offset), successor INTEGER NOT NULL REFERENCES script_instructions(instruction_offset), target_offset INTEGER NOT NULL REFERENCES script_events(instruction_offset), is_standard INTEGER NOT NULL CHECK(is_standard=1), is_strong INTEGER NOT NULL CHECK(is_strong IN (0,1)), is_core INTEGER NOT NULL CHECK(is_core IN (0,1) AND is_core<=is_strong), basis_json TEXT NOT NULL, UNIQUE(root_offset,if_offset,successor,target_offset)',
 'ask_if_relations': "root_offset INTEGER NOT NULL REFERENCES conditional_roots(root_offset), ask_offset INTEGER NOT NULL REFERENCES dialogue_references(instruction_offset), if_offset INTEGER NOT NULL REFERENCES script_conditions(instruction_offset), bank INTEGER NOT NULL CHECK(bank<=15), address INTEGER NOT NULL CHECK(address<=65535), width INTEGER NOT NULL CHECK(width IN (1,2)), status TEXT NOT NULL CHECK(status IN ('local','candidate')), reason TEXT, corridor_json TEXT NOT NULL, CHECK((status='local')=(reason IS NULL)), UNIQUE(root_offset,ask_offset,if_offset,bank,address,width)",
 'request_edges': "source_offset INTEGER NOT NULL UNIQUE REFERENCES script_events(instruction_offset), opcode INTEGER NOT NULL CHECK(opcode BETWEEN 1 AND 3), priority INTEGER NOT NULL CHECK(priority<=7), target_actor INTEGER NOT NULL CHECK(target_actor<=255), raw_slot INTEGER NOT NULL CHECK(raw_slot<=31), target_root INTEGER REFERENCES script_entries(root_offset), status TEXT NOT NULL CHECK(status IN ('resolved','missing','ambiguous')), CHECK((status='resolved')=(target_root IS NOT NULL))",
 'request_target_events': 'source_offset INTEGER NOT NULL REFERENCES request_edges(source_offset), target_offset INTEGER NOT NULL REFERENCES script_events(instruction_offset), UNIQUE(source_offset,target_offset)',
}
HEADER_TABLES = ('evidence_sources','analysis_runs','analysis_status')
RESULT_TABLES = tuple(name for name in ATTRIBUTES if name not in HEADER_TABLES)
STRICT_TABLES = ('conditional_roots','conditional_controls','ask_if_relations','request_edges','request_target_events')


def _need(condition, reason):
    if not condition:
        raise ValueError(f'Field Evidence {reason}')


def _keys(value, names):
    _need(isinstance(value, dict) and value.keys() == set(names), 'protocol shape')


def _int(value, top=2**53-1):
    return type(value) is int and 0 <= value <= top


def _text(value):
    return isinstance(value,str) and '\0' not in value


def _hash(value):
    return isinstance(value,str) and HASH.fullmatch(value) is not None


def _dump(value):
    return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)


def _decode(value):
    from .field_gis import _decode_json
    # Python also accepts overflowed exponents such as 1e1000 in valid JSON.
    def finite(obj):
        if isinstance(obj,float):
            _need(math.isfinite(obj), 'nonfinite number')
        elif isinstance(obj,list):
            for v in obj:finite(v)
        elif isinstance(obj,dict):
            for v in obj.values():finite(v)
    decoded=_decode_json(value)
    finite(decoded)
    return decoded


def _process(command, *, timeout=TIMEOUT, limit=MAX_BYTES):
    env={k:v for k,v in os.environ.items() if k.upper() not in ('NODE_OPTIONS','NODE_PATH','NODE_COMPILE_CACHE')}
    with subprocess.Popen(command,cwd=WORKSPACE_ROOT,env=env,stdin=subprocess.DEVNULL,
                          stdout=subprocess.PIPE,stderr=subprocess.DEVNULL) as process:
        expired=Event()
        def expire():
            if process.poll() is None:
                expired.set()
                process.kill()
        timer=Timer(timeout,expire)
        timer.start()
        try:
            data=process.stdout.read(limit+1)
            if len(data)>limit:
                process.kill()
            status=process.wait()
        finally:
            timer.cancel()
            timer.join()
            if process.poll() is None:
                process.kill()
        if expired.is_set():
            raise ValueError('Field Evidence Node timed out')
        _need(len(data)<=limit,'transport exceeds byte limit')
        if status==10:return None,'node_version'
        if status==11:raise ValueError('Field Evidence transport exceeds export budget')
        _need(status==0 and data,'Node reader failed; check local Node and installed Web dependencies')
        return data,None


def _identity(scene, interaction):
    ctx=scene['context']
    return dict(fieldId=scene['id'],name=scene['name'],archive=ctx['archive'],archiveSHA256=ctx['sources'][ctx['archive']],
                maplistSHA256=ctx['sources']['maplist'],manifestSHA256=scene['manifest_hash'],
                contextSHA256=scene['hashes'][FILES['context']],decoder=context_decoder(ctx),
                section5SHA256=hashlib.sha256(scene['raw']).hexdigest(),
                section1SHA256=interaction['section1SHA256'] if interaction else None,
                section8SHA256=interaction['section8SHA256'] if interaction else None,memberSHA256=None)


def _fallback(scene,interaction,interaction_reason,reason):
    identity=_identity(scene,interaction)
    reasons=dict(context=None,walkmesh=None,interaction=interaction_reason,dialogue=reason,gameplay=reason,script=reason)
    assets={}
    for role,name in FILES.items():
        available=role in ('context','walkmesh') or role=='interaction' and interaction is not None
        record=scene['assets'].get(name,{})
        assets[role]=['available' if available else 'unavailable',reasons[role],
                      record.get('sha256'),record.get('bytes'),record.get('generator_version')]
    return dict(schema=SCHEMA,version=1,software=__version__,identity=identity,assets=assets,observed={},
                tables={name:[] for name in RESULT_TABLES}, timing={},
                run=dict(revision=REVISION,status='not_run',complete=False,problems=[reason],stats=None,budget=LIMITS))


def validate_reply(data,scene,interaction):
    _keys(data,('schema','version','software','identity','assets','observed','tables','run','timing'))
    _need(data['schema']==SCHEMA and type(data['version']) is int and data['version']==1 and data['software']==__version__,'protocol version')
    expected=_identity(scene,interaction)
    identity=data['identity']
    _keys(identity,expected)
    for k,v in expected.items():
        _need(type(identity[k]) is type(v) and identity[k]==v if v is not None else identity[k] is None or _hash(identity[k]),'source identity')
    _keys(data['assets'],FILES)
    seen=data['observed']
    _need(isinstance(seen,dict) and seen.keys()<=FILES.keys(),'observed source roles')
    for role,name in FILES.items():
        row=data['assets'][role]
        _need(isinstance(row,list) and len(row)==5 and row[0] in ('available','unavailable') and (row[1] is None if row[0]=='available' else row[1] in ('not_registered','reader_rejected','source_rejected','file_missing','scene_conflict')),'asset status')
        record=scene['assets'].get(name,{})
        _need(row[2:]==[record.get(k) for k in ('sha256','bytes','generator_version')],'asset fingerprint')
        if row[0]=='available':
            _need(_hash(row[2]) and _int(row[3],32_000_000) and seen.get(role)==row[2:4],'asset size')
            scene['hashes'][name]=row[2]
    observed={}
    for role,pair in seen.items():
        _need(isinstance(pair,list) and len(pair)==2 and _hash(pair[0]) and _int(pair[1],32_000_000),'observed fingerprint')
        observed[FILES[role]]=pair
    _need(all(data['assets'][k][0]=='available' for k in ('context','walkmesh')) and
          (data['assets']['interaction'][0]=='available')==(interaction is not None),'reader agreement')
    _keys(data['timing'],('analysisMs','projectionMs'))
    _need(all(type(v) in (int,float) and math.isfinite(v) and 0<=v<=TIMEOUT*1000 for v in data['timing'].values()),'analysis timing')
    run=data['run']
    _keys(run,('revision','status','complete','problems','stats','budget'))
    _need(run['revision']==REVISION and run['budget']==LIMITS and run['status'] in ('complete','unavailable','limited','cancelled')
          and run['complete'] is (run['status']=='complete'),'analysis status')
    _need(isinstance(run['problems'],list) and len(run['problems'])<=32 and all(isinstance(p,str) and re.fullmatch('[a-z_]{1,64}',p) for p in run['problems']) and bool(run['problems']) != run['complete'],'analysis reasons')
    tables=data['tables']
    _keys(tables,RESULT_TABLES)
    _need(all(isinstance(rows,list) and all(isinstance(row,list) for row in rows) for rows in tables.values()) and sum(map(len,tables.values()))<=MAX_ROWS-len(ATTRIBUTES)*2,'table budget')
    if run['complete']:
        _need(identity['decoder']=='field-cfg-en-cmusc8-1' and all(_hash(identity[key]) for key in ('memberSHA256','section1SHA256','section8SHA256')) and
              data['assets']['dialogue'][0]=='available','strict source profile')
        _need(isinstance(run['stats'],dict) and run['stats'].get('complete') is True and not run['problems'],'analysis completeness')
    else:
        _need(run['stats'] is None and not any(tables[k] for k in STRICT_TABLES),'incomplete analysis contains strict claims')
    for role,table in (('interaction','event_interaction_candidates'),('dialogue','dialogue_references'),('gameplay','gameplay_events')):
        _need(data['assets'][role][0]=='available' or not tables[table],'unavailable asset carries rows')
    scene['observed_evidence']=observed
    return data


def read_evidence(scene,interaction,interaction_reason,stage):
    node=shutil.which('node')
    if node is None:return _fallback(scene,interaction,interaction_reason,'node_missing')
    entry=WORKSPACE_ROOT/'web/scripts/export-field-evidence.mjs'
    reject_links(entry)
    _need(entry.is_file() and entry.resolve()==entry,'fixed Node entry missing')
    payload,reason=_process([node,str(entry),str(stage),str(scene['root']),str(scene['id']),__version__])
    if payload is None:return _fallback(scene,interaction,interaction_reason,reason)
    evidence=validate_reply(_decode(payload),scene,interaction)
    evidence['timing']['transport_bytes']=len(payload)
    return evidence


def _with_headers(evidence):
    tables=dict(evidence['tables'])
    identity,run,assets=evidence['identity'],evidence['run'],evidence['assets']
    sources=[[role,FILES[role],digest,size,revision,status,reason] for role,(status,reason,digest,size,revision) in assets.items()]
    for role,digest in (('manifest',identity['manifestSHA256']),('archive',identity['archiveSHA256']),('maplist',identity['maplistSHA256']),
                        ('member',identity['memberSHA256']),('section1',identity['section1SHA256']),('section5',identity['section5SHA256']),('section8',identity['section8SHA256'])):
        sources.append([role,identity['archive'] if role=='archive' else None,digest,None,None,
                        'available' if digest else 'unavailable',None if digest else 'source_unavailable'])
    tables['evidence_sources']=sources
    tables['analysis_runs']=[[identity['fieldId'],identity['name'],SCHEMA,1,__version__,identity['decoder'],run['revision'],identity['manifestSHA256'],
                             run['status'],int(run['complete']),_dump(run['budget']),_dump(run['stats']) if run['stats'] is not None else None]]
    statuses=[]
    for role in FILES:
        status,reason,*_=assets[role]
        key={'dialogue':'dialogue_references','gameplay':'gameplay_events'}.get(role)
        statuses.append([role,status,reason,len(tables[key]) if key and status=='available' else None])
    candidate_ready=assets['interaction'][0]=='available' and any(assets[r][0]=='available' for r in ('dialogue','gameplay'))
    statuses.append(['interaction_candidates','available' if candidate_ready else 'unavailable',
                     None if candidate_ready else 'sources_unavailable',len(tables['event_interaction_candidates']) if candidate_ready else None])
    statuses.extend([['conditional',run['status'],','.join(run['problems']) or None,len(tables['conditional_controls']) if run['complete'] else None],
                     ['dialogue_body','not_run','metadata_only_export',None],['old_witness','not_run','not_selected',None]])
    tables['analysis_status']=statuses
    return tables


def _put(db,name,rows):
    columns=db.execute(f'PRAGMA table_info("{name}")').fetchall()[1:]
    for row in rows:
        _need(len(row)==len(columns),'row field count')
        for value,(_,key,kind,not_null,_,_) in zip(row,columns):
            if value is None:
                _need(not not_null,'null required field')
            elif kind=='INTEGER':
                _need(_int(value),'integer range')
            else:
                _need(_text(value) and len(value)<=MAX_BYTES,'attribute text')
                if key.endswith('_json'):
                    _need(isinstance(_decode(value),(list,dict)),'attribute JSON')
    bindings=','.join('?' for _ in columns)
    db.executemany(f'INSERT INTO "{name}" VALUES (NULL,{bindings})',rows)


# These checks validate representation and references. They do not recalculate the proof.
CHECKS = (
 ("event opcode", """SELECT 1 FROM script_events e JOIN script_instructions i USING(instruction_offset)
    WHERE i.opcode!=CASE e.kind WHEN 'REQ' THEN 1 WHEN 'REQSW' THEN 2 WHEN 'REQEW' THEN 3 WHEN 'MESSAGE' THEN 64
          WHEN 'ASK' THEN 72 WHEN 'STITM' THEN 88 WHEN 'SMTRA' THEN 91 WHEN 'BATTLE' THEN 112 END OR i.reachable!=e.reachable"""),
 ("control source", """SELECT 1 FROM conditional_controls c JOIN conditional_roots r USING(root_offset)
    JOIN script_instructions i ON i.instruction_offset=c.if_offset
    WHERE r.status!='accepted' OR i.cfg_status!='verified' OR i.successor_0 IS NULL OR i.successor_1 IS NULL
       OR i.successor_0=i.successor_1 OR c.successor NOT IN (i.successor_0,i.successor_1)
       OR NOT EXISTS (SELECT 1 FROM script_instruction_owners o WHERE o.instruction_offset=c.target_offset AND o.root_offset=c.root_offset)
       OR NOT EXISTS (SELECT 1 FROM script_instruction_owners o WHERE o.instruction_offset=c.if_offset AND o.root_offset=c.root_offset)"""),
 ("core owners", """SELECT 1 FROM conditional_controls c WHERE c.is_core=1 AND EXISTS(
    SELECT 1 FROM script_instruction_owners o WHERE o.instruction_offset=c.target_offset AND NOT EXISTS(
      SELECT 1 FROM conditional_controls v WHERE v.root_offset=o.root_offset AND v.if_offset=c.if_offset
       AND v.successor=c.successor AND v.target_offset=c.target_offset AND v.is_strong=1 AND v.is_core=1))"""),
 ("ASK identity", """SELECT 1 FROM ask_if_relations a JOIN dialogue_references d ON d.instruction_offset=a.ask_offset
    JOIN conditional_roots r USING(root_offset) WHERE d.kind!='ASK' OR (a.status='local' AND r.status!='accepted')
    OR NOT EXISTS (SELECT 1 FROM script_instruction_owners o WHERE o.instruction_offset=a.ask_offset AND o.root_offset=a.root_offset)
    OR NOT EXISTS (SELECT 1 FROM script_instruction_owners o WHERE o.instruction_offset=a.if_offset AND o.root_offset=a.root_offset)"""),
 ("REQ identity", """SELECT 1 FROM request_edges r JOIN script_instructions i ON i.instruction_offset=r.source_offset
    WHERE r.opcode!=i.opcode OR (r.status='resolved' AND NOT EXISTS (SELECT 1 FROM script_entry_aliases a
      WHERE a.actor_id=r.target_actor AND a.kind='table' AND a.raw_slot=r.raw_slot AND a.root_offset=r.target_root))"""),
 ("REQ target scope", """SELECT 1 FROM request_target_events t JOIN request_edges r USING(source_offset)
    WHERE r.status!='resolved' OR NOT EXISTS (SELECT 1 FROM script_instruction_owners o
      WHERE o.instruction_offset=t.target_offset AND o.actor_id=r.target_actor AND o.kind='table' AND
            o.raw_slot=r.raw_slot AND o.root_offset=r.target_root)"""),
)


def _check_rows(db,evidence,counts):
    for reason,query in CHECKS:
        _need(not db.execute(query+' LIMIT 1').fetchone(),reason)
    _need(not db.execute('PRAGMA foreign_key_check').fetchone(),'foreign keys')
    for strong,basis in db.execute('SELECT is_strong,basis_json FROM conditional_controls'):
        _need(_decode(basis)==dict(targetPostdominatesSuccessor=True,targetPostdominatesIf=False,ifDominatesTarget=bool(strong)),
              'control basis')
    for (corridor,) in db.execute('SELECT corridor_json FROM ask_if_relations'):
        offsets=_decode(corridor)
        _need(isinstance(offsets,list) and all(_int(v,65535) for v in offsets) and len(set(offsets))==len(offsets),'ASK corridor')
    stats=evidence['run']['stats']
    if stats is None:return
    measured=dict(rawRoots=counts['conditional_roots'],aliases=counts['script_entry_aliases'],
                  standardRelations=counts['conditional_controls'],
                  requestCount=counts['request_edges'],requestEventPairs=counts['request_target_events'])
    for key,query in (
        ('acceptedRoots',"SELECT count(*) FROM conditional_roots WHERE status='accepted'"),
        ('rejectedRoots',"SELECT count(*) FROM conditional_roots WHERE status='rejected'"),
        ('strongRelations','SELECT count(*) FROM conditional_controls WHERE is_strong=1'),
        ('coreRelations','SELECT count(*) FROM (SELECT DISTINCT if_offset,successor,target_offset FROM conditional_controls WHERE is_core=1)'),
        ('coreEvents','SELECT count(DISTINCT target_offset) FROM conditional_controls WHERE is_core=1'),
        ('askCandidates','SELECT count(*) FROM (SELECT DISTINCT ask_offset,if_offset FROM ask_if_relations)'),
        ('askLocalPairs',"SELECT count(*) FROM (SELECT DISTINCT ask_offset,if_offset FROM ask_if_relations WHERE status='local')"),
    ):
        measured[key]=db.execute(query).fetchone()[0]
    _need(all(_int(stats.get(k)) and stats[k]==v for k,v in measured.items()),'analysis count conservation')


def write_tables(path,evidence):
    tables=_with_headers(evidence)
    counts={name:len(rows) for name,rows in tables.items()}
    _need(sum(counts.values())<=MAX_ROWS,'export row budget')
    with closing(sqlite3.connect(path)) as db:
        db.execute('PRAGMA foreign_keys=ON')
        # The tables and their OGR metadata are published together in the staged database.
        try:
            db.execute('BEGIN IMMEDIATE')
            db.execute('CREATE UNIQUE INDEX field_line_identity ON script_lines(field_id,instruction_offset)')
            db.execute('CREATE UNIQUE INDEX field_triangle_identity ON walkmesh_triangles(field_id,triangle_id)')
            for name,definition in ATTRIBUTES.items():
                db.execute(f'CREATE TABLE "{name}" (id INTEGER PRIMARY KEY, {definition})')
                db.execute("INSERT INTO gpkg_contents(table_name,data_type,identifier) VALUES (?,'attributes',?)",(name,name))
                _put(db,name,tables[name])
            for table,columns in (
                ('interaction_candidates','field_id,record_type,record_id'),('interaction_candidates','field_id,triangle_id'),
                ('script_instruction_owners','root_offset,actor_id'),('dialogue_references','text_id,instruction_offset'),
                ('conditional_controls','target_offset,is_core'),('conditional_controls','if_offset,successor'),
                ('event_interaction_candidates','field_id,line_offset'),('request_target_events','target_offset'),
            ):
                db.execute(f'CREATE INDEX by_{table}_{columns.split(",")[-1]} ON {table}({columns})')
            _check_rows(db,evidence,counts)
            db.commit()
        except BaseException:
            db.rollback()
            raise
    return counts


def verify_tables(path, ogr_dataset, evidence, counts):
    from osgeo import ogr
    with closing(sqlite3.connect(Path(path).as_uri()+'?mode=ro',uri=True)) as db:
        db.execute('PRAGMA foreign_keys=ON')
        for name,rows in _with_headers(evidence).items():
            info=db.execute(f'PRAGMA table_info("{name}")').fetchall()
            _need(info[0][1:3]==('id','INTEGER') and info[0][-1]==1,'attribute primary key')
            _need([x[1:] for x in db.execute(f'SELECT * FROM "{name}" ORDER BY id')]==[tuple(row) for row in rows],'attribute readback')
            layer=ogr_dataset.GetLayerByName(name)
            _need(layer is not None and layer.GetGeomType()==ogr.wkbNone and layer.GetFeatureCount()==counts[name],'OGR attribute readback')
        _check_rows(db,evidence,counts)


def verify_observed(root,observed):
    for name,(digest,size) in observed.items():
        path=root/name
        reject_links(path)
        _need(path.stat().st_size==size and sha256(path)==digest,'source changed during export')
