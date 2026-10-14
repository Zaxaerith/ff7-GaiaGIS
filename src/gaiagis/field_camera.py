"""Bounded classic-PC camera/base tiles; independent private visual contract.

Format facts cross-checked with Makou Reactor BackgroundTilesIOPC::readData,
BackgroundTexturesIOPC::read and LGP Explorer parseBackgroundSection. No engine
code is copied. Layer 0 and unconditional, unblended layer-1 indexed tiles are
drawn. Layer-0 param/state/blending operands are unused in the classic PC format.
"""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
import json
import math
from pathlib import Path
import struct
import zlib

from .field_context import field_sections
from .dataset import discover, child_ci
from .lgp import inventory, read_entry
from .lzss import FormatError
from .poi import parse_maplist
from .safety import output_path
from .web_export import sha256

GENERATOR_VERSION = 'field-visual-2'
MAX_PACK = 64_000_000
MAX_PIXELS = 4_000_000


def parse_cameras(data):
    if not data or len(data) % 38 or len(data) > 38 * 32:
        raise FormatError('Camera count/size')
    records = []
    for at in range(0, len(data), 38):
        r = list(struct.unpack_from('<9h', data, at))
        t = list(struct.unpack_from('<3i', data, at+20))
        zoom = struct.unpack_from('<H', data, at+36)[0]
        if not zoom:
            raise FormatError('Zero camera zoom')
        records.append(dict(id=at//38, offset=at, matrix=r, translation=t,
                            repeatedRzz=struct.unpack_from('<h', data, at+18)[0],
                            extra=list(data[at+32:at+36]), zoom=zoom))
    return records


def project(camera, point):
    q = [sum(camera['matrix'][i*3+k]*point[k]/4096 for k in range(3))+camera['translation'][i] for i in range(3)]
    if not all(math.isfinite(v) for v in q) or q[2] <= 1e-6:
        return None
    return (camera['zoom']*q[0]/q[2], camera['zoom']*q[1]/q[2])


def parse_background(palette, data, *, groups=None):
    """Validate every layer/page reference; export the supported static subset.

    Retain dimensions, tile evidence and explicit omissions. Tile size in classic
    layer 0 is 16; its width/height operands may be zero and are not substitutes
    for texture page bounds. Pixel payload retains indexed texels and only referenced RGB555 palettes.
    """
    def span(at, size):
        if at < 0 or size < 0 or at+size > len(data):
            raise FormatError('Background truncated span')
    def u16(at):
        span(at, 2)
        return struct.unpack_from('<H', data, at)[0]
    if len(data)>8_000_000 or len(palette)>131084:raise FormatError('Visual input budget')
    if len(palette) < 12:
        raise FormatError('Palette header')
    total, _, _, width, count = struct.unpack_from('<I4H', palette)
    if width != 256 or not 1 <= count <= 256 or total != len(palette) or len(palette) != 12+512*count:
        raise FormatError('Palette count/length')
    colors = list(struct.iter_unpack('<256H', palette[12:]))
    span(0, 40)
    if data[5:12] != b'PALETTE' or data[36:40] != b'BACK' or data[4] != 1:
        raise FormatError('Background header signature')
    flags = list(data[12:32]);layers=[];tiles=[];at=40
    for layer in range(4):
        if layer:
            span(at, 1);exists=data[at]
            if exists not in (0, 1):raise FormatError('Background layer flag')
            if not exists:
                layers.append(dict(id=layer,width=0,height=0,tiles=0));at+=1;continue
        header = 12 if layer == 0 else 27 if layer == 1 else 21
        span(at, header)
        w,h,n = struct.unpack_from('<hhH', data, at+(1 if layer else 0))
        if not 0 <= w <= 4096 or not 0 <= h <= 4096 or n > 8192 or sum(l['tiles'] for l in layers)+n > 16384:
            raise FormatError('Background layer bounds')
        layers.append(dict(id=layer,width=w,height=h,tiles=n));at+=header;span(at, n*52)
        for i in range(n):
            x,y=struct.unpack_from('<hh',data,at);size=16 if layer < 2 else 32
            if abs(x)>4096 or abs(y)>4096:raise FormatError('Background target bounds')
            tiles.append(dict(layer=layer,id=i,x=x,y=y,size=size,sourceOffset=at,
                              sx=data[at+8],sy=data[at+10],palette=data[at+20],
                              param=data[at+24],state=data[at+25],blend=data[at+26],blendType=data[at+28],
                              texture=data[at+32] if layer and data[at+26] else data[at+30],depth=data[at+34],
                              z=u16(at+22) if layer else 4095,sub=struct.unpack_from('<I',data,at+36)[0]))
            if layer and data[at+26]:tiles[-1].update(sx=data[at+12],sy=data[at+14])
            at+=52
    span(at,7)
    if data[at:at+7]!=b'TEXTURE':raise FormatError('Background texture signature')
    at+=7;pages=[]
    for i in range(42):
        exists=u16(at);at+=2
        if exists not in (0,1):raise FormatError('Texture page flag')
        if not exists:pages.append(None);continue
        big,depth=u16(at),u16(at+2);at+=4
        if big not in (0,1) or depth not in (0,1,2):raise FormatError('Texture page format')
        size=(32768,65536,131072)[depth];span(at,size);pages.append((depth,data[at:at+size]));at+=size
    if data[at:]!=b'END':raise FormatError('Background trailing/signature')
    base=[];pixels=bytearray();omitted=0;used=set()
    for tile in tiles:
        page=pages[tile['texture']] if tile['texture']<42 else None
        if page is None or tile['depth']!=page[0] or tile['sx']+tile['size']>256 or tile['sy']+tile['size']>256:
            raise FormatError('Tile texture reference')
        if page[0]<2 and tile['palette']>=count:raise FormatError('Tile palette reference')
        if tile['layer']>1 or tile['layer']==1 and (tile['param'] or tile['state'] or tile['blend']) or page[0]!=1:
            omitted+=1;continue
        offset=len(pixels);used.add(tile['palette'])
        for row in range(16):
            for col in range(16):
                index=page[1][(tile['sy']+row)*256+tile['sx']+col]
                pixels.append(index)
        base.append(dict(x=tile['x'],y=tile['y'],id=tile['id'],layer=tile['layer'],offset=offset,sourceOffset=tile['sourceOffset'],texture=tile['texture'],palette=tile['palette'],z=tile['z'],sub=tile['sub']))
    # Draw back to front using stored depth/sub-ID, never a geometric adjustment.
    # Repack indexed texels in the same order as the compact tile descriptors.
    base.sort(key=lambda t:(-t['z'],-t['sub'],t['layer'],t['id']))
    pixels=b''.join(pixels[t['offset']:t['offset']+256] for t in base)
    for i,tile in enumerate(base):tile['offset']=i*256
    footprint=[t for t in tiles if t['layer']==0]+base
    bounds=[min((t['x'] for t in footprint),default=0),min((t['y'] for t in footprint),default=0),max((t['x']+16 for t in footprint),default=0),max((t['y']+16 for t in footprint),default=0)]
    if len(pixels)>MAX_PIXELS*2 or (bounds[2]-bounds[0])*(bounds[3]-bounds[1])>MAX_PIXELS:
        raise FormatError('Background pixel budget')
    # Evidence only, after all existing palette/page/span validation succeeds.
    # Raw tile.state is a mask; Trigger.state is a bit index. Never activates it.
    if groups is not None:
        grouped={}
        for tile in tiles:
            if not tile['layer']:continue
            key=(tile['param'],tile['state'],tile['layer'])
            row=grouped.setdefault(key,dict(group=key[0],mask=key[1],layer=key[2],count=0,firstOffset=tile['sourceOffset']))
            row['count']+=1
        groups.extend(grouped[k] for k in sorted(grouped))
    return dict(status='partial' if omitted else 'static_base',bounds=bounds,layers=layers,tiles=base,omitted=omitted,pixelBytes=len(pixels),paletteRefs=[dict(id=i,transparent=bool(i<20 and flags[i])) for i in sorted(used)]),b''.join(struct.pack('<256H',*colors[i]) for i in sorted(used))+bytes(pixels)


