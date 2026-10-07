// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import curated from '../../src/gaiagis/atlas_data/content.json';
import {parseAtlasContent,parseAtlasPack,searchAtlas,resolveBinding,atlasAnchor,spoilerVisible,validateAtlasPoi} from '../src/data/atlas';
import type {AtlasPack,AtlasEntity} from '../src/data/atlas';
import type {PoiDataset} from '../src/data/poi';

const content=parseAtlasContent(curated);
const entity=content.entities.find(e=>e.id==='midgar')!;
const poi={sources:{'wm0.map':'a'.repeat(64)},locations:[{id:'midgar',primary_entrance:'entry-1',entrance_ids:['entry-1'],field_names:['synthetic']}],entrances:[{id:'entry-1',location_id:'midgar',source_kind:'derived_from_entry_trigger',longitude:1,latitude:2,height:0}]} as unknown as PoiDataset;
const clone=()=>structuredClone(curated);
describe('Atlas schema and provenance',()=>{
 it('accepts the authored five-locale dataset and all named identities',()=>{expect(content.entities).toHaveLength(58);expect(content.entities.filter(e=>e.spatialBinding.kind==='location')).toHaveLength(34);});
 for(const [name,mutate]of [
  ['source missing',(c:ReturnType<typeof clone>)=>{c.entities[0].sources=[];}],
  ['broken source',(c:ReturnType<typeof clone>)=>{c.entities[0].sources=['missing'];}],
  ['invalid type',(c:ReturnType<typeof clone>)=>{c.entities[0].kind='made-up';}],
  ['duplicate',(c:ReturnType<typeof clone>)=>{c.entities.push(c.entities[0]);}],
  ['relation',(c:ReturnType<typeof clone>)=>{c.entities[0].relatedEntities=['missing'];}],
  ['spoiler',(c:ReturnType<typeof clone>)=>{c.entities[0].spoilerLevel='wrong';}],
  ['unsafe URL',(c:ReturnType<typeof clone>)=>{c.sources[0].url='javascript:alert(1)';}],
  ['locale missing',(c:ReturnType<typeof clone>)=>{delete (c.entities[0].summary as Partial<typeof c.entities[0]['summary']>).ja;}],
 ] as const)it('rejects '+name,()=>{const c=clone();mutate(c);expect(()=>parseAtlasContent(c)).toThrow();});
 it('rejects a public coordinate and unsourced fact',()=>{const c=clone();Object.assign(c.entities[0].spatialBinding,{longitude:1});expect(()=>parseAtlasContent(c)).toThrow();const d=clone();d.entities[0].facts=[{kind:'reward',text:d.entities[0].summary,spoilerLevel:'minor',sources:[]}];expect(()=>parseAtlasContent(d)).toThrow();});
});
describe('Atlas search and spoilers',()=>{
 it('ranks one-edit misspellings after literal names without broad matching',()=>{expect(searchAtlas(content,'Midgr','en').some(e=>e.id==='midgar')).toBe(true);expect(searchAtlas(content,'Mxxgar','en')).toHaveLength(0);});
 it('finds names, internal aliases, localized aliases and rewards',()=>{for(const query of ['Midgar','mds5_5','米德加','ミッドガル','미드가르'])expect(searchAtlas(content,query,'zh-CN').some(e=>e.id==='midgar')).toBe(true);expect(searchAtlas(content,'Knights of the Round','en').some(e=>e.id==='round-island-cave')).toBe(true);});
 it('normalizes accents, HP variants and category/region search',()=>{expect(searchAtlas(content,'HP<->MP','en').some(e=>e.id==='hp-mp-cave')).toBe(true);expect(searchAtlas(content,'materia_cave','en').filter(e=>e.kind==='materia_cave')).toHaveLength(4);expect(searchAtlas(content,'northern','en').length).toBeGreaterThan(0);});
 it('keeps major reward terms out of parent search until explicitly shown',()=>{expect(searchAtlas(content,'Black Materia','en')).toHaveLength(0);expect(searchAtlas(content,'Black Materia','en','show-all').some(e=>e.id==='temple-of-the-ancients')).toBe(true);expect(spoilerVisible('major')).toBe(false);expect(spoilerVisible('minor','hide-all')).toBe(false);});
 it('filters discoveries, category and region independently',()=>{expect(searchAtlas(content,'','en','hide-major','collectibles').every(e=>e.tags.includes('collectible'))).toBe(true);expect(searchAtlas(content,'','en','hide-major','places','wutai','town').map(e=>e.id)).toEqual(['wutai']);});
 it('ranks the current locale name before canonical matches',()=>{const a=structuredClone(entity),b=structuredClone(entity);a.id='a';a.localizedNames.ja='試験';b.id='b';b.canonicalName='試験';b.localizedNames.ja='別名';expect(searchAtlas({...content,entities:[b,a]},'試験','ja')[0].id).toBe('a');});
});
describe('Atlas spatial rigor',()=>{
 it('resolves only through verified local identity',()=>{const b=resolveBinding(entity,poi);expect(b.precision).toBe('entrance_level');expect(atlasAnchor(b,poi)?.entrance.id).toBe('entry-1');expect(resolveBinding(entity,null).marker).toBe(false);});
 for(const kind of ['parent_location','field_parent','non_spatial','unresolved'] as const)it('does not emit a '+kind+' point',()=>{const e={...entity,spatialBinding:{kind,locationId:kind.includes('parent')?'midgar':undefined,fieldNames:kind==='field_parent'?['synthetic']:undefined}} as AtlasEntity;const b=resolveBinding(e,poi);expect(b.marker).toBe(false);expect(atlasAnchor(b,poi)).toBeNull();expect(Object.keys(b)).not.toContain('longitude');if(kind.includes('parent'))expect(atlasAnchor(b,poi,true)?.location.id).toBe('midgar');});
 it('rejects a fake marker in a private pack and mismatched or missing POI source',()=>{const c={...content,entities:[{...entity,relatedEntities:[],relatedLocations:[],collectibles:[],secrets:[]}],exclusions:[]};const b=resolveBinding(entity,poi);const pack={schema:'gaiagis-atlas',version:1,curated_sha256:'a'.repeat(64),content:c,sources:poi.sources,bindings:{midgar:b}} as AtlasPack;parseAtlasPack(pack);validateAtlasPoi(pack,poi);expect(()=>validateAtlasPoi(pack,{...poi,sources:{'wm0.map':'b'.repeat(64)}})).toThrow();expect(()=>validateAtlasPoi({...pack,sources:{}},poi)).toThrow();b.precision='parent_place';expect(()=>parseAtlasPack(pack)).toThrow();});
 it('rejects a changed entrance reference even if its string has a valid shape',()=>{const c={...content,entities:[{...entity,relatedEntities:[],relatedLocations:[],collectibles:[],secrets:[]}],exclusions:[]},b=resolveBinding(entity,poi);b.entranceId='entry-fake';b.relatedEntrances.push('entry-fake');const pack={schema:'gaiagis-atlas',version:1,curated_sha256:'a'.repeat(64),content:c,sources:poi.sources,bindings:{midgar:b}} as AtlasPack;parseAtlasPack(pack);expect(()=>validateAtlasPoi(pack,poi)).toThrow();});
});

