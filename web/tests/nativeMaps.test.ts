// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {parseNativeMap,decodeNativeMap,parseTransitions} from '../src/data/nativeMaps';
import {parseTextureTransport} from '../src/data/textures';
import {dictionaries,locales} from '../src/i18n';
const sha='a'.repeat(64);
function fixture(mapId='WM2',change:Record<string,unknown>={}){const grid=mapId==='WM2'?[3,4]:[2,2];const h={schema:'gaiagis-native-map',version:1,mapId,coordinate_space:mapId+'Native',global_mapping:null,axis_order:['native_x','native_z','raw_height'],height_unit:'raw_source_units',section_grid:grid,section_count:grid[0]*grid[1],triangle_count:1,record_bytes:72,extent:grid.map(x=>x*32768),source_sha256:sha,payload_sha256:sha,terrain_names:{},region_names:{},...change};const json=new TextEncoder().encode(JSON.stringify(h)),buffer=new ArrayBuffer(16+json.length+72+32),v=new DataView(buffer);new Uint8Array(buffer).set(new TextEncoder().encode('GAIAMAP\0'));v.setUint32(8,1,true);v.setUint32(12,json.length,true);new Uint8Array(buffer,16).set(json);v.setInt32(16+json.length+8,-500,true);return buffer;}
describe('explicit native transport',()=>{
 for(const id of ['WM2','WM3'])it(id+' has no geographic mapping',()=>{const m=parseNativeMap(fixture(id));expect(m.header.global_mapping).toBe(null);expect(m.header.coordinate_space).toBe(id+'Native');expect(m.positions[2]).toBe(-500);expect(m.attributes(0).map).toBe(Number(id[2]));});
 for(const change of [{mapId:'WM0'},{coordinate_space:'GaiaGame'},{global_mapping:{}},{height_unit:'meters'},{record_bytes:71},{triangle_count:0},{section_count:63},{source_sha256:'bad'},{axis_order:['longitude','latitude','height']}])it('rejects invalid metadata '+JSON.stringify(change),()=>expect(()=>parseNativeMap(fixture('WM2',change))).toThrow());
 it('rejects truncation',()=>expect(()=>parseNativeMap(fixture().slice(0,-1))).toThrow());
 for(const names of [null,[],{'32':'Unknown'},{'0':5},{'0':'x'.repeat(161)}])it('rejects malformed categorical names '+JSON.stringify(names),()=>expect(()=>parseNativeMap(fixture('WM2',{terrain_names:names}))).toThrow());
 it('rejects out-of-bounds position',()=>{const b=fixture(),v=new DataView(b);v.setInt32(16+v.getUint32(12,true),999999,true);expect(()=>parseNativeMap(b)).toThrow();});
 it('rejects unknown terrain',()=>{const b=fixture(),v=new DataView(b);v.setUint8(16+v.getUint32(12,true)+62,32);expect(()=>parseNativeMap(b)).toThrow();});
 it('rejects corrupt digest',async()=>expect(decodeNativeMap(fixture())).rejects.toThrow());
 it('rejects wrong triangle index',()=>expect(()=>parseNativeMap(fixture()).attributes(1)).toThrow());
 it('texture namespace cannot fall back to WM0',()=>expect(()=>parseTextureTransport(fixture(),parseNativeMap(fixture()),{sha256:sha},{mapId:'WM2',sourceHash:sha})).toThrow());
});
function transitions(change:Record<string,unknown>={}){return JSON.stringify({schema:'gaiagis-map-transitions',version:1,sources:{'wm2.map':sha},transitions:[{id:'synthetic',from_map:'WM2',to_map:'WM0',from_anchor_kind:'unresolved',source_file:'synthetic.ev',transform_kind:'transition_pair_only',from_native_position:null,to_native_position:null,evidence_class:'runtime_dependent',condition_kind:[],notes:'Synthetic: runtime destination',runtime_availability:'not_simulated',...change}]});}
describe('transition evidence',()=>{
 it('keeps unresolved coordinates null',()=>expect(parseTransitions(transitions()).transitions[0].to_native_position).toBe(null));
 it('checks source compatibility',()=>expect(()=>parseTransitions(transitions(),{WM2:'b'.repeat(64)})).toThrow());
 it('retains exact pair',()=>expect(parseTransitions(transitions({from_native_position:[1,2,3],to_native_position:[4,5,6]})).transitions[0].to_native_position).toEqual([4,5,6]));
 for(const change of [{from_native_position:[98305,0,0]},{to_native_position:[0,0,32768]},{source_file:null},{from_anchor_kind:null}])it('rejects unsafe map anchor/provenance '+JSON.stringify(change),()=>expect(()=>parseTransitions(transitions(change))).toThrow());
 for(const change of [{from_map:'WM1'},{to_native_position:[1,2]},{condition_kind:5},{runtime_availability:'available-now'}])it('rejects corrupt record '+JSON.stringify(change),()=>expect(()=>parseTransitions(transitions(change))).toThrow());
 for(const language of locales)it('locale '+language+' has all map keys',()=>{expect(Object.keys(dictionaries[language]).filter(k=>k.startsWith('map.')).length).toBe(31);expect(Object.keys(dictionaries[language])).toEqual(Object.keys(dictionaries.en));});
});
