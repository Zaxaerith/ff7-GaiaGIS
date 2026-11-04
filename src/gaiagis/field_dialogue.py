"""Private EN Field dialogue evidence, using the existing bounded Field CFG.

No VM, runtime variables or NPC coordinates. Source-bound CFG recovery belongs
to the shared Field decoder. Game strings stay
in an optional private, per-scene compressed payload, never in audit output.
"""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import struct
import zlib
from .field_context import field_sections, parse_script, PC_MAPLIST_SHA256
from .lzss import FormatError
from .field_provenance import LEGACY, CMUSC8, context_decoder, evidence_identity, validate_profile

FILENAME = 'gaia-field-dialogue.bin'
MAGIC = b'GAIADLG\0'
GENERATOR_VERSION = 'field-dialogue-1'
DECODER = 'field-cfg-v510-cmusc-stop'
EN_ARCHIVE = 'af695ccf7c681be222f5f716758160e39469ec02bc0af3dd6f20a5e9c2a34807'
MAX_PACK, MAX_HEADER, MAX_SCENE = 16_000_000, 1_000_000, 2_000_000
DIALOGUES = {0x40: 3, 0x48: 7}
REQUESTS = {1: 3, 2: 3, 3: 3}
CONDITIONS = {0x14: 6, 0x15: 7, 0x16: 8, 0x17: 9, 0x18: 8, 0x19: 9}
TARGETS = DIALOGUES | REQUESTS | CONDITIONS
SPECIAL = {0xe0,0xe1,0xe2,0xe3,0xe4,0xe6,0xe7,0xe8,*range(0xea,0xfa)}
EXTENDED = {*range(0xd2,0xdd),0xde,0xdf,0xe0,0xe1,0xe9}

def digest(value): return hashlib.sha256(value).hexdigest()
def encoded(value): return json.dumps(value,separators=(',', ':'),sort_keys=True,ensure_ascii=True).encode('ascii')

def text_span(section, start, end):
    """Token boundaries only. A 0xff inside a known parameter is not a terminator."""
    cursor=start
    while cursor<end:
        code=section[cursor];cursor+=1
        if code==255:return cursor,None
        if code<0xe0 or code in SPECIAL:continue
        if code!=0xfe:return None,'unknown_character'
        if cursor>=end:return None,'truncated_control'
        sub=section[cursor];cursor+=1
        width=2 if sub==0xdd else 4 if sub==0xe2 else 0
        if not width and sub not in EXTENDED:return None,'unknown_control'
        if cursor+width>end:return None,'truncated_control'
        cursor+=width
    return None,'no_terminator'

def text_table(section, referenced, with_text):
    _,actors,_,at,sounds=struct.unpack_from('<HBBHH',section)
    extra=struct.unpack_from(f'<{sounds}I',section,32+actors*8)
    end=extra[0] if extra else len(section)
    table=dict(status='unavailable',reason=None,at=at,end=end,declared=None,texts=[])
    if end<at+2 or end>len(section):table['reason']='no_text_region';return table
    if any(not at+2<=p<=len(section)-4 for p in extra) or any(a>=b for a,b in zip(extra,extra[1:])):table['reason']='extra_bounds';return table
    count=struct.unpack_from('<H',section,at)[0];table['declared']=count
    if end-at<=4 and count==0:table.update(status='valid');return table
    if at+4>end:table['reason']='table_bounds';return table
    first=struct.unpack_from('<H',section,at+2)[0]
    if first<4 or first%2 or first>end-at or count>256 or first!=2+count*2:table['reason']='table_count';return table
    offsets=struct.unpack_from(f'<{count}H',section,at+2)
    if any(not first<=p<end-at for p in offsets) or any(a>=b for a,b in zip(offsets,offsets[1:])):table['reason']='text_pointer';return table
    table.update(status='valid')
    for text_id,offset in enumerate(offsets):
        # Original strings may share a suffix; only the extra boundary is authoritative.
        stop,reason=text_span(section,at+offset,end)
        table['texts'].append(dict(id=text_id,offset=at+offset,bytes=None if stop is None else stop-at-offset,
            status='unavailable' if reason else 'valid',reason=reason,
            body=section[at+offset:stop].hex() if stop is not None and with_text and text_id in referenced else None))
    parameters=set()
    for t in table['texts']:
        if t['status']!='valid':continue
        p=t['offset'];stop=p+t['bytes']
        while p<stop:
            c=section[p];p+=1
            if c==0xfe:
                k=section[p];width=3 if k==0xdd else 5 if k==0xe2 else 1;parameters.update(range(p,p+width));p+=width
    for t in table['texts']:
        if t['offset'] in parameters:t.update(status='unavailable',reason='text_pointer_operand',bytes=None,body=None)
    return table

