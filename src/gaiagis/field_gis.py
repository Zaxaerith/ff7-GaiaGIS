"""Private single-Field research export. OGR owns the standard GeoPackage.

Never transforms coordinates, imports WM0 user mapping, or writes game inputs.
Only a selected raw Section 5 is decoded; no LGP or background is needed.
"""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
from contextlib import closing
import hashlib
import json
import math
import os
from pathlib import Path
from .dataset import archive_key, same_dependencies
import re
import shutil
import sqlite3
import struct
import subprocess
import sys
import tempfile
import time

from ._version import __version__
from .field_context import (parse_walkmesh, validate_local_point,
                            validate_gateway_segment, walkmesh_network, _normal, GENERATOR_VERSION)
from .safety import WORKSPACE_ROOT, output_path, protect_input
from .clean_output import reject_links
from .build_workspace import ASSETS
from .web_export import sha256

SCHEMA = 'gaiagis-fieldlocal-gpkg'
LIMIT = 128_000_000
LABEL = 'Static Walkmesh Topology — Not Verified Gameplay Reachability'
INTERACTION_LABEL = 'Original interaction geometry; static association only; runtime activation UNKNOWN'
_IDENTITY = dict(field_id='int',field_name='text')
_SEGMENT = {f'raw_{end}{axis}':'int' for end in ('a','b') for axis in ('x','y','z')}
_GEOMETRY = dict(geometry_relation='text',exact_candidate_count='int',xy_candidate_count='int',zero_length='int',zero_xy='int',raw_z_gap='text',raw_z_triangle='int')
INTERACTION_FIELDS = {
    'field_triggers': dict(_IDENTITY,trigger_slot='int',source_section='int',source_offset='int',**_SEGMENT,group_id='int',state_bit='int',behavior='int',sound_id='int',classification='text',**_GEOMETRY,background_status='text',source_record_hex='text',runtime_active='int'),
    'script_lines': dict(_IDENTITY,instruction_offset='int',opcode='int',source_section='int',**_SEGMENT,**_GEOMETRY,membership_count='int',source_record_hex='text',runtime_active='int'),
    'interaction_scripts': dict(_IDENTITY,instruction_offset='int',opcode='int',source_section='int',source_record_hex='text',entry_reachable='int',classification='text',switch_value='int',banks_json='text',operands_json='text',**_SEGMENT,**_GEOMETRY,membership_count='int',runtime_active='int'),
    'interaction_memberships': dict(field_id='int',instruction_offset='int',actor_id='int',actor_name='text',script_slot='int',entry_offset='int',entry_kind='text',evidence='text'),
    'interaction_line_links': dict(field_id='int',instruction_offset='int',line_offset='int',evidence='text'),
    'interaction_candidates': dict(field_id='int',record_type='text',record_id='int',triangle_id='int',geometry_relation='text',exact_3d='int',xy_only='int',coplanar='int',vertical='int',start_triangle='int',reachable='int',hop_distance='int',evidence='text'),
    'interaction_background': dict(field_id='int',trigger_slot='int',group_id='int',state_bit='int',layer='int',state_mask='int',tile_count='int',source_section='int',source_offset='int',status='text',reason='text',runtime_active='int'),
    'interaction_stops': dict(field_id='int',source_section='int',instruction_offset='int',opcode='int',reason='text',entry_reachable='int'),
}


def interaction_rows(scene, interaction, network):
    """Normalize the validated private evidence without inferring execution order."""
    rows={name:[] for name in INTERACTION_FIELDS};identity=dict(field_id=scene['id'],field_name=scene['name'])
    def coordinates(r):return dict(zip(_SEGMENT,(*r['a'],*r['b'])))
    def contacts(kind,id,r):
        g=r['geometry'];exact=set(g['candidates']);reach=network['reach']
        for i in sorted(set(g['xyCandidates'])|exact):
            rows['interaction_candidates'].append(dict(field_id=scene['id'],record_type=kind,record_id=id,triangle_id=i,geometry_relation=g['relation'],exact_3d=int(i in exact),xy_only=int(i not in exact),coplanar=int(i in g['coplanar']),vertical=int(i in g['vertical']),start_triangle=None if reach is None else reach['start'],reachable=None if reach is None or i not in exact else int(reach['distance'][i]>=0),hop_distance=None if reach is None or i not in exact else reach['distance'][i],evidence='Exact raw 3D contact; topology only' if i in exact else 'XY projection only; no verified topology association'))
    def summary(r):
        g=r['geometry'];return dict(geometry_relation=g['relation'],exact_candidate_count=len(g['candidates']),xy_candidate_count=len(g['xyCandidates']),zero_length=int(g['zeroLength']),zero_xy=int(g['zeroXY']),raw_z_gap=g['rawZGap'],raw_z_triangle=g['rawZTriangle'])
    for r in interaction['triggers']:
        rows['field_triggers'].append(dict(identity,trigger_slot=r['slot'],source_section=8,source_offset=r['offset'],**coordinates(r),group_id=r['group'],state_bit=r['state'],behavior=r['behavior'],sound_id=r['sound'],classification=r['classification'],**summary(r),background_status=r['background']['status'],source_record_hex=r['raw'],runtime_active=None))
        contacts('trigger',r['slot'],r)
        for m in r['background']['matches'] or [None]:
            rows['interaction_background'].append(dict(field_id=scene['id'],trigger_slot=r['slot'],group_id=r['group'],state_bit=r['state'],layer=None if m is None else m['layer'],state_mask=None if m is None else m['mask'],tile_count=None if m is None else m['count'],source_section=9,source_offset=None if m is None else m['firstOffset'],status=r['background']['status'],reason=r['background']['reason'],runtime_active=None))
    for r in interaction['scripts']:
        op=r['opcode'];literal=op==208 or op==211 and r['static']
        classification='initial_line' if op==208 else 'state_control' if op==209 else 'constant_modification' if literal else 'dynamic_modification'
        rows['interaction_scripts'].append(dict(identity,instruction_offset=r['offset'],opcode=op,source_section=1,source_record_hex=r['raw'],entry_reachable=int(r['entryReachable']),classification=classification,switch_value=r.get('switch'),banks_json=None if op!=211 else json.dumps(r['banks']),operands_json=None if op!=211 else json.dumps(r['operands']),**(coordinates(r) if literal else {key:None for key in _SEGMENT}),**(summary(r) if literal else {key:None for key in _GEOMETRY}),membership_count=len(r['owners']),runtime_active=None))
        if op==208:
            rows['script_lines'].append(dict(identity,instruction_offset=r['offset'],opcode=op,source_section=1,**coordinates(r),**summary(r),membership_count=len(r['owners']),source_record_hex=r['raw'],runtime_active=None))
        if literal:contacts('line' if op==208 else 'sline_modification',r['offset'],r)
        for o in r['owners']:
            rows['interaction_memberships'].append(dict(field_id=scene['id'],instruction_offset=r['offset'],actor_id=o['actor'],actor_name=o['name'],script_slot=o['slot'],entry_offset=o['entry'],entry_kind=o['kind'],evidence='Reachable from decoded entry; conditional execution UNKNOWN'))
        for offset in r.get('lineOffsets',[]):
            rows['interaction_line_links'].append(dict(field_id=scene['id'],instruction_offset=r['offset'],line_offset=offset,evidence='Shared Actor ownership; execution/order UNKNOWN'))
    for r in interaction['stops']:
        rows['interaction_stops'].append(dict(field_id=scene['id'],source_section=1,instruction_offset=r['offset'],opcode=r['opcode'],reason=r['reason'],entry_reachable=int(r['entryReachable'])))
    return rows


