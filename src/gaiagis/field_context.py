"""Private, bounded PC field identities and section-8 gateway topology.

This is not a field script interpreter or a spatial transform. Only identity,
gateway destinations and evidence indices leave the decompression buffer.
"""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
import json
from pathlib import Path
import struct

from .dataset import discover, child_ci
from .lgp import inventory, read_entry
from .lzss import decompress, FormatError
from .poi import parse_maplist
from .safety import output_path
from .web_export import sha256

GENERATOR_VERSION = 'field-context-2'

# Reviewed against ff7tk's pinned classic-PC module/location table. Other
# maplists still support graph browsing, but never inherit save compatibility.
PC_MAPLIST_SHA256 = 'd6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29'
SAVE_ID_CONFLICTS = frozenset({88, 89, 90, 91, 404, 526, 593, 594, 699})


def save_identity(field_id: int, maplist_hash: str) -> int | None:
    return field_id if maplist_hash == PC_MAPLIST_SHA256 and field_id not in SAVE_ID_CONFLICTS else None


def gateway_section(payload: bytes) -> bytes:
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
    return data[start + 4:start + 4 + size]


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
    nodes, edges, exits, unresolved = [], [], [], []
    for field_id, name in enumerate(names):
        if not name or name == 'dummy' or field_id in world:
            continue
        node = dict(id=field_id, name=name, status='missing', saveId=None)
        nodes.append(node)
        entry = entries.get(name.casefold())
        if not entry:
            continue
        try:
            gateways = parse_gateways(gateway_section(read_entry(archive, entry)))
        except FormatError:
            node['status'] = 'corrupt'
            unresolved.append(dict(fromField=field_id, to=None, gateway=None, reason='invalid_section'))
            continue
        node['status'] = 'available'
        node['saveId'] = save_identity(field_id, hashlib.sha256(maplist).hexdigest())
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
    poi = json.loads((directory / 'gaia-poi.json').read_text(encoding='utf8'))
    if hashlib.sha256(maplist).hexdigest() != poi['sources'].get('maplist'):
        raise FormatError('Field/POI maplist identity mismatch')
    result = dict(schema='gaiagis-field-context', version=1, coordinateSpace='FieldLocalIdentity',
                  archive='flevel.lgp', sources={**poi['sources'], 'flevel.lgp': archive_hash},
                  nodes=nodes, edges=verified, exits=exits, unresolved=unresolved,
                  bindings=entrance_bindings(poi, nodes), scriptTransitions='unverified')
    if sha256(archive) != archive_hash:
        raise RuntimeError('Field source changed during generation')
    (directory / 'gaia-field-context.json').write_text(json.dumps(result, separators=(',', ':'), sort_keys=True) + '\n', encoding='utf8')
    return result