def scene_dialogue(section, section8, section5, field_id, name, member_hash, *, with_text=False, decoder=LEGACY):
    base=dict(fieldId=field_id,name=name,memberSHA256=member_hash,section1SHA256=digest(section),section8SHA256=digest(section8),
        section5SHA256=digest(section5) if section5 is not None else None,section1Bytes=len(section))
    _,_,stops,trace=parse_script(section,evidence=True,decoder=decoder)
    selected=[r for r in trace['instructions'] if r['opcode'] in TARGETS]
    roots=defaultdict(list)
    for i,entry in enumerate(trace['entries']):roots[entry['entry']].append(i)
    owners=defaultdict(list);wanted={r['offset'] for r in selected};work=0
    for entry,aliases in roots.items():
        seen={entry};pending=[entry]
        for pc in pending:
            work+=1
            if work>8_000_000:raise FormatError('Dialogue CFG work budget')
            if pc in wanted:owners[pc].extend(aliases)
            for target in trace['successors'].get(pc,[]):
                if target not in seen:seen.add(target);pending.append(target)
    records=[];referenced=set()
    for r in selected:
        pc,op=r['offset'],r['opcode'];assert r['length']==TARGETS[op]
        if r['entryReachable'] and op in DIALOGUES:referenced.add(section[pc+(2 if op==0x40 else 3)])
        records.append(dict(offset=pc,opcode=op,raw=section[pc:pc+r['length']].hex(),entryReachable=r['entryReachable'],owners=sorted(owners[pc]) if r['entryReachable'] else []))
    table=text_table(section,referenced,with_text)
    total=sum(r['length'] for r in trace['instructions']);uncovered=trace['codeEnd']-trace['codeStart']-total
    cfg=[[r['offset'],r['length'],r['opcode'],int(r['entryReachable']),*trace['successors'].get(r['offset'],[])] for r in trace['instructions']]
    return dict(**base,status='partial' if stops or uncovered else 'complete',codeStart=trace['codeStart'],codeEnd=trace['codeEnd'],
        entries=trace['entries'],cfg=cfg,records=records,stops=stops,uncoveredBytes=uncovered,textTable=table)

def validate_scene(scene, *, decoder=LEGACY):
    """Generator readback: do not re-interpret code or include text in errors."""
    if not isinstance(scene,dict) or len(scene.get('records',[]))>16_384 or len(scene.get('cfg',[]))>65_535 or len(scene.get('entries',[]))>2112:raise ValueError('Dialogue scene budget')
    records=scene['records'];previous=-1;ids=set()
    start,end=scene['codeStart'],scene['codeEnd']
    if not 32<=start<=end<=min(scene['section1Bytes'],65535):raise ValueError('Dialogue code bounds')
    nodes={};cursor=start;total=0
    for row in scene['cfg']:
        if not isinstance(row,list) or not 4<=len(row)<=6 or not all(type(n) is int for n in row) or not cursor<=row[0]<end or not 1<=row[1]<=end-row[0] or not 0<=row[2]<=255 or row[3] not in (0,1) or len(set(row[4:]))!=len(row[4:]):raise ValueError('Dialogue CFG boundary')
        if row[2]==253 and (decoder!=CMUSC8 or row[1]!=8):raise ValueError('Dialogue CMUSC decoder identity')
        cursor=row[0]+row[1];total+=row[1];nodes[row[0]]=row
    stops={r['offset'] for r in scene['stops']}
    if len(stops)!=len(scene['stops']) or any(not start<=n<end for n in stops):raise ValueError('Dialogue stop boundary')
    if scene['uncoveredBytes']!=end-start-total or scene['status']!=('partial' if stops or scene['uncoveredBytes'] else 'complete'):raise ValueError('Dialogue CFG accounting')
    for row in nodes.values():
        if any(n not in nodes and n not in stops for n in row[4:]):raise ValueError('Dialogue CFG successor boundary')
    roots=defaultdict(list);keys=set()
    for i,e in enumerate(scene['entries']):
        key=(e['actor'],e['slot'],e['kind'])
        if key in keys or not 0<=e['actor']<64 or not 0<=e['slot']<32 or e['kind'] not in ('table','main') or e['kind']=='main' and e['slot']!=0 or e['entry'] not in nodes and e['entry'] not in stops:raise ValueError('Dialogue Entry identity')
        keys.add(key);roots[e['entry']].append(i)
    ownership={r['offset']:[] for r in records};reachable=set();work=0
    for entry,aliases in roots.items():
        visited={entry};todo=[entry]
        for at in todo:
            work+=1
            if work>8_000_000:raise ValueError('Dialogue CFG validation budget')
            reachable.add(at)
            if at in ownership:ownership[at].extend(aliases)
            for target in nodes.get(at,[0,0,0,0])[4:]:
                if target not in visited:visited.add(target);todo.append(target)
    if any(bool(r[3])!=(r[0] in reachable) for r in nodes.values()):raise ValueError('Dialogue CFG reachability')
    for r in records:
        raw=bytes.fromhex(r['raw']);pc=r['offset'];op=r['opcode']
        node=nodes.get(pc)
        if op not in TARGETS or len(raw)!=TARGETS[op] or raw[0]!=op or pc<=previous or pc+len(raw)>scene['codeEnd'] or node is None or node[1]!=len(raw) or node[2]!=op or bool(node[3])!=r['entryReachable']:raise ValueError('Dialogue instruction identity')
        if not r['entryReachable'] and r['owners'] or any(not 0<=i<len(scene['entries']) for i in r['owners']):raise ValueError('Dialogue owners')
        if r['owners']!=sorted(ownership[pc]):raise ValueError('Dialogue Entry ownership')
        previous=pc;ids.add(pc)
    if ids!={pc for pc,row in nodes.items() if row[2] in TARGETS}:raise ValueError('Dialogue omitted reference')
    texts=scene['textTable']['texts'];refs={bytes.fromhex(r['raw'])[2 if r['opcode']==64 else 3] for r in records if r['entryReachable'] and r['opcode'] in DIALOGUES}
    for i,t in enumerate(texts):
        if t['id']!=i or t['body'] is not None and (i not in refs or t['status']!='valid'):raise ValueError('Dialogue text identity')
        if t['body'] is not None:
            data=bytes.fromhex(t['body']);stop,reason=text_span(data,0,len(data))
            if reason or stop!=len(data) or len(data)!=t['bytes']:raise ValueError('Dialogue text boundary')
    return scene

