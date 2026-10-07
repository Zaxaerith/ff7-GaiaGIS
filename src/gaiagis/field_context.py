"""Private, bounded PC field identities and section-8 gateway topology.

This is not a field script interpreter or a spatial transform. Only identity,
gateway destinations and evidence indices leave the decompression buffer.
"""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
from collections import deque
import json
from pathlib import Path
import struct

from .dataset import discover, child_ci
from .lgp import inventory, read_entry
from .lzss import decompress, FormatError
from .poi import parse_maplist
from .safety import output_path
from .web_export import sha256

GENERATOR_VERSION = 'field-context-4'

# Reviewed against ff7tk's pinned classic-PC module/location table. Other
# maplists still support graph browsing, but never inherit save compatibility.
PC_MAPLIST_SHA256 = 'd6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29'
SAVE_ID_CONFLICTS = frozenset({88, 89, 90, 91, 404, 526, 593, 594, 699})
SAVE_HEADER_ALIASES = {88: ('qa', 'q_1'), 89: ('qb', 'q_2'), 90: ('qc', 'q_3'), 91: ('qd', 'q_4')}

# Instruction widths are format facts, cross-checked against Makou Reactor
# 2452025714 and ff7tools 6bf1fbcec2. Zero means unsupported, never a guessed width.
# Only MAPJUMP and bounded branch semantics are interpreted; other known-width
# operands are skipped and never exported. See docs/reference/atlas.md.
_WIDTHS = tuple(map(int, '''
1 3 3 3 3 3 3 2 2 15 6 6 0 0 2 1
2 3 2 3 6 7 8 9 8 9 0 0 0 0 0 0
11 2 5 3 3 9 2 2 1 1 2 2 5 7 2 10
4 4 4 2 2 4 5 8 6 6 6 4 1 1 1 1
3 5 6 2 0 5 0 5 7 4 2 2 0 5 0 5
10 6 4 2 2 3 7 7 5 5 5 7 8 10 8 1
10 2 5 6 6 1 9 1 9 2 7 9 1 4 3 6
4 2 3 4 4 8 4 5 4 5 3 3 3 3 2 3
4 5 4 4 4 4 5 4 5 4 5 4 5 4 5 4
5 4 5 4 5 3 3 3 3 3 4 5 6 7 7 11
2 2 3 3 2 11 9 9 6 6 2 4 1 6 3 3
5 5 4 3 6 6 2 4 5 4 3 5 5 4 0 2
11 8 15 12 1 3 3 2 2 2 4 3 3 3 2 2
13 2 2 16 10 10 4 4 3 1 15 2 4 1 1 11
4 4 3 3 3 5 5 5 7 10 10 5 5 8 8 11
2 5 14 2 2 2 2 4 2 1 3 2 2 6 3 1
'''.split()))


