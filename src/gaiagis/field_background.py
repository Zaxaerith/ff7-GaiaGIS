"""Bounded PC background evidence and explicit Visual transport v2.

Independent implementation; format references and uncertainties are documented in
docs/reference/workspace-format.md. No script execution or runtime-state inference.
The legacy Visual v1 codec remains separate in field_camera.py.
"""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import stat
import struct
import time
import zlib

from .lzss import FormatError
from .safety import WORKSPACE_ROOT, output_path, protect_input

GENERATOR_VERSION = 'field-visual-4'
FILENAME = 'gaia-field-visual.bin'
# Full 702-Field measurement is ~85.5 MB (v1 covered only 520). V2 alone
# permits 96 MB; per-scene 8 MB and composition 4 MP limits stay unchanged.
MAX_PACK = 96_000_000
# Measured generator-4 archive: 98,099,799 bytes, including all 32px research
# rectangles. Only this explicit profile permits 100 MB. Decoded scene (peak
# 762,856 bytes), metadata and Canvas budgets are unchanged; see format notes.
MAX_COMPOSITING_PACK = 100_000_000
MAX_SCENE = 8_000_000
MAX_PIXELS = 4_000_000
DESCRIPTOR = struct.Struct('<hhHBBIHH8BHHII')
assert DESCRIPTOR.size == 36


def digest(data):
    return hashlib.sha256(data).hexdigest()


def visual_path(path):
    """Check lexical write ancestors before resolving filesystem redirects."""
    lexical = Path(os.path.abspath(path))
    if not lexical.is_relative_to(WORKSPACE_ROOT):
        raise ValueError('Visual outputs must remain inside the workspace')
    for parent in (lexical,*lexical.parents):
        if not parent.is_relative_to(WORKSPACE_ROOT):
            break
        if parent.exists() or parent.is_symlink():
            info=parent.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info,'st_file_attributes',0)&0x400:
                raise ValueError('Visual output path is redirected')
    if output_path(lexical)!=lexical:
        raise ValueError('Visual output path is redirected')
    return lexical


def audit_output(path):
    """An audit flag cannot overwrite a Workspace, GIS project or source code."""
    path = visual_path(path)
    if not path.is_relative_to(WORKSPACE_ROOT/'output/dev/current') or path.suffix != '.json':
        raise ValueError('Visual audits must be private JSON under output/dev/current')
    if path.exists():
        if not path.is_file() or path.stat().st_size > 8_000_000:
            raise ValueError('Existing visual audit target is not an owned report')
        try:
            previous = json.loads(path.read_text(encoding='utf8'))
        except (ValueError, UnicodeError) as error:
            raise ValueError('Existing visual audit target is not an owned report') from error
        if not isinstance(previous,dict) or previous.get('schema') != 'gaiagis-field-background-audit' or previous.get('version') != 1:
            raise ValueError('Existing visual audit target is not an owned report')
    return path


class BackgroundError(FormatError):
    def __init__(self, reason, status='invalid_source', structure=None):
        super().__init__(reason)
        self.status = status
        self.structure = structure


