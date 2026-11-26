"""Read-only HTTP query model for one previously verified FieldLocal export."""
# SPDX-License-Identifier: GPL-3.0-only
from contextlib import closing, contextmanager
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
from threading import BoundedSemaphore, Lock
from time import monotonic
from urllib.parse import parse_qsl

from .clean_output import reject_links
from .field_bundle import read_cfg_metadata
from .field_evidence_gis import ATTRIBUTES, FILES, REVISION, SCHEMA as PROTOCOL
from .field_interaction import read_interaction
from .field_provenance import context_decoder
from .field_transaction import JOURNAL

MAX_QUERY = 512
MAX_RESPONSE = 256 * 1024
MAX_PAGE_OFFSET = 10_000
EVENT_KINDS = ('MESSAGE', 'ASK', 'STITM', 'SMTRA', 'BATTLE', 'REQ', 'REQSW', 'REQEW')
ASSET_IDS = dict(context='field-context', walkmesh='field-walkmesh', dialogue='field-dialogue',
                 gameplay='gameplay', interaction='field-interaction', script='field-script-evidence')
FEATURES = frozenset(('walkmesh_triangles', 'walkmesh_edges', 'gateway_segments', 'field_entrances',
                      'arrival_points', 'field_triggers', 'script_lines'))
UNIQUE_KEYS = {
    'gpkg_contents': (('table_name',),),
    'evidence_sources': (('role',),),
    'analysis_status': (('channel',),),
    'analysis_runs': (('field_id',),),
    'script_events': (('instruction_offset',),),
    'gameplay_events': (('instruction_offset',), ('source_record_id',)),
    'dialogue_references': (('instruction_offset',),),
    'conditional_controls': (('root_offset', 'if_offset', 'successor', 'target_offset'),),
}
VISIBLE_CHANNELS = ('context', 'walkmesh', 'interaction', 'dialogue', 'gameplay', 'script', 'conditional')
RUN_STATES = ('complete', 'unavailable', 'limited', 'cancelled', 'not_run')
HASH = re.compile(r'[a-f0-9]{64}')
REQUIRED_COLUMNS = {
    'gpkg_contents': 'table_name data_type',
    'gpkg_geometry_columns': 'table_name srs_id z m',
    'field_metadata': 'schema version field_id field_name coordinate_space source_file source_sha256 maplist_sha256 context_version walkmesh_version section5_sha256 triangle_count access_count interaction_version interaction_sha256 section1_sha256 section8_sha256 section1_bytes section8_bytes',
    'analysis_runs': 'field_id field_name protocol protocol_version decoder revision workspace_sha256 status complete',
    'analysis_status': 'channel status row_count',
    'evidence_sources': 'role asset sha256 byte_count revision status',
    'script_events': 'instruction_offset kind reachable',
    'gameplay_events': 'source_record_id instruction_offset kind status',
    'dialogue_references': 'instruction_offset kind text_id text_status',
    'conditional_controls': 'root_offset if_offset successor target_offset is_standard is_strong is_core',
}


def load_field(*args, **kwargs):
    from .field_gis import load_field as read_field
    return read_field(*args, **kwargs)

EVENT_FROM = """
FROM script_events AS e
LEFT JOIN gameplay_events AS g ON g.instruction_offset = e.instruction_offset
LEFT JOIN dialogue_references AS d ON d.instruction_offset = e.instruction_offset
WHERE (:kind IS NULL OR e.kind = :kind)
  AND (:instruction_offset IS NULL OR e.instruction_offset = :instruction_offset)
"""
EVENTS = """
SELECT e.instruction_offset AS instructionOffset, e.kind, e.reachable,
       g.kind AS gameplayKind, g.status AS gameplayStatus,
       d.text_id AS textId, d.text_status AS textStatus
""" + EVENT_FROM + """
ORDER BY e.instruction_offset
LIMIT :limit OFFSET :offset
"""
CONTROL_FROM = """
FROM conditional_controls AS c
JOIN script_events AS e ON e.instruction_offset = c.target_offset
WHERE c.if_offset = :if_offset
  AND ((:grade = 'standard' AND c.is_standard = 1)
    OR (:grade = 'strong' AND c.is_strong = 1)
    OR (:grade = 'core' AND c.is_core = 1))
"""
CONTROLS = """
SELECT c.root_offset AS rootOffset, c.if_offset AS ifOffset, c.successor,
       c.target_offset AS targetOffset, e.kind,
       c.is_standard AS isStandard, c.is_strong AS isStrong, c.is_core AS isCore
""" + CONTROL_FROM + """
ORDER BY c.root_offset, c.successor, c.target_offset
LIMIT :limit OFFSET :offset
"""
QUERIES = {'events': (EVENTS, 'SELECT COUNT(*) ' + EVENT_FROM),
           'controls': (CONTROLS, 'SELECT COUNT(*) ' + CONTROL_FROM)}


