"""Read-only WM0 entrance extraction; deliberately not a world-script interpreter.

Format evidence and conservative resolution policy: docs/v1.1/field-entrance-research.md.
"""
# SPDX-License-Identifier: GPL-3.0-only
from collections import defaultdict, deque
import hashlib
import json
import math
from pathlib import Path
import struct

from .dataset import discover, child_ci
from .lgp import inventory, read_entry
from .lzss import FormatError
from .map_reader import parse_map
from .reconstruction import Mapping, SphereConfig
from .safety import output_path
from .ev import decode_ev, CALL_TABLE_BYTES, PUSH_CONSTANT, ENTER_FIELD, RETURN, JUMP, BRANCH_FALSE

FIELD_RECORD_BYTES = 12
MAPLIST_NAME_BYTES = 32

# Editorial identity annotations only: no coordinate constants.
# Cross-checked against actual maplist IDs and the sources cited in poi-data.md.
NAME_GROUPS = (
    ('midgar','Midgar','city',('mds5_5',),('Sector 5 gate',)),
    ('kalm','Kalm','town',('elm',),()),
    ('chocobo-farm','Chocobo Farm','facility',('farm',),('Chocobo Ranch',)),
    ('mythril-mine','Mythril Mine','dungeon',('psdun_1','psdun_2'),('Mythril Mines',)),
    ('fort-condor','Fort Condor','facility',('condor1',),()),
    ('junon','Junon','city',('ujunon1',),('Lower Junon',)),
    ('temple-of-the-ancients','Temple of the Ancients','temple',('jtempl',),()),
    ('old-mans-house',"Old Man's House",'settlement',('zz1',),()),
    ('weapon-sellers-house',"Weapon Seller's House",'facility',('zz2',),()),
    ('mideel','Mideel','town',('itown1a','itown1b'),()),
    ('quadra-magic-cave','Quadra Magic Cave','cave',('zz7',),()),
    ('costa-del-sol','Costa del Sol','town',('del2',),()),
    ('mt-corel','Mt. Corel','landmark',('mtcrl_0',),('Mount Corel',)),
    ('north-corel','North Corel','town',('ncorel','ncorel2'),('Corel',)),
    ('corel-desert','Corel Desert','landmark',('desert2',),()),
    ('gongaga','Gongaga','village',('gonjun2',),()),
    ('cosmo-canyon','Cosmo Canyon','settlement',('cos_btm',),()),
    ('nibelheim','Nibelheim','town',('nivl_3',),()),
    ('rocket-town','Rocket Town','town',('rckt','rckt2'),()),
    ('lucrecias-cave',"Lucrecia's Cave",'cave',('zz4',),()),
    ('hp-mp-cave','HP↔MP Cave','cave',('zz6',),('HP MP Cave',)),
    ('wutai','Wutai','town',('uutai1','yougan3'),()),
    ('wutai-outskirts','Wutai Outskirts','entrance',('yougan',),()),
    ('mime-cave','Mime Cave','cave',('zz5',),()),
    ('bone-village','Bone Village','village',('bonevil',),()),
    ('corral-valley-cave','Corral Valley Cave','cave',('sandun_2',),()),
    ('icicle-inn','Icicle Inn','town',('snow',),()),
    ('chocobo-sages-house',"Chocobo Sage's House",'settlement',('zz3',),()),
    ('round-island-cave','Round Island Cave','cave',('zz8',),('Knights of the Round Cave',)),
    ('impaled-zolom','Impaled Zolom','landmark',('sichi',),()),
    ('mt-nibel','Mt. Nibel','landmark',('mtnvl2','mtnvl4'),('Mount Nibel',)),
    ('great-glacier','Great Glacier','landmark',('hyou1',),()),
    ('corral-valley','Corral Valley','landmark',('sango2',),()),
    ('forgotten-capital','Forgotten Capital','dungeon',('lost1',),('Forgotten City','City of the Ancients')),
)

def parse_maplist(data: bytes) -> list[str]:
    if len(data) < 2:
        raise FormatError('Truncated maplist')
    count = struct.unpack_from('<H', data)[0]
    if not count or len(data) != 2 + count * MAPLIST_NAME_BYTES:
        raise FormatError('Invalid maplist count/length')
    result = []
    for i in range(count):
        raw = data[2+i*32:2+(i+1)*32]
        if b'\0' not in raw:
            raise FormatError('Unterminated maplist name')
        try:
            name = raw.split(b'\0',1)[0].decode('ascii')
        except UnicodeDecodeError as exc:
            raise FormatError('Non-ASCII maplist name') from exc
        if any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_' for c in name):
            raise FormatError('Invalid maplist name')
        result.append(name)
    return result

