# SPDX-License-Identifier: GPL-3.0-only
"""Bounded cross-map inventory; unknown anchors are retained, never guessed."""
import hashlib
import json
from .map_spaces import native_position
from .world_events import analyze_ev, reachable_calls, trigger_components, representative
from .ev import decode_ev


def transition_record(from_map, to_map, source, position=None, destination=None, **extra):
    base=dict(from_map=from_map,to_map=to_map,transition_type='script_field_exit',
              from_anchor_kind='derived_trigger_centroid' if position else 'unresolved',
              from_native_position=position,from_source_lineage=None,to_anchor_kind='script_constant' if destination else 'unresolved',
              to_native_position=destination,transform_kind='transition_pair_only',
              evidence_class='script_constant',runtime_availability='not_simulated',source_file=source)
    base.update(extra)
    base['id']='transition-'+hashlib.sha256(json.dumps(base,sort_keys=True).encode()).hexdigest()[:20]
    return base


def analyze_transitions(payload, world, field_table):
    identity=f'WM{world.map_id}'
    analysis=analyze_ev(payload,map_id=identity)
    functions,_=decode_ev(payload)
    anchors={}
    meshes={m.cell:m for m in world.base_meshes}
    for f in functions:
        if f.kind!=2:continue
        cell=(f.header>>4)&1023
        x,z=native_position(identity,(cell%36)*8192,(cell//36)*8192)
        mesh=meshes.get((x//8192,z//8192))
        if mesh is None:continue
        for component in trigger_components(mesh,[t for t in mesh.triangles if t.script==(f.header&15)+3]):
            position,tri=representative(mesh,component)
            anchor=dict(position=position,
                        lineage=dict(mapId=identity,section_id=mesh.section_id,mesh_id=mesh.mesh_id,triangle_id=tri.triangle_id))
            for called in reachable_calls(f.header,analysis['call_graph']):
                anchors.setdefault(called,[]).append(anchor)
    records=[]
    for o in analysis['observations']:
        if o['opcode'] not in (0x318,0x33c,0x33d):continue
        args=o['raw_arguments'];destination=None
        if o['opcode']==0x318 and len(args)==2:destination=field_table.get(tuple(args))
        elif o['opcode']==0x33d and len(args)==1 and args[0] is not None:
            value=args[0];destination=field_table.get(((value>>8)&255,value&1))
        target='WM0' if o['opcode']==0x33c and identity=='WM2' else 'FIELD'
        for a in anchors.get(o['function_id'],[None]):
            records.append(transition_record(identity,target,identity.lower()+'.ev',
                a['position'] if a else None,from_source_lineage=a['lineage'] if a else None,
                source_function=o['function_id'],call_table_record=o['call_table_record'],
                instruction_offset=o['instruction_offset'],opcode=o['opcode'],raw_arguments=args,
                field_id=destination.get('field_id') if destination else None,
                field_name=destination.get('field_name') if destination else None,
                condition_kind=o['condition_kind'],model_id=o['model_id'],
                evidence_class='script_constant' if destination or target=='WM0' else 'unresolved',
                notes='Destination world re-entry and runtime position not inferred from field exit.'))
    return records,analysis


def engine_links():
    return [transition_record(a,b,'classic-pc-reference',transition_type='submarine_surface_dive',
            transform_kind='reference_native_engine_offset',evidence_class='reference_cross_checked',
            source_function='C_0074EA48 / C_0074D6BB / C_0074D6F6 / C_007533AF',
            condition_kind=['model-13','terrain-3','button-edge','runtime-dependent'],
            native_engine_offset=[98304,65536],notes='No fixed point: player/model position at runtime. Steam2026 equivalence NOT VERIFIED.')
            for a,b in [('WM0','WM2'),('WM2','WM0')]] + [transition_record('FIELD','WM3','classic-pc-reference',
                transition_type='field_world_dispatch',source_function='C_0074DB8C',
                evidence_class='runtime_dependent',condition_kind=['world-entry-id-at-least-0x3c','main-state-not-surface'],
                notes='Dispatcher chooses WM3 for snowfield re-entry range. No field entrance anchor or global WM0 pair inferred.')]