def encode_dialogue(source, directory, *, with_text=False):
    from .dataset import discover
    from .lgp import inventory,read_entry
    from .poi import parse_maplist
    from .web_export import sha256
    from .safety import protect_input
    ds=discover(source,'en');archive=ds.field_archive();directory=Path(directory).resolve();protect_input(archive.parent)
    if directory.is_relative_to(archive.parent) or archive.parent.is_relative_to(directory):raise ValueError('Dialogue input/output overlap')
    sources={'flevel.lgp':sha256(archive)}
    if sources['flevel.lgp']!=EN_ARCHIVE:raise ValueError('Dialogue requires verified original EN archive')
    entries={}
    for e in inventory(archive)['entries']:
        key=e['filename'].casefold()
        if key in entries:raise ValueError('Dialogue duplicate LGP member')
        entries[key]=e
    maplist=read_entry(archive,entries['maplist']);sources['maplist']=digest(maplist)
    if sources['maplist']!=PC_MAPLIST_SHA256:raise ValueError('Dialogue maplist source')
    names=parse_maplist(maplist);context_bytes=(directory/'gaia-field-context.json').read_bytes();context=json.loads(context_bytes)
    if context.get('version') not in (3,4,5,6) or context.get('archive')!='flevel.lgp' or any(context['sources'].get(k)!=v for k,v in sources.items()):raise ValueError('Dialogue Context source')
    spans=[];pool=bytearray();coverage=Counter()
    for node in context['nodes']:
        if node['status']!='available':continue
        fid,name=node['id'],node['name']
        if names[fid]!=name or name not in entries:raise ValueError('Dialogue maplist identity')
        raw=read_entry(archive,entries[name]);section,s8,s5=field_sections(raw,walkmesh=True,archive='flevel.lgp',member=name)
        scene=validate_scene(scene_dialogue(section,s8,s5,fid,name,digest(raw),with_text=with_text,decoder=context_decoder(context)),decoder=context_decoder(context));data=encoded(scene);compressed=zlib.compress(data,9)
        if len(data)>MAX_SCENE:raise ValueError('Dialogue scene size')
        spans.append(dict(fieldId=fid,name=name,memberSHA256=scene['memberSHA256'],section1SHA256=scene['section1SHA256'],section8SHA256=scene['section8SHA256'],section5SHA256=scene['section5SHA256'],offset=len(pool),bytes=len(compressed),rawBytes=len(data),sha256=digest(data)))
        pool.extend(compressed);coverage[scene['status']]+=1;coverage['fields']+=1;coverage['validTables']+=scene['textTable']['status']=='valid';coverage['texts']+=len(scene['textTable']['texts'])
        for r in scene['records']:
            if r['opcode'] in DIALOGUES:coverage[('MESSAGE' if r['opcode']==64 else 'ASK')+('' if r['entryReachable'] else '_unreachable')]+=1
        coverage['textBodies']+=sum(t['body'] is not None for t in scene['textTable']['texts']);coverage['badTexts']+=sum(t['status']=='unavailable' for t in scene['textTable']['texts'])
    version,generator,decoder=evidence_identity('field-dialogue',context)
    meta=dict(schema='gaiagis-field-dialogue',version=version,generator_revision=generator,decoder=DECODER if version==1 else decoder,sourceLanguage='en',mode='with-text' if with_text else 'metadata-only',sources=sources,contextSHA256=digest(context_bytes),coverage=dict(coverage),scenes=spans)
    header=encoded(meta);payload=MAGIC+struct.pack('<II',version,len(header))+header+pool
    if len(header)>MAX_HEADER or len(payload)>MAX_PACK:raise ValueError('Dialogue pack budget')
    if sha256(archive)!=sources['flevel.lgp'] or (directory/'gaia-field-context.json').read_bytes()!=context_bytes:raise ValueError('Dialogue input changed')
    return payload,dict(coverage=meta['coverage'],bytes=len(payload),sources=sources,contextSHA256=meta['contextSHA256'],mode=meta['mode'])

