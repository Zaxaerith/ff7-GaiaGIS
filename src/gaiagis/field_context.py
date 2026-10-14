"""Private, bounded PC field identity, topology and Section-5 walkmesh.

This is not a field script interpreter or a global spatial transform. Identity
and evidence stay compact; raw local walkmesh sections enter one private pack.
"""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
from collections import deque
from fractions import Fraction
import json
from pathlib import Path
import struct

from .dataset import discover, child_ci
from .lgp import inventory, read_entry
from .lzss import decompress, FormatError
from .poi import parse_maplist, parse_field_table
from .safety import output_path
from .web_export import sha256

GENERATOR_VERSION = 'field-context-6'
WALKMESH_REVISION = 'field-walkmesh-1'
MAX_WALKMESH_TRIANGLES = 65535  # 0xffff is reserved for a blocked edge.


def parse_walkmesh(section: bytes, *, geometry=False) -> dict | tuple:
    """Validate raw Section 5; preserve order, padding and directed edge access.

    XYZ are signed local components, not GaiaGame or metres. The fourth
    component is retained even when it differs from the documented padding.
    No reciprocal links, winding or degenerate triangles are repaired.
    """
    if len(section) < 4:
        raise FormatError('Truncated Field walkmesh count')
    count = struct.unpack_from('<I', section)[0]
    if count > MAX_WALKMESH_TRIANGLES or len(section) != 4 + count * 30:
        raise FormatError('Field walkmesh count/size limit')
    vertices = list(struct.iter_unpack('<12h', section[4:4 + count * 24]))
    access = list(struct.iter_unpack('<3H', section[4 + count * 24:]))
    if any(target != 0xffff and target >= count for row in access for target in row):
        raise FormatError('Field walkmesh adjacency outside triangle pool')
    stats = dict(blocked=0, accessible=0, asymmetric=0, edgeMismatch=0,
                 selfLinks=0, degenerate=0, degenerateXY=0, paddingVariants=0)
    geometry_points = []
    for i, (v, links) in enumerate(zip(vertices, access)):
        points = [v[j:j+3] for j in (0, 4, 8)]
        if geometry:
            geometry_points.append(tuple(points))
        a, b = [tuple(points[k][j]-points[0][j] for j in range(3)) for k in (1, 2)]
        cross = (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
        stats['degenerate'] += cross == (0, 0, 0)
        stats['degenerateXY'] += cross[2] == 0
        stats['paddingVariants'] += sum(v[j] != v[2] for j in (3, 7, 11))
        for edge, target in enumerate(links):
            if target == 0xffff:
                stats['blocked'] += 1
                continue
            stats['accessible'] += 1
            stats['asymmetric'] += i not in access[target]
            stats['selfLinks'] += target == i
            other = vertices[target]
            other_points = [other[j:j+3] for j in (0, 4, 8)]
            segment = {points[edge], points[(edge+1) % 3]}
            stats['edgeMismatch'] += not any(segment == {other_points[j], other_points[(j+1) % 3]} for j in range(3))
    result = dict(triangles=count, **stats)
    return (result, geometry_points) if geometry else result

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


def parse_script(section: bytes, *, interactions=False):
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
    successors, main_entries = {}, {}

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
    for actor, pc in enumerate(entries[::32]):
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
                    main_entries[actor] = next_pc
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
            if interactions:successors.setdefault(pc, []).append(target)
        if op not in (0x10, 0x11, 0x12, 0x13) and next_pc < end:
            queue.append(next_pc)
            if interactions:successors.setdefault(pc, []).append(next_pc)
    if not interactions:
        return name, list(jumps.values()), list(unknown.values())
    # An optional evidence view of this same CFG. No byte-pattern search, VM,
    # guessed widths, or inference that an entry is actually called at runtime.
    selected = {pc for pc in seen if pc in decoded and decoded[pc][0] in (0xd0, 0xd1, 0xd3)}
    owners, entry_owners = {pc: [] for pc in selected}, {}
    for actor in range(actors):
        raw_name=section[32+actor*8:40+actor*8].split(b'\0')[0]
        actor_name=raw_name.decode('ascii') if all(32<=v<127 for v in raw_name) else None
        for slot, entry in enumerate(entries[actor*32:(actor+1)*32]):
            if entry<end:entry_owners.setdefault(entry, []).append(dict(actor=actor,name=actor_name,slot=slot,entry=entry,kind='table'))
        if actor in main_entries:
            entry=main_entries[actor];entry_owners.setdefault(entry, []).append(dict(actor=actor,name=actor_name,slot=0,entry=entry,kind='main'))
    for entry, identities in entry_owners.items():
        reached={entry};pending=[entry]
        for pc in pending:
            if pc in owners:owners[pc].extend(identities)
            for target in successors.get(pc, []):
                if target not in reached:reached.add(target);pending.append(target)
    records=[]
    for pc in sorted(selected):
        opcode,next_pc=decoded[pc];raw=section[pc:next_pc]
        record=dict(opcode=opcode,offset=pc,raw=raw.hex(),owners=owners[pc],entryReachable=True)
        if not record['owners']:raise FormatError('Interaction has no verified script entry')
        if opcode==0xd0:
            record.update(a=list(struct.unpack_from('<3h',raw,1)),b=list(struct.unpack_from('<3h',raw,7)),static=True)
        elif opcode==0xd1:record.update(switch=raw[1])
        else:
            banks=[n for byte in raw[1:4] for n in (byte>>4,byte&15)]
            operands=list(struct.unpack_from('<6h',raw,4));record.update(banks=banks,operands=operands,static=not any(banks))
            if record['static']:record.update(a=operands[:3],b=operands[3:])
        records.append(record)
    lines=[r for r in records if r['opcode']==0xd0]
    for record in records:
        if record['opcode']==0xd0:continue
        actors_set={o['actor'] for o in record['owners']}
        record['lineOffsets']=[r['offset'] for r in lines if actors_set.intersection(o['actor'] for o in r['owners'])]
    stops=[dict(row,opcode=section[row['offset']],entryReachable=row['offset'] in seen) for row in unknown.values()]
    return name,list(jumps.values()),stops,records


def save_identity(field_id: int, maplist_hash: str) -> int | None:
    return field_id if maplist_hash == PC_MAPLIST_SHA256 and field_id not in SAVE_ID_CONFLICTS else None


def field_sections(payload: bytes, *, walkmesh=False, visual=False) -> tuple:
    if len(payload) < 4 or struct.unpack_from('<I', payload)[0] != len(payload) - 4:
        raise FormatError('Field compressed length')
    data = decompress(payload[4:], max_output=8_000_000)
    if len(data) < 42 or struct.unpack_from('<HI', data) != (0, 9):
        raise FormatError('Field section header')
    offsets = struct.unpack_from('<9I', data, 6)
    # Only Section 5/6 pointers may be isolated in the optional mesh path.
    # Script/gateway pointers keep their original strict bounds.
    required = tuple(offsets[i] for i in (0, 1, 2, 3, 6, 7, 8)) if walkmesh else offsets
    if required[0] < 42 or any(a >= b for a, b in zip(required, required[1:])) or required[-1] + 4 > len(data):
        raise FormatError('Field section bounds')
    start = offsets[7]
    size = struct.unpack_from('<I', data, start)[0]
    if size not in (536, 740) or start + 4 + size != offsets[8]:
        raise FormatError('Field gateway section size')
    script_start = offsets[0]
    script_size = struct.unpack_from('<I', data, script_start)[0]
    if script_start + 4 + script_size != offsets[1]:
        raise FormatError('Field script section size')
    result = (data[script_start+4:script_start+4+script_size], data[start + 4:start + 4 + size])
    if visual:
        parts = []
        for i in (1, 3, 8):
            at = offsets[i]
            length = struct.unpack_from('<I', data, at)[0]
            end = offsets[i+1] if i < 8 else len(data)
            section_end = at + 4 + length
            if section_end != end and not (i == 8 and data[section_end:end] == b'FINAL FANTASY7'):
                raise FormatError('Field visual section size')
            parts.append(data[at+4:section_end])
        return tuple(parts)
    if not walkmesh:
        return result
    # A damaged Section 5 is isolated from identity/script/gateway evidence.
    at = offsets[4]
    valid_span = offsets[3] + 4 <= at and at + 4 <= offsets[5] < offsets[6]
    local_size = struct.unpack_from('<I', data, at)[0] if valid_span else -1
    local = data[at+4:at+4+local_size] if local_size >= 0 and at+4+local_size == offsets[5] else None
    return (*result, local)


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
            a = struct.unpack_from('<6h2hHH4B', section, offset)
            records.append(dict(to=destination, gateway=gateway, offset=offset,
                                sourceA=list(a[:3]), sourceB=list(a[3:6]),
                                targetXY=list(a[6:8]), targetTriangle=a[8], direction=list(a[10:])))
    return records


def _normal(points):
    a, b, c = points
    u, v = ([p[i]-a[i] for i in range(3)] for p in (b, c))
    return (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])


