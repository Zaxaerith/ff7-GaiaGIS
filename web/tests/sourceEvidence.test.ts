// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {buildSourceEvidenceIndex,sourceIdentityKey} from '../src/analysis/sourceEvidence';
import type {EvidenceSource} from '../src/analysis/sourceEvidence';
import type {Entrance,PoiDataset,Location} from '../src/data/poi';
import type {WorldEvent,EventsDataset} from '../src/data/events';
import {parseEncounters,terrainSlots,yuffieThresholds,encounterKinds} from '../src/data/encounters';
import {resolveBinding} from '../src/data/atlas';
import type {AtlasEntity,AtlasContent,AtlasPack} from '../src/data/atlas';
import type {FieldPack,FieldEntrance} from '../src/data/fieldContext';

// Public synthetic identities and table entries, not copied game geometry.
const sha='a'.repeat(64),other='b'.repeat(64),maplist='d6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29';
const sources={'wm0.map':sha,'wm0.ev':sha,'field.tbl':sha,maplist};
const face:EvidenceSource={mapId:'WM0',sourceSHA:sha,section:50,mesh:3,triangle:9,terrain:16,region:0,origin:0};
function entrance(id='entry-a',triangle=9):Entrance{return {
 id,location_id:'place',game_x:0,game_north:0,game_height:0,longitude:0,latitude:0,height:0,world_map:0,section_id:50,mesh_id:3,triangle_id:triangle,
 field_id:1,field_name:'fixture',entrance_table_id:1,scenario:0,region_id:0,source_kind:'derived_from_entry_trigger',source_file:'wm0.map',source_record:triangle,source_script:0,
 confidence:'verified_trigger_derived_position',notes:'Synthetic',height_source:'interpolated_from_surface',heading:null,trigger_radius:null,availability:null,
 trigger_triangle_ids:[triangle,10],script_calls:[{call_table_record:1,instruction_word_offset:5}],field_x:2,field_y:2,field_triangle:0,field_direction:0,field_table_record:0,field_table_byte_offset:0,
};}
function poi():PoiDataset{
 const e=entrance(),location:Location={id:'place',name:'Synthetic',display_name:'Synthetic',category:'landmark',aliases:[],field_names:['fixture'],primary_entrance:e.id,entrance_ids:[e.id],longitude:0,latitude:0,height:0,navigation_kind:'primary_entrance',name_source:'maplist_internal_name',center:null};
 return {schema:'gaiagis-poi',version:1,reconstruction:'v1-geometric-gaia',sources:{...sources},locations:[location],entrances:[e]};
}
function event(id='event-a',triangles=[9,10]):WorldEvent{return {
 id,event_type:'script_trigger',name:'Synthetic',display_name:'Synthetic',longitude:0,latitude:0,height:0,game_x:0,game_north:0,game_height:0,height_source:'interpolated_from_surface',anchor_kind:'derived_trigger_centroid',world_map:0,
 section_id:50,mesh_id:3,triangle_id:9,trigger_triangle_ids:triangles,anchor_function:0,function_id:0,call_table_record:1,instruction_offset:5,basic_block:1,opcode:null,opcode_name:'Synthetic',raw_arguments:[],model_id:null,entity_id:null,field_id:null,field_name:null,entrance_table_id:null,scenario:null,battle_id:null,location_id:'place',condition_kind:[],runtime_availability:'not_simulated',source_file:'wm0.ev',source_record:1,confidence:'source_trigger_derived',notes:'Synthetic',
};}
const events=(rows=[event()]):EventsDataset=>({schema:'gaiagis-events',version:1,reconstruction:'v1-geometric-gaia',sources:{...sources,'world_us.lgp':sha},events:rows,unresolved:[],extraction:{}});
function atlas():AtlasContent{
 const localized={en:'Synthetic','zh-CN':'示例','zh-TW':'示例',ja:'例',ko:'예'};
 const entity=(id:string,spatialBinding:AtlasEntity['spatialBinding']):AtlasEntity=>({id,kind:'landmark',canonicalName:id,localizedNames:localized,aliases:[],summary:localized,region:'unknown',tags:[],spoilerLevel:'none',spatialBinding,relatedLocations:[],relatedEntities:[],collectibles:[],secrets:[],sources:['synthetic'],facts:[],notes:[]});
 return {schema:'gaiagis-atlas-content',version:1,sources:[],exclusions:[],entities:[entity('place',{kind:'location',locationId:'place'}),entity('reward',{kind:'parent_location',locationId:'place'}),entity('field-only',{kind:'field_identity',fieldNames:['fixture']}),entity('unlocated',{kind:'unresolved'})]};
}
function field(p:PoiDataset):FieldPack{
 const table=(record:number):FieldEntrance=>({entry:Math.floor(record/2)+1,scenario:record%2 as 0|1,field_id:0,field_name:'dummy',field_x:0,field_y:0,field_triangle:0,field_direction:0,field_table_record:record,field_table_byte_offset:record*12,status:'placeholder',derivedZ:null});
 const record:FieldEntrance={...table(0),field_id:1,field_name:'fixture',field_x:2,field_y:2,status:'inside',derivedZ:0};
 return {schema:'gaiagis-field-context',version:3,coordinateSpace:'FieldLocalIdentity',archive:'flevel.lgp',sources:{...p.sources,'flevel.lgp':sha},nodes:[{id:1,name:'fixture',status:'available',saveId:1,scriptName:'fixture'}],edges:[],exits:[],unresolved:[],bindings:p.entrances.map(e=>({entranceId:e.id,locationId:e.location_id,fieldId:e.field_id,status:'verified_direct'})),scriptTransitions:'bounded_mapjump',scriptEdges:[],scriptExits:[],scriptUnresolved:[],nativeRelations:[{map:'WM0',fieldId:1,entry:1,scenario:0,function:0,offset:5,opcode:792}],entrances:Array.from({length:128},(_,i)=>i?table(i):record),gateways:[]};
}
function encounters(){return parseEncounters({
 schema:'gaiagis-encounters',version:1,reconstruction:'v1-geometric-gaia',lookup_profile:'classic-pc-reference',runtime_equivalence:'not-verified-steam2026',sources:{'wm0.map':sha,'world_us.lgp':sha,'enc_w.bin':sha},source_record:{filename:'enc_w.bin',size:2208,toc_index:0,archive_data_offset:0},regions:terrainSlots.map((terrain_slots,id)=>({id,terrain_slots,yuffie_threshold:yuffieThresholds[id]})),terrain_aliases:[{source:16,effective:0},{source:24,effective:8}],
 yuffie:Array.from({length:8},(_,i)=>({level_max:i,scene_id:i,raw_scene_id:i,byte_offset:i*4})),chocobo_ratings:Array.from({length:32},(_,i)=>({scene_id:i,rating:0,valid:true,byte_offset:32+i*4})),
 encounter_sets:Array.from({length:64},(_,i)=>{let offset=162+i*32;return {id:`${Math.floor(i/4)}:${i%4}`,region_id:Math.floor(i/4),slot:i%4,byte_offset:160+i*32,active_raw:0,active:false,encounter_rate:20,padding_hex:'0000',records:Object.fromEntries(encounterKinds.map((kind,k)=>[kind,Array.from({length:[6,2,1,1,4][k]},()=>({scene_id:23,weight:1,packed:1047,encounter_type:kind,byte_offset:(offset+=2)-2}))]))};}),
});}