class Unavailable(ValueError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _need(value, code='incompatible'):
    if not value:
        raise Unavailable(code)


def query_parameters(kind, raw):
    if len(raw) > MAX_QUERY:
        raise ValueError('invalid_parameters')
    pairs = parse_qsl(raw, keep_blank_values=True, strict_parsing=True, errors='strict', max_num_fields=4)
    values = dict(pairs)
    allowed = {'limit', 'offset'} | ({'kind', 'instruction_offset'} if kind == 'events' else {'if_offset', 'grade'})
    if len(pairs) != len(values) or values.keys() - allowed:
        raise ValueError('invalid_parameters')

    def number(key, low, high, default=None):
        text = values.get(key)
        if text is None and default is not None:
            return default
        if text is None or not re.fullmatch(r'[0-9]{1,6}', text) or not low <= int(text) <= high:
            raise ValueError('invalid_parameters')
        return int(text)

    params = dict(limit=number('limit', 1, 50, 20), offset=number('offset', 0, MAX_PAGE_OFFSET, 0))
    if kind == 'events':
        event = values.get('kind')
        if event is not None and event not in EVENT_KINDS:
            raise ValueError('invalid_parameters')
        params.update(kind=event, instruction_offset=number('instruction_offset', 0, 65535) if 'instruction_offset' in values else None)
    else:
        grade = values.get('grade', 'core')
        if grade not in ('standard', 'strong', 'core'):
            raise ValueError('invalid_parameters')
        params.update(grade=grade, if_offset=number('if_offset', 0, 65535))
    return params


def _stat(path):
    reject_links(path)
    info = path.stat()
    _need(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'invalid_path')
    return info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns


def _sidecars(path):
    return any(os.path.lexists(str(path) + suffix) for suffix in ('-wal', '-shm', '-journal'))


def _fingerprint(path):
    from .field_gis import LIMIT
    token = _stat(path)
    _need(100 <= token[2] <= LIMIT, 'incompatible')
    _need(not _sidecars(path), 'unsafe_journal')
    with path.open('rb') as stream:
        prefix = stream.read(100)
        _need(prefix[:16] == b'SQLite format 3\0', 'incompatible')
        _need(prefix[18:20] == b'\x01\x01', 'unsafe_journal')
        digest = hashlib.sha256(prefix)
        remaining = token[2] - len(prefix)
        while remaining:
            block = stream.read(min(remaining, 1024 * 1024))
            _need(block, 'database_changed')
            digest.update(block)
            remaining -= len(block)
        _need(not stream.read(1), 'database_changed')
    _need(not _sidecars(path) and _stat(path) == token, 'database_changed')
    return token, digest.hexdigest()


@contextmanager
def _connect(path, budget):
    deadline = monotonic() + budget
    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=0.1)) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA query_only=ON')
        connection.execute('PRAGMA trusted_schema=OFF')
        if hasattr(connection, 'enable_load_extension'):
            connection.enable_load_extension(False)
        connection.set_progress_handler(lambda: int(monotonic() >= deadline), 1000)
        yield connection


def _one(connection, sql):
    rows = connection.execute(sql).fetchmany(2)
    _need(len(rows) == 1)
    return rows[0]


