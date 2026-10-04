"""Bounded abstract world-script analysis and private WM0 spatial export.

Only literal stack expressions and explicit placement pairs are resolved.
Scheduled calls yield reachability edges, never emulated runtime state.
"""
# SPDX-License-Identifier: GPL-3.0-only
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path

from .ev import decode_ev, basic_blocks, PUSH_CONSTANT, ENTER_FIELD, RETURN, JUMP, BRANCH_FALSE
from .poi import parse_maplist, parse_field_table, trigger_components, representative, NAME_GROUPS
from .dataset import discover, child_ci
from .lgp import inventory, read_entry
from .map_reader import parse_map
from .reconstruction import Mapping, SphereConfig
from .safety import output_path
from .lzss import FormatError

MAX_STATES = 12000
MAX_CALL_DEPTH = 16
MAX_INSTRUCTIONS = 200000
OP_NAMES = {0x100:'RESET',0x110:'PUSH_CONSTANT',0x200:'GOTO',0x201:'GOTO_IF_FALSE',0x203:'RETURN',
    0x300:'LOAD_MODEL',0x308:'SET_MESH_POS',0x309:'SET_LOCAL_POS',0x30c:'ENTER_VEHICLE',
    0x310:'SET_POINT',0x311:'SET_POINT_MESH',0x312:'SET_POINT_LOCAL',0x317:'BATTLE',
    0x318:'ENTER_FIELD',0x330:'SET_ENTITY',0x331:'EXIT_VEHICLE',0x33c:'EXIT_UNDERWATER',
    0x33d:'SET_FIELD_ENTRY_ID',0x343:'MOVE_TO_MODEL',0x349:'SET_PROGRESS',0x34b:'SET_CHOCOBO',
    0x34c:'SET_SUBMARINE',0x34d:'SHOW_LAYER',0x34e:'HIDE_LAYER',0x354:'SET_VEHICLE_USABLE'}
# Necessary stack effects, independently described from C_00764F9C. Unknown
# effects clear abstract values; they cannot accidentally resolve a later event.
POPS = {0x300:1,0x302:0,0x303:1,0x304:1,0x305:1,0x306:0,0x307:1,0x308:2,0x309:2,
    0x30a:1,0x30b:1,0x30c:0,0x30d:0,0x30e:2,0x310:2,0x311:2,0x312:2,
    0x313:3,0x314:2,0x315:3,0x316:3,0x317:1,0x318:2,0x319:1,0x31a:0,
    0x31c:1,0x31d:1,0x31e:1,0x31f:1,0x320:0,0x321:1,0x324:4,0x325:1,
    0x326:3,0x327:0,0x328:1,0x329:1,0x32a:1,0x32b:1,0x32c:2,0x32d:0,
    0x32e:0,0x32f:1,0x330:1,0x331:0,0x332:0,0x333:2,0x334:0,0x335:0,
    0x336:1,0x337:1,0x338:0,0x339:0,0x33a:1,0x33b:2,0x33c:0,0x33d:1,
    0x33e:1,0x33f:2,0x343:1,0x344:1,0x345:1,0x346:1,0x347:1,0x348:2,
    0x349:1,0x34b:1,0x34c:1,0x34d:3,0x34e:1,0x34f:1,0x350:1,0x351:1,
    0x352:1,0x353:0,0x354:1,0x355:1}
SPATIAL = {0x317:'scripted_battle',0x318:'dynamic_entrance',0x30c:'vehicle_event',
    0x331:'vehicle_event',0x354:'vehicle_event',0x34b:'vehicle_event',0x34c:'vehicle_event',
    0x33c:'map_transition',0x33d:'dynamic_entrance'}