def parse_script(section: bytes) -> tuple[str, list[dict], list[dict]]:
    """Section-1 entry-rooted static topology, not runtime availability.

    Unknown instruction width stops that branch. Overlapping instructions or
    branches into operands reject the section's entire script evidence.
    Field-local MAPJUMP spawn coordinates are deliberately not read/exported.
    """
    if len(section) < 32:
        raise FormatError('Field script header')
    version, actors, _, end, sounds = struct.unpack_from('<HBBHH', section)
    base = 32 + actors * 72 + sounds * 4
    if version != 0x502 or not 0 < actors <= 64 or not base <= end <= len(section):
        raise FormatError('Field script bounds')
    name = section[24:32].split(b'\0')[0].decode('ascii', errors='strict')
    if not name or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for c in name):
        raise FormatError('Field script name')
    entries = struct.unpack_from(f'<{actors * 32}H', section, 32 + actors * 8 + sounds * 4)
    if any(not base <= pc <= end for pc in entries):
        raise FormatError('Field script entry bounds')
    occupied, decoded, unknown, jumps = {}, {}, {}, {}

    def instruction(pc):
        if not base <= pc < end or pc in occupied and occupied[pc] != pc:
            raise FormatError('Field script branch/entry into operand or outside code')
        if pc in decoded:
            return decoded[pc]
        op = section[pc]
        size = _WIDTHS[op] if op != 0xfd else 0  # Independent references disagree on CMUSC width.
        if op == 0x0f:
            if pc + 1 >= end:
                raise FormatError('Truncated SPECIAL')
            size = {0xf5: 3, 0xf6: 6, 0xf7: 4, 0xf8: 4, 0xf9: 2, 0xfa: 2,
                    0xfb: 3, 0xfc: 3, 0xfd: 4, 0xfe: 2, 0xff: 2}.get(section[pc+1], 0)
        elif op == 0x28:
            if pc + 1 >= end or section[pc+1] < 3:
                raise FormatError('Invalid KAWAI bounds')
            size = section[pc+1]
        if not size:
            occupied[pc] = pc
            unknown[pc] = dict(offset=pc, reason='unsupported_opcode')
            return None
        if pc + size > end or any(p in occupied and occupied[p] != pc for p in range(pc, pc+size)):
            raise FormatError('Truncated/overlapping Field instruction')
        for p in range(pc, pc+size):
            occupied[p] = pc
        decoded[pc] = (op, pc + size)
        return decoded[pc]

    roots = set(pc for pc in entries if pc < end)
    # The first RET terminates each actor's initialization script; immediately
    # following it is the documented default/main script entry (no byte scan).
    for pc in entries[::32]:
        seen = set()
        while pc < end and pc not in seen:
            seen.add(pc)
            ins = instruction(pc)
            if ins is None:
                break
            op, next_pc = ins
            if op == 0:
                if next_pc < end:
                    roots.add(next_pc)
                break
            pc = next_pc
    # Establish instruction ownership before following branches. This walks
    # widths, not opcode byte patterns, and emits no transitions. Unsupported
    # widths stop the interval; only another declared entry may restart it.
    scanned = set()
    for pc in sorted({base, *roots}):
        while pc < end and pc not in scanned:
            scanned.add(pc)
            ins = instruction(pc)
            if ins is None:
                break
            pc = ins[1]
    queue, seen = deque(sorted(roots)), set()
    while queue:
        pc = queue.popleft()
        if pc in seen:
            continue
        seen.add(pc)
        if pc not in decoded and pc not in roots and pc not in unknown:
            if pc in occupied or not base <= pc < end:
                raise FormatError('Field script branch into operand or outside code')
            unknown[pc] = dict(offset=pc, reason='unverified_boundary')
            continue
        ins = instruction(pc)
        if ins is None:
            continue
        op, next_pc = ins
        if op == 0x60:
            jumps[pc] = dict(to=struct.unpack_from('<H', section, pc+1)[0], opcode=op, offset=pc)
            continue
        if op in (0, 7, 0xff):
            continue
        target = None
        if op in (0x10, 0x11, 0x12, 0x13):
            delta = section[pc+1] if op in (0x10, 0x12) else struct.unpack_from('<H', section, pc+1)[0]
            target = pc + delta + 1 if op < 0x12 else pc - delta
        elif op in (0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x30, 0x31, 0x32, 0xcb, 0xcc):
            at = 5 if op in (0x14, 0x15) else 7 if op in (0x16, 0x17, 0x18, 0x19) else 3 if op in (0x30, 0x31, 0x32) else 2
            delta = struct.unpack_from('<H', section, pc+at)[0] if op in (0x15, 0x17, 0x19) else section[pc+at]
            target = pc + at + delta
        if target is not None:
            queue.append(target)
        if op not in (0x10, 0x11, 0x12, 0x13) and next_pc < end:
            queue.append(next_pc)
    return name, list(jumps.values()), list(unknown.values())


def save_identity(field_id: int, maplist_hash: str) -> int | None:
    return field_id if maplist_hash == PC_MAPLIST_SHA256 and field_id not in SAVE_ID_CONFLICTS else None


