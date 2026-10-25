"""Optional private interaction evidence, sharing the existing Field decoders.

No script execution or active-state inference. One compressed JSON span per Field;
the existing Context/Walkmesh/Visual contracts are unchanged.
"""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
from fractions import Fraction
import hashlib
import json
import os
import re
from pathlib import Path
from .constants import GAME_DATA_LANGUAGES
from .dataset import field_source_keys, same_dependencies
import struct
import tempfile
import time
import zlib

from .dataset import discover, child_ci
from .field_context import (field_sections, parse_script, parse_walkmesh,
                            validate_gateway_segment, _normal, _clip)
from .field_camera import parse_background
from .lgp import inventory, read_entry
from .lzss import FormatError
from .poi import parse_maplist
from .safety import output_path, protect_input
from .web_export import sha256

GENERATOR_VERSION='field-interaction-1'
FILENAME='gaia-field-interaction.bin'
MAX_PACK=8_000_000
MAX_SCENE=2_000_000
MAX_HEADER=512_000
UNUSED_TRIGGER=bytes.fromhex('000000000000000000000000ff000000')


def digest(value):return hashlib.sha256(value).hexdigest()


def segment_geometry(points, a, b):
    """All original candidates; exact rational Raw-Z gaps over XY overlap only."""
    if points is None:return dict(relation='unknown',candidates=[],xyCandidates=[],coplanar=[],vertical=[],zeroLength=a==b,zeroXY=a[:2]==b[:2],rawZGap=None,rawZTriangle=None)
    contacts=[];relation=validate_gateway_segment(points,a,b,candidates=contacts)
    xy=[];coplanar=[];vertical=[];gaps=[]
    for i,p in enumerate(points):
        n=_normal(p)
        if n==(0,0,0):continue
        span=_clip(p,a,b)
        if span is None:continue
        xy.append(i)
        if n[2]==0:vertical.append(i);continue
        delta=[]
        for t in span:
            q=[Fraction(a[k])+t*(b[k]-a[k]) for k in range(3)]
            surface=Fraction(p[0][2])-sum(n[k]*(q[k]-p[0][k]) for k in (0,1))/n[2]
            delta.append(q[2]-surface)
        gap=Fraction(0) if delta[0]*delta[1]<=0 else min(abs(d) for d in delta)
        gaps.append((gap,i))
        if delta==[0,0] and span[0]<span[1]:coplanar.append(i)
    closest=min(gaps) if gaps else None
    return dict(relation=relation,candidates=contacts,xyCandidates=xy,coplanar=coplanar,vertical=vertical,
                zeroLength=a==b,zeroXY=a[:2]==b[:2],rawZGap=None if closest is None else str(closest[0]),rawZTriangle=None if closest is None else closest[1])


def parse_triggers(section):
    if len(section) not in (536,740):raise FormatError('Interaction Section 8 length')
    records=[];unused=0
    for slot in range(12):
        offset=344+slot*16;raw=section[offset:offset+16]
        if raw==UNUSED_TRIGGER:unused+=1;continue
        values=struct.unpack('<6h4B',raw);group,state,behavior,sound=values[6:]
        records.append(dict(slot=slot,offset=offset,raw=raw.hex(),a=list(values[:3]),b=list(values[3:6]),
                            group=group,state=state,behavior=behavior,sound=sound,
                            classification='unknown' if group==255 or behavior>5 or raw==bytes(16) else 'record'))
    return records,unused


def scene_interactions(payload, field_id, name, *, archive=None):
    script,section,local=field_sections(payload,walkmesh=True,archive=archive,member=name)
    triggers,unused=parse_triggers(section)
    points=None;triangles=0;mesh_reason=None
    try:
        stats,points=parse_walkmesh(local,geometry=True);triangles=stats['triangles']
    except (FormatError,TypeError) as error:mesh_reason='mesh_unavailable'
    stops=[];records=[]
    try:_,_,stops,records=parse_script(script,interactions=True)
    except (FormatError,UnicodeError):stops=[dict(offset=None,opcode=None,reason='invalid_script',entryReachable=False)]
    for row in [*triggers,*records]:
        if 'a' in row:row['geometry']=segment_geometry(points,row['a'],row['b'])
    if triggers:
        groups=[];reason=None
        try:
            _,palette,background=field_sections(payload,visual=True,archive=archive,member=name)
            parse_background(palette,background,groups=groups)
        except FormatError as error:reason=str(error)[:256]
        for row in triggers:
            matches=[g for g in groups if g['group']==row['group'] and row['state']<8 and g['mask']&(1<<row['state'])]
            row['background']=dict(status='unknown' if reason else 'matched' if matches else 'no_match',matches=matches,reason=reason)
    return dict(fieldId=field_id,name=name,triangles=triangles,meshReason=mesh_reason,
                section1Bytes=len(script),section8Bytes=len(section),section1SHA256=digest(script),
                section8SHA256=digest(section),section5SHA256=digest(local) if local is not None else None,
                unusedTriggers=unused,triggers=triggers,scripts=records,stops=stops)