BINARY = {0x30:lambda a,b:a*b,0x40:lambda a,b:a+b,0x41:lambda a,b:a-b,
    0x50:lambda a,b:a<<b,0x51:lambda a,b:a>>b,0x60:lambda a,b:int(a<b),
    0x61:lambda a,b:int(a>b),0x62:lambda a,b:int(a<=b),0x63:lambda a,b:int(a>=b),
    0x70:lambda a,b:int(a==b),0x71:lambda a,b:int(a!=b),0x80:lambda a,b:a&b,
    0xa0:lambda a,b:a|b,0xb0:lambda a,b:int(bool(a) and bool(b)),0xc0:lambda a,b:int(bool(a) or bool(b))}

def opcode_name(op):
    return OP_NAMES.get(op, f'CALL_FN_{op-0x204}' if 0x204<=op<0x300 else f'OP_{op:03X}')

@dataclass(frozen=True)
class Value:
    literal: int|None = None
    kinds: tuple[str,...] = ()

def pop(stack,n):
    values=list(stack[-n:]) if n else []
    return (stack[:-n] if n else stack), [Value()]*max(0,n-len(values))+values

def point_coordinates(mesh, local):
    if mesh is None or local is None or not 0<=mesh[0]<36 or not 0<=mesh[1]<28:
        return None
    return mesh[0]*8192+(local[0]&8191),mesh[1]*8192+(local[1]&8191)

