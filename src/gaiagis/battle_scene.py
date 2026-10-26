"""Bounded read-only PC Battle Scene and kernel-name evidence.

Format references: ff7tools ff7/scene.py (ISC), Scarlet SceneEditor
Scene/Enemy/EnemyLocation.cs (MS-PL), and FFNx ff7/battle + kernel.cpp
(GPL-3.0). This is an independent parser, not an imported implementation.
Only fixed identities, formation references, western names and basic stats
are interpreted. AI, combat behavior and boss classification stay unknown.
"""
# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import hashlib
import struct
import zlib

from .lzss import FormatError, decompress

BLOCK = 8192
SCENE_SIZE = 7808
MAX_RESOURCE = 4_000_000


def digest(data):
    return hashlib.sha256(data).hexdigest()


def western_name(data):
    """The western font is shifted Mac Roman with documented FF7 symbols.

    Unknown control bytes are explicit hex, never guessed character names.
    This is not a Japanese font decoder or a translation service.
    """
    overrides = {0x80: '♥', 0x84: '↔', 0x85: '→', 0x86: '♪', 0x88: 'α'}
    text = []
    partial = False
    for value in data:
        if value == 255:
            return ''.join(text).strip(), 'partial' if partial else 'decoded'
        if value < 224:
            text.append(overrides.get(value, bytes([value + 32]).decode('mac_roman')))
        else:
            text.append(f'[{value:02X}]')
            partial = True
    return ''.join(text).strip(), 'partial'


def _gzip(data, expected):
    inflater = zlib.decompressobj(31)
    try:
        decoded = inflater.decompress(data, expected + 1)
    except zlib.error as exc:
        raise FormatError('Battle gzip stream') from exc
    if len(decoded) != expected or not inflater.eof or inflater.unconsumed_tail:
        raise FormatError('Battle gzip size/boundary')
    if inflater.unused_data and any(v != 255 for v in inflater.unused_data):
        raise FormatError('Battle gzip trailing bytes')
    return decoded


def scene_records(data):
    """Read physical block order; unused slots never renumber later scenes."""
    if not data or len(data) > MAX_RESOURCE or len(data) % BLOCK:
        raise FormatError('Scene archive block size')
    scenes = []
    formations = []
    enemies = []
    failures = []
    scene_id = 0
    for block_at in range(0, len(data), BLOCK):
        block = data[block_at:block_at + BLOCK]
        words = struct.unpack_from('<16I', block)
        pointers = []
        unused = False
        for word in words:
            if word == 0xffffffff:
                unused = True
                continue
            if unused or word < 16 or word * 4 >= BLOCK or pointers and word * 4 <= pointers[-1]:
                raise FormatError('Scene pointer table')
            pointers.append(word * 4)
        if not pointers:
            if any(value != 255 for value in block[64:]):
                raise FormatError('Scene empty block payload')
            continue
        if pointers[0] != 64:
            raise FormatError('Scene first pointer')
        boundaries = [*pointers, BLOCK]
        for start, end in zip(boundaries, boundaries[1:]):
            if scene_id >= 256:
                raise FormatError('Scene ID budget')
            try:
                raw = _gzip(block[start:end], SCENE_SIZE)
            except FormatError as exc:
                failures.append(dict(id=scene_id, reason=str(exc)))
                scene_id += 1
                continue
            ids = struct.unpack_from('<3H', raw)
            available = [value for value in ids if value != 65535]
            if len(set(available)) != len(available):
                failures.append(dict(id=scene_id, reason='duplicate_scene_enemy_id'))
                scene_id += 1
                continue
            scenes.append(dict(id=scene_id, sha256=digest(raw), enemyIds=available,
                               block=block_at // BLOCK, compressedOffset=block_at + start,
                               compressedBytes=end-start, decodedBytes=SCENE_SIZE))
            for slot, enemy_id in enumerate(ids):
                if enemy_id == 65535:
                    continue
                at = 0x298 + slot * 184
                name, name_status = western_name(raw[at:at+32])
                enemies.append(dict(id=enemy_id, sceneId=scene_id, slot=slot,
                                    name=name, nameStatus=name_status,
                                    rawNameHex=raw[at:at+32].hex(), level=raw[at+32],
                                    hp=struct.unpack_from('<I', raw, at+164)[0],
                                    mp=struct.unpack_from('<H', raw, at+156)[0], sourceOffset=at))
            for slot in range(4):
                at = 0x118 + slot * 96
                references = [struct.unpack_from('<H', raw, at + i * 16)[0] for i in range(6)]
                references = [value for value in references if value != 65535]
                status = 'empty' if not references else 'parsed' if all(value in available for value in references) else 'unresolved_enemy'
                formations.append(dict(id=scene_id*4+slot, battleId=scene_id*4+slot,
                                       sceneId=scene_id, slot=slot, enemyIds=references,
                                       status=status, sourceOffset=at))
            scene_id += 1
    return dict(scenes=scenes, formations=formations, enemies=enemies,
                failures=failures, sceneSlots=scene_id)


def _kernel_chunks(data):
    """Kernel 1 has size/decoded-size/type headers around gzip streams."""
    chunks = []
    at = 0
    while at + 6 <= len(data):
        packed, expected, kind = struct.unpack_from('<3H', data, at)
        at += 6
        if not packed or not expected or at + packed > len(data) or len(chunks) >= 27:
            raise FormatError('Kernel chunk bounds')
        decoded = _gzip(data[at:at+packed], expected)
        chunks.append(decoded)
        at += packed
    if any(data[at:]):
        raise FormatError('Kernel trailing bytes')
    return chunks