def field_sections(payload: bytes) -> tuple[bytes, bytes]:
    if len(payload) < 4 or struct.unpack_from('<I', payload)[0] != len(payload) - 4:
        raise FormatError('Field compressed length')
    data = decompress(payload[4:], max_output=8_000_000)
    if len(data) < 42 or struct.unpack_from('<HI', data) != (0, 9):
        raise FormatError('Field section header')
    offsets = struct.unpack_from('<9I', data, 6)
    if offsets[0] < 42 or any(a >= b for a, b in zip(offsets, offsets[1:])) or offsets[-1] + 4 > len(data):
        raise FormatError('Field section bounds')
    start = offsets[7]
    size = struct.unpack_from('<I', data, start)[0]
    if size not in (536, 740) or start + 4 + size != offsets[8]:
        raise FormatError('Field gateway section size')
    script_start = offsets[0]
    script_size = struct.unpack_from('<I', data, script_start)[0]
    if script_start + 4 + script_size != offsets[1]:
        raise FormatError('Field script section size')
    return data[script_start+4:script_start+4+script_size], data[start + 4:start + 4 + size]


def gateway_section(payload: bytes) -> bytes:
    return field_sections(payload)[1]


def parse_gateways(section: bytes) -> list[dict]:
    if len(section) not in (536, 740):
        raise FormatError('Field gateway section size')
    records = []
    for gateway in range(12):
        offset = 56 + gateway * 24
        destination = struct.unpack_from('<H', section, offset + 18)[0]
        if destination != 0x7fff:
            records.append(dict(to=destination, gateway=gateway, offset=offset))
    return records


def entrance_bindings(poi: dict, nodes: list[dict]) -> list[dict]:
    by_id = {n['id']: n for n in nodes}
    result = []
    for entrance in poi['entrances']:
        node = by_id.get(entrance['field_id'])
        verified = (node and node['status'] == 'available' and node['name'] == entrance['field_name']
                    and entrance['source_kind'] == 'derived_from_entry_trigger'
                    and entrance['script_calls'] and entrance['world_map'] == 0)
        result.append(dict(entranceId=entrance['id'], locationId=entrance['location_id'],
                           fieldId=entrance['field_id'], status='verified_direct' if verified else 'unresolved'))
    return result


def native_relations(transitions: dict, available: set[int], sources: dict) -> list[dict]:
    """Borrow validated EV/FIELD.TBL identities, never its native positions.

    Conflicting constant targets cannot be resolved by selecting the first row.
    Reject such input; the optional Field payload may remain unavailable while
    the rest of the workspace retains its existing graceful fallback.
    """
    if any(sources[k] != h for k, h in transitions['sources'].items() if k in sources):
        raise FormatError('Field/transition source mismatch')
    records = {}
    for r in transitions['transitions']:
        if r['to_map'] != 'FIELD' or r['opcode'] != 0x318 or r['from_map'] not in ('WM0', 'WM2', 'WM3'):
            continue
        key = (r['from_map'], r['source_function'], r['instruction_offset'])
        entry_id, scenario = r['raw_arguments']
        record = dict(map=r['from_map'], fieldId=r['field_id'], entry=entry_id, scenario=scenario,
                      function=r['source_function'], offset=r['instruction_offset'], opcode=0x318)
        if key in records and records[key] != record:
            raise FormatError('Conflicting native Field transition targets')
        records[key] = record
    return [r for r in records.values() if r['fieldId'] in available]


