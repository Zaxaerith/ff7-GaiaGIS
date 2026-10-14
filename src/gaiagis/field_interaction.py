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
from pathlib import Path
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


def scene_interactions(payload, field_id, name):
    script,section,local=field_sections(payload,walkmesh=True)
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
            _,palette,background=field_sections(payload,visual=True)
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
    began=time.perf_counter();source=Path(source).resolve();directory=output_path(Path(directory));protect_input(source)
    if directory.is_relative_to(source) or source.is_relative_to(directory):raise ValueError('Interaction output/input overlap')
    ds=discover(source);field=child_ci(ds.wm_directory.parent,'field');archive=child_ci(field,'flevel.lgp') if field else None
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
    maplist=read_entry(archive,entries['maplist']);names=parse_maplist(maplist);sources={'flevel.lgp':source_hash,'maplist':digest(maplist)}
    context_path=directory/'gaia-field-context.json'
    if not context_path.is_file() or context_path.stat().st_size>8_000_000:raise ValueError('Interaction requires existing Field Context')
    context=json.loads(context_path.read_text(encoding='utf8'))
    if not isinstance(context,dict) or context.get('schema')!='gaiagis-field-context' or context.get('version') not in (1,2,3) or not isinstance(context.get('sources'),dict) or any(context['sources'].get(k)!=v for k,v in sources.items()):raise ValueError('Interaction Field source identity mismatch')
    nodes=context.get('nodes')
    if not isinstance(nodes,list) or len(nodes)>2000 or any(not isinstance(n,dict) for n in nodes):raise ValueError('Interaction Field identities')
    scenes=[];pool=bytearray();counts=dict(fields=0,slots=0,triggers=0,unused=0,line=0,linon=0,sline=0,staticSline=0,dynamicSline=0,stops=0,backgroundMatched=0,backgroundUnknown=0)
    for node in nodes:
        if node.get('status')!='available':continue
        fid=node['id'];name=node['name']
        if type(fid) is not int or not 0<=fid<len(names) or name!=names[fid] or name.casefold() not in entries or any(s['fieldId']==fid for s in scenes):raise ValueError('Interaction maplist/Field identity mismatch')
        value=scene_interactions(read_entry(archive,entries[name.casefold()]),fid,name)
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
    if manifest.get('sources',{}).get('flevel.lgp')!=report['sources']['flevel.lgp']:raise ValueError('Interaction Workspace source mismatch')
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
    args=parser.parse_args(argv)
    try:print(json.dumps(update_workspace(args.source,args.workspace),ensure_ascii=False,indent=2));return 0
    except (ValueError,OSError,FormatError,KeyError,TypeError,struct.error) as error:parser.exit(1,f'Field interaction generation rejected: {error}\n')


if __name__=='__main__':raise SystemExit(main())
