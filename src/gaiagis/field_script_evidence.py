"""Private, optional, bounded Field background/Palette script evidence.

This indexes verified instruction boundaries and static entry reachability. It
does not execute scripts, read variables, or infer initial background state.
Algorithm/operand references are documented in workspace-format.md; no external
implementation is incorporated.
"""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
from .constants import GAME_DATA_LANGUAGES
from .dataset import field_source_keys, same_dependencies
import re
import struct
import time
import zlib

from .field_context import field_sections, parse_script
from .lzss import FormatError

FILENAME = 'gaia-field-script-evidence.bin'
GENERATOR_VERSION = 'field-script-evidence-1'
MAGIC = b'GAIASCR\0'
SCHEMA = 'gaiagis-field-script-evidence'
# These limits are independently measured against the complete archive. They
# are not inherited from the image/texture transport budget.
MAX_PACK = 4_000_000
MAX_HEADER = 512_000
MAX_SCENE = 512_000
MAX_RECORDS = 1024
MAX_ENTRIES = 2112
MAX_OWNERS = 16384
MAX_WALK = 8_000_000
OPCODES = {0x2c: ('BGPDH', 5), 0x2d: ('BGSCR', 7), 0xdf: ('MPPAL', 11),
    0xe0: ('BGON', 4), 0xe1: ('BGOFF', 4), 0xe2: ('BGROL', 3),
    0xe3: ('BGROL2', 3), 0xe4: ('BGCLR', 3), 0xe5: ('STPAL', 5),
    0xe6: ('LDPAL', 5), 0xe7: ('CPPAL', 5), 0xe8: ('RTPAL', 7),
    0xe9: ('ADPAL', 10), 0xea: ('MPPAL2', 10), 0xeb: ('STPLS', 5),
    0xec: ('LDPLS', 5), 0xed: ('CPPAL2', 8), 0xee: ('RTPAL2', 8),
    0xef: ('ADPAL2', 11)}


class EvidenceLimitError(FormatError):
    """Application indexing budget reached, not an invalid original resource."""


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encode_json(value):
    return json.dumps(value, separators=(',', ':'), sort_keys=True, ensure_ascii=True).encode('utf8')