def parse_field_table(data: bytes, names: list[str]) -> dict[tuple[int,int],dict]:
    if len(data) != 64 * 2 * FIELD_RECORD_BYTES:
        raise FormatError('FIELD.TBL must contain 64 paired records')
    result = {}
    for record in range(128):
        x,y,triangle,field,direction = struct.unpack_from('<hhHHB',data,record*12)
        if field >= len(names) or not names[field]:
            raise FormatError('FIELD.TBL references missing maplist field')
        result[(record//2+1,record%2)] = dict(field_id=field,field_name=names[field],
            field_x=x,field_y=y,field_triangle=triangle,field_direction=direction,
            field_table_record=record,field_table_byte_offset=record*12)
    return result

def mesh_field_calls(data: bytes) -> tuple[list[dict],list[dict],dict]:
    """Reachable CFG and contiguous constant arguments, not VM execution.

    Dynamic stack arithmetic/calls are intentionally not resolved. Instruction
    boundaries are checked globally per function to reject branches into operands.
    """
    decoded,intervals = decode_ev(data)
    functions = [(f.table,f.header,f.start) for f in decoded]
    calls,unresolved = [],[]
    for table,header,start in functions:
        if header>>14 != 2:
            continue
        end = next(f.end for f in decoded if f.table==table)
        instructions = intervals[start]
        queue=deque([(start,())]);visited=set();resolved=set()
        while queue:
            pc,pending=queue.popleft()
            if (pc,pending) in visited:
                continue
            visited.add((pc,pending))
            if pc not in instructions:
                raise FormatError(f'EV branch outside function or into operand: {pc}')
            op,arg,next_pc=instructions[pc]
            if op==RETURN:
                continue
            if op==PUSH_CONSTANT:
                pending=(*pending,arg)[-2:]
            elif op==ENTER_FIELD:
                if len(pending)==2 and 1<=pending[0]<=64 and pending[1] in (0,1):
                    key=(pending[0],pending[1],pc)
                    if key not in resolved:
                        resolved.add(key)
                        cell=(header>>4)&1023
                        calls.append(dict(call_table_record=table,function_header=header,
                            function_word_offset=start,source_script=header&15,
                            mesh_column=cell%36,mesh_row=cell//36,
                            instruction_word_offset=pc,entrance_table_id=pending[0],scenario=pending[1]))
                else:
                    unresolved.append(dict(call_table_record=table,instruction_word_offset=pc,
                                           reason='ENTER_FIELD arguments not contiguous constants'))
                pending=()
            else:
                pending=()
            if op in (JUMP,BRANCH_FALSE):
                queue.append((arg,()))
                if op==JUMP:
                    continue
            if next_pc<end:
                queue.append((next_pc,pending))
            else:
                raise FormatError('EV reachable function falls through its boundary')
    return calls,unresolved,dict(active_call_records=len(functions),mesh_functions=sum(h>>14==2 for _,h,_ in functions),
        excluded='Model/system transitions and nonconstant arguments; no runtime state evaluation')

def trigger_components(mesh, triangles):
    """Shared geometric edges handle duplicate vertex records without global welding."""
    neighbors=defaultdict(set);edges=defaultdict(list)
    by_id={t.triangle_id:t for t in triangles}
    for t in triangles:
        p=[mesh.position(i) for i in t.indices]
        for a,b in zip(p,p[1:]+p[:1]):
            edges[tuple(sorted((a,b)))].append(t.triangle_id)
    for ids in edges.values():
        for i in ids:
            neighbors[i].update(ids)
    remaining=set(by_id);result=[]
    while remaining:
        queue=[min(remaining)];component=set()
        while queue:
            i=queue.pop()
            if i in component:continue
            component.add(i);queue.extend(neighbors[i]-component)
        remaining-=component;result.append([by_id[i] for i in sorted(component)])
    return result

def representative(mesh, triangles):
    def area(t):
        a,b,c=[mesh.position(i) for i in t.indices]
        return abs((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))/2
    triangle=max(triangles,key=lambda t:(area(t),-t.triangle_id))
    if area(triangle)<=0:
        raise FormatError('Degenerate entry trigger component')
    p=[mesh.position(i) for i in triangle.indices]
    return tuple(sum(v[k] for v in p)/3 for k in range(3)),triangle

def spherical_center(entrances):
    vectors=[]
    for e in entrances:
        lon,lat=math.radians(e['longitude']),math.radians(e['latitude'])
        vectors.append((math.cos(lat)*math.cos(lon),math.cos(lat)*math.sin(lon),math.sin(lat)))
    x,y,z=(sum(p[k] for p in vectors) for k in range(3))
    if math.sqrt(x*x+y*y+z*z)<1e-10:
        return None
    return dict(longitude=math.degrees(math.atan2(y,x)),latitude=math.degrees(math.atan2(z,math.hypot(x,y))),
                source_kind='derived_navigation_center')

def group_locations(entrances):
    identity={field:row for row in NAME_GROUPS for field in row[3]}
    groups=defaultdict(list)
    for e in entrances:
        row=identity.get(e['field_name'])
        groups[row[0] if row else 'field-'+e['field_name']].append(e)
    result=[]
    for id,items in sorted(groups.items()):
        items.sort(key=lambda e:(e['scenario'],e['entrance_table_id'],e['section_id'],e['id']))
        row=identity.get(items[0]['field_name'])
        primary=items[0]
        result.append(dict(id=id,name=row[1] if row else primary['field_name'],display_name=row[1] if row else primary['field_name'],
            category=row[2] if row else 'entrance',aliases=list(row[4]) if row else [],
            field_names=sorted({e['field_name'] for e in items}),primary_entrance=primary['id'],
            entrance_ids=[e['id'] for e in items],longitude=primary['longitude'],latitude=primary['latitude'],height=primary['height'],
            navigation_kind='primary_entrance',center=spherical_center(items),
            name_source='manual_verified_field_identity' if row else 'maplist_internal_name'))
        for e in items:e['location_id']=id
    return result

def build_poi(source: Path, destination: Path, field_archive: Path|None=None) -> dict:
    destination=output_path(destination)
    ds=discover(source);lgp=ds.files['world_us.lgp'];entries=inventory(lgp)['entries']
    if destination.is_relative_to(ds.wm_directory):
        raise ValueError('Output cannot be inside the selected source WM directory')
    def payload(name):
        matches=[e for e in entries if e['filename'].casefold()==name]
        if len(matches)!=1:raise FormatError(f'Expected one LGP entry: {name}')
        return read_entry(lgp,matches[0])
    if field_archive is None:
        # sibling data/field resolves classic and 2026 layout without AppID assumptions.
        field_dir=child_ci(ds.wm_directory.parent,'field')
        field_archive=child_ci(field_dir,'flevel.lgp') if field_dir else None
    if field_archive is None or not field_archive.is_file():
        raise FormatError('English flevel.lgp/maplist required; pass --field-archive for extracted data')
    if destination.is_relative_to(field_archive.resolve().parent):
        raise ValueError('Output cannot be inside the selected source field directory')
    ftoc=inventory(field_archive)['entries'];maps=[e for e in ftoc if e['filename'].casefold()=='maplist']
    if len(maps)!=1:raise FormatError('Expected one maplist in field archive')
    maplist=read_entry(field_archive,maps[0]);table_data=payload('field.tbl');ev=payload('wm0.ev')
    table=parse_field_table(table_data,parse_maplist(maplist));calls,unresolved,stats=mesh_field_calls(ev)
    world=parse_map(ds.files['wm0.map'],0)
    if world.failures:raise FormatError('Cannot derive POI from a partially parsed MAP')
    meshes={m.cell:m for m in world.base_meshes};mapping=Mapping(*world.extent,SphereConfig())
    entrances=[];seen={}
    for call in calls:
        mesh=meshes.get((call['mesh_column'],call['mesh_row']))
        if mesh is None:raise FormatError('EV mesh call outside WM0')
        triangles=[t for t in mesh.triangles if t.script==call['source_script']+3]
        field=table[(call['entrance_table_id'],call['scenario'])]
        if not triangles or field['field_id']==0:
            unresolved.append(dict(**call,reason='No base trigger triangles or dummy destination'));continue
        for component in trigger_components(mesh,triangles):
            raw,t=representative(mesh,component)
            key=(call['function_header'],call['entrance_table_id'],call['scenario'],component[0].triangle_id)
            provenance=dict(call_table_record=call['call_table_record'],instruction_word_offset=call['instruction_word_offset'])
            if key in seen:
                seen[key]['script_calls'].append(provenance);continue
            lon,lat,h=mapping.game_to_geographic(*raw)
            id=f"wm0-{call['function_header']:04x}-{call['entrance_table_id']}-{call['scenario']}-{component[0].triangle_id}"
            e=dict(id=id,game_x=raw[0],game_north=raw[1],game_height=raw[2],longitude=lon,latitude=lat,height=h,
                world_map=0,section_id=mesh.section_id,mesh_id=mesh.mesh_id,triangle_id=t.triangle_id,
                trigger_triangle_ids=[t.triangle_id for t in component],region_id=t.region,
                source_kind='derived_from_entry_trigger',source_file='wm0.map',source_record=t.triangle_id,
                source_script=call['source_script'],script_calls=[provenance],function_header=call['function_header'],
                entrance_table_id=call['entrance_table_id'],scenario=call['scenario'],**field,
                height_source='interpolated_from_surface',entrance_type='walkmesh_trigger',
                trigger_radius=None,heading=None,availability=None,confidence='verified_trigger_derived_position',
                notes='Largest trigger triangle centroid; conditional story/vehicle script paths retained, not evaluated.')
            entrances.append(e);seen[key]=e
    locations=group_locations(entrances)
    unresolved.extend([dict(id='gold-saucer',name='Gold Saucer',reason='Model/system entry not traced to static base trigger'),
                       dict(id='northern-cave',name='Northern Cave',reason='Highwind landing/system transition requires separate verification')])
    asset=dict(schema='gaiagis-poi',version=1,reconstruction='v1-geometric-gaia',world_extent=list(world.extent),
        mapping=dict(method='inverse_mercator',radius_m=mapping.config.radius_m,flip_latitude=False,antimeridian_game_east=0,
                     vertical_scale_m_per_raw_unit=1),
        sources={name:hashlib.sha256(data).hexdigest() for name,data in [('wm0.map',ds.files['wm0.map'].read_bytes()),
                 ('wm0.ev',ev),('field.tbl',table_data),('maplist',maplist)]},
        locations=locations,entrances=entrances,unresolved=unresolved,extraction=stats)
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(asset,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    return asset