def build_field_visual(source:Path,directory:Path):
    ds=discover(source);field=child_ci(ds.wm_directory.parent,'field');archive=child_ci(field,'flevel.lgp') if field else None
    if not archive:raise FormatError('Field archive unavailable')
    archive_hash=sha256(archive);entries={}
    for e in inventory(archive)['entries']:
        name=e['filename'].casefold()
        if name in entries:raise FormatError('Ambiguous field entry')
        entries[name]=e
    maplist=read_entry(archive,entries['maplist']);scenes=[];pool=bytearray()
    for id,name in enumerate(parse_maplist(maplist)):
        if name.casefold() not in entries:continue
        record=dict(fieldId=id,cameras=[],background=dict(status='unsupported'))
        try:
            camera,palette,background=field_sections(read_entry(archive,entries[name.casefold()]),visual=True)
            record['cameras']=parse_cameras(camera)
            try:
                meta,pixels=parse_background(palette,background)
                # Revision 2 uses bit 6 of the texture byte for layer 0/1; page
                # IDs remain 0..41. The 8-byte descriptor/pack schema stay v1.
                tiles=meta.pop('tiles');descriptors=b''.join(struct.pack('<hhHBB',t['x'],t['y'],t['id'],t['texture']|(t['layer']<<6),t['palette']) for t in tiles);meta['tileCount']=len(tiles)
                decoded=descriptors+pixels;compressed=zlib.compress(decoded,9);meta.update(offset=len(pool),bytes=len(compressed),sha256=hashlib.sha256(decoded).hexdigest());pool.extend(compressed);record['background']=meta
            except FormatError as error:record['background']['reason']=str(error)
        except FormatError as error:record['reason']=str(error)
        scenes.append(record)
        if len(pool)>MAX_PACK:raise FormatError('Visual pack budget exceeded')
    metadata=dict(schema='gaiagis-field-visual',version=1,generator_revision=GENERATOR_VERSION,sources={'flevel.lgp':archive_hash,'maplist':hashlib.sha256(maplist).hexdigest()},scenes=scenes)
    encoded=json.dumps(metadata,separators=(',',':'),sort_keys=True).encode()
    if len(encoded)>8_000_000 or 16+len(encoded)+len(pool)>MAX_PACK:raise FormatError('Visual pack metadata/size budget')
    if sha256(archive)!=archive_hash:raise RuntimeError('Field source changed')
    output_path(directory/'gaia-field-visual.bin').write_bytes(b'GAIACAM\0'+struct.pack('<II',1,len(encoded))+encoded+pool)
    return dict(scenes=len(scenes),cameras=sum(len(s['cameras']) for s in scenes),backgrounds=sum(s['background']['status']!='unsupported' for s in scenes),bytes=16+len(encoded)+len(pool))