def _validate_schema(connection):
    from .field_gis import table_fields
    _need(connection.execute('PRAGMA application_id').fetchone()[0] == 0x47504B47)
    tables = {r['name'] for r in connection.execute('PRAGMA table_list') if r['schema'] == 'main' and r['type'] == 'table'}
    expected = set(table_fields(3)) | ATTRIBUTES.keys()
    _need(expected | {'gpkg_contents', 'gpkg_geometry_columns'} <= tables)
    for name, columns in REQUIRED_COLUMNS.items():
        actual = {r['name'] for r in connection.execute('SELECT name FROM pragma_table_info(?)', (name,))}
        _need(set(columns.split()) <= actual)
    records = {r['table_name']: r['data_type'] for r in connection.execute('SELECT table_name, data_type FROM gpkg_contents')}
    _need(records == {name: 'features' if name in FEATURES else 'attributes' for name in expected})
    geometry = {r['table_name']: tuple(r)[1:] for r in connection.execute(
        'SELECT table_name, srs_id, z, m FROM gpkg_geometry_columns')}
    _need(geometry == dict.fromkeys(FEATURES, (-1, 1, 0)))
    for name, keys in UNIQUE_KEYS.items():
        indexes = connection.execute('SELECT name FROM pragma_index_list(?) WHERE "unique" = 1 AND partial = 0', (name,))
        unique = {tuple(r['name'] for r in connection.execute('SELECT name FROM pragma_index_info(?) ORDER BY seqno', (index['name'],)))
                  for index in indexes}
        _need(all(key in unique for key in keys))
    _need(connection.execute('PRAGMA integrity_check(1)').fetchone()[0] == 'ok'
          and connection.execute('PRAGMA foreign_key_check').fetchone() is None, 'corrupt')
    return len(records), len(geometry)


def _validate_rows(connection, channels, section1_bytes):
    counts = {}
    for table, channel, columns in (
        ('gameplay_events', 'gameplay', 'instruction_offset'),
        ('dialogue_references', 'dialogue', 'instruction_offset'),
        ('conditional_controls', 'conditional', 'root_offset if_offset successor target_offset'),
        ('script_events', None, 'instruction_offset'),
    ):
        # Identifiers are internal constants. SQL values, including section size, are bound.
        invalid = ' OR '.join(f"typeof({col}) <> 'integer' OR {col} < 0 OR {col} >= ?" for col in columns.split())
        _need(connection.execute(f'SELECT 1 FROM {table} WHERE {invalid} LIMIT 1', (section1_bytes,) * len(columns.split())).fetchone() is None)
        count = connection.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
        counts[table] = count
        if channel:
            status, declared = channels[channel]
            known = status in ('available', 'complete')
            _need((declared == count) if known else (declared is None and count == 0))
    _need(sum(counts.values()) <= 250_000)
    _need(connection.execute("""SELECT 1 FROM script_events
        WHERE reachable IS NULL OR reachable NOT IN (0, 1) OR kind IS NULL
           OR kind NOT IN ('MESSAGE','ASK','STITM','SMTRA','BATTLE','REQ','REQSW','REQEW') LIMIT 1""").fetchone() is None)
    _need(connection.execute("""SELECT 1 FROM dialogue_references AS d LEFT JOIN script_events AS e USING (instruction_offset)
        WHERE e.kind IS NULL OR d.kind IS NOT e.kind OR d.kind NOT IN ('MESSAGE','ASK')
           OR typeof(d.text_id) <> 'integer' OR d.text_id NOT BETWEEN 0 AND 255
           OR d.text_status IS NULL OR d.text_status NOT IN ('valid','unavailable') LIMIT 1""").fetchone() is None)
    _need(connection.execute("""SELECT 1 FROM gameplay_events AS g LEFT JOIN script_events AS e USING (instruction_offset)
        WHERE g.kind IS NULL OR g.kind NOT IN ('item','materia','battle','flag')
           OR g.status IS NULL OR g.status NOT IN ('static','unknown')
           OR (g.kind <> 'flag' AND e.kind IS NOT CASE g.kind WHEN 'item' THEN 'STITM' WHEN 'materia' THEN 'SMTRA' ELSE 'BATTLE' END)
        LIMIT 1""").fetchone() is None)
    _need(connection.execute("""SELECT 1 FROM conditional_controls AS c LEFT JOIN script_events AS e ON e.instruction_offset = c.target_offset
        WHERE e.instruction_offset IS NULL OR c.is_standard IS NOT 1 OR c.is_strong IS NULL OR c.is_strong NOT IN (0,1)
           OR c.is_core IS NULL OR c.is_core NOT IN (0,1) OR c.is_core > c.is_strong LIMIT 1""").fetchone() is None)
    if not any(channels[role][0] == 'available' for role in ('dialogue', 'gameplay')):
        _need(counts['script_events'] == 0)