def background_structure(palette, data):
    """Read all layers/pages before classifying support; never repair a span.

    Tile depth is retained as an unused raw operand. The referenced texture page
    supplies the actual depth (Makou BackgroundTexturesPC::depth/pixel).
    """
    def span(at, size):
        if at < 0 or size < 0 or at + size > len(data):
            raise BackgroundError('Background truncated span')
    def u16(at):
        span(at, 2)
        return struct.unpack_from('<H', data, at)[0]
    if len(data) > 8_000_000 or len(palette) > 131084:
        raise BackgroundError('Visual input budget', 'unsupported')
    if len(palette) < 12:
        raise BackgroundError('Palette header')
    total, px, py, width, count = struct.unpack_from('<I4H', palette)
    palette_problem = 'Palette count/length' if total != len(palette) or len(palette) != 12 + width * count * 2 else None
    if width != 256 or not 0 <= count <= 256:
        palette_problem = 'Unverified palette dimensions'
    span(0, 40)
    if data[5:12] != b'PALETTE' or data[36:40] != b'BACK':
        raise BackgroundError('Background header signature', 'unknown')
    if data[4] != 1:
        raise BackgroundError('Unverified background header variant', 'unknown')
    flags = list(data[12:32]); layers = []; tiles = []; at = 40
    for layer in range(4):
        if layer:
            span(at, 1); exists = data[at]
            if exists not in (0, 1):
                raise BackgroundError('Unverified background layer flag', 'unknown')
            if not exists:
                layers.append(dict(id=layer, width=0, height=0, tiles=0)); at += 1
                continue
        header = 12 if layer == 0 else 27 if layer == 1 else 21
        span(at, header)
        w, h, n = struct.unpack_from('<hhH', data, at + bool(layer))
        if w < 0 or h < 0:
            raise BackgroundError('Unverified negative layer dimensions', 'unknown')
        if w > 4096 or h > 4096 or n > 8192 or len(tiles) + n > 16384:
            raise BackgroundError('Background layer preview budget', 'unsupported')
        layers.append(dict(id=layer, width=w, height=h, tiles=n)); at += header
        span(at, n * 52)
        for tile_id in range(n):
            x, y = struct.unpack_from('<hh', data, at)
            alternate = bool(layer and data[at+26])
            tiles.append(dict(x=x, y=y, id=tile_id, layer=layer,
                size=16 if layer < 2 else 32, sourceOffset=at,
                # Each source/page/palette/depth operand is U8 followed by an
                # unused byte, not a little-endian U16 (Makou TilePC layout).
                sx=data[at + (12 if alternate else 8)],
                sy=data[at + (14 if alternate else 10)],
                texture=data[at + (32 if alternate else 30)], palette=data[at+20],
                rawDepth=data[at+34], group=data[at+24], mask=data[at+25],
                blend=data[at+26], blendType=data[at+28],
                z=u16(at+22) if layer else 4095,
                sub=struct.unpack_from('<I', data, at+36)[0]))
            at += 52
    span(at, 7)
    if data[at:at+7] != b'TEXTURE':
        raise BackgroundError('Background texture signature')
    at += 7; pages = []
    for page_id in range(42):
        exists = u16(at); at += 2
        if exists not in (0, 1):
            raise BackgroundError('Unverified texture page flag', 'unknown')
        if not exists:
            pages.append(None); continue
        big, depth = u16(at), u16(at+2); at += 4
        if big not in (0, 1) or depth not in (0, 1, 2):
            raise BackgroundError('Unverified texture page format', 'unknown')
        size = (32768, 65536, 131072)[depth]; span(at, size)
        pages.append(dict(id=page_id, big=big, depth=depth, sourceOffset=at,
                          bytes=size, pixels=data[at:at+size])); at += size
    tail = data[at:]
    structure = dict(paletteHeader=[total, px, py, width, count], flags=flags,
                     layers=layers, tiles=tiles, pages=pages, tail=tail.hex())
    # The archive footer is found inside the declared Section-9 span in some
    # original PC records; only these two exact terminal byte strings qualify.
    if tail not in (b'END', b'ENDFINAL FANTASY7'):
        raise BackgroundError('Background trailing/signature', structure=structure)
    structure['tail'] = tail.decode('ascii')
    if palette_problem:
        raise BackgroundError(palette_problem, 'unknown' if palette_problem.startswith('Unverified') else 'invalid_source', structure)
    for tile in tiles:
        page = pages[tile['texture']] if tile['texture'] < 42 else None
        if page is None or tile['sx'] + tile['size'] > 256 or tile['sy'] + tile['size'] > 256:
            raise BackgroundError('Tile texture reference', structure=structure)
        if page['depth'] < 2 and tile['palette'] >= count:
            raise BackgroundError('Tile palette reference', structure=structure)
        tile['depth'] = page['depth']
    return structure


def audit_structure(structure):
    """Aggregate evidence only, including readable structures rejected later."""
    return dict(layers=structure['layers'], tileCount=len(structure['tiles']),
        pages=[{k:v for k,v in p.items() if k!='pixels'} for p in structure['pages'] if p],
        tail=structure['tail'],
        depthOperands=dict(Counter(str((t['rawDepth'], t.get('depth'))) for t in structure['tiles'])),
        groups=dict(Counter(str((t['layer'],t['group'],t['mask'])) for t in structure['tiles'] if t['layer'])),
        blends=dict(Counter(str((t['layer'],t['blend'],t['blendType'])) for t in structure['tiles'])))