describe('WM0 source evidence identity',()=>{
 it('joins every explicit trigger, retains multiple owners and ignores representative anchors',()=>{
  const p=poi(),e=events([event(),event('event-b',[10]),{...event('model',[]),anchor_kind:'script_model_position',model_id:1}]);
  p.entrances.push({...entrance('entry-b',10),trigger_triangle_ids:[10]});p.locations[0].entrance_ids.push('entry-b');
  const index=buildSourceEvidenceIndex(sha,{poi:p,events:e});
  expect(index.query(face).events.rows.map(e=>e.id)).toEqual(['event-a']);
  const r=index.query({...face,triangle:10});
  expect(r.events.rows.map(e=>e.id)).toEqual(['event-a','event-b']);expect(r.entrances.rows.map(e=>e.id)).toEqual(['entry-a','entry-b']);expect(r.locations.rows.map(l=>l.id)).toEqual(['place']);
  expect(index.query({...face,triangle:11}).events.status).toBe('no_direct_relation');
  // Same triangle number in another source cell must never share evidence.
  expect(index.query({...face,section:49}).entrances.rows).toEqual([]);expect(index.query({...face,mesh:4}).events.rows).toEqual([]);
  expect(r.identityKey).toBe(sourceIdentityKey({...face,triangle:10}));
 });
 it('separates unsupported map/cap identities, wrong query fingerprints, missing packs and unmatched sources',()=>{
  const index=buildSourceEvidenceIndex(sha,{});
  expect(index.query(face).events.status).toBe('unavailable');expect(index.query(face).encounter.status).toBe('unavailable');
  for(const source of [{...face,mapId:'WM2'},{...face,origin:1},{...face,section:null}])expect(index.query(source).events.status).toBe('not_applicable');
  expect(index.query({...face,sourceSHA:other}).events.status).toBe('source_mismatch');
  expect(()=>buildSourceEvidenceIndex('',{})).toThrow('fingerprint');
  const p=poi(),e=events(),enc=encounters();p.sources['wm0.map']=other;e.sources['wm0.map']=other;enc.sources['wm0.map']=other;
  const r=buildSourceEvidenceIndex(sha,{poi:p,events:e,encounters:enc,atlas:atlas(),field:field(p)}).query(face);
  for(const group of [r.events,r.entrances,r.locations,r.atlas,r.field])expect(group).toMatchObject({status:'source_mismatch',rows:[]});
  expect(r.encounter).toEqual({status:'source_mismatch',value:null});
 });
 it('uses the existing static terrain/region lookup without promoting it to runtime state',()=>{
  const r=buildSourceEvidenceIndex(sha,{encounters:encounters()}).query({...face,region:19,terrain:24});
  expect(r.terrain).toBe(24);expect(r.region).toBe(19);expect(r.encounter.status).toBe('linked');expect(r.encounter.value).toMatchObject({sourceRegion:19,effectiveRegion:15,sourceTerrain:24,effectiveTerrain:8,slot:0,fallback:true,set:{active:false}});
  expect(buildSourceEvidenceIndex(sha,{encounters:encounters()}).query({...face,terrain:null}).encounter.status).toBe('not_applicable');
 });
 it('links event location IDs only when the script/table identities also agree',()=>{
  const p=poi(),e=events([event('event-only',[11])]);
  expect(buildSourceEvidenceIndex(sha,{poi:p,events:e}).query({...face,triangle:11}).locations.rows.map(l=>l.id)).toEqual(['place']);
  e.sources['wm0.ev']=other;
  const r=buildSourceEvidenceIndex(sha,{poi:p,events:e}).query({...face,triangle:11});expect(r.events.rows).toHaveLength(1);expect(r.locations.rows).toEqual([]);
 });
 it('preserves Atlas entrance, parent and exact Field identity precision; unlocated entities remain unlinked',()=>{
  const p=poi(),r=buildSourceEvidenceIndex(sha,{poi:p,atlas:atlas(),field:field(p)}).query(face);
  expect(r.atlas.rows.map(r=>[r.entity.id,r.binding.precision,r.binding.marker])).toEqual([['place','entrance_level',true],['reward','parent_place',false],['field-only','field_only',false]]);
  expect(r.atlas.rows.find(r=>r.entity.id==='reward')?.binding.entranceId).toBeNull();
  const f=field(p);f.sources.maplist=other;expect(buildSourceEvidenceIndex(sha,{poi:p,atlas:atlas(),field:f}).query(face).atlas.rows.map(r=>r.entity.id)).toEqual(['place','reward']);
 });
 it('requires complete matching private Atlas provenance and validates its existing binding',()=>{
  const p=poi(),content=atlas(),pack:AtlasPack={schema:'gaiagis-atlas',version:1,curated_sha256:sha,content,sources:{...p.sources},bindings:Object.fromEntries(content.entities.map(e=>[e.id,resolveBinding(e,p)]))};
  expect(buildSourceEvidenceIndex(sha,{poi:p,atlas:pack}).query(face).atlas.rows).toHaveLength(2);
  pack.sources.maplist=other;expect(buildSourceEvidenceIndex(sha,{poi:p,atlas:pack}).query(face).atlas).toEqual({status:'source_mismatch',rows:[]});
  pack.sources.maplist=maplist;pack.bindings.place.entranceId='unproved';expect(buildSourceEvidenceIndex(sha,{poi:p,atlas:pack}).query(face).atlas.status).toBe('source_mismatch');
 });
 it('keeps Field identity browsing separate from local landing-point verification and legacy context',()=>{
  const p=poi(),f=field(p),r=buildSourceEvidenceIndex(sha,{poi:p,field:f}).query(face);
  expect(r.field.status).toBe('linked');expect(r.field.rows[0]).toMatchObject({node:{id:1},table:{field_table_record:0},tableStatus:'mesh_unavailable'});
  expect(r.field.rows[0]).not.toHaveProperty('longitude');expect(r.field.rows[0]).not.toHaveProperty('anchor');
  f.version=2;const legacy=buildSourceEvidenceIndex(sha,{poi:p,field:f}).query(face).field.rows[0];expect(legacy.node.id).toBe(1);expect(legacy.table).toBeNull();expect(legacy.tableStatus).toBe('legacy_context');
 });
 it('does not borrow Field identity on mismatched provenance or a forged entrance binding',()=>{
  for(const key of ['wm0.map','wm0.ev','field.tbl','maplist']){const p=poi(),f=field(p);f.sources[key]=other;expect(buildSourceEvidenceIndex(sha,{poi:p,field:f}).query(face).field).toEqual({status:'source_mismatch',rows:[]});}
  const p=poi(),f=field(p);f.bindings[0].fieldId=2;expect(buildSourceEvidenceIndex(sha,{poi:p,field:f}).query(face).field.status).toBe('source_mismatch');
  const g=field(p);g.entrances![0].field_x=99;const result=buildSourceEvidenceIndex(sha,{poi:p,field:g}).query(face).field.rows[0];expect(result.node.id).toBe(1);expect(result.tableStatus).toBe('table_mismatch');
 });
});