def analyze_ev(data, max_states=MAX_STATES, max_instructions=MAX_INSTRUCTIONS):
    functions, intervals=decode_ev(data)
    by_header={f.header:f for f in functions}
    observations={};calls=set();reachable=set();unresolved=[];steps=0;function_stats=[]
    for f in functions:
        code=intervals[f.start];blocks=basic_blocks(f,code)
        # State: pc, literal/symbolic stack, active model, mesh/local pairs,
        # active point, point mesh/local pairs, condition categories.
        queue=deque([(f.start,(),f.model,None,None,None,None,None,())]);visited=set();pcs=set();joined={}
        while queue:
            state=queue.popleft()
            # Finite abstract join at each PC. Divergent branch/loop literals
            # widen to unknown instead of enumerating runtime iterations.
            prior=joined.get(state[0])
            if prior is not None:
                values=[]
                if len(prior[1])==len(state[1]):
                    for old,new in zip(prior[1],state[1]):
                        kinds=tuple(sorted(set(old.kinds)|set(new.kinds)))
                        values.append(Value(old.literal if old.literal==new.literal else None,kinds))
                state=(state[0],tuple(values),*(old if old==new else None for old,new in zip(prior[2:8],state[2:8])),
                    tuple(sorted(set(prior[8])|set(state[8]))))
            joined[state[0]]=state
            if state in visited: continue
            if len(visited)>=max_states or steps>=max_instructions:
                unresolved.append(dict(call_table_record=f.table,function_id=f.header,
                    reason='analysis_guard',instruction_offset=state[0]));break
            visited.add(state);steps+=1
            pc,stack,model,mesh,local,point,point_mesh,point_local,conditions=state
            if pc not in code: raise FormatError(f'EV branch outside function/into operand: {pc}')
            op,arg,nxt=code[pc];reachable.add(pc);pcs.add(pc)
            args=[];placement=None;call=None;kind=SPATIAL.get(op)
            if op==RETURN: continue
            if op==0: pass
            elif op==0x100: stack=()
            elif 0x100<op<0x200:
                if op==PUSH_CONSTANT: value=Value(arg)
                else:
                    bank=op&3
                    tag='savemap-dependent' if bank==0 else 'model-dependent' if bank==3 and arg in (8,15) else 'runtime-dependent'
                    value=Value(None,(tag,))
                stack=(*stack,value)[-8:]
            elif op in BINARY or op in (0x15,0x17):
                stack,v=pop(stack,2 if op in BINARY else 1)
                kinds=tuple(sorted({k for x in v for k in x.kinds}));literal=None
                if all(x.literal is not None for x in v):
                    try:
                        if op in (0x50,0x51) and not 0<=v[1].literal<32: raise ValueError()
                        literal=BINARY[op](v[0].literal,v[1].literal) if op in BINARY else -v[0].literal if op==0x15 else int(not v[0].literal)
                        literal=(literal+2**31)%2**32-2**31
                    except (ValueError,OverflowError): pass
                stack=(*stack,Value(literal,kinds))[-8:]
            elif op==0xe0:
                stack,v=pop(stack,2);stack=(*stack,v[-1])[-8:] # no memory emulation
            elif op in (0x18,0x19,0x1a,0x1b):
                stack,_=pop(stack,1);stack=(*stack,Value(None,('runtime-dependent',)))[-8:]
            elif op==BRANCH_FALSE:
                stack,v=pop(stack,1)
                conditions=tuple(sorted(set(conditions)|set(v[0].kinds)|({'conditional-branch'} if v[0].literal is None else set())))
                targets=[arg,nxt] if v[0].literal is None else [arg if not v[0].literal else nxt]
                for target in targets: queue.append((target,stack,model,mesh,local,point,point_mesh,point_local,conditions))
                continue
            elif op==JUMP:
                queue.append((arg,stack,model,mesh,local,point,point_mesh,point_local,conditions));continue
            elif 0x204<=op<0x300:
                stack,v=pop(stack,1);target=v[0].literal
                if target is not None and 0<=target<=65535:
                    call=(0x4000|(target<<8)|(op-0x204)) if target<64 else op-0x204
                    if call in by_header: calls.add((f.header,call,pc))
                    else: unresolved.append(dict(call_table_record=f.table,function_id=f.header,instruction_offset=pc,reason='missing_call_target',target=call))
                else: unresolved.append(dict(call_table_record=f.table,function_id=f.header,instruction_offset=pc,reason='dynamic_call_target'))
                # Scheduled call: caller position/stack after a frame is unknown.
                stack=();model=mesh=local=None
            elif op>=0x300:
                count=POPS.get(op)
                if count is None:
                    stack=();model=mesh=local=None
                else:
                    stack,v=pop(stack,count);args=[x.literal for x in v]
                    conditions=tuple(sorted(set(conditions)|{k for x in v for k in x.kinds}))
                    if op in (0x300,0x330):
                        model=args[0] if args[0] is not None and 0<=args[0]<64 else None;mesh=local=None
                        if op==0x300 and model is not None and 0x4000|(model<<8) in by_header:
                            calls.add((f.header,0x4000|(model<<8),pc))
                    elif op in (0x308,0x309):
                        pair=tuple(args) if all(x is not None for x in args) else None
                        if op==0x308: mesh=pair
                        else: local=pair
                        placement=point_coordinates(mesh,local) if model is not None else None
                        kind='world_object' if placement is not None else None
                        if op==0x309 and placement is None:
                            unresolved.append(dict(call_table_record=f.table,function_id=f.header,instruction_offset=pc,
                                reason='dynamic_or_partial_model_position'))
                    elif op==0x310:
                        point=args[0];point_mesh=point_local=None
                    elif op in (0x311,0x312):
                        pair=tuple(args) if all(x is not None for x in args) else None
                        if op==0x311: point_mesh=pair
                        else: point_local=pair
                    elif op in (0x306,0x327,0x32d,0x32e,0x334,0x343,0x346,0x347,0x33f):
                        model=mesh=local=None;stack=()
                if kind:
                    key=(f.table,pc,kind,tuple(args),model,placement)
                    previous=observations.get(key)
                    observation=dict(function_id=f.header,call_table_record=f.table,instruction_offset=pc,
                        basic_block=blocks[pc],opcode=op,opcode_name=opcode_name(op),event_type=kind,
                        raw_arguments=args,model_id=model,position=placement,condition_kind=list(conditions))
                    if previous: observation['condition_kind']=sorted(set(previous['condition_kind'])|set(conditions))
                    observations[key]=observation
            else:
                # Unimplemented arithmetic cannot leave trustworthy values.
                stack=()
            if nxt not in code: raise FormatError(f'EV reachable function falls through boundary: {nxt}')
            queue.append((nxt,stack,model,mesh,local,point,point_mesh,point_local,conditions))
        function_stats.append(dict(call_table_record=f.table,function_id=f.header,kind=f.kind,
            model_id=f.model,start=f.start,basic_blocks=len(set(blocks.values())),reachable_instructions=len(pcs),states=len(visited)))
    # Cycles are reported, never unfolded indefinitely. No inferred dynamic edges.
    graph=defaultdict(set)
    for a,b,_ in calls: graph[a].add(b)
    cycles=[]
    for root in sorted(graph):
        queue=deque([(root,0)]);seen=set()
        while queue:
            node,depth=queue.popleft()
            if node in seen or depth>=MAX_CALL_DEPTH: continue
            seen.add(node)
            for target in graph[node]:
                if target==root: cycles.append(root)
                elif target not in seen: queue.append((target,depth+1))
    instructions={pc:op for interval in intervals.values() for pc,(op,_,_) in interval.items()}
    counts=Counter(instructions[pc] for pc in reachable)
    return dict(observations=sorted(observations.values(),key=lambda o:(o['call_table_record'],o['instruction_offset'],str(o['raw_arguments']),str(o['position']))),
        unresolved=sorted({json.dumps(x,sort_keys=True):x for x in unresolved}.values(),key=lambda x:(x['call_table_record'],x['instruction_offset'],x['reason'])),
        functions=function_stats,call_graph=[dict(caller=a,callee=b,instruction_offset=pc) for a,b,pc in sorted(calls)],
        cyclic_functions=sorted(set(cycles)),opcode_inventory=[dict(opcode=op,name=opcode_name(op),count=count) for op,count in sorted(counts.items())],
        limits=dict(max_states_per_function=max_states,max_instructions=max_instructions,max_call_depth=MAX_CALL_DEPTH),
        visited_instructions=steps)