def support_code(tile, revision):
    """Generator profiles are explicit; legacy descriptors retain their meaning.

    Code 5 has pixels for an opt-in raw-position 32px experiment, never a
    validated static/runtime layer. PC16 blending and fractional modes are not
    established by the independent PC references and remain omitted.
    """
    if abs(tile['x']) > 4096 or abs(tile['y']) > 4096:
        return 4
    if revision == 'field-visual-3':
        return (2 if tile['layer'] > 1 else 1 if tile['layer'] and tile['blend'] else
                3 if tile['layer'] and bool(tile['group']) != bool(tile['mask']) else 0)
    if tile['layer'] and bool(tile['group']) != bool(tile['mask']):
        return 3
    if tile['layer'] and tile['blend'] and (tile['blend'] != 1 or tile['depth'] == 2 or tile['blendType'] not in (1, 2)):
        return 1
    return 5 if tile['layer'] > 1 else 0


def source_span(offset, length, total=MAX_SCENE):
    """Section-relative byte spans, bounded without adding untrusted operands."""
    return (type(offset) is int and type(length) is int and type(total) is int and
            0 <= total <= MAX_SCENE and 0 <= offset <= total and 0 <= length <= total-offset)


def parse_background_v2(palette, data, *, revision='field-visual-3'):
    if revision not in ('field-visual-3', GENERATOR_VERSION):
        raise ValueError('Unknown background generator')
    structure = background_structure(palette, data)
    tiles = structure['tiles']; pages = structure['pages']; used = set(); pixels = bytearray(); cache = {}; content_cache = {}
    tiles.sort(key=lambda t: (-t['z'], -t['sub'], t['layer'], t['id']))
    # Storage order is independent of descriptor/draw order. Neighbouring source
    # blocks share a deflate window without changing a single pixel value.
    storage_order = tiles if revision == 'field-visual-3' else sorted(tiles, key=lambda t: (t['texture'],t['sy'],t['sx'],t['size'],t['layer'],t['id']))
    for tile in storage_order:
        code = support_code(tile, revision)
        tile['supportCode'] = code; tile['pixelOffset'] = 0xffffffff
        if code not in (0, 5):
            continue
        size = tile['size']; page = pages[tile['texture']]
        if page['depth'] < 2:
            used.add(tile['palette'])
        key = (tile['texture'], tile['sx'], tile['sy'], size)
        if key in cache:
            tile['pixelOffset'] = cache[key]
            continue
        rectangle = bytearray()
        for row in range(size):
            start = (tile['sy'] + row) * 256 + tile['sx']
            if page['depth'] == 2:
                rectangle.extend(page['pixels'][start*2:(start+size)*2])
            elif page['depth'] == 1:
                rectangle.extend(page['pixels'][start:start+size])
            else:
                for col in range(size):
                    pos = start + col; byte = page['pixels'][pos//2]
                    rectangle.append((byte >> ((pos & 1)*4)) & 15)
        content = bytes(rectangle)
        offset = content_cache.get(content) if revision == GENERATOR_VERSION else None
        if offset is None:
            offset = len(pixels); pixels.extend(rectangle)
            content_cache[content] = offset
        tile['pixelOffset'] = cache[key] = offset
    footprint = [t for t in tiles if t['supportCode'] != 4]
    bounds = [min((t['x'] for t in footprint), default=0), min((t['y'] for t in footprint), default=0),
              max((t['x']+t['size'] for t in footprint), default=0), max((t['y']+t['size'] for t in footprint), default=0)]
    if (bounds[2]-bounds[0])*(bounds[3]-bounds[1]) > MAX_PIXELS:
        raise BackgroundError('Background pixel budget', 'unsupported')
    base = [t for t in tiles if t['layer'] == 0 or not (t['group'] or t['mask'])]
    base_count = sum(t['supportCode'] == 0 for t in base)
    status = 'unsupported' if not base_count else 'static_partial' if any(t['supportCode'] for t in base) else 'static_complete'
    refs = [dict(id=i, transparent=bool(i < 20 and structure['flags'][i])) for i in sorted(used)]
    descriptors = b''.join(DESCRIPTOR.pack(*(t[k] for k in (
        'x','y','id','layer','size','sourceOffset','sx','sy','texture','palette','depth','group','mask','blend','blendType','supportCode','z','rawDepth','sub','pixelOffset'))) for t in tiles)
    decoded = descriptors + b''.join(palette[12+i*512:12+(i+1)*512] for i in sorted(used)) + pixels
    if len(decoded) > MAX_SCENE:
        raise BackgroundError('Background decoded budget', 'unsupported')
    meta = dict(status=status, bounds=bounds, layers=structure['layers'], tileCount=len(tiles),
        supportedTileCount=sum(t['supportCode'] == 0 for t in tiles), baseTileCount=base_count,
        conditionalTileCount=sum(t['layer'] > 0 and bool(t['group'] or t['mask']) for t in tiles),
        omitted=sum(t['supportCode'] != 0 for t in tiles), pixelBytes=len(pixels), paletteRefs=refs,
        pages=[{k:v for k,v in p.items() if k != 'pixels'} for p in pages if p],
        section4SHA256=digest(palette), section9SHA256=digest(data), rawBytes=len(decoded))
    if revision == GENERATOR_VERSION:
        meta['section9Bytes'] = len(data)
    return meta, decoded, structure


def validate_visual(payload, sources=None):
    """Independent candidate readback: hashes, bounded inflation and all tiles."""
    def integer(value, lo, hi):
        return type(value) is int and lo <= value <= hi
    def shape(value, required, optional=()):
        if not isinstance(value,dict) or set(required)-value.keys() or value.keys()-set(required)-set(optional):
            raise ValueError('Visual candidate shape')
        return value
    def hash_value(value):
        return isinstance(value,str) and len(value)==64 and all(c in '0123456789abcdef' for c in value)
    if not 16 <= len(payload) <= MAX_COMPOSITING_PACK or payload[:8] != b'GAIACAM\0' or struct.unpack_from('<I',payload,8)[0] != 2:
        raise ValueError('Visual candidate header')
    length = struct.unpack_from('<I',payload,12)[0]; base = 16+length
    if not 0 < length <= 8_000_000 or base > len(payload):
        raise ValueError('Visual candidate metadata budget')
    meta = shape(json.loads(payload[16:base]), ('schema','version','generator_revision','sources','scenes'))
    if meta.get('schema') != 'gaiagis-field-visual' or meta.get('version') != 2 or meta.get('generator_revision') not in ('field-visual-3', GENERATOR_VERSION):
        raise ValueError('Visual candidate schema')
    revision = meta['generator_revision']
    if len(payload) > (MAX_COMPOSITING_PACK if revision == GENERATOR_VERSION else MAX_PACK):
        raise ValueError('Visual candidate profile budget')
    if sources is not None and meta.get('sources') != sources:
        raise ValueError('Visual candidate sources')
    shape(meta['sources'], ('flevel.lgp','maplist'))
    if not all(hash_value(v) for v in meta['sources'].values()) or not isinstance(meta['scenes'],list) or len(meta['scenes'])>2000:
        raise ValueError('Visual candidate sources/scenes')
    end = 0; seen = set()
    for scene in meta['scenes']:
        shape(scene, ('fieldId','cameras','background'), ('reason',))
        fid = scene['fieldId']
        if type(fid) is not int or not 0 <= fid <= 65535 or fid in seen:
            raise ValueError('Visual candidate Field identity')
        seen.add(fid); b = scene['background']
        payload_keys = ('bounds','layers','tileCount','supportedTileCount','baseTileCount','conditionalTileCount','omitted','pixelBytes','paletteRefs','pages','offset','bytes','rawBytes','sha256')
        shape(b, ('status',), ('reason','section4SHA256','section9SHA256',*payload_keys,*(('section9Bytes',) if revision == GENERATOR_VERSION else ())))
        section_bytes = b.get('section9Bytes', MAX_SCENE)
        if revision == GENERATOR_VERSION and 'offset' in b and not source_span(0, section_bytes):
            raise ValueError('Visual candidate source length')
        if revision == GENERATOR_VERSION and 'offset' in b and 'section9Bytes' not in b:
            raise ValueError('Visual candidate source length missing')
        if b['status'] not in ('static_complete','static_partial','unsupported','invalid_source','unknown'):
            raise ValueError('Visual candidate status')
        if 'offset' not in b:
            if any(k in b for k in payload_keys) or b['status'] not in ('unsupported','invalid_source','unknown'):
                raise ValueError('Visual candidate missing payload')
            if ('section4SHA256' in b) != ('section9SHA256' in b) or 'section4SHA256' not in b and b['status']!='unknown':
                raise ValueError('Visual candidate missing sources')
            if any(not hash_value(b[k]) for k in ('section4SHA256','section9SHA256') if k in b):
                raise ValueError('Visual candidate source hash')
            continue
        if set(payload_keys)-b.keys() or not all(hash_value(b.get(k)) for k in ('sha256','section4SHA256','section9SHA256')):
            raise ValueError('Visual candidate payload shape/hash')
        bounds=b['bounds']
        if not isinstance(bounds,list) or len(bounds)!=4 or not all(integer(v,-4096,4128) for v in bounds) or bounds[2]<bounds[0] or bounds[3]<bounds[1] or (bounds[2]-bounds[0])*(bounds[3]-bounds[1])>MAX_PIXELS:
            raise ValueError('Visual candidate bounds')
        if b['offset'] != end or not 0 < b['bytes'] <= MAX_SCENE or base+end+b['bytes'] > len(payload) or not 0 <= b['rawBytes'] <= MAX_SCENE:
            raise ValueError('Visual candidate scene span')
        decoder = zlib.decompressobj(); raw = decoder.decompress(payload[base+end:base+end+b['bytes']], MAX_SCENE+1)
        if len(raw) != b['rawBytes'] or decoder.unconsumed_tail or decoder.unused_data or not decoder.eof or digest(raw) != b['sha256']:
            raise ValueError('Visual candidate decoded length/hash')
        end += b['bytes']; count = b['tileCount']; refs = b['paletteRefs']; layers = b['layers']
        if not 0 <= count <= 16384 or len(layers) != 4 or any(l['id'] != i or not 0 <= l['tiles'] <= 8192 for i,l in enumerate(layers)) or sum(l['tiles'] for l in layers) != count:
            raise ValueError('Visual candidate layers')
        ids = [p['id'] for p in refs]
        for p in refs:
            shape(p, ('id','transparent'))
            if type(p['transparent']) is not bool:
                raise ValueError('Visual candidate palette flag')
        if ids != sorted(set(ids)) or any(type(i) is not int or not 0 <= i < 256 for i in ids) or not integer(b['pixelBytes'],0,MAX_SCENE) or len(raw) != count*36+len(refs)*512+b['pixelBytes']:
            raise ValueError('Visual candidate palettes/pixels')
        if not isinstance(b['pages'],list) or len(b['pages'])>42:
            raise ValueError('Visual candidate pages')
        pages = {}
        for p in b['pages']:
            shape(p, ('id','big','depth','sourceOffset','bytes'))
            if not integer(p['id'],0,41) or p['id'] in pages or not integer(p['depth'],0,2) or not integer(p['big'],0,1) or not integer(p['sourceOffset'],40,8_000_000) or p['bytes']!=(32768,65536,131072)[p['depth']] or not source_span(p['sourceOffset'],p['bytes'],section_bytes):
                raise ValueError('Visual candidate page reference')
            pages[p['id']]=p
        tile_ids = set(); intervals = set(); order = []; supported = 0; base_count = 0; conditional = 0; base_omitted = 0; footprint=[]
        first_offsets = {}
        for i in range(count):
            x,y,tid,layer,size,source,sx,sy,page,palette,depth,group,mask,blend,blend_type,code,z,raw_depth,sub,offset = DESCRIPTOR.unpack_from(raw,i*36)
            key = (layer,tid)
            first = source-tid*52
            if layer > 3 or key in tile_ids or tid >= layers[layer]['tiles'] or size != (16 if layer<2 else 32) or source < 52 or not source_span(source,52,section_bytes) or first_offsets.get(layer,first) != first or layer == 0 and first != 52:
                raise ValueError('Visual candidate source tile')
            first_offsets[layer] = first
            tile_ids.add(key); order.append((-z,-sub,layer,tid))
            if raw_depth>255 or layer==0 and z!=4095:
                raise ValueError('Visual candidate raw operands')
            p = pages.get(page)
            if p is None or depth != p['depth'] or sx+size > 256 or sy+size > 256 or code != 4 and (x < b['bounds'][0] or y < b['bounds'][1] or x+size > b['bounds'][2] or y+size > b['bounds'][3]):
                raise ValueError('Visual candidate tile reference')
            if code != support_code(dict(x=x,y=y,layer=layer,blend=blend,blendType=blend_type,depth=depth,group=group,mask=mask),revision):
                raise ValueError('Visual candidate support accounting')
            is_base = layer == 0 or not (group or mask)
            if code!=4:
                footprint.append((x,y,x+size,y+size))
            conditional += int(not is_base)
            if code:
                base_omitted += int(is_base)
            if code not in (0,5):
                if offset != 0xffffffff:
                    raise ValueError('Visual candidate unsupported pixels')
            else:
                size_bytes = size*size*(2 if depth==2 else 1)
                if offset+size_bytes > b['pixelBytes'] or depth < 2 and palette not in ids:
                    raise ValueError('Visual candidate pixel reference')
                intervals.add((offset,offset+size_bytes)); supported += int(code==0); base_count += int(is_base and code==0)
        cursor = 0
        for start,stop in sorted(intervals):
            if start != cursor:
                raise ValueError('Visual candidate pixel coverage')
            cursor = stop
        if cursor != b['pixelBytes'] or order != sorted(order) or (supported,base_count,conditional,count-supported) != (b['supportedTileCount'],b['baseTileCount'],b['conditionalTileCount'],b['omitted']):
            raise ValueError('Visual candidate accounting/order')
        expected_bounds=[min((r[0] for r in footprint),default=0),min((r[1] for r in footprint),default=0),max((r[2] for r in footprint),default=0),max((r[3] for r in footprint),default=0)]
        expected_status='unsupported' if not base_count else 'static_partial' if base_omitted else 'static_complete'
        if bounds!=expected_bounds or b['status']!=expected_status:
            raise ValueError('Visual candidate static completeness')
    if base+end != len(payload):
        raise ValueError('Visual candidate trailing bytes')
    return meta


def encode_visual(source, directory, *, audit_path=None, progress=None, audit_only=False):
    """Build one candidate before replacing any workspace resource."""
    from .dataset import discover, child_ci
    from .field_camera import parse_cameras
    from .field_context import field_sections
    from .lgp import inventory, read_entry
    from .poi import parse_maplist
    from .web_export import sha256
    began = time.perf_counter(); source = Path(source).resolve(); directory = visual_path(directory)
    audit_path = audit_output(audit_path) if audit_path else None
    protect_input(source)
    ds = discover(source); field = child_ci(ds.wm_directory.parent, 'field')
    archive = child_ci(field, 'flevel.lgp') if field else None
    if not archive:
        raise FormatError('Field archive unavailable')
    for input_root in (source, ds.wm_directory.resolve(), archive.resolve().parent):
        if directory.is_relative_to(input_root) or input_root.is_relative_to(directory):
            raise ValueError('Visual output/input overlap')
        protect_input(input_root)
    archive_hash = sha256(archive); entries = {}
    for entry in inventory(archive)['entries']:
        name = entry['filename'].casefold()
        if name in entries:
            raise FormatError('Ambiguous field entry')
        entries[name] = entry
    maplist = read_entry(archive, entries['maplist']); scenes = []; pool = bytearray(); pool_size = 0; audit = []
    for field_id, name in enumerate(parse_maplist(maplist)):
        if name.casefold() not in entries:
            continue
        record = dict(fieldId=field_id, cameras=[], background=dict(status='unknown', reason='Visual sections unavailable'))
        row = dict(fieldId=field_id, name=name)
        try:
            camera, palette, background = field_sections(read_entry(archive, entries[name.casefold()]), visual=True)
            try:
                record['cameras'] = parse_cameras(camera)
            except FormatError as error:
                record['reason'] = str(error)
            row.update(cameras=len(record['cameras']), paletteBytes=len(palette), section9Bytes=len(background),
                paletteHeader=list(struct.unpack_from('<I4H', palette)) if len(palette) >= 12 else [],
                section4SHA256=digest(palette), section9SHA256=digest(background))
            try:
                meta, decoded, structure = parse_background_v2(palette, background, revision=GENERATOR_VERSION)
                compressed = zlib.compress(decoded, 9)
                meta.update(offset=pool_size, bytes=len(compressed), sha256=digest(decoded))
                pool_size += len(compressed)
                if not audit_only:
                    pool.extend(compressed)
                record['background'] = meta
                row.update(status=meta['status'], layers=meta['layers'], tileCount=meta['tileCount'],
                    baseTileCount=meta['baseTileCount'], supportedTileCount=meta['supportedTileCount'],
                    conditionalTileCount=meta['conditionalTileCount'], omitted=meta['omitted'],
                    pages=meta['pages'], bounds=meta['bounds'], rawBytes=meta['rawBytes'], compressedBytes=len(compressed),
                    tail=structure['tail'],
                    depthOperands=dict(Counter(str((t['rawDepth'], t['depth'])) for t in structure['tiles'])),
                    groups=dict(Counter(str((t['layer'], t['group'], t['mask'])) for t in structure['tiles'] if t['layer'])),
                    blends=dict(Counter(str((t['layer'], t['blend'], t['blendType'])) for t in structure['tiles'])),
                    unsupported=dict(Counter(str(t['supportCode']) for t in structure['tiles'] if t['supportCode'])))
                row['layerSupport'] = [dict(layer=i, raw=sum(t['layer']==i for t in structure['tiles']),
                    supported=sum(t['layer']==i and t['supportCode']==0 for t in structure['tiles']),
                    research=sum(t['layer']==i and t['supportCode']==5 for t in structure['tiles']),
                    newBlend=sum(i>0 and t['layer']==i and t['supportCode']==0 and bool(t['blend']) for t in structure['tiles']),
                    omitted=dict(Counter(str(t['supportCode']) for t in structure['tiles'] if t['layer']==i and t['supportCode']))) for i in range(4)]
            except BackgroundError as error:
                if error.structure is not None:
                    row.update(audit_structure(error.structure))
                record['background'] = dict(status=error.status, reason=str(error),
                    section4SHA256=digest(palette), section9SHA256=digest(background))
                row.update(status=error.status, reason=str(error))
        except FormatError as error:
            record['reason'] = str(error); row.update(status='unknown', reason=str(error))
        scenes.append(record); audit.append(row)
        if progress:
            progress(len(scenes), name)
        if pool_size > MAX_COMPOSITING_PACK and not audit_only:
            raise FormatError('Visual pack budget exceeded')
    metadata = dict(schema='gaiagis-field-visual', version=2, generator_revision=GENERATOR_VERSION,
        sources={'flevel.lgp':archive_hash, 'maplist':digest(maplist)}, scenes=scenes)
    encoded = json.dumps(metadata, separators=(',', ':'), sort_keys=True).encode()
    if len(encoded) > 8_000_000 or 16+len(encoded)+pool_size > MAX_COMPOSITING_PACK and not audit_only:
        raise FormatError('Visual pack metadata/size budget')
    if sha256(archive) != archive_hash:
        raise RuntimeError('Field source changed')
    payload = None if audit_only else b'GAIACAM\0' + struct.pack('<II', 2, len(encoded)) + encoded + pool
    report = dict(scenes=len(scenes), cameras=sum(len(s['cameras']) for s in scenes),
        backgrounds=sum(s['background']['status'].startswith('static_') for s in scenes), bytes=16+len(encoded)+pool_size,
        headerBytes=16+len(encoded), maxSceneBytes=max((r.get('rawBytes',0) for r in audit), default=0),
        status=dict(Counter(r['status'] for r in audit)),
        reasons=dict(Counter(r.get('reason','OK') for r in audit)),
        sources=metadata['sources'], seconds=time.perf_counter()-began)
    if audit_path:
        from .field_interaction import atomic_write
        atomic_write(audit_path, (json.dumps(dict(schema='gaiagis-field-background-audit', version=1, **report, fields=audit), indent=2)+'\n').encode())
    return payload, report


def build_field_visual(source, directory):
    from .field_interaction import atomic_write
    payload, report = encode_visual(source, directory)
    metadata = validate_visual(payload, report['sources'])
    if metadata['generator_revision'] != GENERATOR_VERSION:
        raise ValueError('Visual generator publication mismatch')
    atomic_write(visual_path(Path(directory)/FILENAME), payload)
    return report


def update_workspace(source, directory, *, audit_path=None):
    """Increment only the Visual and manifest; rollback both on failure.

    A two-file filesystem replacement is not a crash-atomic transaction; keep a
    durable private recovery copy so interrupted publication can be recovered.
    """
    from .local import server_manifest
    from .build_workspace import ASSETS
    from .field_interaction import atomic_write
    from ._version import __version__
    directory = visual_path(directory); manifest = server_manifest(directory)
    if not all((directory/name).is_file() for name in ASSETS[FILENAME][2]):
        raise ValueError('Visual requires existing Context')
    manifest_path = visual_path(directory/'gaia-workspace.json'); pack_path = visual_path(directory/FILENAME)
    old_manifest = manifest_path.read_bytes(); old_pack = pack_path.read_bytes() if pack_path.is_file() else None
    payload, report = encode_visual(source, directory, audit_path=audit_path)
    metadata = validate_visual(payload, report['sources'])
    if metadata['generator_revision'] != GENERATOR_VERSION:
        raise ValueError('Visual generator publication mismatch')
    context = json.loads((directory/'gaia-field-context.json').read_text(encoding='utf8'))
    if any(context.get('sources',{}).get(k) != v for k,v in report['sources'].items()) or manifest['sources'].get('flevel.lgp') != report['sources']['flevel.lgp']:
        raise ValueError('Visual Workspace source mismatch')
    kind, map_id, dependencies = ASSETS[FILENAME]
    entry = dict(filename=FILENAME, type=kind, mapId=map_id, sha256=digest(payload), bytes=len(payload),
                 dependencies=dependencies, generator_version=GENERATOR_VERSION)
    manifest['assets'] = [r for r in manifest['assets'] if r['filename'] != FILENAME]+[entry]
    manifest['tool_version'] = __version__
    candidate = (json.dumps(manifest, sort_keys=True, indent=2)+'\n').encode()
    staged = visual_path(directory/'.build/visual-candidate.bin')
    atomic_write(staged, payload)
    validate_visual(staged.read_bytes(), report['sources'])
    backup = visual_path(directory/'.build/visual-recovery')
    if backup.exists():
        # Never overwrite a previous matching recovery pair (including v1).
        backup = visual_path(backup/digest(old_manifest))
        if backup.exists():
            if (backup/'gaia-workspace.json').read_bytes() != old_manifest or old_pack is not None and (backup/FILENAME).read_bytes() != old_pack:
                raise ValueError('Visual recovery identity conflict')
    backup.mkdir(parents=True, exist_ok=True)
    atomic_write(visual_path(backup/'gaia-workspace.json'), old_manifest)
    if old_pack is not None:
        atomic_write(visual_path(backup/FILENAME), old_pack)
    # Do not roll back someone else's concurrent update when no writes occurred.
    if manifest_path.read_bytes() != old_manifest or (pack_path.read_bytes() if pack_path.is_file() else None) != old_pack:
        raise RuntimeError('Visual Workspace changed during generation')
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
    parser.add_argument('--audit', type=Path, help='Private audit JSON inside the workspace')
    args = parser.parse_args(argv)
    try:
        print(json.dumps(update_workspace(args.source, args.workspace, audit_path=args.audit), indent=2))
        return 0
    except (ValueError, OSError, KeyError, TypeError, struct.error) as error:
        parser.exit(1, f'Field visual generation rejected: {error}\n')


if __name__ == '__main__':
    raise SystemExit(main())