def metadata_values(scene,network,version,interaction=None):
    identity=dict(field_id=scene['id'],field_name=scene['name']);n=scene['stats']['triangles'];reach=network['reach'];path=network['path']
    start=None if reach is None else reach['start'];end=None if path is None else path['end']
    values=dict(identity,schema=SCHEMA,version=version,coordinate_space='FieldLocal',source_file=scene['context']['archive'],source_sha256=scene['context']['sources'][scene['context']['archive']],maplist_sha256=scene['context']['sources']['maplist'],context_version=scene['context']['version'],walkmesh_version=1,exporter_version=__version__,section5_sha256=hashlib.sha256(scene['raw']).hexdigest(),triangle_count=n,access_count=n*3,coordinate_semantics='Original XYZ; no axis swap, transform, geography or scale',raw4_semantics='Original fourth S16; neither M nor verified collision/height',network_semantics=LABEL,component_labels='0-based, sorted by minimum Triangle ID; BFS Access slot 0/1/2',runtime_passability='UNKNOWN',units='Raw Unit / Raw Unit^2; no metres or geographic reference',start_triangle=start,end_triangle=end,path_status='not_requested' if path is None else path['reason'] or 'found')
    if version==2:
        values.update(interaction_version=1,interaction_sha256=scene['hashes']['gaia-field-interaction.bin'],section1_sha256=interaction['section1SHA256'],section8_sha256=interaction['section8SHA256'],section1_bytes=interaction['section1Bytes'],section8_bytes=interaction['section8Bytes'],interaction_semantics=INTERACTION_LABEL)
    return values


def table_fields(version):
    base=dict(field_id='int',field_name='text')
    xyz={f'v{k}_{axis}':'int' for k in range(3) for axis in ('x','y','z','raw4')}
    triangle_fields=dict(base,triangle_id='int',**xyz,access_0='int',access_1='int',access_2='int',source_file='text',section='int',source_offset='int',original_order='int',wcc_id='int',scc_id='int',wcc_size='int',scc_size='int',isolated='int',degenerate_3d='int',degenerate_xy='int',asymmetric_count='int',edge_mismatch_count='int',self_link_count='int',padding_variants='int',start_triangle='int',reachable='int',hop_distance='int',parent_triangle='int',parent_access_slot='int')
    fields={
        'walkmesh_triangles': triangle_fields,
        'raw_vertices': dict(base,triangle_id='int',vertex_slot='int',x='int',y='int',z='int',raw4='int',source_offset='int'),
        'walkmesh_edges': dict(base,from_triangle='int',edge_slot='int',to_triangle='int',raw_access='int',blocked='int',asymmetric='int',edge_mismatch='int',self_link='int',access_offset='int',source_file='text',section='int',ax='int',ay='int',az='int',bx='int',by='int',bz='int'),
        'field_entrances': dict(base,entry_id='int',scenario='int',variant='text',triangle_id='int',raw_x='int',raw_y='int',derived_raw_z='real',direction='int',record_index='int',source_file='text',source_offset='int',validation='text',z_semantics='text'),
        'arrival_points': dict(base,source_field='int',source_name='text',gateway_id='int',triangle_id='int',raw_x='int',raw_y='int',derived_raw_z='real',source_file='text',source_offset='int',validation='text',z_semantics='text'),
        'anchor_records': dict(kind='text',source_field='int',target_field='int',record_id='int',triangle_id='int',raw_xy='text',source_offset='int',validation='text'),
        'gateway_segments': dict(base,gateway_id='int',target_field='int',target_name='text',world_target='int',target_triangle='int',target_x='int',target_y='int',source_file='text',section='int',source_offset='int',direction_bytes='text',record_hex='text',validation='text',runtime_passability='text',ax='int',ay='int',az='int',bx='int',by='int',bz='int'),
        'gateway_candidates': dict(field_id='int',gateway_id='int',triangle_id='int',reachable='int',validation='text'),
        'network_components': dict(kind='text',component_id='int',triangle_count='int',minimum_triangle='int',triangles_json='text',semantics='text'),
        'network_path': dict(sequence_index='int',triangle_id='int',start_triangle='int',end_triangle='int',hop_count='int',from_triangle='int',access_slot='int',access_offset='int',semantics='text'),
        'field_metadata': dict(schema='text',version='int',field_id='int',field_name='text',coordinate_space='text',source_file='text',source_sha256='text',maplist_sha256='text',context_version='int',walkmesh_version='int',exporter_version='text',section5_sha256='text',triangle_count='int',access_count='int',coordinate_semantics='text',raw4_semantics='text',network_semantics='text',component_labels='text',runtime_passability='text',units='text',start_triangle='int',end_triangle='int',path_status='text'),
    }
    if version==2:
        fields.update(INTERACTION_FIELDS)
        fields['field_metadata'].update(interaction_version='int',interaction_sha256='text',section1_sha256='text',section8_sha256='text',section1_bytes='int',section8_bytes='int',interaction_semantics='text')
    elif version!=1:raise ValueError('Unsupported FieldLocal format version')
    return fields