def matches_context(path, context_path):
    """A small header check for incremental reuse; never decode scene text here."""
    try:
        with Path(path).open('rb') as stream:
            prefix=stream.read(16)
            if len(prefix)!=16 or prefix[:8]!=MAGIC:return False
            version,length=struct.unpack_from('<II',prefix,8)
            if version not in (1,2) or not 0<length<=MAX_HEADER or 16+length>Path(path).stat().st_size:return False
            header=json.loads(stream.read(length))
        if not isinstance(header,dict):return False
        return (header.get('generator_revision')==f'field-dialogue-{version}' and header.get('decoder')==(DECODER if version==1 else context_decoder(json.loads(Path(context_path).read_bytes())))
            and header.get('sources')=={'flevel.lgp':EN_ARCHIVE,'maplist':PC_MAPLIST_SHA256}
            and header.get('contextSHA256')==digest(Path(context_path).read_bytes()))
    except (ValueError,OSError,struct.error):return False


def build_field_dialogue(source,directory):
    from .field_interaction import atomic_write
    payload,report=encode_dialogue(source,directory)
    atomic_write(Path(directory)/FILENAME,payload);return report

def update_workspace(source,directory,*,with_text=False):
    """Only the new resource and Manifest change. Keep the old Manifest for legacy use."""
    from .local import server_manifest
    from .field_interaction import atomic_write
    from .safety import output_path
    from ._version import __version__
    directory=output_path(Path(directory));manifest=server_manifest(directory);mp=directory/'gaia-workspace.json';previous=mp.read_bytes();path=directory/FILENAME;old=path.read_bytes() if path.exists() else None
    context=directory/'gaia-field-context.json';record=next((r for r in manifest['assets'] if r['filename']==context.name),None)
    if not record or record['sha256']!=digest(context.read_bytes()) or record['bytes']!=context.stat().st_size:raise ValueError('Dialogue Context Manifest identity')
    payload,report=encode_dialogue(source,directory,with_text=with_text)
    if mp.read_bytes()!=previous:raise ValueError('Dialogue Manifest changed')
    backup=output_path(directory/'.build/recovery/field-dialogue'/digest(previous));backup.mkdir(parents=True,exist_ok=True)
    saved=backup/'gaia-workspace.json'
    if saved.exists() and saved.read_bytes()!=previous:raise ValueError('Dialogue recovery conflict')
    atomic_write(saved,previous)
    if old is not None:atomic_write(backup/FILENAME,old)
    manifest['assets']=[r for r in manifest['assets'] if r['filename']!=FILENAME]+[dict(filename=FILENAME,type='field-dialogue',mapId='shared',sha256=digest(payload),bytes=len(payload),dependencies=['gaia-field-context.json'],generator_version=json.loads(payload[16:16+struct.unpack_from('<I',payload,12)[0]])['generator_revision'])]
    manifest['tool_version']=__version__
    try:atomic_write(path,payload);atomic_write(mp,encoded(manifest)+b'\n')
    except BaseException:
        if old is None:path.unlink(missing_ok=True)
        else:atomic_write(path,old)
        atomic_write(mp,previous);raise
    return report

def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--with-text',action='store_true',help='Include only referenced, valid original EN text in the PRIVATE resource')
    a=p.parse_args(argv)
    try:print(json.dumps(update_workspace(a.source,a.workspace,with_text=a.with_text),indent=2));return 0
    except (ValueError,OSError,KeyError,FormatError,struct.error):p.exit(1,'Dialogue generation rejected; original data and unrelated assets are unchanged.\n')

if __name__=='__main__':raise SystemExit(main())