def encode_interactions(source, directory):
    """Read inputs only, build a bounded candidate entirely before publication."""
    began=time.perf_counter();ds=discover(source);source=ds.selected_path;directory=output_path(Path(directory));protect_input(source)
    if directory.is_relative_to(source) or source.is_relative_to(directory):raise ValueError('Interaction output/input overlap')
    archive=ds.field_archive()
    if not archive:raise FormatError('Field archive unavailable')
    # A selected wm directory also reads the sibling field directory. Neither
    # may become a writable output, even when legal inputs live in the checkout.
    for input_root in (ds.wm_directory.resolve(),archive.resolve().parent):
        if directory.is_relative_to(input_root) or input_root.is_relative_to(directory):raise ValueError('Interaction output/input overlap')
        protect_input(input_root)
    source_hash=sha256(archive);entries={}
    for entry in inventory(archive)['entries']:
        key=entry['filename'].casefold()
        if key in entries:raise FormatError('Ambiguous Field archive entry')
        entries[key]=entry
    if 'maplist' not in entries:raise FormatError('Field maplist unavailable')
    maplist=read_entry(archive,entries['maplist']);names=parse_maplist(maplist);sources={ds.field_name:source_hash,'maplist':digest(maplist)}
    context_path=directory/'gaia-field-context.json'
    if not context_path.is_file() or context_path.stat().st_size>8_000_000:raise ValueError('Interaction requires existing Field Context')
    context=json.loads(context_path.read_text(encoding='utf8'))
    if not isinstance(context,dict) or context.get('schema')!='gaiagis-field-context' or context.get('version') not in (1,2,3,4,5) or not isinstance(context.get('sources'),dict) or any(context['sources'].get(k)!=v for k,v in sources.items()):raise ValueError('Interaction Field source identity mismatch')
    nodes=context.get('nodes')
    if not isinstance(nodes,list) or len(nodes)>2000 or any(not isinstance(n,dict) for n in nodes):raise ValueError('Interaction Field identities')
    scenes=[];pool=bytearray();counts=dict(fields=0,slots=0,triggers=0,unused=0,line=0,linon=0,sline=0,staticSline=0,dynamicSline=0,stops=0,backgroundMatched=0,backgroundUnknown=0)
    for node in nodes:
        if node.get('status')!='available':continue
        fid=node['id'];name=node['name']
        if type(fid) is not int or not 0<=fid<len(names) or name!=names[fid] or name.casefold() not in entries or any(s['fieldId']==fid for s in scenes):raise ValueError('Interaction maplist/Field identity mismatch')
        value=scene_interactions(read_entry(archive,entries[name.casefold()]),fid,name,archive=ds.field_name)
        decoded=json.dumps(value,separators=(',',':'),sort_keys=True).encode();compressed=zlib.compress(decoded,9)
        if len(decoded)>MAX_SCENE or len(compressed)>MAX_SCENE:raise FormatError('Interaction scene budget')
        scenes.append(dict(fieldId=fid,name=name,triangles=value['triangles'],section5SHA256=value['section5SHA256'],offset=len(pool),bytes=len(compressed),rawBytes=len(decoded),sha256=digest(decoded)))
        pool.extend(compressed)
        if len(pool)>MAX_PACK:raise FormatError('Interaction pack budget')
        counts['fields']+=1;counts['slots']+=12;counts['triggers']+=len(value['triggers']);counts['unused']+=value['unusedTriggers'];counts['stops']+=len(value['stops'])
        for row in value['scripts']:
            key={0xd0:'line',0xd1:'linon',0xd3:'sline'}[row['opcode']];counts[key]+=1
            if key=='sline':counts['staticSline' if row['static'] else 'dynamicSline']+=1
        for row in value['triggers']:
            counts['backgroundMatched']+=row['background']['status']=='matched';counts['backgroundUnknown']+=row['background']['status']=='unknown'
    meta=dict(schema='gaiagis-field-interaction',version=1,coordinateSpace='FieldLocal',generator_revision=GENERATOR_VERSION,sources=sources,scenes=scenes)
    encoded=json.dumps(meta,separators=(',',':'),sort_keys=True).encode()
    if len(encoded)>MAX_HEADER or 16+len(encoded)+len(pool)>MAX_PACK:raise FormatError('Interaction header/pack budget')
    if sha256(archive)!=source_hash:raise RuntimeError('Field source changed during interaction generation')
    payload=b'GAIAINT\0'+struct.pack('<II',1,len(encoded))+encoded+pool
    return payload,dict(counts,bytes=len(payload),seconds=round(time.perf_counter()-began,3),sources=sources)