def reachable_calls(root, graph, max_depth=MAX_CALL_DEPTH):
    edges=defaultdict(set)
    for e in graph: edges[e['caller']].add(e['callee'])
    seen=set();queue=deque([(root,0)])
    while queue:
        node,depth=queue.popleft()
        if node in seen: continue
        seen.add(node)
        if depth<max_depth: queue.extend((x,depth+1) for x in sorted(edges[node]))
    return seen

def containing_surface(mesh,x,north):
    matches=[]
    for t in mesh.triangles:
        a,b,c=[mesh.position(i) for i in t.indices]
        det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        if abs(det)<1e-9: continue
        u=((x-a[0])*(c[1]-a[1])-(north-a[1])*(c[0]-a[0]))/det
        v=((b[0]-a[0])*(north-a[1])-(b[1]-a[1])*(x-a[0]))/det
        if u>=-1e-8 and v>=-1e-8 and u+v<=1+1e-8:
            matches.append((a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]),t))
    if not matches or max(h for h,_ in matches)-min(h for h,_ in matches)>1e-6:
        # Overlapping surfaces with different heights cannot identify a model's
        # gameplay surface from XY alone. Preserve the anchor, not a guessed Y.
        return None,None
    return max(matches,key=lambda p:p[1].triangle_id)