def _source_identity(root, scene, sources, channels):
    context = scene['context']
    identities = {'manifest': scene['manifest_hash'], 'archive': context['sources'][context['archive']],
                  'maplist': context['sources']['maplist'], 'section5': hashlib.sha256(scene['raw']).hexdigest()}
    lengths = {}
    if channels['interaction'][0] == 'available':
        interaction, _ = read_interaction(scene)
        for section in ('1', '8'):
            identities['section' + section] = interaction[f'section{section}SHA256']
            lengths[section] = interaction[f'section{section}Bytes']
    for role in ('dialogue', 'script', 'gameplay'):
        if channels[role][0] != 'available':
            continue
        meta, _ = read_cfg_metadata(root / FILES[role])
        candidates = meta['field']['scenes'] if role == 'gameplay' else meta['scenes']
        selected = [r for r in candidates if r['fieldId'] == scene['id']]
        _need(len(selected) == 1 and selected[0]['name'] == scene['name'], 'source_mismatch')
        selected = selected[0]
        for name in ('member', 'section1', 'section5', 'section8'):
            key = name + 'SHA256'
            if key in selected and selected[key] is not None:
                value = selected[key]
                _need(identities.setdefault(name, value) == value, 'source_mismatch')
        if role == 'gameplay':
            _need(lengths.setdefault('1', selected['section1Bytes']) == selected['section1Bytes'], 'source_mismatch')
    if '1' not in lengths and 'section1' in identities:
        # The dialogue/script-only export spans identify Section 1 but omit its length.
        lengths['1'] = 65536
    for role in ('manifest', 'archive', 'maplist', 'member', 'section1', 'section5', 'section8'):
        asset, digest, size, rev, status = sources[role]
        expected = identities.get(role)
        _need(digest == expected and status == ('available' if expected else 'unavailable')
              and asset == (context['archive'] if role == 'archive' else None)
              and size is None and rev is None, 'source_mismatch')
    return identities, lengths


@dataclass(frozen=True)
class Binding:
    field_id: int
    name: str
    table_count: int
    feature_count: int
    channels: dict
    assets: tuple
    watched: tuple

    def status(self):
        from .field_gis import SCHEMA
        return dict(available=True, status='available', schema=SCHEMA, version=3,
                    fieldId=self.field_id, fieldName=self.name, coordinateSpace='FieldLocal', readOnly=True,
                    tableCount=self.table_count, spatialLayerCount=self.feature_count,
                    channels=self.channels, sourceMatched=True, requiredAssets=self.assets)