def _shape(value, keys):
    if not isinstance(value,dict) or set(value)!=set(keys.split()):raise ValueError('Interaction record shape')
    return value


def _int(value, lo=0, hi=65535):
    if type(value) is not int or not lo<=value<=hi:raise ValueError('Interaction integer bounds')
    return value


def _list(value, limit):
    if not isinstance(value,list) or len(value)>limit:raise ValueError('Interaction list budget')
    return value


def _fingerprint(value):
    if not isinstance(value,str) or not re.fullmatch('[a-f0-9]{64}',value):raise ValueError('Interaction fingerprint')
    return value


def _decode(data):
    def pairs(rows):
        result={}
        for key,value in rows:
            if key in result:raise ValueError('Duplicate interaction JSON key')
            result[key]=value
        return result
    return json.loads(data,object_pairs_hook=pairs,parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite interaction value')))


def validate_interaction_scene(value, span, scene):
    """Same v1 evidence contract as Web; independently recheck raw mesh contacts."""
    s=_shape(value,'fieldId name triangles meshReason section1Bytes section8Bytes section1SHA256 section8SHA256 section5SHA256 unusedTriggers triggers scripts stops')
    _int(s['fieldId']);_int(s['triangles'])
    for key in ('fieldId','name','triangles','section5SHA256'):
        if s[key]!=span[key]:raise ValueError('Interaction scene identity')
    if s['meshReason'] is not None or s['section5SHA256']!=digest(scene['raw']):raise ValueError('Interaction Walkmesh identity')
    for key in ('section1SHA256','section5SHA256','section8SHA256'):_fingerprint(s[key])
    _int(s['section1Bytes'],32,8_000_000)
    if type(s['section8Bytes']) is not int or s['section8Bytes'] not in (536,740):raise ValueError('Interaction Section 8')
    _int(s['unusedTriggers'],0,12)
    triggers=_list(s['triggers'],12);scripts=_list(s['scripts'],4096)
    if (len(triggers)+sum(isinstance(r,dict) and (r.get('opcode')==208 or r.get('opcode')==211 and r.get('static') is True) for r in scripts))*s['triangles']>2_000_000:raise ValueError('Interaction geometry validation work budget')
    def vector(value, lo=-32768, hi=32767, size=3):
        if len(_list(value,size))!=size:raise ValueError('Interaction vector size')
        for v in value:_int(v,lo,hi)
    def raw(row, size):
        if not isinstance(row['raw'],str) or not re.fullmatch('[a-f0-9]{'+str(size*2)+'}',row['raw']):raise ValueError('Interaction raw bytes')
        return bytes.fromhex(row['raw'])
    def geometry(row):
        g=_shape(row['geometry'],'relation candidates xyCandidates coplanar vertical zeroLength zeroXY rawZGap rawZTriangle')
        for key in ('candidates','xyCandidates','coplanar','vertical'):
            ids=_list(g[key],scene['stats']['triangles'])
            for i in ids:_int(i,0,scene['stats']['triangles']-1)
            if ids!=sorted(set(ids)):raise ValueError('Interaction duplicate candidate')
        if type(g['zeroLength']) is not bool or type(g['zeroXY']) is not bool or g!=segment_geometry(scene['points'],row['a'],row['b']):raise ValueError('Interaction geometry evidence mismatch')
    previous=-1
    for r in triggers:
        _shape(r,'slot offset raw a b group state behavior sound classification geometry background');slot=_int(r['slot'],0,11)
        if slot<=previous or _int(r['offset'])!=344+slot*16:raise ValueError('Trigger identity/offset')
        previous=slot;data=raw(r,16);values=struct.unpack('<6h4B',data)
        vector(r['a']);vector(r['b'])
        if data==UNUSED_TRIGGER or r['a']!=list(values[:3]) or r['b']!=list(values[3:6]):raise ValueError('Trigger original XYZ')
        for key,v in zip(('group','state','behavior','sound'),values[6:]):
            if _int(r[key],0,255)!=v:raise ValueError('Trigger original parameter')
        expected='unknown' if r['group']==255 or r['behavior']>5 or data==bytes(16) else 'record'
        if r['classification']!=expected:raise ValueError('Trigger classification')
        geometry(r);b=_shape(r['background'],'status matches reason');seen=set()
        for m in _list(b['matches'],16384):
            _shape(m,'group mask layer count firstOffset');key=(m['layer'],m['group'],m['mask'])
            if key in seen or _int(m['group'],0,255)!=r['group'] or r['state']>=8 or not (_int(m['mask'],1,255)&(1<<r['state'])):raise ValueError('Trigger background mask')
            seen.add(key);_int(m['layer'],1,3);_int(m['count'],1,16384);_int(m['firstOffset'],0,8_000_000)
        if b['status'] not in ('matched','no_match','unknown') or (b['status']=='matched')!=bool(b['matches']) or (b['status']=='unknown')!=(b['reason'] is not None):raise ValueError('Trigger background status')
        if b['reason'] is not None and (not isinstance(b['reason'],str) or not 0<len(b['reason'])<=256):raise ValueError('Trigger background reason')
    if len(s['triggers'])+s['unusedTriggers']!=12:raise ValueError('Trigger slot accounting')
    previous=-1;owner_budget=0
    for r in scripts:
        op=_int(r['opcode']);size={208:13,209:2,211:16}.get(op)
        if size is None:raise ValueError('Interaction opcode')
        constant=op==208 or op==211 and r.get('static') is True
        keys='opcode offset raw owners entryReachable '+('a b static geometry' if op==208 else 'switch lineOffsets' if op==209 else 'banks operands static lineOffsets'+(' a b geometry' if constant else ''))
        _shape(r,keys);offset=_int(r['offset'],0,65535-size)
        if offset<previous or offset+size>s['section1Bytes'] or r['entryReachable'] is not True:raise ValueError('Interaction instruction boundary')
        previous=offset+size;data=raw(r,size)
        if data[0]!=op:raise ValueError('Interaction raw opcode')
        owners=_list(r['owners'],2112);owner_budget+=len(owners);seen=set()
        if not owners or owner_budget>65536:raise ValueError('Interaction owner budget')
        for o in owners:
            _shape(o,'actor name slot entry kind');key=(o['actor'],o['slot'],o['entry'],o['kind'])
            _int(o['actor'],0,63);_int(o['slot'],0,31);_int(o['entry'],0,min(65535,s['section1Bytes']-1))
            if key in seen or o['kind'] not in ('table','main') or o['kind']=='main' and o['slot']!=0 or o['name'] is not None and (not isinstance(o['name'],str) or not re.fullmatch('[\x20-\x7e]{0,8}',o['name'])):raise ValueError('Interaction membership')
            seen.add(key)
        if op==209:
            if _int(r['switch'],0,255)!=data[1]:raise ValueError('LINON parameter')
        elif op==211:
            banks=[n for byte in data[1:4] for n in (byte>>4,byte&15)];operands=list(struct.unpack_from('<6h',data,4))
            vector(r['banks'],0,15,6);vector(r['operands'],-32768,32767,6)
            if r['banks']!=banks or r['operands']!=operands or type(r['static']) is not bool or r['static']!=(not any(banks)):raise ValueError('SLINE bank classification')
            if constant and (r['a']!=operands[:3] or r['b']!=operands[3:]):raise ValueError('SLINE original literals')
        elif r['static'] is not True or r['a']!=list(struct.unpack_from('<3h',data,1)) or r['b']!=list(struct.unpack_from('<3h',data,7)):raise ValueError('LINE original XYZ')
        if constant:
            vector(r['a']);vector(r['b'])
            geometry(r)
    lines=[r for r in s['scripts'] if r['opcode']==208]
    for r in s['scripts']:
        if r['opcode']==208:continue
        related=[line['offset'] for line in lines if {o['actor'] for o in line['owners']}&{o['actor'] for o in r['owners']}]
        for offset in _list(r['lineOffsets'],4096):_int(offset)
        if r['lineOffsets']!=related:raise ValueError('Interaction LINE evidence link')
    seen_stops=set()
    for r in _list(s['stops'],4096):
        _shape(r,'offset opcode reason entryReachable')
        key=(r['offset'],r['opcode'],r['reason'])
        if key in seen_stops:raise ValueError('Duplicate interaction stop')
        seen_stops.add(key)
        if type(r['entryReachable']) is not bool or r['reason'] not in ('unsupported_opcode','unverified_boundary','invalid_script'):raise ValueError('Interaction stop evidence')
        if r['reason']=='invalid_script':
            if r['offset'] is not None or r['opcode'] is not None or s['scripts']:raise ValueError('Interaction invalid script evidence')
        else:_int(r['offset'],0,min(65535,s['section1Bytes']-1));_int(r['opcode'],0,255)
    return s


def read_interaction(scene):
    """Read/hash the optional v1 pack, decompress only this selected Field."""
    from .clean_output import reject_links
    began=time.perf_counter();path=scene['root']/FILENAME;record=scene['assets'].get(FILENAME)
    if not record or not path.is_file():raise ValueError('FieldLocal v2 requires Interaction Pack; run field-interaction --source YOUR_FF7_PC_DATA --workspace YOUR_WORKSPACE')
    reject_links(path)
    if path.stat().st_size!=_int(record['bytes'],16,MAX_PACK) or record.get('generator_version')!=GENERATOR_VERSION:raise ValueError('Interaction manifest/checksum mismatch')
    with path.open('rb') as stream:
        prefix=stream.read(16)
        if len(prefix)!=16 or prefix[:8]!=b'GAIAINT\0' or struct.unpack_from('<I',prefix,8)[0]!=1:raise ValueError('Interaction pack header')
        length=struct.unpack_from('<I',prefix,12)[0]
        if not 0<length<=MAX_HEADER or 16+length>record['bytes']:raise ValueError('Interaction metadata budget')
        encoded=stream.read(length);checksum=hashlib.sha256(prefix+encoded)
        meta=_shape(_decode(encoded),'schema version coordinateSpace generator_revision sources scenes')
        if meta['schema']!='gaiagis-field-interaction' or type(meta['version']) is not int or meta['version']!=1 or meta['coordinateSpace']!='FieldLocal' or meta['generator_revision']!=GENERATOR_VERSION:raise ValueError('Interaction schema')
        _shape(meta['sources'],' '.join(field_source_keys(meta['sources'])))
        if any(_fingerprint(h)!=scene['context']['sources'][k] for k,h in meta['sources'].items()):raise ValueError('Interaction source mismatch')
        end=0;seen=set();chosen=None
        for span in _list(meta['scenes'],2000):
            _shape(span,'fieldId name triangles section5SHA256 offset bytes rawBytes sha256');id=_int(span['fieldId']);node=scene['nodes'].get(id)
            if id in seen or not node or node['name']!=span['name'] or node['status']!='available':raise ValueError('Interaction Field identity')
            seen.add(id);_int(span['triangles']);_fingerprint(span['sha256'])
            if span['section5SHA256'] is not None:_fingerprint(span['section5SHA256'])
            if _int(span['offset'],0,MAX_PACK)!=end or 16+length+end+_int(span['bytes'],1,MAX_SCENE)>record['bytes']:raise ValueError('Interaction compressed span')
            end+=span['bytes'];_int(span['rawBytes'],1,MAX_SCENE)
            if id==scene['id']:chosen=span
        if 16+length+end!=record['bytes'] or not chosen or chosen['triangles']!=scene['stats']['triangles'] or chosen['section5SHA256']!=digest(scene['raw']):raise ValueError('Interaction selected Walkmesh/trailing bytes')
        # Hash the same bytes from which the selected span is captured. Never
        # reopen a mutable pathname between authentication and scene reading.
        cursor=0;parts=[]
        while cursor<end:
            block=stream.read(min(1_048_576,end-cursor))
            if not block:raise ValueError('Interaction truncated payload')
            checksum.update(block)
            lo=max(0,chosen['offset']-cursor);hi=min(len(block),chosen['offset']+chosen['bytes']-cursor)
            if hi>lo:parts.append(block[lo:hi])
            cursor+=len(block)
        if stream.read(1) or checksum.hexdigest()!=record['sha256']:raise ValueError('Interaction manifest/checksum mismatch')
        compressed=b''.join(parts);scene['hashes'][FILENAME]=record['sha256'];metadata_seconds=time.perf_counter()-began
    began=time.perf_counter();decoder=zlib.decompressobj()
    try:decoded=decoder.decompress(compressed,MAX_SCENE+1)
    except zlib.error as error:raise ValueError('Interaction compressed scene') from error
    if len(decoded)!=chosen['rawBytes'] or decoder.unconsumed_tail or decoder.unused_data or not decoder.eof or digest(decoded)!=chosen['sha256']:raise ValueError('Interaction decompression/scene checksum')
    decompress_seconds=time.perf_counter()-began
    result=validate_interaction_scene(_decode(decoded),chosen,scene)
    return result,dict(metadata_seconds=metadata_seconds,decompress_seconds=decompress_seconds,scene_seconds=time.perf_counter()-began,decoded_bytes=len(decoded))


def atomic_write(path, payload):
    target=output_path(path);target.parent.mkdir(parents=True,exist_ok=True);temporary=None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent,prefix='.interaction-',suffix='.tmp',delete=False) as stream:
            temporary=Path(stream.name);stream.write(payload);stream.flush();os.fsync(stream.fileno())
        os.replace(temporary,target)
    finally:
        if temporary is not None:temporary.unlink(missing_ok=True)