def _json(path, limit):
    return _decode_json(_metadata_bytes(path,limit))


def _metadata_bytes(path, limit):
    with path.open('rb') as stream:data=stream.read(limit+1)
    if not 0<len(data)<=limit:raise ValueError('Metadata size limit')
    return data


def _decode_json(data):
    def pairs(rows):
        result={}
        for key,value in rows:
            if key in result:raise ValueError('Duplicate metadata key')
            result[key]=value
        return result
    return json.loads(data,object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite metadata')))


def _integer(value, lo=0, hi=65535):
    if type(value) is not int or not lo<=value<=hi:raise ValueError('Invalid bounded integer')
    return value


def _vector(value, size, lo=-32768, hi=32767):
    if not isinstance(value,list) or len(value)!=size:raise ValueError('Invalid raw vector')
    return [_integer(v,lo,hi) for v in value]


def _sources(value, required=None):
    if not isinstance(value,dict) or not 2<=len(value)<=32 or any(not re.fullmatch(r'[A-Za-z0-9_.-]{1,128}',k) or not isinstance(v,str) or not re.fullmatch('[a-f0-9]{64}',v) for k,v in value.items()):
        raise ValueError('Invalid source hashes')
    required = required or (archive_key(value,'field'),'maplist')
    for name in required:
        if name not in value:raise ValueError('Missing Field source identity')


def load_field(workspace, field):
    """Bounded workspace/pack reader; reuses the original Section-5 parser."""
    root=Path(workspace).resolve();protect_input(root)
    manifest_path=root/'gaia-workspace.json';reject_links(manifest_path)
    manifest_raw=_metadata_bytes(manifest_path,100_000);manifest=_decode_json(manifest_raw);manifest_hash=hashlib.sha256(manifest_raw).hexdigest()
    if manifest.get('schema')!='gaiagis-workspace' or type(manifest.get('version')) is not int or manifest['version']!=1 or manifest.get('timestamp_policy')!='omitted' or not re.fullmatch(r'\d+\.\d+\.\d+',str(manifest.get('tool_version',''))):raise ValueError('Workspace manifest/version')
    _sources(manifest.get('sources'),(archive_key(manifest.get('sources',{}),'field'),))
    assets=manifest.get('assets');records={}
    if not isinstance(assets,list) or len(assets)>32:raise ValueError('Workspace inventory limit')
    for record in assets:
        if not isinstance(record,dict):raise ValueError('Workspace asset object')
        name=record.get('filename')
        if not isinstance(name,str) or not re.fullmatch(r'[A-Za-z0-9_.-]{1,128}',name) or name in ('.','..') or name in records:raise ValueError('Unsafe/duplicate workspace asset')
        records[name]=record
    for name,record in records.items():
        if name not in ASSETS:raise ValueError('Unknown workspace asset')
        kind,mapid,dependencies=ASSETS[name]
        if record.get('type')!=kind or record.get('mapId')!=mapid or record.get('dependencies')!=dependencies or any(d not in records for d in dependencies):raise ValueError('Workspace dependency/identity mismatch')
        _integer(record.get('bytes'),1,160_000_000)
        if not isinstance(record.get('sha256'),str) or not re.fullmatch('[a-f0-9]{64}',record['sha256']):raise ValueError('Workspace asset checksum format')
    hashes={}
    for name,kind,budget in (('gaia-field-context.json','field-context',8_000_000),('gaia-field-walkmesh.bin','field-walkmesh',32_000_000)):
        record=records.get(name);path=root/name;reject_links(path)
        if path.resolve().parent!=root or not record or record.get('type')!=kind or record.get('generator_version') not in ('field-context-6','field-context-7',GENERATOR_VERSION) or record.get('mapId')!=('WM0' if kind=='field-context' else 'shared') or record.get('dependencies')!=(['gaia-poi.json'] if kind=='field-context' else ['gaia-field-context.json']) or type(record.get('bytes')) is not int or not 0<record['bytes']<=budget or path.stat().st_size!=record['bytes']:raise ValueError('Field asset size/identity')
        hashes[name]=sha256(path)
        if hashes[name]!=record.get('sha256'):raise ValueError('Field asset checksum mismatch')
    context_raw=_metadata_bytes(root/'gaia-field-context.json',8_000_000)
    if hashlib.sha256(context_raw).hexdigest()!=hashes['gaia-field-context.json']:raise ValueError('Context changed while reading')
    context=_decode_json(context_raw)
    if context.get('schema')!='gaiagis-field-context' or context.get('version') not in (3,4,5) or context.get('coordinateSpace')!='FieldLocalIdentity' or context.get('archive')!=archive_key(context.get('sources',{}),'field'):raise ValueError('Requires Field Context schema 3–5')
    if context['version']==3 and context['archive']!='flevel.lgp':raise ValueError('Legacy Field Context requires English archive')
    archive_key(context.get('sources',{}),'world',required=context['version']>=4)
    _sources(context.get('sources'))
    if not same_dependencies(manifest['sources'], context['sources'], ['@field']):raise ValueError('Context/manifest archive identity mismatch')
    if any(manifest['sources'][k]!=v for k,v in context['sources'].items() if k in manifest['sources']):raise ValueError('Context/manifest source mismatch')
    nodes=context.get('nodes');identities={};names={}
    if not isinstance(nodes,list) or len(nodes)>2000:raise ValueError('Field identity limit')
    for node in nodes:
        id=_integer(node['id']);name=node['name']
        if id in identities or not isinstance(name,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,32}',name) or name.casefold() in names or node['status'] not in ('available','missing','corrupt'):raise ValueError('Field identity ambiguity')
        identities[id]=node;names[name.casefold()]=id
    selected=names.get(str(field).casefold())
    if selected is None or identities[selected]['status']!='available':raise ValueError('Field not available; use its maplist name')
    with (root/'gaia-field-walkmesh.bin').open('rb') as stream:
        prefix=stream.read(16)
        if len(prefix)!=16 or prefix[:8]!=b'GAIAFLD\0' or struct.unpack_from('<I',prefix,8)[0]!=1:raise ValueError('Walkmesh header')
        length=struct.unpack_from('<I',prefix,12)[0]
        if length>512_000 or 16+length>records['gaia-field-walkmesh.bin']['bytes']:raise ValueError('Walkmesh metadata budget')
        meta=_decode_json(stream.read(length));_sources(meta.get('sources'))
        if meta.get('schema')!='gaiagis-field-walkmesh' or meta.get('version')!=1 or meta.get('coordinateSpace')!='FieldLocal' or meta.get('generator_revision')!='field-walkmesh-1' or any(context['sources'].get(k)!=v for k,v in meta['sources'].items()):raise ValueError('Walkmesh source/schema mismatch')
        rows=meta.get('scenes');end=0;seen=set();chosen=None
        if not isinstance(rows,list) or len(rows)>2000:raise ValueError('Walkmesh scene budget')
        for row in rows:
            id=_integer(row['fieldId'])
            if id in seen or id not in identities or identities[id]['status']!='available' or row['status'] not in ('available','corrupt'):raise ValueError('Walkmesh identity mismatch')
            seen.add(id)
            if row['status']=='available':
                n=_integer(row['triangles'])
                if _integer(row.get('offset'),0,32_000_000)!=end or _integer(row.get('bytes'),4,32_000_000)!=4+n*30:raise ValueError('Walkmesh span mismatch')
                end+=row['bytes']
            if id==selected:chosen=row
        if 16+length+end!=records['gaia-field-walkmesh.bin']['bytes'] or not chosen or chosen['status']!='available':raise ValueError('Walkmesh unavailable/trailing bytes')
        stream.seek(16+length+chosen['offset']);raw=stream.read(chosen['bytes'])
    stats,points=parse_walkmesh(raw,geometry=True)
    if any(_integer(chosen.get(k),0,196605)!=v for k,v in stats.items()):raise ValueError('Walkmesh statistics mismatch')
    n=stats['triangles'];vertices=list(struct.iter_unpack('<12h',raw[4:4+n*24]));access=list(struct.iter_unpack('<3H',raw[4+n*24:]))
    if not isinstance(context.get('entrances'),list) or len(context['entrances'])!=128 or not isinstance(context.get('gateways'),list) or len(context['gateways'])>24000:raise ValueError('Anchor record budget')
    return dict(id=selected,name=identities[selected]['name'],context=context,nodes=identities,
                raw=raw,stats=stats,points=points,vertices=vertices,access=access,
                root=root,assets=records,hashes=hashes,manifest_hash=manifest_hash)


def _point(record, triangle, xy, scene):
    result=validate_local_point(scene['points'],_integer(triangle),_vector(xy,2))
    z=record.get('derivedZ')
    if result['status']!=record.get('status') or (result['derivedZ'] is None)!=(z is None) or z is not None and (type(z) not in (float,int) or not math.isfinite(z) or abs(z-result['derivedZ'])>1e-9):raise ValueError('Anchor geometry/source mismatch')
    return result


def safe_target(path):
    path=Path(path).absolute();target=output_path(path)
    allowed=WORKSPACE_ROOT/'output/exports/fieldlocal'
    if target!=path or not target.is_relative_to(allowed) or target.suffix.lower()!='.gpkg':raise ValueError('Field GIS output must be under output/exports/fieldlocal/*.gpkg')
    for parent in (target,*target.parents):
        if parent==WORKSPACE_ROOT:break
        reject_links(parent)
    if target.exists():raise ValueError('Output exists; choose a new filename')
    return target


def export_field(workspace, field, output, start=None, end=None, format_version=1):
    if type(format_version) is not int or format_version not in (1,2):raise ValueError('Unsupported FieldLocal format version')
    from osgeo import gdal,ogr
    from .gis_export import Package,polygon_geometry,_user_row
    gdal.UseExceptions();ogr.UseExceptions()
    if int(gdal.VersionInfo('VERSION_NUM'))<3090000:raise ValueError('FieldLocal export requires GDAL >= 3.9 for explicit SRID=-1')
    began=time.perf_counter();scene=load_field(workspace,field);target=safe_target(output)
    interaction=None;pack_timing={}
    if format_version==2:
        from .field_interaction import read_interaction
        interaction,pack_timing=read_interaction(scene)
    schemas=table_fields(format_version)
    network=walkmesh_network(scene['access'],start,end);target.parent.mkdir(parents=True,exist_ok=True)
    if shutil.disk_usage(target.parent).free<256_000_000:raise ValueError('Insufficient disk space for bounded atomic export')
    counts={};package=None
    with tempfile.TemporaryDirectory(prefix='.field-gis-',dir=target.parent) as scratch:
        temporary=output_path(Path(scratch)/target.name)
        try:
            package=Package(temporary)
            def layer(name,geometry=ogr.wkbNone):
                counts[name]=0
                return package.layer(name,None,fields=schemas[name],geometry_type=geometry,options=['SRID=-1'] if geometry!=ogr.wkbNone else [])
            def row(table,attributes,geometry=None):
                _user_row(table,attributes,geometry);counts[table.GetName()]+=1
                if counts[table.GetName()]%1000==0 and temporary.stat().st_size>LIMIT:raise ValueError('GeoPackage output budget')
            def geom(kind,points):
                g=ogr.Geometry(kind)
                for p in points:g.AddPoint(*p)
                return g
            identity=dict(field_id=scene['id'],field_name=scene['name']);n=len(scene['vertices']);isolated=set(network['isolated'])
            triangles=layer('walkmesh_triangles',ogr.wkbPolygon25D)
            raw_vertices=layer('raw_vertices')
            edges=layer('walkmesh_edges',ogr.wkbLineString25D)
            for i,(v,links) in enumerate(zip(scene['vertices'],scene['access'])):
                p=scene['points'][i];diagnostics=[]
                for slot,to in enumerate(links):
                    a,b=p[slot],p[(slot+1)%3];blocked=to==65535
                    mismatch=not blocked and not any({a,b}=={scene['points'][to][k],scene['points'][to][(k+1)%3]} for k in range(3))
                    asymmetric=not blocked and i not in scene['access'][to];self_link=not blocked and to==i
                    diagnostics.append((asymmetric,mismatch,self_link))
                    row(edges,dict(identity,from_triangle=i,edge_slot=slot,to_triangle=None if blocked else to,raw_access=to,blocked=int(blocked),asymmetric=int(asymmetric),edge_mismatch=int(mismatch),self_link=int(self_link),access_offset=4+n*24+(i*3+slot)*2,source_file=scene['context']['archive'],section=5,**dict(zip(('ax','ay','az','bx','by','bz'),(*a,*b)))),geom(ogr.wkbLineString25D,[a,b]))
                w,s=network['wcc']['labels'][i],network['scc']['labels'][i];reach=network['reach'];normal=_normal(p)
                attributes=dict(identity,triangle_id=i,**{f'v{k}_{axis}':v[k*4+j] for k in range(3) for j,axis in enumerate(('x','y','z','raw4'))},**{f'access_{k}':links[k] for k in range(3)},source_file=scene['context']['archive'],section=5,source_offset=4+i*24,original_order=i,wcc_id=w,scc_id=s,wcc_size=len(network['wcc']['groups'][w]),scc_size=len(network['scc']['groups'][s]),isolated=int(i in isolated),degenerate_3d=int(normal==(0,0,0)),degenerate_xy=int(normal[2]==0),asymmetric_count=sum(d[0] for d in diagnostics),edge_mismatch_count=sum(d[1] for d in diagnostics),self_link_count=sum(d[2] for d in diagnostics),padding_variants=sum(v[k]!=v[2] for k in (3,7,11)),start_triangle=start,reachable=None if reach is None else int(reach['distance'][i]>=0),hop_distance=None if reach is None else reach['distance'][i],parent_triangle=None if reach is None or reach['parent'][i]<0 else reach['parent'][i],parent_access_slot=None if reach is None or reach['slot'][i]<0 else reach['slot'][i])
                row(triangles,attributes,polygon_geometry(p))
                for k in range(3):row(raw_vertices,dict(identity,triangle_id=i,vertex_slot=k,x=v[k*4],y=v[k*4+1],z=v[k*4+2],raw4=v[k*4+3],source_offset=4+i*24+k*8))
            entrances=layer('field_entrances',ogr.wkbPoint25D)
            arrivals=layer('arrival_points',ogr.wkbPoint25D)
            records=layer('anchor_records')
            entrance_records=set()
            for e in scene['context']['entrances']:
                record=_integer(e['field_table_record'],0,127)
                if record in entrance_records:raise ValueError('Duplicate FIELD.TBL record')
                entrance_records.add(record)
                if e['field_id']!=scene['id']:continue
                record=_integer(e['field_table_record'],0,127);scenario=_integer(e['scenario'],0,1);entry=_integer(e['entry'],1,64)
                if record!=(entry-1)*2+scenario or e['field_table_byte_offset']!=record*12 or e['field_name']!=scene['name']:raise ValueError('FIELD.TBL identity/offset')
                if e['status']=='placeholder':continue
                result=_point(e,e['field_triangle'],[e['field_x'],e['field_y']],scene)
                row(records,dict(kind='entrance',target_field=scene['id'],record_id=record,triangle_id=e['field_triangle'],raw_xy=json.dumps([e['field_x'],e['field_y']]),source_offset=record*12,validation=result['status']))
                if result['status'] not in ('inside','boundary'):continue
                row(entrances,dict(identity,entry_id=entry,scenario=scenario,variant='Default' if scenario==0 else 'Alternative',triangle_id=e['field_triangle'],raw_x=e['field_x'],raw_y=e['field_y'],derived_raw_z=result['derivedZ'],direction=_integer(e['field_direction'],0,255),record_index=record,source_file=(archive_key(scene['context']['sources'],'world',required=scene['context']['version']>=4) or 'world_us.lgp')+'/field.tbl',source_offset=record*12,validation=result['status'],z_semantics='Derived triangle-plane Raw Z; no independent FIELD.TBL Z'),geom(ogr.wkbPoint25D,[(e['field_x'],e['field_y'],result['derivedZ'])]))
            gateways=layer('gateway_segments',ogr.wkbLineString25D)
            candidates=layer('gateway_candidates')
            seen=set();evidence={};world=set()
            for key in ('edges','exits','unresolved'):
                rows=scene['context'].get(key)
                if not isinstance(rows,list) or len(rows)>24000:raise ValueError('Gateway topology evidence budget')
                for e in rows:
                    if key=='unresolved' and e.get('reason')!='missing_destination':continue
                    identity_key=(e['fromField'],e['gateway'])
                    if identity_key in evidence:raise ValueError('Duplicate Gateway topology evidence')
                    evidence[identity_key]=e['to']
                    if key=='exits':world.add(identity_key)
            for g in scene['context']['gateways']:
                if g['fromField']!=scene['id'] and g['to']!=scene['id']:continue
                source=_integer(g['fromField']);to=_integer(g['to']);gid=_integer(g['gateway'],0,11);offset=56+gid*24
                if (source,gid) in seen or g['offset']!=offset or to==32767 or source not in scene['nodes'] or evidence.get((source,gid))!=to or (g['destination']['status']=='world')!=((source,gid) in world):raise ValueError('Gateway identity/offset')
                seen.add((source,gid));a=_vector(g['sourceA'],3);b=_vector(g['sourceB'],3);xy=_vector(g['targetXY'],2);direction=_vector(g['direction'],4,0,255);triangle=_integer(g['targetTriangle'])
                if source==scene['id']:
                    contacts=[];relation=validate_gateway_segment(scene['points'],a,b,candidates=contacts)
                    if relation!=g['sourceRelation']:raise ValueError('Gateway source geometry mismatch')
                    row(gateways,dict(identity,gateway_id=gid,target_field=to,target_name=scene['nodes'].get(to,{}).get('name'),world_target=int(g['destination']['status']=='world'),target_triangle=triangle,target_x=xy[0],target_y=xy[1],source_file=scene['context']['archive'],section=8,source_offset=offset,direction_bytes=json.dumps(direction),record_hex=struct.pack('<6h2hHH4B',*a,*b,*xy,triangle,to,*direction).hex(),validation=relation,runtime_passability='UNKNOWN',**dict(zip(('ax','ay','az','bx','by','bz'),(*a,*b)))),geom(ogr.wkbLineString25D,[a,b]))
                    for candidate in contacts:row(candidates,dict(field_id=scene['id'],gateway_id=gid,triangle_id=candidate,reachable=None if network['reach'] is None else int(network['reach']['distance'][candidate]>=0),validation='surface; topology association only'))
                if to==scene['id']:
                    result=_point(g['destination'],triangle,xy,scene)
                    row(records,dict(kind='arrival',source_field=source,target_field=to,record_id=gid,triangle_id=triangle,raw_xy=json.dumps(xy),source_offset=offset,validation=result['status']))
                    if result['status'] in ('inside','boundary'):row(arrivals,dict(identity,source_field=source,source_name=scene['nodes'][source]['name'],gateway_id=gid,triangle_id=triangle,raw_x=xy[0],raw_y=xy[1],derived_raw_z=result['derivedZ'],source_file=scene['context']['archive'],source_offset=offset,validation=result['status'],z_semantics='Derived target triangle-plane Raw Z; target record has XY only'),geom(ogr.wkbPoint25D,[(*xy,result['derivedZ'])]))
            components=layer('network_components')
            for kind in ('wcc','scc'):
                for id,group in enumerate(network[kind]['groups']):row(components,dict(kind=kind.upper(),component_id=id,triangle_count=len(group),minimum_triangle=group[0],triangles_json=json.dumps(group),semantics=LABEL))
            paths=layer('network_path')
            path=network['path']
            for k,i in enumerate(path['ids'] if path else []):
                parent=None if k==0 else path['ids'][k-1];slot=None if k==0 else network['reach']['slot'][i]
                row(paths,dict(sequence_index=k,triangle_id=i,start_triangle=start,end_triangle=end,hop_count=len(path['ids'])-1,from_triangle=parent,access_slot=slot,access_offset=None if k==0 else 4+n*24+(parent*3+slot)*2,semantics=LABEL))
            metadata=layer('field_metadata')
            row(metadata,metadata_values(scene,network,format_version,interaction))
            if interaction is not None:
                for name,entries in interaction_rows(scene,interaction,network).items():
                    table=layer(name,ogr.wkbLineString25D if name in ('field_triggers','script_lines') else ogr.wkbNone)
                    for attributes in entries:
                        geometry=None
                        if name in ('field_triggers','script_lines'):
                            geometry=geom(ogr.wkbLineString25D,[tuple(attributes[f'raw_{end}{axis}'] for axis in ('x','y','z')) for end in ('a','b')])
                        row(table,attributes,geometry)
            package.dataset.CommitTransaction();package.dataset.Close();package.dataset=None;package=None
            checked=time.perf_counter();report=verify_package(temporary,scene,network,counts,format_version,interaction);verification_seconds=time.perf_counter()-checked
            if temporary.stat().st_size>LIMIT:raise ValueError('GeoPackage output budget')
            if any(sha256(scene['root']/name)!=h for name,h in scene['hashes'].items()) or sha256(scene['root']/'gaia-workspace.json')!=scene['manifest_hash']:raise ValueError('Workspace changed during export')
            safe_target(target);os.link(temporary,target)  # Atomic no-clobber delivery, including races.
        finally:
            if package is not None:
                # The staging file is discarded on failure. Flush its schema
                # before Close: rolling back lazily-created GPKG tables causes
                # GDAL feature-count triggers to fail during Windows cleanup.
                try:package.dataset.CommitTransaction()
                finally:package.dataset.Close();package.dataset=None
    return dict(field=scene['name'],format_version=format_version,pack_timing=pack_timing,verification_seconds=round(verification_seconds,4),counts=counts,wcc=len(network['wcc']['groups']),scc=len(network['scc']['groups']),reachable=None if network['reach'] is None else sum(d>=0 for d in network['reach']['distance']),path=path,bytes=target.stat().st_size,seconds=round(time.perf_counter()-began,4),validation=report)


def verify_package(path, scene, network, counts, format_version=1, interaction=None):
    """Reopen with SQLite and OGR before delivery; exact integer XYZ/raw4 proof."""
    from osgeo import gdal,ogr
    schemas=table_fields(format_version)
    if format_version==2 and interaction is None:raise ValueError('V2 verification requires validated Interaction evidence')
    if set(counts)!=set(schemas):raise ValueError('FieldLocal table contract mismatch')
    with closing(sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('GeoPackage integrity')
        columns=db.execute('SELECT table_name,geometry_type_name,srs_id,z,m FROM gpkg_geometry_columns').fetchall()
        expected={'walkmesh_triangles':'POLYGON','walkmesh_edges':'LINESTRING','field_entrances':'POINT','gateway_segments':'LINESTRING','arrival_points':'POINT'}
        if format_version==2:expected.update(field_triggers='LINESTRING',script_lines='LINESTRING')
        contents=db.execute('SELECT table_name,data_type FROM gpkg_contents').fetchall()
        if dict(contents)!={name:'features' if name in expected else 'attributes' for name in schemas}:raise ValueError('FieldLocal exact table contract mismatch')
        user_tables={name for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table'") if not name.startswith(('gpkg_','rtree_','sqlite_'))}
        if user_tables!=set(schemas):raise ValueError('Unexpected FieldLocal data table')
        if {name:kind for name,kind,_,_,_ in columns}!=expected or any(srs!=-1 or z!=1 or m!=0 for _,_,srs,z,m in columns):raise ValueError('FieldLocal geometry CRS/Z/M mismatch')
        if db.execute('SELECT organization,organization_coordsys_id,definition FROM gpkg_spatial_ref_sys WHERE srs_id=-1').fetchone()!=('NONE',-1,'undefined'):raise ValueError('Undefined Cartesian CRS missing')
        if db.execute("SELECT count(*) FROM gpkg_contents WHERE data_type='features' AND srs_id!=-1").fetchone()[0]:raise ValueError('FieldLocal contents CRS')
        for name,count in counts.items():
            if db.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0]!=count:raise ValueError('Export record count mismatch')
        for name,_,_,_,_ in columns:
            if any(struct.unpack_from('<i',blob,4)[0]!=-1 for (blob,) in db.execute(f'SELECT geom FROM "{name}"')):raise ValueError('Geometry blob SRS mismatch')
    dataset=gdal.OpenEx(str(path),gdal.OF_VECTOR|gdal.OF_READONLY,allowed_drivers=['GPKG'])
    if dataset is None:raise ValueError('OGR cannot reopen GeoPackage')
    try:
        for name,fields in schemas.items():
            table=dataset.GetLayerByName(name);definition=table.GetLayerDefn()
            types={'int':ogr.OFTInteger,'real':ogr.OFTReal,'text':ogr.OFTString}
            actual={definition.GetFieldDefn(i).GetName():definition.GetFieldDefn(i).GetType() for i in range(definition.GetFieldCount())}
            if actual!={key:types[kind] for key,kind in fields.items()}:raise ValueError('FieldLocal field contract mismatch')
        records=list(dataset.GetLayerByName('field_metadata'))
        wanted=metadata_values(scene,network,format_version,interaction)
        if len(records)!=1 or any(records[0].GetField(key)!=value for key,value in wanted.items() if key!='exporter_version') or not re.fullmatch(r'\d+\.\d+\.\d+',records[0].GetField('exporter_version') or ''):raise ValueError('FieldLocal metadata mismatch')
        if format_version==2:
            for name,entries in interaction_rows(scene,interaction,network).items():
                actual=[]
                for feature in dataset.GetLayerByName(name):
                    attributes={key:feature.GetField(key) for key in schemas[name]};actual.append(json.dumps(attributes,sort_keys=True))
                    if name in ('field_triggers','script_lines'):
                        g=feature.GetGeometryRef();points=[tuple(attributes[f'raw_{end}{axis}'] for axis in ('x','y','z')) for end in ('a','b')]
                        if g is None or g.GetPointCount()!=2 or any(g.GetPoint(i)!=p for i,p in enumerate(points)):raise ValueError('Interaction original XYZ mismatch')
                if sorted(actual)!=sorted(json.dumps(row,sort_keys=True) for row in entries):raise ValueError('Interaction normalized evidence mismatch')
        triangles=dataset.GetLayerByName('walkmesh_triangles');found=set();n=scene['stats']['triangles']
        for f in triangles:
            i=_integer(f.GetField('triangle_id'),0,n-1)
            if i in found:raise ValueError('Duplicate Triangle ID')
            found.add(i);v=scene['vertices'][i];ring=f.GetGeometryRef().GetGeometryRef(0)
            if ring.GetPointCount()!=4 or any(ring.GetPoint(k)!=tuple(v[k*4:k*4+3]) for k in range(3)) or ring.GetPoint(3)!=ring.GetPoint(0):raise ValueError('Polygon Z coordinate/order mismatch')
            if any(f.GetField(f'v{k}_{axis}')!=v[k*4+j] for k in range(3) for j,axis in enumerate(('x','y','z','raw4'))) or any(f.GetField(f'access_{k}')!=scene['access'][i][k] for k in range(3)):raise ValueError('Original attributes changed')
            if any(f.GetField(kind+'_id')!=network[kind]['labels'][i] for kind in ('wcc','scc')):raise ValueError('Component mismatch')
            reach=network['reach']
            if reach is not None and any(f.GetField(key)!=value for key,value in dict(start_triangle=reach['start'],reachable=int(reach['distance'][i]>=0),hop_distance=reach['distance'][i],parent_triangle=None if reach['parent'][i]<0 else reach['parent'][i],parent_access_slot=None if reach['slot'][i]<0 else reach['slot'][i]).items()):raise ValueError('BFS snapshot mismatch')
        if len(found)!=n:raise ValueError('Triangle count mismatch')
        n=scene['stats']['triangles'];seen=set()
        for f in dataset.GetLayerByName('walkmesh_edges'):
            i=f.GetField('from_triangle');slot=f.GetField('edge_slot');key=(i,slot)
            if type(i) is not int or not 0<=i<n or type(slot) is not int or not 0<=slot<3 or key in seen:raise ValueError('Edge slot identity')
            seen.add(key);to=scene['access'][i][slot];geometry=f.GetGeometryRef()
            if geometry.GetPointCount()!=2 or geometry.GetPoint(0)!=scene['points'][i][slot] or geometry.GetPoint(1)!=scene['points'][i][(slot+1)%3] or f.GetField('raw_access')!=to or f.GetField('to_triangle')!=(None if to==65535 else to) or f.GetField('blocked')!=int(to==65535) or f.GetField('access_offset')!=4+n*24+(i*3+slot)*2:raise ValueError('Directed Access evidence mismatch')
        if len(seen)!=n*3:raise ValueError('Missing raw edge slot')
        seen=set()
        for f in dataset.GetLayerByName('raw_vertices'):
            i=_integer(f.GetField('triangle_id'),0,n-1);k=_integer(f.GetField('vertex_slot'),0,2)
            if (i,k) in seen or f.GetField('source_offset')!=4+i*24+k*8 or tuple(f.GetField(key) for key in ('x','y','z','raw4'))!=tuple(scene['vertices'][i][k*4:k*4+4]):raise ValueError('Raw vertex evidence mismatch')
            seen.add((i,k))
        if len(seen)!=n*3:raise ValueError('Missing raw vertex')
        groups={(kind.upper(),i):group for kind in ('wcc','scc') for i,group in enumerate(network[kind]['groups'])}
        seen=set()
        for f in dataset.GetLayerByName('network_components'):
            key=(f.GetField('kind'),f.GetField('component_id'));group=groups.get(key)
            if key in seen or group is None or _decode_json(f.GetField('triangles_json'))!=group or f.GetField('triangle_count')!=len(group) or f.GetField('minimum_triangle')!=group[0]:raise ValueError('Component membership mismatch')
            seen.add(key)
        if seen!=groups.keys():raise ValueError('Missing component membership')
        expected_contacts=set()
        for g in scene['context']['gateways']:
            if g['fromField']!=scene['id']:continue
            contacts=[];validate_gateway_segment(scene['points'],g['sourceA'],g['sourceB'],candidates=contacts)
            expected_contacts.update((g['gateway'],i) for i in contacts)
        contacts=[(f.GetField('gateway_id'),f.GetField('triangle_id')) for f in dataset.GetLayerByName('gateway_candidates')]
        if len(contacts)!=len(set(contacts)) or set(contacts)!=expected_contacts:raise ValueError('Gateway one-to-many relation mismatch')
    finally:dataset.Close()
    return dict(format_version=format_version,interaction_evidence_equal=interaction is not None,srs_id=-1,xyz_max_error=0,raw4_max_error=0,raw_access_equal=True,component_labels_equal=True)


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation',choices=['export']);parser.add_argument('--workspace',type=Path,required=True);parser.add_argument('--field',required=True);parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--format-version',type=int,choices=(1,2),default=1)
    parser.add_argument('--start-triangle',type=int);parser.add_argument('--end-triangle',type=int)
    args=parser.parse_args(argv)
    try:
        print(json.dumps(export_field(args.workspace,args.field,args.output,args.start_triangle,args.end_triangle,args.format_version),ensure_ascii=False));return 0
    except ImportError:
        root=os.environ.get('GAIAGIS_QGIS_ROOT')
        if root and sys.platform=='win32' and not getattr(sys,'frozen',False):
            try:
                from .runtime import qgis_environment
                root=Path(root).resolve();env=qgis_environment(root);env.pop('GAIAGIS_QGIS_ROOT',None)
                command=[str(root/'bin/python.exe'),'-B','-m','gaiagis','field-gis','export','--workspace',str(args.workspace.absolute()),'--field',args.field,'--output',str(args.output.absolute())]
                for name,value in (('format-version',args.format_version),('start-triangle',args.start_triangle),('end-triangle',args.end_triangle)):
                    if value is not None:command.extend(['--'+name,str(value)])
                return subprocess.run(command,cwd=WORKSPACE_ROOT,env=env).returncode
            except (ValueError,OSError,RuntimeError) as error:parser.exit(1,f'QGIS/GDAL environment unavailable: {error}\n')
        parser.exit(1,'Field GIS requires GDAL >= 3.9-enabled Python. On Windows, set GAIAGIS_QGIS_ROOT to an installed QGIS/OSGeo4W root. Web/portable Viewer needs no GDAL.\n')
    except (ValueError,OSError,RuntimeError,KeyError,TypeError,AttributeError,IndexError,struct.error,RecursionError) as error:
        parser.exit(1,f'Field GIS export rejected: {error}\n')