// Field topology fixtures are synthetic and contain no source-derived dataset.
import {FieldIndex,parseFieldPack,validateFieldPoi,currentSaveField} from '../src/data/fieldContext';
import type {FieldPack} from '../src/data/fieldContext';
import type {SaveSlot} from '../src/data/save';
const fieldFixture=():FieldPack=>({schema:'gaiagis-field-context',version:1,coordinateSpace:'FieldLocalIdentity',archive:'flevel.lgp',sources:Object.fromEntries(['flevel.lgp','maplist','field.tbl','wm0.ev','wm0.map'].map(k=>[k,k==='maplist'?'d6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29':'a'.repeat(64)])),nodes:[{id:100,name:'fixture_a',status:'available',saveId:100},{id:101,name:'fixture_b',status:'available',saveId:101},{id:102,name:'fixture_c',status:'available',saveId:null},{id:103,name:'missing',status:'missing',saveId:null}],edges:[{fromField:100,to:101,gateway:0,offset:56},{fromField:101,to:100,gateway:0,offset:56},{fromField:101,to:102,gateway:1,offset:80}],exits:[{fromField:100,to:1,gateway:1,offset:80,name:'wm0'}],unresolved:[{fromField:101,to:103,gateway:2,reason:'missing_destination'}],bindings:[{entranceId:'entry-1',locationId:'midgar',fieldId:100,status:'verified_direct'}],scriptTransitions:'unverified'});
describe('Field identities, evidence and conservative topology',()=>{
 it('keeps directed incoming/outgoing evidence and cycles finite',()=>{const index=new FieldIndex(parseFieldPack(fieldFixture()));expect(index.outgoing.get(101)?.map(e=>e.to)).toEqual([100,102]);expect(index.incoming.get(102)?.map(e=>e.fromField)).toEqual([101]);expect(index.connected(100)).toEqual([101]);});
 it('associates mutual connectivity without treating one-way reachability as a parent',()=>{const index=new FieldIndex(fieldFixture());expect(index.context(100).status).toBe('verified_direct');expect(index.context(101).status).toBe('verified_parent');expect(index.context(102).status).toBe('unresolved');expect(index.fieldsForPlace('midgar').map(n=>n.id)).toEqual([100,101]);});
 it('retains ambiguous parents rather than choosing by name or proximity',()=>{const p=fieldFixture();p.nodes.push({id:104,name:'fixture_d',status:'available',saveId:104});p.edges.push({fromField:101,to:104,gateway:3,offset:128},{fromField:104,to:101,gateway:0,offset:56});p.bindings.push({entranceId:'entry-2',locationId:'other',fieldId:104,status:'verified_direct'});const index=new FieldIndex(p);expect(index.context(101).status).toBe('ambiguous');expect(index.context(101).parents).toEqual(['midgar','other']);});
 it('revalidates every binding against the loaded POI and exact names/hashes',()=>{const p=fieldFixture(),q={sources:p.sources,entrances:[{id:'entry-1',location_id:'midgar',field_id:100,field_name:'fixture_a',world_map:0,source_kind:'derived_from_entry_trigger',script_calls:[{}]}]} as unknown as PoiDataset;validateFieldPoi(p,q);expect(()=>validateFieldPoi(p,{...q,sources:{...q.sources,maplist:'b'.repeat(64)}})).toThrow();q.entrances[0].field_name='similar';expect(()=>validateFieldPoi(p,q)).toThrow();});
 it('does not turn a field-only Atlas reward into a world marker',()=>{const e={...entity,spatialBinding:{kind:'field_parent',locationId:'midgar',fieldNames:['synthetic']}} as AtlasEntity;new FieldIndex(fieldFixture());const b=resolveBinding(e,poi);expect(b.precision).toBe('field_only');expect(b.marker).toBe(false);expect(atlasAnchor(b,poi)).toBeNull();});
 it('uses only valid field-module slots and available exact IDs',()=>{const index=new FieldIndex(fieldFixture()),s={status:'valid',module:1,location:101} as SaveSlot;expect(currentSaveField(s,index)?.name).toBe('fixture_b');for(const slot of [{...s,module:3},{...s,location:102},{...s,location:103},{...s,location:65535},{...s,status:'checksum'} as SaveSlot])expect(currentSaveField(slot,index)).toBeNull();expect(currentSaveField(s,null)).toBeNull();});
 it.each([
  ['coordinates',(p:FieldPack)=>Object.assign(p.nodes[0],{longitude:1})],
  ['local coordinates',(p:FieldPack)=>Object.assign(p.edges[0],{fieldX:1})],
  ['space',(p:FieldPack)=>Object.assign(p,{coordinateSpace:'GaiaGame'})],
  ['scripts',(p:FieldPack)=>Object.assign(p,{scripts:[]})],
  ['unknown semantics',(p:FieldPack)=>Object.assign(p,{scriptTransitions:'verified'})],
  ['duplicate ID',(p:FieldPack)=>p.nodes.push({...p.nodes[0]})],
  ['duplicate name',(p:FieldPack)=>{p.nodes[1].name=p.nodes[0].name;}],
  ['malformed name',(p:FieldPack)=>{p.nodes[0].name='../a';}],
  ['missing destination',(p:FieldPack)=>{p.edges[0].to=103;}],
  ['corrupt source',(p:FieldPack)=>{p.nodes[0].status='corrupt';}],
  ['gateway index',(p:FieldPack)=>{p.edges[0].gateway=12;}],
  ['gateway offset',(p:FieldPack)=>{p.edges[0].offset=57;}],
  ['duplicate evidence',(p:FieldPack)=>p.edges.push({...p.edges[0]})],
  ['world identity as scene',(p:FieldPack)=>{p.nodes[0].name='wm0';}],
  ['invented world map transform',(p:FieldPack)=>{p.exits[0].name='WM2Native';}],
  ['false save binding',(p:FieldPack)=>{p.nodes[0].saveId=101;}],
  ['unreviewed save table',(p:FieldPack)=>{p.sources.maplist='b'.repeat(64);}],
  ['conflicting save table ID',(p:FieldPack)=>{p.nodes.push({id:593,name:'conflict',status:'available',saveId:593});}],
  ['unknown status',(p:FieldPack)=>Object.assign(p.nodes[0],{status:'maybe'})],
  ['bad fingerprint',(p:FieldPack)=>{p.sources.maplist='wrong';}],
  ['missing fingerprint',(p:FieldPack)=>{delete p.sources['flevel.lgp'];}],
  ['unknown binding',(p:FieldPack)=>Object.assign(p.bindings[0],{status:'guessed'})],
  ['false unresolved',(p:FieldPack)=>{p.unresolved[0].to=100;}],
 ] as const)('rejects %s',(name,change)=>{const p=fieldFixture();change(p);expect(()=>parseFieldPack(p)).toThrow();});
 it('bounds payload collections and forbids private source paths',()=>{const p=fieldFixture();p.nodes=Array.from({length:2001},(_,id)=>({id,name:'f'+id,status:'available',saveId:id}));expect(()=>parseFieldPack(p)).toThrow();const q=fieldFixture();q.sources['C:/private']='a'.repeat(64);expect(()=>parseFieldPack(q)).toThrow();});
});

import {existsSync,readFileSync} from 'node:fs';
import {parsePoi} from '../src/data/poi';
const localFields=new URL('../../output/local-workspace/gaia-field-context.json',import.meta.url);
it.skipIf(!existsSync(localFields))('validates the optional private Field/POI pair without embedding it publicly',()=>{const p=parseFieldPack(JSON.parse(readFileSync(localFields,'utf8'))),poi=parsePoi(JSON.parse(readFileSync(new URL('../../output/local-workspace/gaia-poi.json',import.meta.url),'utf8')));validateFieldPoi(p,poi);const start=performance.now(),index=new FieldIndex(p),counts:Record<string,number>={};for(const n of p.nodes){const status=index.context(n.id).status;counts[status]=(counts[status]??0)+1;}console.log('Private Field topology',JSON.stringify({nodes:p.nodes.length,available:p.nodes.filter(n=>n.status==='available').length,edges:p.edges.length,exits:p.exits.length,unresolved:p.unresolved.length,bindings:p.bindings.length,bytes:readFileSync(localFields).length,indexMs:performance.now()-start,counts,midgar:index.fieldsForPlace('midgar').length}));expect(p.nodes.every(n=>!Object.hasOwn(n,'longitude'))).toBe(true);});