def build_field_interaction(source,directory):
    payload,report=encode_interactions(source,directory)
    atomic_write(Path(directory)/FILENAME,payload)
    return report


def update_workspace(source, directory):
    """Only this optional pack and its manifest entry; never rebuild WM/GIS."""
    from .local import server_manifest
    from .build_workspace import ASSETS
    from ._version import __version__
    directory=output_path(Path(directory));manifest=server_manifest(directory)
    if not all((directory/name).is_file() for name in ASSETS[FILENAME][2]):raise ValueError('Interaction requires existing Context and Walkmesh')
    manifest_path=output_path(directory/'gaia-workspace.json');pack_path=output_path(directory/FILENAME)
    old_manifest=manifest_path.read_bytes();old_pack=pack_path.read_bytes() if pack_path.is_file() else None
    payload,report=encode_interactions(source,directory)
    if not same_dependencies(manifest.get('sources',{}),report['sources'],['@field']):raise ValueError('Interaction Workspace source mismatch')
    kind,map_id,dependencies=ASSETS[FILENAME]
    record=dict(filename=FILENAME,type=kind,mapId=map_id,sha256=digest(payload),bytes=len(payload),dependencies=dependencies,generator_version=GENERATOR_VERSION)
    manifest['assets']=[r for r in manifest['assets'] if r['filename']!=FILENAME]+[record];manifest['tool_version']=__version__
    new_manifest=(json.dumps(manifest,sort_keys=True,indent=2)+'\n').encode()
    try:
        atomic_write(pack_path,payload);atomic_write(manifest_path,new_manifest)
    except BaseException:
        if old_pack is None:pack_path.unlink(missing_ok=True)
        else:atomic_write(pack_path,old_pack)
        atomic_write(manifest_path,old_manifest);raise
    return report


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',type=Path,required=True);parser.add_argument('--workspace',type=Path,required=True)
    parser.add_argument('--game-language',choices=GAME_DATA_LANGUAGES,default='en',help='FF7 data language; independent of UI language')
    args=parser.parse_args(argv)
    from .dataset import discover
    args.source=discover(args.source,args.game_language)
    try:print(json.dumps(update_workspace(args.source,args.workspace),ensure_ascii=False,indent=2));return 0
    except (ValueError,OSError,FormatError,KeyError,TypeError,struct.error) as error:parser.exit(1,f'Field interaction generation rejected: {error}\n')


if __name__=='__main__':raise SystemExit(main())
