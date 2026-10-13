// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {parseMesh} from '../src/data/mesh';
import {Vector3} from 'three';
import {parsePoi,searchLocations,filterLocation,loadOptionalPoi,readLocalPoi,validatePoiMesh} from '../src/data/poi';
import {validateWorldEntrance,parseFieldPack,parseWalkmeshHeader,decodeWalkmesh,WalkmeshNetwork} from '../src/data/fieldContext';
import type {FieldEntrance} from '../src/data/fieldContext';
import type {Location} from '../src/data/poi';
import {projections} from '../src/projections';
import {markerPosition,markerVisible} from '../src/viewer/locations';
import {shortestLongitude,flyDirection,flyDuration} from '../src/viewer/flyTo';
const sha='a'.repeat(64);
function fixture(){
  const entrance={id:'fixture-entry',location_id:'fixture',game_x:0,game_north:0,game_height:0,longitude:0,latitude:0,height:0,world_map:0,section_id:0,mesh_id:0,triangle_id:0,
    field_id:1,field_name:'fixture_field',entrance_table_id:1,scenario:0,region_id:0,source_kind:'derived_from_entry_trigger',source_file:'wm0.map',source_record:0,source_script:4,
    height_source:'interpolated_from_surface',confidence:'verified_trigger_derived_position',notes:'Synthetic test fixture; not an FF7 coordinate.',heading:null,trigger_radius:null,availability:null,
    trigger_triangle_ids:[0],script_calls:[{call_table_record:1,instruction_word_offset:1}],field_x:0,field_y:0,field_triangle:0,field_direction:0,field_table_record:0,field_table_byte_offset:0};
  const location={id:'fixture',name:'Fixture City',display_name:'Fixture City',category:'city',aliases:['Synthetic Town'],field_names:['fixture_field'],primary_entrance:entrance.id,entrance_ids:[entrance.id],longitude:0,latitude:0,height:0,navigation_kind:'primary_entrance',name_source:'manual_verified_field_identity',center:null};
  return {schema:'gaiagis-poi',version:1,reconstruction:'v1-geometric-gaia',world_extent:[294912,229376],mapping:{method:'inverse_mercator',radius_m:6371008.8,flip_latitude:false,antimeridian_game_east:0,vertical_scale_m_per_raw_unit:1},sources:{'wm0.map':sha,'wm0.ev':sha,'field.tbl':sha,maplist:sha},locations:[location],entrances:[entrance]};
}
describe('local POI schema',()=>{
  it('accepts validated source relationships and multiple entrances',()=>{
    const f=fixture();f.entrances.push({...f.entrances[0],id:'second',scenario:1,field_table_record:1,field_table_byte_offset:12});f.locations[0].entrance_ids.push('second');
    expect(parsePoi(f).entrances).toHaveLength(2);
  });
  it.each(['latitude','game_x','field_id','region_id','source_script'])('rejects invalid %s',key=>{
    const f=fixture();(f.entrances[0] as Record<string,unknown>)[key]=Infinity;expect(()=>parsePoi(f)).toThrow();
  });
  it('rejects climate mapping, orphan references and inconsistent centers',()=>{
    const f=fixture();f.mapping.flip_latitude=true;expect(()=>parsePoi(f)).toThrow();
    const g=fixture();g.locations[0].entrance_ids=['missing'];expect(()=>parsePoi(g)).toThrow();
    const h=fixture();h.locations[0].longitude=10;expect(()=>parsePoi(h)).toThrow();
  });
  it('rejects duplicate ids and source mismatch',()=>{
    const f=fixture();f.entrances.push(f.entrances[0]);expect(()=>parsePoi(f)).toThrow();
    expect(()=>parsePoi(fixture(),{stage1:{source_wm0_sha256:'b'.repeat(64)}} as never)).toThrow(/different WM0/);
  });
  it('rejects fabricated world heading and non-source positions',()=>{
    const f=fixture();(f.entrances[0] as Record<string,unknown>).heading=255;expect(()=>parsePoi(f)).toThrow();
    const g=fixture();g.entrances[0].source_kind='estimated_by_visual_inspection';expect(()=>parsePoi(g)).toThrow();
  });
  it('keeps missing optional data independent of mesh loading',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:404})));
    expect(await loadOptionalPoi({} as never)).toBeNull();vi.unstubAllGlobals();
  });
  it('does not silently accept corrupt optional data',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"version":99}',{headers:{'content-type':'application/json'}})));
    await expect(loadOptionalPoi({} as never)).rejects.toThrow();vi.unstubAllGlobals();
  });
  it('rejects oversized or wrong local file names',async()=>{
    await expect(readLocalPoi({name:'other.json',size:1} as File,{} as never)).rejects.toThrow();
    await expect(readLocalPoi({name:'gaia-poi.json',size:6_000_000} as File,{} as never)).rejects.toThrow();
  });
});
describe('location search',()=>{
  const base=parsePoi(fixture()).locations[0];
  const locations=[{...base,id:'prefix',display_name:'Test Prefix'}, {...base,id:'substring',display_name:'A Test'},
    {...base,id:'alias',display_name:'Another',aliases:['Test alias']},{...base,id:'exact',display_name:'Test'},
    {...base,id:'field',display_name:'Internal',aliases:[],field_names:['test_field']}];
  it('ranks exact, prefix, substring, alias, field name',()=>expect(searchLocations(locations,' TeSt ').map(l=>l.id)).toEqual(['exact','prefix','substring','alias','field']));
  it('normalizes accents and finds aliases/internal fields',()=>{expect(searchLocations([{...base,display_name:'Café'}],'CAFE')).toHaveLength(1);expect(searchLocations([base],'synthetic')).toHaveLength(1);expect(searchLocations([base],'fixture_field')).toHaveLength(1);});
  it('filters categories and reports empty results',()=>{expect(filterLocation({...base,category:'cave'},'dungeons')).toBe(true);expect(searchLocations([base],'','dungeons')).toHaveLength(0);expect(searchLocations([base],'missing')).toHaveLength(0);});
});
describe('World → Field original entrance evidence',()=>{
 function evidence(){
  const p=fixture();Object.assign(p.entrances[0],{field_x:2,field_y:2});
  const poi=parsePoi(p),e=poi.entrances[0];
  const blank=(record:number):FieldEntrance=>({entry:Math.floor(record/2)+1,scenario:record%2 as 0|1,field_id:0,field_name:'dummy',field_x:0,field_y:0,field_triangle:0,field_direction:0,field_table_record:record,field_table_byte_offset:record*12,status:'placeholder',derivedZ:null});
  const record:FieldEntrance={entry:1,scenario:0,field_id:1,field_name:'fixture_field',field_x:2,field_y:2,field_triangle:0,field_direction:0,field_table_record:0,field_table_byte_offset:0,status:'inside',derivedZ:0};
  const entrances=Array.from({length:128},(_,i)=>i?blank(i):record);
  const pack=parseFieldPack({schema:'gaiagis-field-context',version:3,coordinateSpace:'FieldLocalIdentity',archive:'flevel.lgp',sources:{...poi.sources,'flevel.lgp':sha},nodes:[{id:1,name:'fixture_field',status:'available',saveId:null,scriptName:null}],edges:[],exits:[],unresolved:[],bindings:[{entranceId:e.id,locationId:e.location_id,fieldId:1,status:'verified_direct'}],scriptTransitions:'bounded_mapjump',scriptEdges:[],scriptExits:[],scriptUnresolved:[],nativeRelations:[{map:'WM0',fieldId:1,entry:1,scenario:0,function:1,offset:1,opcode:792}],entrances,gateways:[]});
  const raw=new ArrayBuffer(34),view=new DataView(raw);view.setUint32(0,1,true);[0,0,0,0,10,0,0,0,0,10,0,0].forEach((v,i)=>view.setInt16(4+i*2,v,true));for(let i=0;i<3;i++)view.setUint16(28+i*2,65535,true);
  return {poi,e,pack,mesh:decodeWalkmesh(raw),sources:{'flevel.lgp':sha,maplist:sha}};
 }
 it('requires original WM0 script/table identity and selected geometry, without inventing a global coordinate',()=>{
  const {poi,e,pack,mesh,sources}=evidence();expect(validateWorldEntrance(pack,poi,e).reason).toBe('mesh_unavailable');const r=validateWorldEntrance(pack,poi,e,mesh,sources);expect(r.ok).toBe(true);expect(r.anchor).toEqual({key:'entrance:0',kind:'entrance',record:pack.entrances![0],x:2,y:2});expect(r.relations.map(n=>n.offset)).toEqual([1]);expect(r).not.toHaveProperty('longitude');
 });
 it('retains Default/Alternative as separate evidence and targets',()=>{
  const {poi,e,pack,mesh,sources}=evidence(),alternative={...e,id:'alternative',scenario:1,field_id:2,field_name:'other_field',field_table_record:1,field_table_byte_offset:12,script_calls:[{call_table_record:2,instruction_word_offset:2}]};poi.entrances.push(alternative);pack.nodes.push({id:2,name:'other_field',status:'available',saveId:null});pack.bindings.push({entranceId:'alternative',locationId:e.location_id,fieldId:2,status:'verified_direct'});pack.entrances![1]={...pack.entrances![0],scenario:1,field_id:2,field_name:'other_field',field_table_record:1,field_table_byte_offset:12};pack.nativeRelations!.push({map:'WM0',fieldId:2,entry:1,scenario:1,function:2,offset:2,opcode:792});
  expect(validateWorldEntrance(pack,poi,e,mesh,sources).field?.id).toBe(1);const r=validateWorldEntrance(pack,poi,alternative,mesh,sources);expect(r.ok).toBe(true);expect(r.field?.id).toBe(2);expect(r.anchor?.key).toBe('entrance:1');expect(r.record?.scenario).toBe(1);
 });
 it('keeps identity browsing but refuses old Context and absent resources',()=>{
  const {poi,e,pack,mesh,sources}=evidence();for(const version of [1,2] as const)expect(validateWorldEntrance({...pack,version},poi,e,mesh,sources)).toMatchObject({ok:false,reason:'legacy_context',field:{id:1}});expect(validateWorldEntrance(null,poi,e).reason).toBe('context_unavailable');expect(validateWorldEntrance(pack,null,e).reason).toBe('poi_unavailable');expect(validateWorldEntrance(pack,poi,{...e,id:'missing'}).reason).toBe('unknown_entrance');expect(validateWorldEntrance(pack,poi,e,mesh).reason).toBe('source_mismatch');
 });
 it.each(['wm0.map','wm0.ev','field.tbl','maplist','flevel.lgp'])('rejects source mismatch %s',key=>{
  const {poi,e,pack,mesh,sources}=evidence();if(key==='flevel.lgp')sources[key]='b'.repeat(64);else pack.sources[key]='b'.repeat(64);expect(validateWorldEntrance(pack,poi,e,mesh,sources).reason).toBe('source_mismatch');
 });
 it.each([2,3])('does not borrow WM0 geometry for WM%d identity',map=>{const {poi,e,pack,mesh,sources}=evidence();e.world_map=map;expect(validateWorldEntrance(pack,poi,e,mesh,sources).reason).toBe('non_wm0');});
 it('rejects missing, contradictory and unrelated ENTER_FIELD calls rather than choosing the first',()=>{
  const {poi,e,pack,mesh,sources}=evidence();const check=()=>validateWorldEntrance(pack,poi,e,mesh,sources);pack.nativeRelations![0].offset=2;expect(check().reason).toBe('transition_mismatch');pack.nativeRelations![0].offset=1;pack.nativeRelations!.push({...pack.nativeRelations![0],fieldId:2,function:2});expect(check().reason).toBe('transition_mismatch');pack.nativeRelations!.pop();e.script_calls.push({call_table_record:2,instruction_word_offset:3});expect(check().reason).toBe('transition_mismatch');
 });
 it('rejects dummy, tampered table coordinates, invalid/outside mesh and unproved Z instead of snapping',()=>{
  const f=evidence();f.pack.entrances![0].status='placeholder';expect(validateWorldEntrance(f.pack,f.poi,f.e,f.mesh,f.sources).reason).toBe('table_mismatch');
  const g=evidence();expect(validateWorldEntrance(g.pack,g.poi,{...g.e,field_x:3},g.mesh,g.sources).reason).toBe('table_mismatch');g.pack.entrances![0].field_x=99;expect(validateWorldEntrance(g.pack,g.poi,g.e,g.mesh,g.sources).reason).toBe('table_mismatch');
  const h=evidence();h.mesh.vertices[4]=1;h.mesh.vertices[9]=1;expect(validateWorldEntrance(h.pack,h.poi,h.e,h.mesh,h.sources).reason).toBe('point_invalid');
  const z=evidence();z.pack.entrances![0].derivedZ=2;expect(validateWorldEntrance(z.pack,z.poi,z.e,z.mesh,z.sources).reason).toBe('point_invalid');
 });
 it('preserves exact boundary points',()=>{const {poi,e,pack,mesh,sources}=evidence();e.field_x=0;e.field_y=5;Object.assign(pack.entrances![0],{field_x:0,field_y:5,status:'boundary'});expect(validateWorldEntrance(pack,poi,e,mesh,sources).ok).toBe(true);});
 it('refuses non-trigger or missing target identity even with a valid FIELD.TBL point',()=>{
  const {poi,e,pack,mesh,sources}=evidence();e.source_kind='field_table_only';expect(validateWorldEntrance(pack,poi,e,mesh,sources).reason).toBe('world_evidence_missing');e.source_kind='derived_from_entry_trigger';pack.nodes[0].status='missing';expect(validateWorldEntrance(pack,poi,e,mesh,sources).reason).toBe('field_unavailable');
 });
 it('cannot use WM2/WM3 ENTER_FIELD identity as proof of a WM0 entrance',()=>{
  for(const map of ['WM2','WM3'] as const){const {poi,e,pack,mesh,sources}=evidence();pack.nativeRelations![0].map=map;expect(validateWorldEntrance(pack,poi,e,mesh,sources).reason).toBe('transition_mismatch');}
 });
 it('requires ENTER_FIELD opcode and bounded original instruction offsets',()=>{
  for(const offset of [0,-1,13824,Infinity]){const {poi,e,pack,mesh,sources}=evidence();e.script_calls[0].instruction_word_offset=offset;expect(validateWorldEntrance(pack,poi,e,mesh,sources).reason).toBe('world_evidence_missing');}
  const f=evidence();(f.pack.nativeRelations![0] as unknown as {opcode:number}).opcode=0x60;expect(validateWorldEntrance(f.pack,f.poi,f.e,f.mesh,f.sources).reason).toBe('transition_mismatch');
 });
 it('rejects invalid target IDs and XY outside S16 bounds without mutating evidence',()=>{
  const invalid=evidence();invalid.e.field_id=65536;expect(validateWorldEntrance(invalid.pack,invalid.poi,invalid.e,invalid.mesh,invalid.sources).reason).toBe('field_unavailable');
  for(const [key,value] of [['field_triangle',65535],['field_x',32768],['field_y',-32769]] as const){const f=evidence();f.e[key]=value;f.pack.entrances![0][key]=value;expect(validateWorldEntrance(f.pack,f.poi,f.e,f.mesh,f.sources).reason).toBe('point_invalid');expect(f.e[key]).toBe(value);expect(f.pack.entrances![0][key]).toBe(value);}
 });
 it('requires hashes on every necessary source and independently verifies the Walkmesh maplist',()=>{
  for(const key of ['wm0.map','wm0.ev','field.tbl','maplist','flevel.lgp']){const f=evidence();delete f.pack.sources[key];expect(validateWorldEntrance(f.pack,f.poi,f.e,f.mesh,f.sources).reason).toBe('source_mismatch');}
  const f=evidence();f.sources.maplist='b'.repeat(64);expect(validateWorldEntrance(f.pack,f.poi,f.e,f.mesh,f.sources).reason).toBe('source_mismatch');
 });
 it('rejects same-ID entrance arguments that borrow another map, location or source record',()=>{
  const {poi,e,pack,mesh,sources}=evidence();const validate=(v:typeof e)=>validateWorldEntrance(pack,poi,v,mesh,sources);
  expect(validate(structuredClone(e)).ok).toBe(true);
  for(const world_map of [2,3])expect(validate({...e,world_map}).reason).toBe('non_wm0');
  expect(validate({...e,location_id:'different_parent'}).reason).toBe('table_mismatch');
  for(const key of ['source_kind','source_file','source_record','source_script','section_id','mesh_id','triangle_id'] as const){const modified={...e,[key]:typeof e[key]==='string'?'tampered':Number(e[key])+1};expect(validate(modified).reason).toBe('world_evidence_missing');}
 });
 it('compares raw trigger and script-call arrays by original order and values, not merely entrance ID',()=>{
  const {poi,e,pack,mesh,sources}=evidence();const validate=(v:typeof e)=>validateWorldEntrance(pack,poi,v,mesh,sources);
  expect(validate({...e,trigger_triangle_ids:[0,1]}).reason).toBe('world_evidence_missing');
  expect(validate({...e,trigger_triangle_ids:[1]}).reason).toBe('world_evidence_missing');
  expect(validate({...e,script_calls:[{call_table_record:2,instruction_word_offset:1}]}).reason).toBe('world_evidence_missing');
  expect(validate({...e,script_calls:[{call_table_record:1,instruction_word_offset:2}]}).reason).toBe('world_evidence_missing');
  e.trigger_triangle_ids=[0,1];e.script_calls=[{call_table_record:1,instruction_word_offset:1},{call_table_record:2,instruction_word_offset:2}];pack.nativeRelations!.push({...pack.nativeRelations![0],function:2,offset:2});expect(validate(structuredClone(e)).ok).toBe(true);
  expect(validate({...e,trigger_triangle_ids:[1,0]}).reason).toBe('world_evidence_missing');expect(validate({...e,script_calls:[...e.script_calls].reverse()}).reason).toBe('world_evidence_missing');
 });
});
it.skipIf(!process.env.GAIA_FIELD_NAV_WORKSPACE)('verifies real WM0 entrance records against the same local Field/Walkmesh source',()=>{
 const root=process.env.GAIA_FIELD_NAV_WORKSPACE!;
 const pack=parseFieldPack(JSON.parse(readFileSync(root+'/gaia-field-context.json','utf8'))),poi=parsePoi(JSON.parse(readFileSync(root+'/gaia-poi.json','utf8'))),raw=readFileSync(root+'/gaia-field-walkmesh.bin');
 const length=raw.readUInt32LE(12),buffer=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),header=parseWalkmeshHeader(buffer.slice(0,16+length),raw.length,pack),verified=[];
 for(const e of poi.entrances){const scene=header.scenes.get(e.field_id)!;expect(scene.status).toBe('available');const mesh=decodeWalkmesh(buffer.slice(header.base+scene.offset!,header.base+scene.offset!+scene.bytes!));const result=validateWorldEntrance(pack,poi,e,mesh,header.sources);expect(result.ok,e.id+' / '+result.reason).toBe(true);verified.push({e,mesh,result});}
 const midgar=verified.filter(v=>v.e.field_name==='mds5_5');expect(midgar.length).toBeGreaterThan(0);for(const v of midgar){expect(v.result.record?.field_triangle).toBe(16);const reach=new WalkmeshNetwork(v.mesh).reach(16);expect(reach.ids).toHaveLength(85);expect(reach.ids).not.toContain(82);expect(reach.ids).not.toContain(83);}
 const farm=verified.filter(v=>v.e.field_name==='farm');expect(new Set(farm.map(v=>v.e.scenario))).toEqual(new Set([0,1]));for(const v of farm){expect(v.result.record?.field_triangle).toBe(v.e.scenario?79:10);expect(new WalkmeshNetwork(v.mesh).reach(v.e.field_triangle).ids).toHaveLength(184);}
 // FIELD.TBL has identities without WM0 anchors: never synthesize POIs from it.
 expect(verified.length).toBeLessThan(pack.entrances!.filter(e=>e.status==='inside'||e.status==='boundary').length);
});
describe('mesh provenance binding',()=>{
  const mesh={triangleCount:1,indices:new Uint32Array([0,1,2]),geographic:new Float32Array([0,0,0,-1,-1,0,1,1,0]),attributes:()=>({origin:0,section:0,mesh:0,triangle:0,region:0,script:7})};
  it('checks representative height, region and every trigger lineage',()=>expect(()=>validatePoiMesh(parsePoi(fixture()),mesh as never)).not.toThrow());
  it('rejects wrong region',()=>{const f=fixture();f.entrances[0].region_id=1;expect(()=>validatePoiMesh(parsePoi(f),mesh as never)).toThrow(/region/);});
  it('rejects a fabricated trigger triangle',()=>{const f=fixture();f.entrances[0].trigger_triangle_ids.push(50);expect(()=>validatePoiMesh(parsePoi(f),mesh as never)).toThrow(/trigger/);});
  it('rejects a height inconsistent with the source surface',()=>{const f=fixture();f.entrances[0].height=f.entrances[0].game_height=f.locations[0].height=5;expect(()=>validatePoiMesh(parsePoi(f),mesh as never)).toThrow(/position/);});
});
const localPoi=new URL('../public/data/gaia-poi.json',import.meta.url);
it.skipIf(!existsSync(localPoi))('binds all locally generated POIs to the actual frozen V1 transport',()=>{
  const meta=JSON.parse(readFileSync(new URL('../public/data/gaia-meta.json',import.meta.url),'utf8'));
  const buffer=readFileSync(new URL('../public/data/gaia-mesh.bin',import.meta.url));
  const mesh=parseMesh(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),meta);
  expect(()=>validatePoiMesh(parsePoi(JSON.parse(readFileSync(localPoi,'utf8')),meta),mesh)).not.toThrow();
});
describe('shared projection and fly-to endpoints',()=>{
  const c={radius:6371008.8,mercatorLimit:85.0511287798066,centerLon:0,centerLat:0};
  const l={longitude:37,latitude:21,height:123} as Location;
  it.each(Object.keys(projections) as (keyof typeof projections)[])('%s marker uses existing projection endpoint',id=>expect(markerPosition(l,id,c)).toEqual(projections[id].project(l.longitude,l.latitude,l.height+1000,c)));
  it('hides orthographic far-side markers and shows the focused target',()=>{expect(markerVisible({...l,longitude:180},'orthographic',c)).toBe(false);expect(markerVisible(l,'orthographic',{...c,centerLon:37,centerLat:21})).toBe(true);});
  it('uses the short antimeridian angular path',()=>{expect(Math.abs(shortestLongitude(179,-179,.5))).toBe(180);expect(shortestLongitude(179,-179,1)).toBe(-179);});
  it('reaches exact globe direction by a short spherical arc',()=>{
    const from=new Vector3(...projections.globe.project(179,0,0,c)),to=new Vector3(...projections.globe.project(-179,0,0,c));
    expect(flyDirection(from,to,1).distanceTo(to)).toBeLessThan(1e-12);expect(flyDirection(from,to,.5).z).toBeLessThan(-.999);
  });
  it('honors reduced motion',()=>{expect(flyDuration(true)).toBe(0);expect(flyDuration(false)).toBeGreaterThanOrEqual(600);expect(flyDuration(false)).toBeLessThanOrEqual(1200);});
});