def extract_events(analysis,world,field_table):
    mapping=Mapping(*world.extent,SphereConfig());meshes={m.cell:m for m in world.base_meshes}
    anchors=defaultdict(list);unresolved=list(analysis['unresolved']);events=[]
    functions={f['function_id']:f for f in analysis['functions']}
    # Source MAP trigger components retain all triangles, no geometry duplication.
    for header,f in functions.items():
        if f['kind']!=2: continue
        cell=(header>>4)&1023;mesh=meshes.get((cell%36,cell//36))
        if mesh is None: raise FormatError('EV mesh header outside WM0')
        ts=[t for t in mesh.triangles if t.script==(header&15)+3]
        for component in trigger_components(mesh,ts):
            raw,t=representative(mesh,component)
            anchor=dict(raw=raw,mesh=mesh,triangle=t,trigger_triangle_ids=[v.triangle_id for v in component],anchor_kind='derived_trigger_centroid',anchor_function=header)
            for called in reachable_calls(header,analysis['call_graph']): anchors[called].append(anchor)
            # A source trigger remains an event even if its dynamic outcomes are unknown.
            events.append(make_event(mapping,anchor,dict(function_id=header,call_table_record=f['call_table_record'],
                instruction_offset=f['start'],basic_block=f['start'],opcode=None,opcode_name='MAP_TRIGGER',event_type='script_trigger',
                raw_arguments=[],model_id=None,condition_kind=['runtime-dependent']),field_table))
    # Special engine gate: system-9 invocation by terrain 27 is NOT MAP script bits.
    if 9 in functions:
        for mesh in world.base_meshes:
            for component in trigger_components(mesh,[t for t in mesh.triangles if t.ff7_terrain_type==27]):
                raw,t=representative(mesh,component)
                anchor=dict(raw=raw,mesh=mesh,triangle=t,trigger_triangle_ids=[v.triangle_id for v in component],
                    anchor_kind='derived_terrain_gate_centroid',anchor_function=9)
                for called in reachable_calls(9,analysis['call_graph']): anchors[called].append(anchor)
    for o in analysis['observations']:
        bound=anchors.get(o['function_id'],[])
        if o['event_type']=='world_object':
            x,n=o['position'];mesh=meshes.get((x//8192,n//8192))
            if mesh is None:
                unresolved.append({**o,'reason':'placement_outside_WM0'});continue
            h,t=containing_surface(mesh,x,n)
            bound=[dict(raw=(x,n,h),mesh=mesh,triangle=t,trigger_triangle_ids=[],anchor_kind='script_model_position',anchor_function=o['function_id'])]
        if not bound:
            unresolved.append({**o,'reason':'non_spatial_or_runtime_anchor'});continue
        for a in bound:
            e=make_event(mapping,a,o,field_table)
            if e['event_type']=='dynamic_entrance' and e['field_id'] is None:
                unresolved.append({**o,'reason':'dynamic_or_unknown_field_destination','anchor_function':a['anchor_function']})
                e['event_type']='unresolved_script_event'
            events.append(e)
    # Identical output records deduplicated across aliases/constant paths.
    unique={e['id']:e for e in events}
    return sorted(unique.values(),key=lambda e:e['id']),sorted(unresolved,key=lambda e:(e.get('call_table_record',0),e.get('instruction_offset',0),e['reason']))

def make_event(mapping,a,o,table):
    x,n,h=a['raw'];lon,lat,_=mapping.game_to_geographic(x,n,h or 0)
    t=a['triangle'];mesh=a['mesh'];args=o['raw_arguments'];destination={};entry=scenario=None
    if o['opcode']==ENTER_FIELD and len(args)==2:
        entry,scenario=args;destination=table.get((entry,scenario),{})
    field=destination.get('field_name');identity=next((row[0] for row in NAME_GROUPS if field in row[3]),None)
    battle=args[0] if o['opcode']==0x317 and args else None
    model=o['model_id'];kind=o['event_type']
    name=f"Field entrance · {field}" if field else f'Scripted Battle {battle}' if battle is not None else f'Scripted Model {model}' if kind=='world_object' else f'{kind.replace("_"," ").title()} · function {o["function_id"]:04X}'
    key=[o['call_table_record'],o['instruction_offset'],kind,args,model,a['anchor_function'],mesh.section_id,mesh.mesh_id,a['trigger_triangle_ids'],x,n]
    id='event-'+hashlib.sha256(json.dumps(key,separators=(',',':')).encode()).hexdigest()[:20]
    return dict(id=id,event_type=kind,name=name,display_name=name,longitude=lon,latitude=lat,height=h,
        game_x=x,game_north=n,game_height=h,height_source='interpolated_from_surface' if h is not None else 'unknown',
        anchor_kind=a['anchor_kind'],world_map=0,section_id=mesh.section_id,mesh_id=mesh.mesh_id,
        triangle_id=t.triangle_id if t else None,trigger_triangle_ids=a['trigger_triangle_ids'],
        anchor_function=a['anchor_function'],function_id=o['function_id'],call_table_record=o['call_table_record'],
        instruction_offset=o['instruction_offset'],basic_block=o['basic_block'],opcode=o['opcode'],opcode_name=o['opcode_name'],
        raw_arguments=args,model_id=model,entity_id=None,field_id=destination.get('field_id'),field_name=field,
        entrance_table_id=entry,scenario=scenario,battle_id=battle,location_id=identity,
        condition_kind=sorted(set(o['condition_kind'])|({'vehicle-dependent','savemap-dependent','reference-engine-gate'} if a['anchor_function']==9 else set())),
        runtime_availability='not_simulated',source_file='wm0.ev',source_record=o['call_table_record'],
        confidence='classic_pc_reference_derived' if a['anchor_function']==9 else 'source_constant_placement' if a['anchor_kind']=='script_model_position' else 'source_trigger_derived',
        notes='Script-defined placement, not current runtime position.' if kind=='world_object' else 'Static potential event; runtime conditions and scheduled execution are not simulated.')

def build_events(source:Path,destination:Path,field_archive:Path|None=None):
    destination=output_path(destination);ds=discover(source);lgp=ds.files['world_us.lgp']
    if destination.is_relative_to(ds.wm_directory.resolve()):
        raise ValueError('Output cannot be inside the selected read-only source WM directory')
    entries=inventory(lgp)['entries']
    def payload(name):
        found=[e for e in entries if e['filename'].casefold()==name]
        if len(found)!=1: raise FormatError(f'Expected one archive entry: {name}')
        return read_entry(lgp,found[0])
    ev=payload('wm0.ev');field=payload('field.tbl')
    if field_archive is None:
        field_dir=child_ci(ds.wm_directory.parent,'field')
        field_archive=child_ci(field_dir,'flevel.lgp') if field_dir else None
    if field_archive is None: raise FormatError('English flevel.lgp/maplist required')
    if destination.is_relative_to(field_archive.resolve().parent):
        raise ValueError('Output cannot be inside the selected read-only source field directory')
    toc=inventory(field_archive)['entries'];found=[e for e in toc if e['filename'].casefold()=='maplist']
    if len(found)!=1: raise FormatError('Expected one maplist')
    names=read_entry(field_archive,found[0]);table=parse_field_table(field,parse_maplist(names))
    world=parse_map(ds.files['wm0.map'],0)
    if world.failures: raise FormatError('Cannot extract events from partial WM0')
    analysis=analyze_ev(ev);events,unresolved=extract_events(analysis,world,table)
    hashes={name:hashlib.sha256(data).hexdigest() for name,data in [('wm0.map',ds.files['wm0.map'].read_bytes()),
        ('world_us.lgp',lgp.read_bytes()),('wm0.ev',ev),('field.tbl',field),('maplist',names)]}
    extraction={key:value for key,value in analysis.items() if key not in ('observations','unresolved')}
    extraction.update(event_counts=dict(sorted(Counter(e['event_type'] for e in events).items())),
        unresolved_reasons=dict(sorted(Counter(e['reason'] for e in unresolved).items())))
    asset=dict(schema='gaiagis-events',version=1,reconstruction='v1-geometric-gaia',world_extent=list(world.extent),
        mapping=dict(method='inverse_mercator',radius_m=6371008.8,flip_latitude=False,antimeridian_game_east=0,vertical_scale_m_per_raw_unit=1),
        sources=hashes,events=events,unresolved=unresolved,extraction=extraction)
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(asset,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8')
    return asset
