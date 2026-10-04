// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {parseEvents,loadOptionalEvents,readLocalEvents,filterEvent,eventLocation,validateEventsMesh,eventTypes} from '../src/data/events';
import {parseMesh} from '../src/data/mesh';
import {markerPosition,markerVisible} from '../src/viewer/locations';
import {projections} from '../src/projections';
import {flyDuration,shortestLongitude} from '../src/viewer/flyTo';
export function syntheticEvents(){
  const sha='a'.repeat(64);
  const e={id:'synthetic-event',event_type:'scripted_battle',name:'Synthetic scripted battle',display_name:'Synthetic scripted battle',longitude:0,latitude:0,height:0,
    game_x:147456,game_north:114688,game_height:0,height_source:'interpolated_from_surface',anchor_kind:'derived_trigger_centroid',world_map:0,section_id:0,mesh_id:0,triangle_id:0,trigger_triangle_ids:[0],anchor_function:0x8000,
    function_id:0x8000,call_table_record:1,instruction_offset:1,basic_block:1,opcode:0x317,opcode_name:'BATTLE',raw_arguments:[42],model_id:null,entity_id:null,field_id:null,field_name:null,entrance_table_id:null,scenario:null,battle_id:42,location_id:null,condition_kind:['savemap-dependent'],runtime_availability:'not_simulated',source_file:'wm0.ev',source_record:1,confidence:'source_trigger_derived',notes:'Synthetic public fixture; no game data.'};
  return {schema:'gaiagis-events',version:1,reconstruction:'v1-geometric-gaia',world_extent:[294912,229376],mapping:{method:'inverse_mercator',radius_m:6371008.8,flip_latitude:false,antimeridian_game_east:0,vertical_scale_m_per_raw_unit:1},sources:{'wm0.map':sha,'world_us.lgp':sha,'wm0.ev':sha,'field.tbl':sha,maplist:sha},events:[e],unresolved:[{reason:'dynamic_position'}],extraction:{}};
}
describe('World Events data boundary',()=>{
  it('accepts synthetic scripted battle with raw identity',()=>expect(parseEvents(syntheticEvents()).events[0].battle_id).toBe(42));
  it.each(['longitude','game_x','function_id','instruction_offset','model_id'])('rejects invalid %s',key=>{const f=syntheticEvents();(f.events[0] as Record<string,unknown>)[key]=Infinity;expect(()=>parseEvents(f)).toThrow();});
  it('rejects schema/version/reconstruction changes',()=>{for(const [key,v]of [['schema','other'],['version',2],['reconstruction','climate']]){const f=syntheticEvents();(f as Record<string,unknown>)[key as string]=v;expect(()=>parseEvents(f)).toThrow();}});
  it('rejects source hash mismatch',()=>expect(()=>parseEvents(syntheticEvents(),{stage1:{source_wm0_sha256:'b'.repeat(64)}} as never)).toThrow(/different WM0/));
  it('rejects missing hash',()=>{const f=syntheticEvents();f.sources.maplist='';expect(()=>parseEvents(f)).toThrow();});
  it('rejects duplicate event identity',()=>{const f=syntheticEvents();f.events.push(f.events[0]);expect(()=>parseEvents(f)).toThrow();});
  it('rejects guessed anchors and runtime availability',()=>{const f=syntheticEvents();f.events[0].anchor_kind='visual_guess';expect(()=>parseEvents(f)).toThrow();const g=syntheticEvents();g.events[0].runtime_availability='available_now';expect(()=>parseEvents(g)).toThrow();});
  it('rejects unresolved entrance displayed as a field entrance',()=>{const f=syntheticEvents();f.events[0].event_type='dynamic_entrance';expect(()=>parseEvents(f)).toThrow();});
  it('does not require an optional events file',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:404})));expect(await loadOptionalEvents({} as never)).toBeNull();vi.unstubAllGlobals();});
  it('rejects corrupt optional file',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{headers:{'content-type':'application/json'}})));await expect(loadOptionalEvents({} as never)).rejects.toThrow();vi.unstubAllGlobals();});
  it('rejects wrong filename and oversized input',async()=>{await expect(readLocalEvents({name:'other.json',size:1} as File,{} as never)).rejects.toThrow();await expect(readLocalEvents({name:'gaia-events.json',size:6_000_000} as File,{} as never)).rejects.toThrow();});
  it('filters categories independently of location search',()=>{const e=parseEvents(syntheticEvents()).events[0];expect(filterEvent(e,'battles')).toBe(true);expect(filterEvent(e,'entrances')).toBe(false);expect(filterEvent(e,'all')).toBe(true);for(const t of eventTypes)expect(filterEvent({...e,event_type:t},'all')).toBe(true);});
  it('keeps unknown height null; display-only baseline is explicit',()=>{const f=syntheticEvents();Object.assign(f.events[0],{event_type:'world_object',anchor_kind:'script_model_position',model_id:1,height:null,game_height:null,height_source:'unknown',triangle_id:null,trigger_triangle_ids:[]});const e=parseEvents(f).events[0];expect(e.height).toBeNull();expect(eventLocation(e).height).toBe(0);});
  it.each(['globe','equirectangular','mercator','mollweide','orthographic'] as const)('shares marker projection endpoint for %s',id=>{const e=parseEvents(syntheticEvents()).events[0],context={radius:1,centerLon:0,centerLat:0,mercatorLimit:85.0511287798066};expect(markerPosition(eventLocation(e),id,context)).toEqual(projections[id].project(e.longitude,e.latitude,1000,context));});
  it('culls rear orthographic events',()=>expect(markerVisible({longitude:180,latitude:0},'orthographic',{radius:1,centerLon:0,centerLat:0,mercatorLimit:85.0511287798066})).toBe(false));
  it('reuses shortest-angle and reduced-motion flight',()=>{expect(Math.abs(shortestLongitude(179,-179,.5))).toBe(180);expect(flyDuration(true)).toBe(0);});
});
const local=existsSync('public/data/gaia-events.json')&&existsSync('public/data/gaia-mesh.bin');
describe.skipIf(!local)('private source events integration',()=>{
  it('validates every source lineage on the V1 mesh',()=>{const meta=JSON.parse(readFileSync('public/data/gaia-meta.json','utf8')),b=readFileSync('public/data/gaia-mesh.bin'),mesh=parseMesh(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),meta),data=parseEvents(JSON.parse(readFileSync('public/data/gaia-events.json','utf8')),meta);expect(()=>validateEventsMesh(data,mesh)).not.toThrow();});
});