def _weights(points, point, axes=(0, 1)):
    x, y = axes
    a, b, c = points
    den = (b[y]-c[y])*(a[x]-c[x])+(c[x]-b[x])*(a[y]-c[y])
    if not den:
        return None
    u = Fraction((b[y]-c[y])*(point[x]-c[x])+(c[x]-b[x])*(point[y]-c[y]), den)
    v = Fraction((c[y]-a[y])*(point[x]-c[x])+(a[x]-c[x])*(point[y]-c[y]), den)
    return u, v, 1-u-v


def _clip(points, a, b, axes=(0, 1)):
    wa, wb = _weights(points, a, axes), _weights(points, b, axes)
    if wa is None:
        # A vertical surface projects to a segment, not an empty XY set.
        x, y = axes
        cross = lambda u, v: u[0]*v[1]-u[1]*v[0]
        r = (b[x]-a[x], b[y]-a[y])
        spans = []
        for i, p in enumerate(points):
            q = points[(i+1) % 3]
            s, delta = (q[x]-p[x], q[y]-p[y]), (p[x]-a[x], p[y]-a[y])
            den = cross(r, s)
            if den:
                t, u = Fraction(cross(delta, s), den), Fraction(cross(delta, r), den)
                if 0 <= t <= 1 and 0 <= u <= 1:
                    spans.append((t, t))
            elif r == (0, 0):
                if cross(s, delta) == 0 and all(min(p[k], q[k]) <= a[k] <= max(p[k], q[k]) for k in axes):
                    spans.append((Fraction(0), Fraction(1)))
            elif cross(delta, r) == 0:
                k = x if r[0] else y
                t, u = Fraction(p[k]-a[k], b[k]-a[k]), Fraction(q[k]-a[k], b[k]-a[k])
                lo, hi = max(0, min(t, u)), min(1, max(t, u))
                if lo <= hi:
                    spans.append((lo, hi))
        return (min(s[0] for s in spans), max(s[1] for s in spans)) if spans else None
    lo, hi = Fraction(0), Fraction(1)
    for u, v in zip(wa, wb):
        d = v-u
        if d > 0:
            lo = max(lo, -u/d)
        elif d < 0:
            hi = min(hi, -u/d)
        elif u < 0:
            return None
    return (lo, hi) if lo <= hi else None


