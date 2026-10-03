// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {parseMesh} from '../src/data/mesh';
import {Vector3} from 'three';
import {parsePoi,searchLocations,filterLocation,loadOptionalPoi,readLocalPoi,validatePoiMesh} from '../src/data/poi';
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