def decode_record(raw):
    """Interpret only fixed byte layouts, retaining banks and unknown semantics.

    Offsets here are relative to the instruction. Palette buffer positions are
    deliberately not promoted to Section-4 Palette IDs. Runtime effects remain
    unknown even when every operand is a literal.
    """
    if not raw or raw[0] not in OPCODES or len(raw) != OPCODES[raw[0]][1]:
        raise ValueError('Script evidence opcode/width')
    op = raw[0]
    operands = []
    unknown = ['runtime_execution_unknown']
    association = dict(group=None, stateBit=None, layer=None, palette=None)
    def bank(at, nibble):
        return raw[at] >> 4 if nibble == 0 else raw[at] & 15
    def add(name, offset, size=1, signed=False, source=None, ambiguous=False):
        b = None if source is None else bank(*source)
        value = int.from_bytes(raw[offset:offset+size], 'little', signed=signed)
        kind = 'unknown' if ambiguous else 'variable' if b else 'literal'
        operands.append(dict(name=name, offset=offset, bytes=size, signed=signed,
                             bank=b, value=value, kind=kind))
        return value if kind == 'literal' else None
    if op in (0xe0, 0xe1):
        group = add('group', 2, source=(1, 0))
        bit = add('stateBit', 3, source=(1, 1))
        association['group'] = group
        association['stateBit'] = bit if bit is not None and bit < 8 else None
        if bit is not None and bit >= 8:
            unknown.append('state_bit_outside_tile_mask')
    elif op in (0xe2, 0xe3, 0xe4):
        association['group'] = add('group', 2, source=(1, 1))
        if op != 0xe4:
            unknown.append('state_rotation_not_spatial_scroll')
    elif op in (0x2c, 0x2d):
        layer = add('layer', 2)
        association['layer'] = layer if layer in (2, 3) else None
        if association['layer'] is None:
            unknown.append('layer_operand_outside_research_layers')
        if op == 0x2c:
            add('depth', 3, 2, True, (1, 0), ambiguous=bool(raw[1]))
            if raw[1]:
                unknown.append('bgpdh_bank_selection_conflict')
        else:
            add('xOperand', 3, 2, True, (1, 0))
            add('yOperand', 5, 2, True, (1, 1))
            unknown.append('scroll_units_timing_and_initial_position_unknown')
    elif op in (0xe5, 0xe6, 0xe7):
        names = {0xe5: ('paletteIdOperand', 'bufferPosition'),
                 0xe6: ('bufferPosition', 'paletteIdOperand'),
                 0xe7: ('sourceBuffer', 'targetBuffer')}[op]
        for i, name in enumerate(names):
            add(name, 2+i, source=(1, i))
        add('countMinusOne', 4)
    elif op == 0xe8:
        add('sourceBuffer', 3, source=(1, 0))
        add('targetBuffer', 4, source=(1, 1))
        add('startOperand', 5, source=(2, 1))
        add('endOperand', 6)
    elif op in (0xe9, 0xea):
        for i, name in enumerate(('sourceBuffer', 'targetBuffer', 'blueOperand', 'greenOperand', 'redOperand')):
            add(name, 4+i, source=(1+i//2, i % 2))
        add('countMinusOne', 9)
        unknown.append('palette_arithmetic_not_evaluated')
    elif op in (0xeb, 0xec):
        names = ('paletteIdOperand', 'bufferPosition') if op == 0xeb else ('bufferPosition', 'paletteIdOperand')
        for i, name in enumerate((*names, 'startOperand', 'countMinusOne')):
            add(name, 1+i)
    elif op in (0xed, 0xee):
        add('sourceBufferOperand', 3)
        add('targetBufferOperand', 4)
        add('sourcePositionOperand', 5, source=(1, 0))
        add('targetPositionOperand', 6, source=(1, 1))
        add('countOperand' if op == 0xed else 'startOperand', 7, source=(2, 1))
        unknown.append('extended_palette_semantics_unconfirmed')
    elif op in (0xdf, 0xef):
        add('sourceBufferOperand', 4)
        add('targetBufferOperand', 5)
        for i, name in enumerate(('startOperand', 'blueOperand', 'greenOperand', 'redOperand')):
            add(name, 6+i, source=(1+i//2, i % 2))
        add('countOperand', 10, source=(3, 1))
        unknown.append('palette_arithmetic_not_evaluated')
    if op >= 0xe5 or op == 0xdf:
        unknown.append('palette_work_buffer_not_section4_identity')
    if any(o['kind'] == 'variable' for o in operands):
        unknown.append('runtime_variable_not_evaluated')
    return dict(operands=operands, association=association,
                confidence='corroborated', runtime='unknown', unknown=unknown)


def complement(start, end, intervals):
    """Sorted half-open ranges absent from a bounded code interval."""
    result = []
    cursor = start
    for lo, hi in sorted(intervals):
        if lo > cursor:
            result.append(dict(offset=cursor, bytes=lo-cursor))
        cursor = max(cursor, hi)
    if cursor < end:
        result.append(dict(offset=cursor, bytes=end-cursor))
    return result


def script_index(section):
    """Select target opcodes only after the shared decoder verifies their CFG."""
    _, _, stops, trace = parse_script(section, evidence=True)
    entries = trace['entries']
    selected = [r for r in trace['instructions'] if r['entryReachable'] and r['opcode'] in OPCODES]
    if len(selected) > MAX_RECORDS:
        raise EvidenceLimitError('Script evidence record budget')
    targets = {r['offset'] for r in selected} | {r['offset'] for r in stops}
    owners = defaultdict(list)
    roots = defaultdict(list)
    for i, identity in enumerate(entries):
        roots[identity['entry']].append(i)
    work = total_owners = 0
    # Alias slots share traversal. The cap bounds worst-case hostile cyclic CFGs.
    for entry, aliases in roots.items():
        pending = [entry]
        visited = {entry}
        for pc in pending:
            work += 1
            if work > MAX_WALK:
                raise EvidenceLimitError('Script evidence CFG work budget')
            if pc in targets:
                owners[pc].extend(aliases)
                total_owners += len(aliases)
                if total_owners > MAX_OWNERS:
                    raise EvidenceLimitError('Script evidence owner budget')
            for target in trace['successors'].get(pc, ()):
                if target not in visited:
                    visited.add(target)
                    pending.append(target)
    records = []
    for row in selected:
        pc, length = row['offset'], row['length']
        raw = section[pc:pc+length]
        membership = sorted(owners[pc])
        if not membership:
            raise FormatError('Script evidence missing entry')
        records.append(dict(offset=pc, length=length, opcode=row['opcode'], raw=raw.hex(),
                            owners=membership, entryReachable=True, **decode_record(raw)))
    for row in stops:
        row['owners'] = sorted(owners[row['offset']])
    all_intervals = [(r['offset'], r['offset']+r['length']) for r in trace['instructions']]
    reachable = [r for r in trace['instructions'] if r['entryReachable']]
    reach_intervals = [(r['offset'], r['offset']+r['length']) for r in reachable]
    uncovered = complement(trace['codeStart'], trace['codeEnd'], all_intervals)
    incomplete = bool(stops or uncovered)
    return dict(status=('partial' if records else 'limited') if incomplete else ('indexed' if records else 'empty'),
        reason='bounded_cfg_stops' if incomplete else None,
        codeStart=trace['codeStart'], codeEnd=trace['codeEnd'], entries=entries,
        decodedInstructions=len(all_intervals), reachableInstructions=len(reachable),
        decodedBytes=sum(hi-lo for lo, hi in all_intervals),
        reachableBytes=sum(hi-lo for lo, hi in reach_intervals), uncovered=uncovered,
        unreachable=complement(trace['codeStart'], trace['codeEnd'], reach_intervals),
        records=records, stops=stops)


def scene_evidence(script, section8, field_id, name):
    """No visual parsing: a rejected Palette cannot be repaired by script bytes."""
    try:
        index = script_index(script)
    except EvidenceLimitError:
        # Limits describe this application's work budget. Refuse the candidate
        # rather than mislabel a valid source as an invalid-source index.
        raise
    except (FormatError, UnicodeError):
        index = dict(status='invalid_source', reason='invalid_script', codeStart=0, codeEnd=0,
            entries=[], decodedInstructions=0, reachableInstructions=0, decodedBytes=0,
            reachableBytes=0, uncovered=[], unreachable=[], records=[],
            stops=[dict(offset=None, opcode=None, reason='invalid_script', entryReachable=False, owners=[])])
    return dict(fieldId=field_id, name=name, section1Bytes=len(script), section8Bytes=len(section8),
                section1SHA256=digest(script), section8SHA256=digest(section8), **index)


def _int(value, lo=0, hi=65535):
    if type(value) is not int or not lo <= value <= hi:
        raise ValueError('Script evidence integer range')
    return value


def _shape(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys.split()):
        raise ValueError('Script evidence object shape')
    return value


def _list(value, size):
    if not isinstance(value, list) or len(value) > size:
        raise ValueError('Script evidence list budget')
    return value


def _hash(value):
    if not isinstance(value, str) or not re.fullmatch('[a-f0-9]{64}', value):
        raise ValueError('Script evidence fingerprint')
    return value


def _decode(data):
    text = bytes(data).decode('utf8') if isinstance(data, (bytes, bytearray)) else data
    # JSON's implementation recursion strategy varies by Python version. Bound
    # structural depth before parsing instead of relying on RecursionError.
    depth = 0; quoted = escaped = False
    for char in text:
        if quoted:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
        elif char in '{[':
            depth += 1
            if depth > 32:
                raise ValueError('Script evidence JSON nesting')
        elif char in '}]':
            depth -= 1
    def pairs(rows):
        value = {}
        for key, item in rows:
            if key in value:
                raise ValueError('Script evidence duplicate JSON key')
            value[key] = item
        return value
    try:
        return json.loads(text, object_pairs_hook=pairs,
            parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Script evidence nonfinite JSON')))
    except RecursionError as error:
        raise ValueError('Script evidence JSON nesting') from error


def validate_scene(value, span):
    """Validate schema and rederive every target's operands from bounded bytes."""
    v = _shape(value, 'fieldId name section1Bytes section8Bytes section1SHA256 section8SHA256 status reason codeStart codeEnd entries decodedInstructions reachableInstructions decodedBytes reachableBytes uncovered unreachable records stops')
    for key in ('fieldId', 'name', 'section1SHA256', 'section8SHA256'):
        if v[key] != span[key]:
            raise ValueError('Script evidence scene/source identity')
    _int(v['fieldId'])
    if not isinstance(v['name'], str) or not re.fullmatch('[A-Za-z0-9_-]{1,20}', v['name']):
        raise ValueError('Script evidence Field name')
    _hash(v['section1SHA256']); _hash(v['section8SHA256'])
    _int(v['section1Bytes'], 32, 8_000_000)
    if type(v['section8Bytes']) is not int or v['section8Bytes'] not in (536, 740):
        raise ValueError('Script evidence Section 8 size')
    start = _int(v['codeStart'], 0 if v['status'] == 'invalid_source' else 32)
    end = _int(v['codeEnd'], start, min(65535, v['section1Bytes']))
    entries = _list(v['entries'], MAX_ENTRIES)
    previous = None
    for e in entries:
        _shape(e, 'actor name slot entry kind')
        _int(e['actor'], 0, 63); _int(e['slot'], 0, 31); _int(e['entry'], start, end-1)
        if e['kind'] not in ('table', 'main') or e['kind'] == 'main' and e['slot'] != 0:
            raise ValueError('Script evidence entry kind')
        if e['name'] is not None and (not isinstance(e['name'], str) or not re.fullmatch('[\x20-\x7e]{0,8}', e['name'])):
            raise ValueError('Script evidence actor name')
        order = (e['actor'], e['kind'] == 'main', e['slot'])
        if previous is not None and order <= previous:
            raise ValueError('Script evidence duplicate/unordered entry')
        previous = order
    decoded = _int(v['decodedInstructions']); reachable = _int(v['reachableInstructions'], 0, decoded)
    decoded_bytes = _int(v['decodedBytes'], decoded, end-start)
    reachable_bytes = _int(v['reachableBytes'], reachable, decoded_bytes)
    def ranges(rows):
        cursor = start; total = 0
        for r in _list(rows, 65535):
            _shape(r, 'offset bytes')
            lo = _int(r['offset'], start, end-1); size = _int(r['bytes'], 1, end-lo)
            if lo < cursor:
                raise ValueError('Script evidence overlapping ranges')
            cursor = lo+size; total += size
        return total
    if ranges(v['uncovered']) != end-start-decoded_bytes or ranges(v['unreachable']) != end-start-reachable_bytes:
        raise ValueError('Script evidence coverage accounting')
    if any(not any(outer['offset'] <= gap['offset'] and gap['bytes'] <= outer['offset']+outer['bytes']-gap['offset'] for outer in v['unreachable']) for gap in v['uncovered']):
        raise ValueError('Script evidence reachable/decoded coverage')
    owner_count = 0
    def membership(rows, required=False):
        nonlocal owner_count
        ids = _list(rows, MAX_ENTRIES); owner_count += len(ids)
        if owner_count > MAX_OWNERS or required and not ids or ids != sorted(set(ids)):
            raise ValueError('Script evidence owner membership')
        for i in ids:
            _int(i, 0, len(entries)-1)
    records = _list(v['records'], MAX_RECORDS)
    if len(records) > reachable:
        raise ValueError('Script evidence target count')
    previous = start; target_bytes = 0
    for r in records:
        _shape(r, 'offset length opcode raw owners entryReachable operands association confidence runtime unknown')
        op = _int(r['opcode'], 0, 255)
        if op not in OPCODES or r['length'] != OPCODES[op][1] or type(r['length']) is not int:
            raise ValueError('Script evidence target opcode/length')
        pc = _int(r['offset'], start, end-r['length'])
        if pc < previous or r['entryReachable'] is not True:
            raise ValueError('Script evidence target boundary/order')
        previous = pc+r['length']; target_bytes += r['length']
        membership(r['owners'], required=True)
        if not isinstance(r['raw'], str) or not re.fullmatch('[a-f0-9]{'+str(2*r['length'])+'}', r['raw']):
            raise ValueError('Script evidence raw instruction')
        raw = bytes.fromhex(r['raw'])
        if raw[0] != op or any(encode_json(r[k]) != encode_json(val) for k, val in decode_record(raw).items()):
            raise ValueError('Script evidence operand/association mismatch')
        if any(pc < g['offset']+g['bytes'] and g['offset'] < previous for g in [*v['uncovered'], *v['unreachable']]):
            raise ValueError('Script evidence target in uncovered/unreachable range')
    if target_bytes > reachable_bytes:
        raise ValueError('Script evidence target byte count')
    stop_ids = set()
    for r in _list(v['stops'], 4096):
        _shape(r, 'offset opcode reason entryReachable owners')
        if type(r['entryReachable']) is not bool or r['reason'] not in ('unsupported_opcode', 'unverified_boundary', 'invalid_script'):
            raise ValueError('Script evidence stop')
        membership(r['owners'], required=r['entryReachable'])
        if not r['entryReachable'] and r['owners']:
            raise ValueError('Script evidence unreachable stop ownership')
        if r['reason'] == 'invalid_script':
            if r['offset'] is not None or r['opcode'] is not None or v['records'] or r['entryReachable'] or r['owners']:
                raise ValueError('Script evidence invalid source stop')
        else:
            pc = _int(r['offset'], start, end-1); _int(r['opcode'], 0, 255)
            if not any(g['offset'] <= pc < g['offset']+g['bytes'] for g in v['uncovered']):
                raise ValueError('Script evidence stop outside uncovered range')
        if r['offset'] in stop_ids:
            raise ValueError('Script evidence duplicate stop')
        stop_ids.add(r['offset'])
    incomplete = bool(v['stops'] or v['uncovered'])
    expected = ('partial' if v['records'] else 'limited') if incomplete else ('indexed' if v['records'] else 'empty')
    if v['status'] == 'invalid_source':
        if v['reason'] != 'invalid_script' or start or end or entries or decoded or reachable or len(v['stops']) != 1 or v['stops'][0]['reason'] != 'invalid_script':
            raise ValueError('Script evidence invalid-source accounting')
    elif v['status'] != expected or v['reason'] != ('bounded_cfg_stops' if incomplete else None):
        raise ValueError('Script evidence index status')
    return v


def _inflate(compressed, span):
    decoder = zlib.decompressobj()
    try:
        raw = decoder.decompress(compressed, MAX_SCENE+1)
    except zlib.error as error:
        raise ValueError('Script evidence compressed data') from error
    if len(raw) != span['rawBytes'] or decoder.unused_data or decoder.unconsumed_tail or not decoder.eof or digest(raw) != span['sha256']:
        raise ValueError('Script evidence decompression/checksum')
    return validate_scene(_decode(raw), span)


def validate_evidence(payload, sources, *, context_sha256=None, context=None, field_id=None):
    """Strict bounded readback; optionally return only one decoded scene."""
    if not 16 < len(payload) <= MAX_PACK or payload[:8] != MAGIC or struct.unpack_from('<I', payload, 8)[0] != 1:
        raise ValueError('Script evidence transport')
    length = struct.unpack_from('<I', payload, 12)[0]
    if not 0 < length <= MAX_HEADER or length > len(payload)-16:
        raise ValueError('Script evidence metadata budget')
    meta = _shape(_decode(payload[16:16+length]), 'schema version generator_revision sources contextSHA256 scenes')
    if meta['schema'] != SCHEMA or type(meta['version']) is not int or meta['version'] != 1 or meta['generator_revision'] != GENERATOR_VERSION:
        raise ValueError('Script evidence schema/generator')
    _shape(meta['sources'], ' '.join(field_source_keys(meta['sources']))); _hash(meta['contextSHA256'])
    if any(_hash(v) != sources.get(k) for k, v in meta['sources'].items()) or context_sha256 is not None and meta['contextSHA256'] != context_sha256:
        raise ValueError('Script evidence Context/source mismatch')
    nodes = {n['id']: n for n in context['nodes'] if n['status'] == 'available'} if context is not None else None
    cursor = 0; seen = set(); chosen = None
    for span in _list(meta['scenes'], 2000):
        _shape(span, 'fieldId name section1SHA256 section8SHA256 offset bytes rawBytes sha256')
        fid = _int(span['fieldId']); _hash(span['sha256']); _hash(span['section1SHA256']); _hash(span['section8SHA256'])
        if fid in seen or not isinstance(span['name'], str) or not re.fullmatch('[A-Za-z0-9_-]{1,20}', span['name']):
            raise ValueError('Script evidence duplicate Field identity')
        seen.add(fid)
        if nodes is not None and (fid not in nodes or nodes[fid]['name'] != span['name']):
            raise ValueError('Script evidence Field Context identity')
        _int(span['rawBytes'], 1, MAX_SCENE); size = _int(span['bytes'], 1, MAX_SCENE)
        if _int(span['offset'], 0, MAX_PACK) != cursor or size > len(payload)-16-length-cursor:
            raise ValueError('Script evidence compressed range')
        if field_id is None or field_id == fid:
            value = _inflate(payload[16+length+cursor:16+length+cursor+size], span)
            if field_id is not None:
                chosen = value
        cursor += size
    if 16+length+cursor != len(payload) or nodes is not None and seen != set(nodes):
        raise ValueError('Script evidence trailing/missing Field data')
    if field_id is not None:
        if chosen is None:
            raise ValueError('Script evidence selected Field absent')
        return chosen
    return meta


def audit_output(path):
    """Only this tool's report may be replaced, inside the active QA root."""
    from .safety import output_path, WORKSPACE_ROOT
    from .clean_output import reject_links
    path = Path(path)
    reject_links(path)
    target = output_path(path)
    if not target.is_relative_to(WORKSPACE_ROOT/'output/dev/current') or target.suffix != '.json':
        raise ValueError('Script evidence audit output must be active QA JSON')
    if target.exists():
        if not target.is_file() or target.stat().st_size > 4_000_000:
            raise ValueError('Script evidence audit output ownership')
        previous = _decode(target.read_bytes())
        if not isinstance(previous, dict) or previous.get('schema') != 'gaiagis-field-script-evidence-audit' or type(previous.get('version')) is not int or previous.get('version') != 1:
            raise ValueError('Script evidence audit output ownership')
    return target


def encode_evidence(source, directory, *, audit_path=None, progress=None):
    """Read original input once per Field; no unrelated Workspace generation."""
    from .dataset import discover, child_ci
    from .lgp import inventory, read_entry
    from .poi import parse_maplist
    from .safety import output_path, protect_input
    from .web_export import sha256
    began = time.perf_counter(); ds=discover(source); source=ds.selected_path; directory = output_path(Path(directory))
    audit_path = audit_output(audit_path) if audit_path is not None else None
    protect_input(source)
    archive = ds.field_archive()
    if not archive:
        raise FormatError('Field archive unavailable')
    for root in (source, ds.wm_directory.resolve(), archive.resolve().parent):
        if directory.is_relative_to(root) or root.is_relative_to(directory):
            raise ValueError('Script evidence output/input overlap')
        protect_input(root)
    archive_hash = sha256(archive); entries = {}
    for entry in inventory(archive)['entries']:
        key = entry['filename'].casefold()
        if key in entries:
            raise FormatError('Ambiguous Field archive entry')
        entries[key] = entry
    if 'maplist' not in entries:
        raise FormatError('Field maplist unavailable')
    maplist = read_entry(archive, entries['maplist']); names = parse_maplist(maplist)
    sources = {ds.field_name: archive_hash, 'maplist': digest(maplist)}
    context_path = directory/'gaia-field-context.json'
    if not context_path.is_file() or context_path.stat().st_size > 8_000_000:
        raise ValueError('Script evidence requires existing Field Context')
    context_bytes = context_path.read_bytes(); context = _decode(context_bytes)
    if not isinstance(context, dict) or context.get('schema') != 'gaiagis-field-context' or context.get('version') not in (3,4,5) or not isinstance(context.get('sources'), dict) or any(context['sources'].get(k) != v for k, v in sources.items()):
        raise ValueError('Script evidence Field Context source mismatch')
    spans = []; pool = bytearray(); audits = []; counts = Counter(); opcodes = Counter(); max_scene = max_records = max_entries = max_owners = 0
    for node in _list(context.get('nodes'), 2000):
        if not isinstance(node, dict):
            raise ValueError('Script evidence Field Context node')
        if node.get('status') != 'available':
            continue
        fid = _int(node['id']); name = node['name']
        if fid >= len(names) or name != names[fid] or name.casefold() not in entries or any(s['fieldId'] == fid for s in spans):
            raise ValueError('Script evidence maplist identity mismatch')
        script, section8 = field_sections(read_entry(archive, entries[name.casefold()]), archive=ds.field_name, member=name)
        value = scene_evidence(script, section8, fid, name)
        raw = encode_json(value); compressed = zlib.compress(raw, 9)
        if len(raw) > MAX_SCENE or len(compressed) > MAX_SCENE:
            raise FormatError('Script evidence scene budget')
        span = dict(fieldId=fid, name=name, section1SHA256=value['section1SHA256'], section8SHA256=value['section8SHA256'], offset=len(pool), bytes=len(compressed), rawBytes=len(raw), sha256=digest(raw))
        validate_scene(value, span)
        spans.append(span); pool.extend(compressed)
        if len(pool) > MAX_PACK:
            raise FormatError('Script evidence pack budget')
        scene_ops = Counter(OPCODES[r['opcode']][0] for r in value['records']); opcodes.update(scene_ops)
        scene_stops = Counter(r['reason'] for r in value['stops'])
        scene_owners = sum(len(r['owners']) for r in [*value['records'], *value['stops']])
        max_scene = max(max_scene, len(raw)); max_records = max(max_records, len(value['records'])); max_entries = max(max_entries, len(value['entries'])); max_owners = max(max_owners, scene_owners)
        counts[value['status']] += 1; counts['records'] += len(value['records']); counts['entries'] += len(value['entries']); counts['decodedInstructions'] += value['decodedInstructions']; counts['reachableInstructions'] += value['reachableInstructions']; counts['stops'] += len(value['stops'])
        audits.append(dict(fieldId=fid, name=name, status=value['status'], reason=value['reason'], section1SHA256=value['section1SHA256'], section8SHA256=value['section8SHA256'], entries=len(value['entries']), uniqueEntries=len({e['entry'] for e in value['entries']}), decodedInstructions=value['decodedInstructions'], reachableInstructions=value['reachableInstructions'], records=len(value['records']), opcode=dict(scene_ops), stops=dict(scene_stops), uncovered=value['uncovered'], unreachable=value['unreachable'], associations=dict(Counter(k for r in value['records'] for k, v in r['association'].items() if v is not None)), rawBytes=len(raw), bytes=len(compressed)))
        if progress:
            progress(len(spans), name)
    meta = dict(schema=SCHEMA, version=1, generator_revision=GENERATOR_VERSION, sources=sources, contextSHA256=digest(context_bytes), scenes=spans)
    encoded = encode_json(meta)
    payload = MAGIC+struct.pack('<II', 1, len(encoded))+encoded+pool
    if len(encoded) > MAX_HEADER or len(payload) > MAX_PACK:
        raise FormatError('Script evidence metadata/pack budget')
    if sha256(archive) != archive_hash or context_path.read_bytes() != context_bytes:
        raise RuntimeError('Script evidence source changed during generation')
    report = dict(schema='gaiagis-field-script-evidence-audit', version=1, fields=len(spans), counts=dict(counts), opcode=dict(opcodes), bytes=len(payload), headerBytes=16+len(encoded), maxSceneBytes=max_scene, maxRecords=max_records, maxEntries=max_entries, maxOwners=max_owners, sources=sources, contextSHA256=digest(context_bytes), seconds=time.perf_counter()-began, scenes=audits)
    if audit_path:
        from .field_interaction import atomic_write
        # Check again at the final write boundary, after potentially long input
        # reads. An unrelated file appearing during generation is never replaced.
        audit_path = audit_output(audit_path)
        atomic_write(audit_path, (json.dumps(report, indent=2)+'\n').encode('utf8'))
    return payload, report


def build_field_script_evidence(source, directory):
    """Initial Workspace exporter; Manifest publication belongs to its caller."""
    from .safety import output_path
    from .field_interaction import atomic_write
    payload, report = encode_evidence(source, directory)
    context = _decode((Path(directory)/'gaia-field-context.json').read_bytes())
    validate_evidence(payload, report['sources'], context_sha256=report['contextSHA256'], context=context)
    atomic_write(output_path(Path(directory)/FILENAME), payload)
    return {k: v for k, v in report.items() if k != 'scenes'}


def update_workspace(source, directory, *, audit_path=None):
    """Publish just the optional resource and Manifest, retaining a recovery pair."""
    from .output_lifecycle import OutputRun
    with OutputRun('field-script-evidence') as run:
        return _update_workspace(source, directory, audit_path=audit_path, staging=run.path)


def _update_workspace(source, directory, *, audit_path, staging):
    from .safety import output_path
    from .local import server_manifest
    from .build_workspace import ASSETS
    from .field_interaction import atomic_write
    from ._version import __version__
    directory = output_path(Path(directory)); manifest = server_manifest(directory)
    manifest_path = output_path(directory/'gaia-workspace.json'); pack_path = output_path(directory/FILENAME)
    old_manifest = manifest_path.read_bytes(); old_pack = pack_path.read_bytes() if pack_path.is_file() else None
    if _decode(old_manifest) != manifest:
        raise RuntimeError('Script evidence Manifest changed during validation')
    payload, report = encode_evidence(source, directory, audit_path=audit_path)
    context_bytes = (directory/'gaia-field-context.json').read_bytes()
    if digest(context_bytes) != report['contextSHA256']:
        raise RuntimeError('Script evidence Context changed during generation')
    context = _decode(context_bytes)
    validate_evidence(payload, report['sources'], context_sha256=report['contextSHA256'], context=context)
    if not same_dependencies(manifest.get('sources', {}),report['sources'],['@field']):
        raise ValueError('Script evidence Workspace source mismatch')
    kind, map_id, dependencies = ASSETS[FILENAME]
    entry = dict(filename=FILENAME, type=kind, mapId=map_id, sha256=digest(payload), bytes=len(payload), dependencies=dependencies, generator_version=GENERATOR_VERSION)
    manifest['assets'] = [r for r in manifest['assets'] if r['filename'] != FILENAME]+[entry]
    manifest['tool_version'] = __version__
    candidate = (json.dumps(manifest, sort_keys=True, indent=2)+'\n').encode('utf8')
    # OutputRun exclusively owns this random task directory; a pre-existing
    # research file at a predictable .build candidate path is never replaced.
    staged = output_path(staging/'candidate.bin')
    atomic_write(staged, payload)
    validate_evidence(staged.read_bytes(), report['sources'], context_sha256=report['contextSHA256'], context=context)
    backup = output_path(directory/'.build/script-evidence-recovery'/digest(old_manifest))
    if backup.exists():
        if (backup/'gaia-workspace.json').read_bytes() != old_manifest or (backup/FILENAME).is_file() != (old_pack is not None) or old_pack is not None and (backup/FILENAME).read_bytes() != old_pack:
            raise ValueError('Script evidence recovery identity conflict')
    else:
        # A failed backup write stays in the owned OutputRun, never as an
        # incomplete durable recovery pair that would block a later retry.
        prepared = output_path(staging/'recovery')
        prepared.mkdir()
        atomic_write(prepared/'gaia-workspace.json', old_manifest)
        if old_pack is not None:
            atomic_write(prepared/FILENAME, old_pack)
        backup.parent.mkdir(parents=True, exist_ok=True)
        prepared.rename(backup)
    if manifest_path.read_bytes() != old_manifest or (pack_path.read_bytes() if pack_path.is_file() else None) != old_pack or (directory/'gaia-field-context.json').read_bytes() != context_bytes:
        raise RuntimeError('Script evidence Workspace changed during generation')
    try:
        atomic_write(pack_path, payload); atomic_write(manifest_path, candidate)
    except BaseException:
        if old_pack is None:
            pack_path.unlink(missing_ok=True)
        else:
            atomic_write(pack_path, old_pack)
        atomic_write(manifest_path, old_manifest)
        raise
    staged.unlink(missing_ok=True)
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--audit', type=Path, help='Private audit JSON in the workspace')
    parser.add_argument('--audit-only', action='store_true', help='Verify a candidate without updating Workspace files')
    parser.add_argument('--game-language',choices=GAME_DATA_LANGUAGES,default='en',help='FF7 data language; independent of UI language')
    args = parser.parse_args(argv)
    from .dataset import discover
    args.source=discover(args.source,args.game_language)
    try:
        if args.audit_only:
            payload, report = encode_evidence(args.source, args.workspace, audit_path=args.audit)
            validate_evidence(payload, report['sources'], context_sha256=report['contextSHA256'])
        else:
            report = update_workspace(args.source, args.workspace, audit_path=args.audit)
        print(json.dumps({k: v for k, v in report.items() if k != 'scenes'}, indent=2))
        return 0
    except (ValueError, OSError, KeyError, TypeError, FormatError, struct.error) as error:
        parser.exit(1, f'Field script evidence generation rejected: {error}\n')


if __name__ == '__main__':
    raise SystemExit(main())