def validate_local_point(points, triangle, xy):
    """Exact XY containment, retaining boundaries; no snapping or unit conversion."""
    if points is None:
        return dict(status='mesh_unavailable', derivedZ=None)
    if not 0 <= triangle < len(points):
        return dict(status='invalid_triangle', derivedZ=None)
    weights = _weights(points[triangle], xy)
    if weights is None:
        return dict(status='degenerate', derivedZ=None)
    if min(weights) < 0:
        return dict(status='outside', derivedZ=None)
    return dict(status='boundary' if min(weights) == 0 else 'inside',
                derivedZ=float(sum(w*p[2] for w, p in zip(weights, points[triangle]))))


def validate_gateway_segment(points, a, b, *, candidates=None):
    """Exact rational segment/triangle tests, including vertical triangles.

    The dominant-axis projection is used only for testing 3D containment.
    It never changes exported raw XYZ or promotes evidence to passability.
    """
    if points is None:
        return 'unknown'
    xy = surface = False
    for triangle, p in enumerate(points):
        n = _normal(p)
        if n == (0, 0, 0):
            continue
        xy |= _clip(p, a, b) is not None
        axis = max(range(3), key=lambda k: abs(n[k]))
        span = _clip(p, a, b, tuple(k for k in range(3) if k != axis))
        if span is None:
            continue
        da, db = (sum(n[k]*(q[k]-p[0][k]) for k in range(3)) for q in (a, b))
        if da == db == 0 or da != db and span[0] <= Fraction(-da, db-da) <= span[1]:
            if candidates is None:return 'surface'
            candidates.append(triangle);surface=True
    return 'surface' if surface else 'xy_only' if xy else 'disjoint'