def build_field_context(source: Path, directory: Path) -> dict:
    directory = output_path(directory)
    ds = discover(source)
    field = child_ci(ds.wm_directory.parent, 'field')
    archive = child_ci(field, 'flevel.lgp') if field else None
    if not archive or not archive.is_file():
        raise FormatError('Field archive unavailable')
    archive_hash = sha256(archive)
    toc = inventory(archive)['entries']
    entries = {}
    for entry in toc:
        key = entry['filename'].casefold()
        if key in entries:
            raise FormatError('Ambiguous field archive identity')
        entries[key] = entry
    if 'maplist' not in entries:
        raise FormatError('Field maplist unavailable')
    maplist = read_entry(archive, entries['maplist'])
    names = parse_maplist(maplist)
    if len(set(n.casefold() for n in names if n)) != len([n for n in names if n]):
        raise FormatError('Ambiguous field name identity')
    # World entry pseudo-fields are identities, not native WM2/WM3 maps.
    world = {i: name for i, name in enumerate(names) if name.startswith('wm') and name[2:].isdigit()}
    nodes, edges, exits, unresolved, script_edges, script_exits, script_unknown = [], [], [], [], [], [], []
    for field_id, name in enumerate(names):
        if not name or name == 'dummy' or field_id in world:
            continue
        node = dict(id=field_id, name=name, status='missing', saveId=None, scriptName=None)
        nodes.append(node)
        entry = entries.get(name.casefold())
        if not entry:
            continue
        try:
            script, gateway = field_sections(read_entry(archive, entry))
            gateways = parse_gateways(gateway)
        except FormatError:
            node['status'] = 'corrupt'
            unresolved.append(dict(fromField=field_id, to=None, gateway=None, reason='invalid_section'))
            continue
        node['status'] = 'available'
        node['saveId'] = save_identity(field_id, hashlib.sha256(maplist).hexdigest())
        try:
            script_name, jumps, unknown = parse_script(script)
            node['scriptName'] = script_name
            if hashlib.sha256(maplist).hexdigest() == PC_MAPLIST_SHA256 and SAVE_HEADER_ALIASES.get(field_id) == (name, script_name):
                node['saveId'] = field_id
            for row in jumps:
                record = dict(fromField=field_id, **row)
                if row['to'] in world:
                    script_exits.append(dict(**record, name=world[row['to']]))
                else:
                    script_edges.append(record)
            script_unknown.extend(dict(fromField=field_id, **row) for row in unknown)
        except (FormatError, UnicodeError):
            node['scriptName'] = None
            script_unknown.append(dict(fromField=field_id, offset=None, reason='invalid_script'))
        for row in gateways:
            destination = row['to']
            record = dict(fromField=field_id, **row)
            if destination in world:
                exits.append(dict(**record, name=world[destination]))
            else:
                edges.append(record)
    available = {n['id'] for n in nodes if n['status'] == 'available'}
    verified = []
    for edge in edges:
        if edge['to'] in available:
            verified.append(edge)
        else:
            unresolved.append(dict(fromField=edge['fromField'], to=edge['to'], gateway=edge['gateway'], reason='missing_destination'))
    verified_scripts = []
    for edge in script_edges:
        if edge['to'] in available:
            verified_scripts.append(edge)
        else:
            script_unknown.append(dict(fromField=edge['fromField'], offset=edge['offset'], reason='missing_destination'))
    poi = json.loads((directory / 'gaia-poi.json').read_text(encoding='utf8'))
    if hashlib.sha256(maplist).hexdigest() != poi['sources'].get('maplist'):
        raise FormatError('Field/POI maplist identity mismatch')
    native = []
    transitions_path = directory / 'gaia-transitions.json'
    sources = {**poi['sources'], 'flevel.lgp': archive_hash}
    if transitions_path.is_file():
        transitions = json.loads(transitions_path.read_text(encoding='utf8'))
        native = native_relations(transitions, available, sources)
        sources.update(transitions['sources'])
    result = dict(schema='gaiagis-field-context', version=2, coordinateSpace='FieldLocalIdentity',
                  archive='flevel.lgp', sources=sources,
                  nodes=nodes, edges=verified, exits=exits, unresolved=unresolved,
                  bindings=entrance_bindings(poi, nodes), scriptTransitions='bounded_mapjump',
                  scriptEdges=verified_scripts, scriptExits=script_exits, scriptUnresolved=script_unknown,
                  nativeRelations=native)
    if sha256(archive) != archive_hash:
        raise RuntimeError('Field source changed during generation')
    (directory / 'gaia-field-context.json').write_text(json.dumps(result, separators=(',', ':'), sort_keys=True) + '\n', encoding='utf8')
    return result
