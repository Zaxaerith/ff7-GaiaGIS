"""Bounded, read-only Field inventory grants and battle/flag script evidence.

Format layouts were checked against Makou Reactor 2452025714 Opcode.h/.cpp.
The shared Field decoder supplies instruction boundaries and static CFG only.
No inventory mutation, script execution, chest identity or saved-flag mapping.
"""
# SPDX-License-Identifier: GPL-3.0-only
from collections import Counter, defaultdict
import hashlib
from pathlib import Path

from .dataset import archive_key
from .field_context import field_sections, parse_script
from .lgp import inventory, read_entry
from .lzss import FormatError
from .poi import parse_maplist
from .web_export import sha256

OPCODES = {0x58: ('item', 5), 0x5b: ('materia', 7), 0x70: ('battle', 4),
           0x80: ('flag', 4), 0x82: ('flag', 4), 0x83: ('flag', 4)}
MAX_WALK = 8_000_000
MAX_RECORDS = 4096


def digest(value):
    return hashlib.sha256(value).hexdigest()


def decode_gameplay_operands(raw):
    """Retain fixed-width operands and banks; never evaluate a game variable."""
    if not raw or raw[0] not in OPCODES or len(raw) != OPCODES[raw[0]][1]:
        raise FormatError('Gameplay opcode/width')
    op = raw[0]
    result = []
    def add(name, at, size, bank, *, target=False):
        result.append(dict(name=name, kind='variable' if target or bank else 'literal',
                           bank=bank, value=int.from_bytes(raw[at:at+size], 'little')))
    first, second = raw[1] >> 4, raw[1] & 15
    if op == 0x58:
        add('item', 2, 2, first); add('quantity', 4, 1, second)
    elif op == 0x5b:
        add('materia', 3, 1, first)
        for name, at, bank in [('ap0', 4, second), ('ap1', 5, raw[2] >> 4), ('ap2', 6, raw[2] & 15)]:
            add(name, at, 1, bank)
    elif op == 0x70:
        add('formation', 2, 2, second)
    else:
        add('target', 2, 1, first, target=True)
        add('value' if op == 0x80 else 'bit', 3, 1, second)
    return result


def scene_gameplay(section, field_id, name, *, member_sha256=None):
    """A partial CFG cannot produce a definite grant or battle association.

    Static means a fully decoded instruction with literal grant operands. It
    does not mean its entry is called or its conditions currently hold. Flag
    writes remain candidates, not established pickup flags.
    """
    base = dict(fieldId=field_id, name=name, memberSHA256=member_sha256,
                section1SHA256=digest(section), section1Bytes=len(section))
    try:
        script_name, _, stops, trace = parse_script(section, evidence=True)
        selected = [r for r in trace['instructions'] if r['entryReachable'] and r['opcode'] in OPCODES]
        if len(selected) > MAX_RECORDS:
            raise FormatError('Gameplay record limit')
        targets = {r['offset'] for r in selected}
        roots = defaultdict(list)
        for owner in trace['entries']:
            roots[owner['entry']].append(owner)
        owners = defaultdict(list)
        work = 0
        for entry, aliases in roots.items():
            pending = [entry]; visited = {entry}
            for pc in pending:
                work += 1
                if work > MAX_WALK:
                    raise FormatError('Gameplay CFG work limit')
                if pc in targets:
                    owners[pc].extend(aliases)
                for target in trace['successors'].get(pc, ()):
                    if target not in visited:
                        visited.add(target); pending.append(target)
        decoded_bytes = sum(r['length'] for r in trace['instructions'])
        complete = not stops and decoded_bytes == trace['codeEnd']-trace['codeStart']
        records = []
        for row in selected:
            pc, op = row['offset'], row['opcode']
            raw = section[pc:pc+row['length']]
            operands = decode_gameplay_operands(raw)
            # A bank write alone never establishes a game's pickup flag.
            static = complete and op in (0x58, 0x5b, 0x70) and all(p['kind'] == 'literal' for p in operands)
            records.append(dict(id=f'{field_id}:{pc}', kind=OPCODES[op][0], offset=pc,
                opcode=op, raw=raw.hex(), owners=owners[pc], operands=operands,
                status='static' if static else 'unknown', position=None, flagLinks=[]))
        return dict(**base, scriptName=script_name, status=('indexed' if records else 'empty') if complete else 'partial',
                    reason=None if complete else 'incomplete_cfg', records=records, stops=stops)
    except (FormatError, UnicodeError):
        return dict(**base, scriptName=None, status='unavailable', reason='invalid_script', records=[], stops=[])


def index_field_gameplay(archive: Path, context: dict) -> dict:
    """Index only exact current Field/maplist identities, without raw exports."""
    archive = Path(archive)
    source_key = archive_key(context['sources'], 'field')
    if archive.name.casefold() != source_key or sha256(archive) != context['sources'][source_key]:
        raise FormatError('Gameplay Field archive source mismatch')
    entries = {}
    for entry in inventory(archive)['entries']:
        name = entry['filename'].casefold()
        if name in entries:
            raise FormatError('Gameplay ambiguous archive member')
        entries[name] = entry
    if 'maplist' not in entries:
        raise FormatError('Gameplay maplist missing')
    maplist = read_entry(archive, entries['maplist'])
    if digest(maplist) != context['sources']['maplist']:
        raise FormatError('Gameplay maplist source mismatch')
    names = parse_maplist(maplist)
    scenes = []
    for node in context['nodes']:
        field_id, name = node['id'], node['name']
        if field_id >= len(names) or names[field_id] != name:
            raise FormatError('Gameplay maplist/Field identity mismatch')
        base = dict(fieldId=field_id, name=name, memberSHA256=None, section1SHA256=None,
                    section1Bytes=0, scriptName=None, status='unavailable', reason='missing_member', records=[], stops=[])
        entry = entries.get(name.casefold())
        if entry:
            raw = read_entry(archive, entry)
            base['memberSHA256'] = digest(raw)
            try:
                script, _ = field_sections(raw, archive=source_key, member=name)
                base = scene_gameplay(script, field_id, name, member_sha256=base['memberSHA256'])
            except (FormatError, UnicodeError):
                base['reason'] = 'invalid_sections'
        scenes.append(base)
    counts = Counter(s['status'] for s in scenes)
    records = [r for s in scenes for r in s['records']]
    kinds = Counter(r['kind'] for r in records)
    static = Counter(r['kind'] for r in records if r['status'] == 'static')
    coverage = dict(scenes=len(scenes), indexed=counts['indexed'], empty=counts['empty'],
        partial=counts['partial'], unavailable=counts['unavailable'], records=len(records),
        item=kinds['item'], materia=kinds['materia'], battle=kinds['battle'], flag=kinds['flag'],
        staticItem=static['item'], staticMateria=static['materia'], staticBattle=static['battle'],
        verifiedPickupFlags=0, verifiedPickupPoints=0, fieldLocal=0,
        sceneOnly=sum(r['kind'] in ('item', 'materia') for r in records))
    return dict(sources={source_key:context['sources'][source_key], 'maplist':digest(maplist)},
                scenes=scenes, coverage=coverage)