def _kernel2_chunks(data):
    if len(data) < 4 or struct.unpack_from('<I', data)[0] != len(data)-4:
        raise FormatError('Kernel2 compressed length')
    raw = decompress(data[4:], 1_000_000)
    chunks = []
    at = 0
    while at < len(raw):
        if at + 4 > len(raw) or len(chunks) >= 18:
            raise FormatError('Kernel2 section table')
        length = struct.unpack_from('<I', raw, at)[0]
        at += 4
        if not length or at + length > len(raw):
            raise FormatError('Kernel2 section bounds')
        chunks.append(raw[at:at+length])
        at += length
    if len(chunks) != 18:
        raise FormatError('Kernel2 section count')
    return chunks


def _expand_text(data, start, end, depth=0):
    if depth > 16 or not 0 <= start < end <= len(data):
        raise FormatError('Kernel text reference bounds')
    result = bytearray()
    at = start
    while at < end:
        value = data[at]
        at += 1
        if value == 249:
            if at >= end:
                raise FormatError('Kernel text reference truncated')
            arg = data[at]
            at += 1
            reference = at - (arg & 63) - 3
            length = 4 + 2 * (arg >> 6)
            if reference < 0 or reference + length > at - 2:
                raise FormatError('Kernel text forward reference')
            fragment, terminated = _expand_text(data, reference, reference+length, depth+1)
            result.extend(fragment)
            if terminated:
                return bytes(result), True
        else:
            result.append(value)
            if value == 255:
                return bytes(result), True
        if len(result) > 1024:
            raise FormatError('Kernel name output budget')
    return bytes(result), False


def _names(data, expected, base_id=0):
    if len(data) < expected*2 or struct.unpack_from('<H', data)[0] != expected*2:
        raise FormatError('Kernel name table count')
    offsets = struct.unpack_from(f'<{expected}H', data)
    rows = []
    for i, offset in enumerate(offsets):
        if not expected*2 <= offset < len(data):
            raise FormatError('Kernel name offset')
        raw, terminated = _expand_text(data, offset, len(data))
        if not terminated:
            raise FormatError('Kernel name terminator')
        name, status = western_name(raw)
        rows.append(dict(id=base_id+i, name=name, nameStatus=status))
    return rows


def parse_battle_resources(scene_path: Path | None, kernel_path: Path | None = None,
                           kernel2_path: Path | None = None) -> dict:
    result = dict(scenes=[], formations=[], enemies=[], names=dict(items=[], materia=[]),
                  coverage={}, sources={})
    resources = {}
    for label, path in [('scene.bin', scene_path), ('kernel.bin', kernel_path), ('kernel2.bin', kernel2_path)]:
        if path is None or not Path(path).is_file():
            continue
        path = Path(path)
        if path.name.casefold() != label or path.stat().st_size > MAX_RESOURCE:
            raise FormatError('Battle resource identity/budget')
        raw = path.read_bytes()
        resources[label] = raw
        result['sources'][label] = digest(raw)
    coverage = dict(sceneStatus='unavailable', sceneSlots=0, scenes=0, failedScenes=0,
                    formations=0, nonemptyFormations=0, unresolvedFormations=0,
                    enemyRecords=0, uniqueEnemyIds=0, namesStatus='unavailable',
                    itemNames=0, materiaNames=0, unsupported=['battle_ai', 'boss_classification', 'runtime_availability'])
    if 'scene.bin' in resources:
        parsed = scene_records(resources['scene.bin'])
        for key in ('scenes', 'formations', 'enemies'):
            result[key] = parsed[key]
        coverage.update(sceneStatus='partial' if parsed['failures'] else 'parsed',
                        sceneSlots=parsed['sceneSlots'], scenes=len(parsed['scenes']),
                        failedScenes=len(parsed['failures']), formations=len(parsed['formations']),
                        nonemptyFormations=sum(bool(row['enemyIds']) for row in parsed['formations']),
                        unresolvedFormations=sum(row['status']=='unresolved_enemy' for row in parsed['formations']),
                        enemyRecords=len(parsed['enemies']), uniqueEnemyIds=len({row['id'] for row in parsed['enemies']}))
        result['failures'] = parsed['failures']
    else:
        result['failures'] = []
    chunks = None
    if 'kernel.bin' in resources:
        try:
            kernel = _kernel_chunks(resources['kernel.bin'])
            coverage['kernelSections'] = len(kernel)
            if len(kernel) == 27:
                chunks = kernel[9:]
        except FormatError:
            coverage['kernelStatus'] = 'unsupported'
    if 'kernel2.bin' in resources:
        try:
            chunks = _kernel2_chunks(resources['kernel2.bin'])
            coverage['namesSource'] = 'kernel2.bin'
        except FormatError:
            coverage['kernel2Status'] = 'unsupported'
    if chunks is not None:
        try:
            items = []
            for section, count, base in [(10,128,0),(11,128,128),(12,32,256),(13,32,288)]:
                items.extend(_names(chunks[section], count, base))
            materia = _names(chunks[14], 96)
            result['names'] = dict(items=items, materia=materia)
            coverage.update(namesStatus='parsed', itemNames=len(items), materiaNames=len(materia),
                            namesSource=coverage.get('namesSource','kernel.bin'))
        except FormatError:
            coverage['namesStatus'] = 'partial'
    result['coverage'] = coverage
    return result