def _validate(connection, root, manifest):
    from .field_gis import SCHEMA
    table_count, features = _validate_schema(connection)
    meta = _one(connection, """SELECT schema, version, field_id, field_name, coordinate_space,
        source_file, source_sha256, maplist_sha256, context_version, walkmesh_version,
        section5_sha256, triangle_count, access_count, interaction_version, interaction_sha256,
        section1_sha256, section8_sha256, section1_bytes, section8_bytes FROM field_metadata""")
    field_id, name = meta['field_id'], meta['field_name']
    _need((meta['schema'], meta['version'], meta['coordinate_space'], meta['walkmesh_version']) ==
          (SCHEMA, 3, 'FieldLocal', 1) and type(field_id) is int and 0 <= field_id <= 65535
          and isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9_-]{1,32}', name))
    run = _one(connection, """SELECT field_id, field_name, protocol, protocol_version, decoder, revision,
        workspace_sha256, status, complete FROM analysis_runs""")
    _need((run['field_id'], run['field_name'], run['protocol'], run['protocol_version'], run['revision']) ==
          (field_id, name, PROTOCOL, 1, REVISION) and run['status'] in RUN_STATES
          and run['complete'] == int(run['status'] == 'complete'))
    channels = {r[0]: (r[1], r[2]) for r in connection.execute('SELECT channel, status, row_count FROM analysis_status')}
    _need(set(VISIBLE_CHANNELS) <= channels.keys() and all(channels[role][0] in ('available', 'unavailable') for role in FILES)
          and channels['conditional'][0] == run['status'])
    _need(all(channels[role][0] == 'available' for role in ('walkmesh', 'context')))
    _need(run['status'] != 'complete' or all(channels[role][0] == 'available' for role in ('dialogue', 'gameplay')))
    sources = {r[0]: tuple(r)[1:] for r in connection.execute(
        'SELECT role, asset, sha256, byte_count, revision, status FROM evidence_sources')}
    _need(set(sources) == set(FILES) | {'manifest', 'archive', 'maplist', 'member', 'section1', 'section5', 'section8'}
          and all(digest is None or isinstance(digest, str) and HASH.fullmatch(digest) for _, digest, *_ in sources.values()))
    try:
        scene = load_field(root, name, protect_workspace=False)
        records = {r['filename']: r for r in manifest['assets']}
        _need(scene['id'] == field_id and scene['name'] == name and scene['assets'] == records
              and scene['manifest_hash'] == run['workspace_sha256'] and context_decoder(scene['context']) == run['decoder']
              and meta['context_version'] == scene['context']['version']
              and meta['triangle_count'] == scene['stats']['triangles'] and meta['access_count'] == 3 * meta['triangle_count'], 'source_mismatch')
        watched = [root / 'gaia-workspace.json']
        required = []
        for role, filename in FILES.items():
            record = records.get(filename, {})
            digest, size, rev = (record.get(key) for key in ('sha256', 'bytes', 'generator_version'))
            status = channels[role][0]
            _need(sources[role] == (filename, digest, size, rev, status) and (status != 'available' or bool(digest)), 'source_mismatch')
            if status == 'available':
                path = root / filename
                reject_links(path)
                _need(path.stat().st_size == size, 'source_mismatch')
                with path.open('rb') as stream:
                    _need(hashlib.file_digest(stream, 'sha256').hexdigest() == digest, 'source_mismatch')
                watched.append(path)
                required.append(ASSET_IDS[role])
        tokens = tuple((path, _stat(path)) for path in watched)
        identities, lengths = _source_identity(root, scene, sources, channels)
        _need((meta['source_file'], meta['source_sha256'], meta['maplist_sha256'], meta['section5_sha256']) ==
              (scene['context']['archive'], identities['archive'], identities['maplist'], identities['section5']), 'source_mismatch')
        if channels['interaction'][0] == 'available':
            _need(tuple(meta[k] for k in ('interaction_version', 'interaction_sha256', 'section1_sha256', 'section8_sha256', 'section1_bytes', 'section8_bytes')) ==
                  (scene['interaction_version'], sources['interaction'][1], identities['section1'], identities['section8'], lengths['1'], lengths['8']), 'source_mismatch')
        else:
            _need(all(meta[k] is None for k in ('interaction_version', 'interaction_sha256', 'section1_sha256', 'section8_sha256', 'section1_bytes', 'section8_bytes')), 'source_mismatch')
        _need(all(_stat(path) == token for path, token in tokens), 'source_mismatch')
    except (OSError, KeyError, ValueError) as error:
        if isinstance(error, Unavailable):
            raise
        raise Unavailable('source_mismatch') from error
    _validate_rows(connection, channels, lengths.get('1', 0))
    return Binding(field_id, name, table_count, features, {role: channels[role][0] for role in VISIBLE_CHANNELS}, tuple(required), tokens)