def walkmesh_network(access, start=None, end=None):
    """Same directed Access/slot order and min-ID labels as Web WalkmeshNetwork.

    Iterative Kosaraju and BFS, O(V+E). Shared vertices never create edges.
    """
    n=len(access)
    if n>MAX_WALKMESH_TRIANGLES or any(len(row)!=3 or any(type(t) is not int or t!=65535 and not 0<=t<n for t in row) for row in access):
        raise FormatError('Invalid network Access')
    for value in (start,end):
        if value is not None and (type(value) is not int or not 0<=value<n):raise ValueError('Invalid Triangle ID')
    if end is not None and start is None:raise ValueError('Path requires a start triangle')
    outgoing=[[t for t in row if t!=65535] for row in access];incoming=[[] for _ in range(n)]
    for i,row in enumerate(outgoing):
        for target in row:incoming[target].append(i)
    def components(order, neighbors):
        labels=[-1]*n;groups=[]
        for i in order:
            if labels[i]!=-1:continue
            group=[];stack=[i];labels[i]=len(groups)
            while stack:
                at=stack.pop();group.append(at)
                for target in neighbors(at):
                    if labels[target]==-1:labels[target]=labels[i];stack.append(target)
            groups.append(group)
        remap={};normalized=[];result=[]
        for i,old in enumerate(labels):
            if old not in remap:remap[old]=len(normalized);normalized.append([])
            label=remap[old];result.append(label);normalized[label].append(i)
        return dict(groups=normalized,labels=result)
    wcc=components(range(n),lambda i:outgoing[i]+incoming[i]);seen=set();order=[]
    for i in range(n):
        if i in seen:continue
        seen.add(i);stack=[(i,0)]
        while stack:
            at,k=stack[-1]
            if k==len(outgoing[at]):order.append(at);stack.pop();continue
            stack[-1]=(at,k+1);target=outgoing[at][k]
            if target not in seen:seen.add(target);stack.append((target,0))
    scc=components(reversed(order),lambda i:incoming[i]);reach=None;path=None
    if start is not None:
        distance=[-1]*n;parent=[-1]*n;slot=[-1]*n;queue=deque([start]);distance[start]=0
        while queue:
            at=queue.popleft()
            for edge,target in enumerate(access[at]):
                if target==65535 or distance[target]!=-1:continue
                distance[target]=distance[at]+1;parent[target]=at;slot[target]=edge;queue.append(target)
        reach=dict(start=start,distance=distance,parent=parent,slot=slot)
        if end is not None:
            ids=[]
            if distance[end]!=-1:
                at=end
                while at!=-1:ids.append(at);at=parent[at]
                ids.reverse()
            path=dict(start=start,end=end,ids=ids,reason=None if ids else 'different_wcc' if wcc['labels'][start]!=wcc['labels'][end] else 'direction')
    return dict(wcc=wcc,scc=scc,isolated=[g[0] for g in wcc['groups'] if len(g)==1],reach=reach,path=path)


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
    scenes, walkmesh_data, meshes, spatial_gateways = [], bytearray(), {}, []
    for field_id, name in enumerate(names):
        if not name or name == 'dummy' or field_id in world:
            continue
        node = dict(id=field_id, name=name, status='missing', saveId=None, scriptName=None)
        nodes.append(node)
        entry = entries.get(name.casefold())
        if not entry:
            continue
        try:
            script, gateway, local = field_sections(read_entry(archive, entry), walkmesh=True)
            gateways = parse_gateways(gateway)
        except FormatError:
            node['status'] = 'corrupt'
            unresolved.append(dict(fromField=field_id, to=None, gateway=None, reason='invalid_section'))
            continue
        node['status'] = 'available'
        try:
            if local is None:
                raise FormatError('Invalid Section 5 bounds')
            stats, points = parse_walkmesh(local, geometry=True)
            if len(walkmesh_data) + len(local) > 31_000_000:
                raise FormatError('Field walkmesh pack limit')
            meshes[field_id] = points
            scenes.append(dict(fieldId=field_id, status='available', offset=len(walkmesh_data), bytes=len(local), **stats))
            walkmesh_data.extend(local)
        except FormatError:
            scenes.append(dict(fieldId=field_id, status='corrupt'))
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
            spatial_gateways.append(dict(fromField=field_id, **row))
            record = dict(fromField=field_id, to=destination, gateway=row['gateway'], offset=row['offset'])
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
    # FIELD.TBL is read independently of WM trigger coverage: preserve all 128
    # paired records, including placeholders and alternative identities.
    world_archive = ds.files['world_us.lgp']
    world_hash = sha256(world_archive)
    table_entries = [e for e in inventory(world_archive)['entries'] if e['filename'].casefold() == 'field.tbl']
    if len(table_entries) != 1:
        raise FormatError('Expected one FIELD.TBL')
    table_bytes = read_entry(world_archive, table_entries[0])
    if hashlib.sha256(table_bytes).hexdigest() != poi['sources'].get('field.tbl'):
        raise FormatError('Field/POI FIELD.TBL source mismatch')
    entrances = []
    for (entry_id, scenario), row in parse_field_table(table_bytes, names).items():
        placeholder = (row['field_name'] == 'dummy' and not any(table_bytes[row['field_table_byte_offset']:row['field_table_byte_offset']+12]))
        result_point = dict(status='placeholder', derivedZ=None) if placeholder else (
            validate_local_point(meshes.get(row['field_id']), row['field_triangle'], (row['field_x'], row['field_y']))
            if row['field_id'] in available else dict(status='missing', derivedZ=None))
        entrances.append(dict(entry=entry_id, scenario=scenario, **row, **result_point))
    for row in spatial_gateways:
        row['sourceRelation'] = validate_gateway_segment(meshes.get(row['fromField']), row['sourceA'], row['sourceB'])
        row['destination'] = (dict(status='world', derivedZ=None) if row['to'] in world else
                              validate_local_point(meshes.get(row['to']), row['targetTriangle'], row['targetXY'])
                              if row['to'] in available else dict(status='missing', derivedZ=None))
    native = []
    transitions_path = directory / 'gaia-transitions.json'
    sources = {**poi['sources'], 'flevel.lgp': archive_hash}
    if transitions_path.is_file():
        transitions = json.loads(transitions_path.read_text(encoding='utf8'))
        native = native_relations(transitions, available, sources)
        sources.update(transitions['sources'])
    result = dict(schema='gaiagis-field-context', version=3, coordinateSpace='FieldLocalIdentity',
                  archive='flevel.lgp', sources=sources,
                  nodes=nodes, edges=verified, exits=exits, unresolved=unresolved,
                  bindings=entrance_bindings(poi, nodes), scriptTransitions='bounded_mapjump',
                  scriptEdges=verified_scripts, scriptExits=script_exits, scriptUnresolved=script_unknown,
                  nativeRelations=native, entrances=entrances, gateways=spatial_gateways)
    if sha256(archive) != archive_hash or sha256(world_archive) != world_hash:
        raise RuntimeError('Field source changed during generation')
    metadata = dict(schema='gaiagis-field-walkmesh', version=1, coordinateSpace='FieldLocal',
                    generator_revision=WALKMESH_REVISION,
                    sources={'flevel.lgp': archive_hash, 'maplist': hashlib.sha256(maplist).hexdigest()}, scenes=scenes)
    encoded = json.dumps(metadata, separators=(',', ':'), sort_keys=True).encode('utf8')
    if len(encoded) > 512_000 or 16 + len(encoded) + len(walkmesh_data) > 32_000_000:
        raise FormatError('Field walkmesh metadata/pack limit')
    # One private binary owner; offsets are relative to the raw Section-5 pool.
    output_path(directory / 'gaia-field-walkmesh.bin').write_bytes(b'GAIAFLD\0' + struct.pack('<II', 1, len(encoded)) + encoded + walkmesh_data)
    output_path(directory / 'gaia-field-context.json').write_text(json.dumps(result, separators=(',', ':'), sort_keys=True) + '\n', encoding='utf8')
    return result