def inactive(code):
    return dict(available=False, status=code, readOnly=True, sourceMatched=False)


class LocalDatabase:
    def __init__(self, path, root, manifest):
        self._path = None
        self._root = Path(root)
        self._binding = None
        self._state = 'not_configured'
        self._lock = Lock()
        self._slots = BoundedSemaphore(4)
        if path is None:
            return
        from .field_gis import fieldlocal_path
        try:
            self._path = fieldlocal_path(path)
            _need(not self._path.is_relative_to(self._root), 'invalid_path')
        except (OSError, ValueError):
            self._state = 'invalid_path'
            return
        try:
            self._initial = _fingerprint(self._path)
            with _connect(self._path, 3.0) as connection:
                self._binding = _validate(connection, self._root, manifest)
            self._state = 'available'
            self._check_current()
        except Unavailable as error:
            self._state = error.code
        except OSError:
            self._state = 'database_unavailable'
        except sqlite3.DatabaseError:
            self._state = 'corrupt'

    def _check_current(self):
        if self._state != 'available':
            return False
        from .field_gis import fieldlocal_path
        try:
            _need(_fingerprint(fieldlocal_path(self._path)) == self._initial, 'database_changed')
        except (OSError, ValueError):
            self._state = 'database_changed'
            return False
        try:
            _need(not os.path.lexists(self._root / JOURNAL) and all(
                _stat(path) == token for path, token in self._binding.watched), 'source_mismatch')
        except (OSError, ValueError):
            self._state = 'source_mismatch'
            return False
        return True

    def request(self, kind, raw):
        try:
            if kind == 'status':
                if raw:
                    raise ValueError('invalid_parameters')
                params = None
            else:
                params = query_parameters(kind, raw)
        except ValueError:
            return 400, inactive('invalid_parameters')
        if not self._slots.acquire(blocking=False):
            return 503, inactive('busy')
        try:
            with self._lock:
                if not self._check_current():
                    return (200 if kind == 'status' else 409), inactive(self._state)
                binding = self._binding
            if kind == 'status':
                return 200, binding.status()
            if kind == 'controls' and binding.channels['conditional'] != 'complete':
                return 409, inactive('conditional_' + binding.channels['conditional'])
            if kind == 'events':
                role = 'gameplay' if params['kind'] in ('STITM', 'SMTRA', 'BATTLE') else 'dialogue'
                if params['kind'] is None:
                    available = any(binding.channels[r] == 'available' for r in ('gameplay', 'dialogue'))
                else:
                    available = binding.channels[role] == 'available'
                if not available:
                    return 409, inactive('channel_unavailable')
            try:
                with _connect(self._path, 0.5) as connection:
                    sql, count = QUERIES[kind]
                    connection.execute('BEGIN')
                    total = connection.execute(count, params).fetchone()[0]
                    rows = [dict(row) for row in connection.execute(sql, params)]
            except sqlite3.DatabaseError as error:
                with self._lock:
                    if not self._check_current():
                        return 409, inactive(self._state)
                timeout = getattr(error, 'sqlite_errorcode', None) in (sqlite3.SQLITE_INTERRUPT, sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED)
                return (503, inactive('query_timeout')) if timeout else (500, inactive('query_failed'))
            with self._lock:
                if not self._check_current():
                    return 409, inactive(self._state)
            limit, offset = params['limit'], params['offset']
            return 200, dict(status='complete', queryType=kind, fieldId=binding.field_id, rows=rows,
                             total=total, limit=limit, offset=offset, hasMore=offset+len(rows)<total,
                             coverage='partial' if kind == 'events' and any(
                                 binding.channels[r] != 'available' for r in ('dialogue', 'gameplay')) and params['kind'] is None else 'complete')
        finally:
            self._slots.release()


def response_bytes(code, payload):
    result = json.dumps(payload, separators=(',', ':'), ensure_ascii=True).encode()
    if len(result) > MAX_RESPONSE:
        return 500, b'{"available":false,"status":"response_limit","readOnly":true,"sourceMatched":false}'
    return code, result
