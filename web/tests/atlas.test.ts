// SPDX-License-Identifier: GPL-3.0-only
import {FieldPlanView} from '../src/ui/fieldContext';
import {openFieldInteraction,parseInteractionHeader,parseInteractionScene,interactionReach} from '../src/data/fieldInteraction';
import {cameraFov,cameraCenter,projectField,parseVisualHeader,inflateVisual,baseBackground,openFieldVisual} from '../src/data/fieldCamera';
import type {FieldCamera} from '../src/data/fieldCamera';
import {discoverWorkspace,parseManifest} from '../src/app/workspace';
import {describe,it,expect} from 'vitest';
import curated from '../../src/gaiagis/atlas_data/content.json';
import {parseAtlasContent,parseAtlasPack,searchAtlas,resolveBinding,atlasAnchor,atlasMapTarget,spoilerVisible,validateAtlasPoi,atlasFactTerms,guideCategories,guideCategory,guidePrecision} from '../src/data/atlas';
import type {AtlasPack,AtlasEntity} from '../src/data/atlas';
import type {PoiDataset} from '../src/data/poi';

const content=parseAtlasContent(curated);
const entity=content.entities.find(e=>e.id==='midgar')!;
const poi={sources:{'wm0.map':'a'.repeat(64)},locations:[{id:'midgar',primary_entrance:'entry-1',entrance_ids:['entry-1'],field_names:['synthetic']}],entrances:[{id:'entry-1',location_id:'midgar',source_kind:'derived_from_entry_trigger',longitude:1,latitude:2,height:0}]} as unknown as PoiDataset;
const clone=()=>structuredClone(curated);

describe('Game Guide facets of the authored Atlas',()=>{
 const get=(id:string)=>content.entities.find(e=>e.id===id)!;
 const ids=(category:typeof guideCategories[number])=>content.entities.filter(e=>guideCategory(e,category)).map(e=>e.id);
 it('reuses all 58 entries and 19 reward entries without creating another content set',()=>{
  expect(ids('all')).toHaveLength(58);expect(ids('treasures')).toHaveLength(19);
  expect(ids('places')).toContain('ancient-forest');expect(ids('secrets')).toContain('sunken-gelnika');
  expect(ids('materia')).toEqual(expect.arrayContaining(['round-island-cave','round-island-cave-reward','mine-materia','glacier-materia']));
  expect(ids('materia')).not.toContain('kalm-treasure');
  expect(ids('battles')).toEqual(['wutai-pagoda','glacier-materia']);
 });
 it('keeps battle guide rewards separate from coordinates and raw scripted-battle records',()=>{
  for(const id of ids('battles')){
   const e=get(id);expect(e.spatialBinding.kind).toBe('parent_location');
   expect(e.facts.every(f=>f.sources.length>0)).toBe(true);
   expect(resolveBinding(e,null)).toMatchObject({marker:false,precision:'unresolved'});
   expect(atlasAnchor(resolveBinding(e,null),null)).toBeNull();
  }
  expect(get('wutai-pagoda').spatialBinding.locationId).toBe('wutai');
  expect(get('glacier-materia').spatialBinding.locationId).toBe('great-glacier');
 });
 it('finds Godo and Snow through existing visible facts in all five languages',()=>{
  for(const lang of ['en','zh-CN','zh-TW','ja','ko'] as const){
   expect(searchAtlas(content,'Godo',lang).filter(e=>guideCategory(e,'battles')).map(e=>e.id)).toContain('wutai-pagoda');
   expect(searchAtlas(content,'Snow',lang).filter(e=>guideCategory(e,'battles')).map(e=>e.id)).toContain('glacier-materia');
   for(const id of ids('battles'))expect(searchAtlas(content,get(id).facts[0].text[lang],lang)).toContain(get(id));
  }
 });
 it('applies facets after the existing spoiler-safe search, including hidden major Materia',()=>{
  expect(searchAtlas(content,'','en','hide-all').filter(e=>guideCategory(e,'battles'))).toEqual([]);
  expect(searchAtlas(content,'','en').filter(e=>guideCategory(e,'materia')).map(e=>e.id)).not.toContain('temple-black-materia');
  expect(searchAtlas(content,'','en','show-all').filter(e=>guideCategory(e,'materia')).map(e=>e.id)).toContain('temple-black-materia');
  for(const category of guideCategories)expect(searchAtlas(content,'','en','hide-all').filter(e=>guideCategory(e,category)).every(e=>e.spoilerLevel==='none')).toBe(true);
 });
});

describe('Game Guide location precision',()=>{
 it('requires an actual entrance binding, while offline cards retain authored parent/scene associations',()=>{
  expect(guidePrecision(entity,resolveBinding(entity,null))).toBe('unresolved');
  expect(guidePrecision(entity,resolveBinding(entity,poi))).toBe('entrance');
  for(const [id,precision] of [['kalm-treasure','parent'],['round-island-cave-reward','field'],['ancient-forest','field'],['sunken-gelnika','field']] as const){const e=content.entities.find(e=>e.id===id)!,b=resolveBinding(e,null);expect(guidePrecision(e,b)).toBe(precision);expect(atlasAnchor(b,null,true)).toBeNull();expect(b.marker).toBe(false);}
 });
 it('keeps a parent-place navigation action distinct from an exact reward marker',()=>{
  const e={...entity,spatialBinding:{kind:'parent_location' as const,locationId:'midgar'}},b=resolveBinding(e,poi);
  expect(guidePrecision(e,b)).toBe('parent');expect(atlasAnchor(b,poi)).toBeNull();expect(atlasAnchor(b,poi,true)?.entrance.id).toBe('entry-1');
 });
});
describe('Map-first Atlas target evidence',()=>{
 it('uses an existing entrance identity without creating an Atlas reward marker',()=>{
  const binding=resolveBinding(entity,poi),target=atlasMapTarget(binding,poi);
  expect(target?.location).toBe(poi.locations[0]);expect(target?.entrance).toBe(poi.entrances[0]);
  const parent={...entity,spatialBinding:{kind:'parent_location' as const,locationId:'midgar'}},parentBinding=resolveBinding(parent,poi);
  expect(parentBinding.marker).toBe(false);expect(parentBinding.entranceId).toBeNull();expect(atlasMapTarget(parentBinding,poi)).toEqual(target);
  const kalm=content.entities.find(e=>e.id==='kalm-treasure')!,kalmPoi={...poi,locations:[{...poi.locations[0],id:'kalm'}],entrances:[{...poi.entrances[0],location_id:'kalm'}]};
  expect(atlasMapTarget(resolveBinding(kalm,kalmPoi),kalmPoi)?.location.id).toBe('kalm');expect(resolveBinding(kalm,kalmPoi).marker).toBe(false);
 });
 it('does not turn a Field-only parent into a world-map target',()=>{
  const field={...entity,spatialBinding:{kind:'field_parent' as const,locationId:'midgar',fieldNames:['synthetic']}},binding=resolveBinding(field,poi);
  expect(atlasAnchor(binding,poi,true)).not.toBeNull();expect(atlasMapTarget(binding,poi)).toBeNull();
  for(const id of ['round-island-cave-reward','ancient-forest','sunken-gelnika']){const e=content.entities.find(e=>e.id===id)!;expect(atlasMapTarget(resolveBinding(e,null),null)).toBeNull();}
 });
 it('keeps public source-only and unresolved entries non-spatial',()=>{
  expect(atlasMapTarget(resolveBinding(entity,null),null)).toBeNull();expect(atlasMapTarget(resolveBinding(entity,poi),null)).toBeNull();
  const unresolved={...resolveBinding(entity,poi),precision:'unresolved' as const};expect(atlasMapTarget(unresolved,poi)).toBeNull();
 });
});
describe('Optional Field Interaction evidence contract',()=>{
 const fp={sources:{'flevel.lgp':'a'.repeat(64),maplist:'b'.repeat(64)},nodes:[{id:1,name:'fixture',status:'available'}]} as unknown as FieldPack;
 const rawMesh=()=>{const out=new Uint8Array(34),v=new DataView(out.buffer);v.setUint32(0,1,true);[0,0,0,9,4,0,0,17,0,4,0,-1].forEach((n,i)=>v.setInt16(4+i*2,n,true));[0,1,2].forEach(i=>v.setUint16(28+i*2,65535,true));return out;};
 const bytes=(op:number,values:number[],banks:number[]=[])=>{const out=new Uint8Array(op===208?13:op===209?2:16),v=new DataView(out.buffer);out[0]=op;if(op===209)out[1]=values[0];else{out.set(banks,1);values.forEach((n,i)=>v.setInt16((op===208?1:4)+i*2,n,true));}return Array.from(out,n=>n.toString(16).padStart(2,'0')).join('');};
 const geom=()=>({relation:'surface',candidates:[0],xyCandidates:[0],coplanar:[0],vertical:[],zeroLength:false,zeroXY:false,rawZGap:'0',rawZTriangle:0});
 const owners=()=>[{actor:0,name:'line',slot:0,entry:104,kind:'table'}];
 const scene=()=>({fieldId:1,name:'fixture',triangles:1,meshReason:null,section1Bytes:256,section8Bytes:536,section1SHA256:'c'.repeat(64),section8SHA256:'d'.repeat(64),section5SHA256:'e'.repeat(64),unusedTriggers:12,triggers:[] as any[],scripts:[{opcode:208,offset:105,raw:bytes(208,[1,1,0,2,1,0]),owners:owners(),entryReachable:true,a:[1,1,0],b:[2,1,0],static:true,geometry:geom()}] as any[],stops:[] as any[]});
 const span=(s=scene())=>({fieldId:1,name:'fixture',triangles:1,section5SHA256:s.section5SHA256,offset:0,bytes:1,rawBytes:1,sha256:'f'.repeat(64)});
 const sha=async(r:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',r as Uint8Array<ArrayBuffer>)),n=>n.toString(16).padStart(2,'0')).join('');
 async function pack(edit?:(s:ReturnType<typeof scene>)=>void,headerEdit?:(m:any)=>void){
  const s=scene();s.section5SHA256=await sha(rawMesh());edit?.(s);const body=new TextEncoder().encode(JSON.stringify(s)),compressed=await new Response(new Blob([body]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
  const m={schema:'gaiagis-field-interaction',version:1,coordinateSpace:'FieldLocal',generator_revision:'field-interaction-1',sources:fp.sources,scenes:[{...span(s),bytes:compressed.byteLength,rawBytes:body.byteLength,sha256:await sha(body)}]};headerEdit?.(m);
  const encoded=new TextEncoder().encode(JSON.stringify(m)),head=new Uint8Array(16),v=new DataView(head.buffer);head.set(new TextEncoder().encode('GAIAINT\0'));v.setUint32(8,1,true);v.setUint32(12,encoded.length,true);
  return new File([head,encoded,compressed],'gaia-field-interaction.bin');
 }
 it('lazily decodes the selected source-bound scene and preserves raw4 in its mesh fingerprint',async()=>{
  const file=await pack(),p=await openFieldInteraction(file,fp),mesh=decodeWalkmesh(rawMesh().buffer);expect(p.scenes.size).toBe(1);const decoded=await p.decode(1,mesh);expect(decoded.records[0].a).toEqual([1,1,0]);expect(decoded.records[0].geometry!.candidates).toEqual([0]);mesh.vertices[3]++;await expect(p.decode(1,mesh)).rejects.toThrow('fingerprint');
 });
 it('distinguishes dynamic SLINE operands from static XYZ and treats LINON as control evidence',()=>{
  const s=scene();s.scripts.push({opcode:209,offset:120,raw:bytes(209,[0]),switch:0,owners:owners(),entryReachable:true,lineOffsets:[105]},{opcode:211,offset:122,raw:bytes(211,[21,-427,0,19,-815,0],[96,6,0]),banks:[6,0,0,6,0,0],operands:[21,-427,0,19,-815,0],static:false,owners:owners(),entryReachable:true,lineOffsets:[105]});
  const r=parseInteractionScene(s,span(s));expect(r.scripts[2].geometry).toBeUndefined();expect(r.scripts[2].a).toBeUndefined();expect(r.scripts[1].switch).toBe(0);expect(r.scripts[2].lineOffsets).toEqual([105]);
  s.scripts[2].a=[21,-427,0];expect(()=>parseInteractionScene(s,span(s))).toThrow();
 });
 it('preserves aliases and multiple actor memberships without selecting a unique owner',()=>{
  const s=scene();s.scripts[0].owners.push({actor:1,name:'other',slot:3,entry:105,kind:'table'},{actor:0,name:'line',slot:1,entry:105,kind:'table'});expect(parseInteractionScene(s,span(s)).scripts[0].owners).toHaveLength(3);
  s.scripts[0].owners.push(s.scripts[0].owners[0]);expect(()=>parseInteractionScene(s,span(s))).toThrow('owner');
 });
 it('uses Trigger state as a bit index; does not discard zero coordinates',()=>{
  const s=scene(),v=new DataView(new ArrayBuffer(16));[1,1,0,2,1,0].forEach((n,i)=>v.setInt16(i*2,n,true));[7,3,5,2].forEach((n,i)=>v.setUint8(12+i,n));const raw=Array.from(new Uint8Array(v.buffer),n=>n.toString(16).padStart(2,'0')).join('');
  s.unusedTriggers=11;s.triggers.push({slot:0,offset:344,raw,a:[1,1,0],b:[2,1,0],group:7,state:3,behavior:5,sound:2,classification:'record',geometry:geom(),background:{status:'matched',reason:null,matches:[{group:7,mask:8,layer:1,count:2,firstOffset:131}]}});
  expect(parseInteractionScene(s,span(s)).triggers[0].background!.matches[0].mask).toBe(8);s.triggers[0].background.matches[0].mask=3;expect(()=>parseInteractionScene(s,span(s))).toThrow('mask');
 });
 it('rejects forged raw coordinates, candidates, offsets, script links and stops',()=>{
  for(const edit of [(s:any)=>s.scripts[0].a[0]=2,(s:any)=>s.scripts[0].geometry.candidates=[1],(s:any)=>s.scripts[0].offset=250,(s:any)=>s.unusedTriggers=11,(s:any)=>s.stops=[{offset:999,opcode:253,reason:'unsupported_opcode',entryReachable:true}],(s:any)=>s.scripts[0].geometry.candidates=[0,0]]){const s=scene();edit(s);expect(()=>parseInteractionScene(s,span(s))).toThrow();}
 });
 it('rejects source mismatch, duplicate scene spans, over-budget metadata and truncated compression',async()=>{
  for(const edit of [(m:any)=>m.sources={...m.sources,maplist:'0'.repeat(64)},(m:any)=>m.scenes.push(m.scenes[0]),(m:any)=>m.scenes[0].offset=1,(m:any)=>m.scenes[0].rawBytes=2_000_001])await expect(openFieldInteraction(await pack(undefined,edit),fp)).rejects.toThrow();
  const p=await pack(),truncated=new File([await p.slice(0,p.size-1).arrayBuffer()],p.name);await expect(openFieldInteraction(truncated,fp)).rejects.toThrow();
  expect(()=>parseInteractionHeader(new ArrayBuffer(16),8_000_001,fp)).toThrow();
 });
 it('associates only exact geometry with directed reachability and keeps XY-only UNKNOWN',()=>{
  const r=parseInteractionScene(scene(),span()).scripts[0],reach=new WalkmeshNetwork(decodeWalkmesh(rawMesh().buffer)).reach(0);expect(interactionReach(r,reach).reachable).toEqual([0]);expect(interactionReach(r,null).status).toBe('not_analyzed');r.geometry!.relation='xy_only';r.geometry!.candidates=[];expect(interactionReach(r,reach).status).toBe('unknown');
 });
 it('fits interaction extents explicitly and restores ordinary mesh bounds',()=>{const view=new FieldPlanView([0,4,0,4]);view.resize(320,390);const normal=view.fit;view.fitTo([0,10000,0,4]);expect(view.scale).toBeLessThan(normal);view.fitTo([0,4,0,4]);expect(view.scale).toBe(normal);expect(view.centerX).toBe(2);});
 it('cancels a discarded scene without adopting or decompressing it',async()=>{const p=await openFieldInteraction(await pack(),fp),abort=new AbortController();abort.abort();await expect(p.decode(1,decodeWalkmesh(rawMesh().buffer),abort.signal)).rejects.toThrow();});
});
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
import {FieldIndex,parseFieldPack,validateFieldPoi,currentSaveField,resolveFieldAtlas,fieldEvidence,atlasEvidence,spatialStatus,fieldAliases,decodeWalkmesh,parseWalkmeshHeader,openWalkmeshPack} from '../src/data/fieldContext';
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
import {pathToFileURL} from 'node:url';
import {localPoint,gatewayRelation,sceneAnchors,WalkmeshNetwork} from '../src/data/fieldContext';
import type {FieldGateway} from '../src/data/fieldContext';
import {parsePoi} from '../src/data/poi';
const privateWorkspace=process.env.GAIA_TEST_WORKSPACE?pathToFileURL(process.env.GAIA_TEST_WORKSPACE.replaceAll('\\','/')+'/'):new URL('../../output/local-workspace/',import.meta.url);
const localFields=new URL('gaia-field-context.json',privateWorkspace);
it.skipIf(!existsSync(localFields))('validates the optional private Field/POI pair without embedding it publicly',()=>{const p=parseFieldPack(JSON.parse(readFileSync(localFields,'utf8'))),poi=parsePoi(JSON.parse(readFileSync(new URL('gaia-poi.json',privateWorkspace),'utf8')));validateFieldPoi(p,poi);const start=performance.now(),index=new FieldIndex(p),counts:Record<string,number>={};for(const n of p.nodes){const status=index.context(n.id).status;counts[status]=(counts[status]??0)+1;}console.log('Private Field topology',JSON.stringify({nodes:p.nodes.length,available:p.nodes.filter(n=>n.status==='available').length,edges:p.edges.length,exits:p.exits.length,unresolved:p.unresolved.length,bindings:p.bindings.length,bytes:readFileSync(localFields).length,indexMs:performance.now()-start,counts,midgar:index.fieldsForPlace('midgar').length}));expect(p.nodes.every(n=>!Object.hasOwn(n,'longitude'))).toBe(true);});


const scriptFixture=():FieldPack=>{const p=fieldFixture();p.version=2;p.scriptTransitions='bounded_mapjump';p.nodes=p.nodes.map(n=>({...n,scriptName:n.status==='available'?'fixture':null}));p.scriptEdges=[{fromField:102,to:100,opcode:96,offset:200},{fromField:100,to:102,opcode:96,offset:300}];p.scriptExits=[];p.scriptUnresolved=[];p.nativeRelations=[{map:'WM2',fieldId:100,entry:31,scenario:0,function:20,offset:100,opcode:792}];p.sources['wm2.ev']='b'.repeat(64);return p;};
describe('World archaeology and provenance',()=>{
 it('adds script topology without inferring geographic containment from cutscene/teleport cycles',()=>{const i=new FieldIndex(parseFieldPack(scriptFixture()));expect(i.connected(100)).toContain(102);expect(i.context(102).status).toBe('unresolved');});
 it('promotes exact local field requests only to field_only; unknown tables and absent scenes stay unresolved',()=>{const e={...entity,spatialBinding:{kind:'field_identity',fieldNames:['fixture_a']}} as AtlasEntity,b=resolveBinding(e,poi),p=scriptFixture();expect(b.precision).toBe('unresolved');const resolved=resolveFieldAtlas(e,b,new FieldIndex(p));expect(resolved.precision).toBe('field_only');expect(resolved.locationId).toBeNull();expect(resolved.marker).toBe(false);expect(atlasAnchor(resolved,poi,true)).toBeNull();expect(resolveFieldAtlas(e,b,null)).toEqual(b);p.sources.maplist='c'.repeat(64);expect(resolveFieldAtlas(e,b,new FieldIndex(p))).toEqual(b);expect(resolveFieldAtlas({...e,spatialBinding:{kind:'field_identity',fieldNames:['similar']}},b,new FieldIndex(scriptFixture()))).toEqual(b);});
 it('distinguishes known directed evidence, inferred association and missing global anchors',()=>{const i=new FieldIndex(scriptFixture()),chain=fieldEvidence(i,101);expect(chain.some(s=>s.sourceType==='gateway'&&s.relation==='known')).toBe(true);expect(chain.some(s=>s.relation==='inferred')).toBe(true);expect(chain.at(-1)?.sourceIdentity).toBe('midgar');expect(fieldEvidence(i,102).at(-1)?.relation).toBe('unresolved');const b=resolveBinding(entity,null);expect(atlasEvidence(entity,b,null,null).at(-1)?.relation).toBe('unresolved');for(const step of chain)expect(Object.keys(step)).not.toContain('longitude');});
 it('restores only the reviewed Gelnika save IDs with matching source header aliases',()=>{const p=scriptFixture();p.nodes.push({id:88,name:'qa',scriptName:'q_1',saveId:88,status:'available'});const i=new FieldIndex(parseFieldPack(p));expect(currentSaveField({status:'valid',module:1,location:88} as SaveSlot,i)?.name).toBe('qa');p.nodes.at(-1)!.scriptName='q_2';expect(()=>parseFieldPack(p)).toThrow();});
 it('keeps native map relations as identities without coordinates or transforms',()=>{const p=parseFieldPack(scriptFixture());expect(p.nativeRelations?.[0].map).toBe('WM2');Object.assign(p.nativeRelations![0],{longitude:1});expect(()=>parseFieldPack(p)).toThrow();});
 it.each(['target','opcode','duplicate','coordinate','offset','raw','nativeSource','version'] as const)('rejects malformed script evidence: %s',kind=>{const p=scriptFixture();if(kind==='target')p.scriptEdges![0].to=103;if(kind==='opcode')Object.assign(p.scriptEdges![0],{opcode:97});if(kind==='duplicate')p.scriptEdges!.push({...p.scriptEdges![0]});if(kind==='coordinate')Object.assign(p.scriptEdges![0],{fieldX:1});if(kind==='offset')p.scriptEdges![0].offset=Infinity;if(kind==='raw')Object.assign(p,{scripts:'dump'});if(kind==='nativeSource')delete p.sources['wm2.ev'];if(kind==='version')p.version=1;expect(()=>parseFieldPack(p)).toThrow();});
 it('filters precision without calling parent/field evidence a resolved anchor',()=>{expect(spatialStatus('entrance_level')).toBe('resolved');expect(spatialStatus('field_only')).toBe('field_only');expect(spatialStatus('parent_place')).toBe('parent_place');expect(spatialStatus('unresolved')).toBe('unresolved');});
});

it('rejects contradictory unknown and verified script evidence at the same source offset',()=>{const p=scriptFixture();p.scriptUnresolved=[{fromField:102,offset:200,reason:'unsupported_opcode'}];expect(()=>parseFieldPack(p)).toThrow();});

function syntheticWalkmesh(){
 const b=new ArrayBuffer(64),v=new DataView(b);v.setUint32(0,2,true);
 // Deliberately asymmetric, mixed winding, one nonstandard padding value.
 const triangles=[[0,0,0,9,10,0,0,0,0,10,0,0],[10,0,0,0,10,10,0,0,0,10,0,0]];
 triangles.flat().forEach((n,i)=>v.setInt16(4+i*2,n,true));[65535,1,65535,65535,65535,65535].forEach((n,i)=>v.setUint16(52+i*2,n,true));return b;
}
function walkFile(raw=syntheticWalkmesh(),change?:(m:Record<string,unknown>)=>void){
 const fields=fieldFixture(),mesh=decodeWalkmesh(raw),metadata:Record<string,unknown>={schema:'gaiagis-field-walkmesh',version:1,coordinateSpace:'FieldLocal',generator_revision:'field-walkmesh-1',sources:{'flevel.lgp':fields.sources['flevel.lgp'],maplist:fields.sources.maplist},scenes:[{fieldId:100,status:'available',offset:0,bytes:raw.byteLength,triangles:mesh.triangles,...mesh.stats}]};change?.(metadata);
 const encoded=new TextEncoder().encode(JSON.stringify(metadata)),head=new Uint8Array(16+encoded.length);head.set(new TextEncoder().encode('GAIAFLD\0'));new DataView(head.buffer).setUint32(8,1,true);new DataView(head.buffer).setUint32(12,encoded.length,true);head.set(encoded,16);return {fields,head,file:new File([head,raw],'gaia-field-walkmesh.bin')};
}
describe('bounded FieldLocal walkmesh and private transport',()=>{
 it('retains raw order, padding, blocked and asymmetric access without repairing topology',()=>{const m=decodeWalkmesh(syntheticWalkmesh());expect(m.coordinateSpace).toBe('FieldLocal');expect(Array.from(m.vertices.slice(0,4))).toEqual([0,0,0,9]);expect(Array.from(m.access)).toEqual([65535,1,65535,65535,65535,65535]);expect(m.stats).toMatchObject({blocked:5,accessible:1,asymmetric:1,paddingVariants:1,degenerate:0,edgeMismatch:0});});
 it('accepts empty geometry and counts 3D/XY degeneracy separately',()=>{const empty=new ArrayBuffer(4);expect(decodeWalkmesh(empty).triangles).toBe(0);const raw=syntheticWalkmesh(),v=new DataView(raw);for(let i=0;i<24;i++)v.setInt16(4+i*2,0,true);expect(decodeWalkmesh(raw).stats).toMatchObject({degenerate:2,degenerateXY:2});});
 it.each(['short','count','overflow','neighbor','trailing'] as const)('rejects damaged Section 5: %s',kind=>{let raw=syntheticWalkmesh();const v=new DataView(raw);if(kind==='short')raw=raw.slice(0,63);if(kind==='count')v.setUint32(0,3,true);if(kind==='overflow')v.setUint32(0,0xffffffff,true);if(kind==='neighbor')v.setUint16(52,2,true);if(kind==='trailing')raw=new Uint8Array(65).buffer;expect(()=>decodeWalkmesh(raw)).toThrow();});
 it('loads only a selected scene and works with v1/v2 context; no global properties appear',async()=>{for(const fields of [fieldFixture(),scriptFixture()]){const f=walkFile(),pack=await openWalkmeshPack(f.file,fields);const mesh=await pack.decode(100);expect(mesh.triangles).toBe(2);expect(mesh).not.toHaveProperty('geographic');expect(mesh).not.toHaveProperty('mapId');await expect(pack.decode(101)).rejects.toThrow('unavailable');}});
 it.each(['space','revision','source','field','offset','size','stats','duplicate','unknown'] as const)('rejects incompatible pack metadata: %s',kind=>{const f=walkFile(undefined,m=>{const s=m.scenes as Record<string,unknown>[];if(kind==='space')m.coordinateSpace='GaiaGame';if(kind==='revision')m.generator_revision='future';if(kind==='source')(m.sources as Record<string,string>)['flevel.lgp']='b'.repeat(64);if(kind==='field')s[0].fieldId=103;if(kind==='offset')s[0].offset=1;if(kind==='size')s[0].bytes=Infinity;if(kind==='stats')s[0].blocked=0;if(kind==='duplicate')s.push({...s[0]});if(kind==='unknown')m.longitude=1;});expect(()=>parseWalkmeshHeader(f.head.buffer,f.file.size,f.fields)).toThrow();});
 it('isolates a corrupt scene without destroying identities and rejects changed scene bytes on demand',async()=>{const f=walkFile(undefined,m=>(m.scenes as Record<string,unknown>[])[0].asymmetric=0);const pack=await openWalkmeshPack(f.file,f.fields);await expect(pack.decode(100)).rejects.toThrow('statistics');expect(new FieldIndex(f.fields).nodes.size).toBe(4);const empty=walkFile(new ArrayBuffer(4));expect((await (await openWalkmeshPack(empty.file,empty.fields)).decode(100)).triangles).toBe(0);});
 it('bounds file/header size and rejects truncated spans before decode',async()=>{const f=walkFile();await expect(openWalkmeshPack(new File([f.head],'gaia-field-walkmesh.bin'),f.fields)).rejects.toThrow();const head=f.head.slice();new DataView(head.buffer).setUint32(12,0xffffffff,true);expect(()=>parseWalkmeshHeader(head.buffer,f.file.size,f.fields)).toThrow();});
});

const privateWalkmesh=new URL('gaia-field-walkmesh.bin',privateWorkspace);
it.skipIf(!existsSync(privateWalkmesh)||!existsSync(localFields))('validates all optional private scenes without committing original geometry',async()=>{
 const fields=parseFieldPack(JSON.parse(readFileSync(localFields,'utf8'))),bytes=readFileSync(privateWalkmesh),start=performance.now(),pack=await openWalkmeshPack(new File([bytes],'gaia-field-walkmesh.bin'),fields),indexMs=performance.now()-start;let triangles=0;
 for(const [id,row] of pack.scenes)if(row.status==='available'){const m=await pack.decode(id);triangles+=m.triangles;expect(m.coordinateSpace).toBe('FieldLocal');}
 console.log('Private Walkmesh',JSON.stringify({fields:pack.scenes.size,triangles,bytes:bytes.length,indexMs,allDecodeMs:performance.now()-start}));expect(triangles).toBeGreaterThan(0);
});

it('indexes only reviewed non-truncated script-header aliases',()=>{const p=scriptFixture(),n={id:88,name:'qa',scriptName:'q_1',saveId:88,status:'available'} as const;expect(fieldAliases(n,p)).toContain('q_1');expect(fieldAliases({...n,id:620,name:'anfrst_1',scriptName:'anfrst_'},p)).not.toContain('anfrst_');p.sources.maplist='c'.repeat(64);expect(fieldAliases(n,p)).not.toContain('q_1');});

it('rejects paths and malformed names in authored Field identity requests',()=>{for(const name of ['../qa','D:/private','a'.repeat(33)]){const c=clone(),e=c.entities.find(e=>e.id==='ancient-forest')!;e.spatialBinding={kind:'field_identity',fieldNames:[name]};expect(()=>parseAtlasContent(c)).toThrow();}});

function anchorsFixture():FieldPack {
 const p=scriptFixture();p.version=3;
 p.entrances=Array.from({length:128},(_,record)=>({entry:Math.floor(record/2)+1,scenario:record%2 as 0|1,field_id:0,field_name:'dummy',field_x:0,field_y:0,field_triangle:0,field_direction:0,field_table_record:record,field_table_byte_offset:record*12,status:'placeholder' as const,derivedZ:null}));
 for(const record of [0,1])Object.assign(p.entrances[record],{field_id:100+record,field_name:'fixture_'+(record?'b':'a'),field_x:1,field_y:1,status:'inside',derivedZ:0});
 p.gateways=[...p.edges,...p.exits,...p.unresolved.filter(e=>e.reason==='missing_destination').map(e=>({fromField:e.fromField,to:e.to!,gateway:e.gateway!,offset:56+e.gateway!*24}))].map(e=>({fromField:e.fromField,to:e.to,gateway:e.gateway,offset:e.offset,sourceA:[0,0,0],sourceB:[10,0,0],targetXY:[1,1],targetTriangle:0,direction:[0,0,0,0],sourceRelation:'surface',destination:{status:p.exits.includes(e as never)?'world':e.to===103?'missing':'inside',derivedZ:e.to===103||p.exits.includes(e as never)?null:0}})) as FieldGateway[];
 return p;
}
describe('Field spatial anchors, bounded records and independent geometry',()=>{
 it('preserves paired identities and all placeholders, with no anchors in legacy packs',()=>{const p=parseFieldPack(anchorsFixture()),mesh=decodeWalkmesh(syntheticWalkmesh());expect(p.entrances?.length).toBe(128);expect(p.entrances?.[0].field_id).not.toBe(p.entrances?.[1].field_id);expect(sceneAnchors(fieldFixture(),mesh,100)).toEqual([]);expect(sceneAnchors(p,mesh,100).filter(a=>a.kind==='entrance')).toHaveLength(1);expect(sceneAnchors(p,mesh,101).filter(a=>a.kind==='entrance')[0].record).toMatchObject({scenario:1,field_id:101});});
 it('checks exact edge/vertex boundaries, winding, outside, invalid and degenerate triangles',()=>{const m=decodeWalkmesh(syntheticWalkmesh());for(const xy of [[0,0],[2,8],[5,0]])expect(localPoint(m,0,xy).status).toBe('boundary');expect(localPoint(m,0,[1,1])).toEqual({status:'inside',derivedZ:0});expect(localPoint(m,0,[9,9]).status).toBe('outside');expect(localPoint(m,-1,[1,1]).status).toBe('invalid_triangle');expect(localPoint(m,0,[NaN,1]).status).not.toBe('inside');const raw=syntheticWalkmesh(),v=new DataView(raw);for(let i=0;i<12;i++)v.setInt16(4+i*2,0,true);expect(localPoint(decodeWalkmesh(raw),0,[0,0]).status).toBe('degenerate');});
 it.each([
  [[-2,2,0],[12,2,0],'surface'],[[1,1,1],[2,2,1],'xy_only'],[[2,2,-1],[2,2,1],'surface'],[[20,20,0],[30,30,0],'disjoint'],[[-1,0,0],[0,0,0],'surface'],
 ] as const)('classifies raw XYZ segment %j → %j without repair',(a,b,status)=>expect(gatewayRelation(decodeWalkmesh(syntheticWalkmesh()),a,b)).toBe(status));
 it('handles vertical 3D triangles and extreme signed coordinates exactly',()=>{const raw=syntheticWalkmesh(),v=new DataView(raw);[[0,0,0],[0,10,0],[0,0,10],[0,0,0],[0,10,0],[0,0,10]].flatMap(p=>[...p,0]).forEach((n,i)=>v.setInt16(4+i*2,n,true));const m=decodeWalkmesh(raw);expect(gatewayRelation(m,[-32768,2,2],[32767,2,2])).toBe('surface');expect(gatewayRelation(m,[-32768,12,12],[32767,12,12])).toBe('disjoint');for(const [a,b] of [[[-32768,2,20],[32767,2,20]],[[0,-1,20],[0,12,20]],[[0,2,20],[0,2,20]]])expect(gatewayRelation(m,a,b)).toBe('xy_only');expect(gatewayRelation(m,[1,2,20],[1,2,20])).toBe('disjoint');});
 it('keeps target points in their target scene and never renders world targets or forged point checks',()=>{const p=anchorsFixture(),m=decodeWalkmesh(syntheticWalkmesh());const a=sceneAnchors(p,m,100);expect(a.some(a=>a.kind==='arrival'&&a.record.fromField===101)).toBe(true);expect(a.some(a=>a.kind==='arrival'&&a.record.fromField===100)).toBe(false);p.entrances![0].field_x=100;expect(sceneAnchors(p,m,100).some(a=>a.kind==='entrance')).toBe(false);p.gateways![0].destination.derivedZ=12;expect(sceneAnchors(p,m,101).some(a=>a.kind==='arrival'&&a.record.fromField===100)).toBe(false);});
 it('rejects false missing identities and invalid point/segment components',()=>{for(const kind of ['entrance','gateway']){const p=anchorsFixture();if(kind==='entrance'){p.entrances![0].status='missing';p.entrances![0].derivedZ=null;}else p.gateways![0].destination={status:'missing',derivedZ:null};expect(()=>parseFieldPack(p)).toThrow();}const m=decodeWalkmesh(syntheticWalkmesh());expect(localPoint(m,0,[Infinity,0]).derivedZ).toBeNull();expect(gatewayRelation(m,[NaN,0,0],[1,1,1])).toBe('unknown');});
 it.each(['offset','float','direction','duplicate','world','point','missing','private','placeholder','size'] as const)('rejects malformed spatial records: %s',kind=>{const p=anchorsFixture(),g=p.gateways![0],e=p.entrances![0];if(kind==='offset')g.offset++;if(kind==='float')g.sourceA[0]=.1;if(kind==='direction')g.direction[0]=256;if(kind==='duplicate')p.gateways!.push({...g});if(kind==='world')g.destination.status='world';if(kind==='point')e.derivedZ=Infinity;if(kind==='missing')p.gateways!.pop();if(kind==='private')Object.assign(g,{sourcePath:'C:/private'});if(kind==='placeholder')p.entrances![2].field_x=1;if(kind==='size')p.entrances!.pop();expect(()=>parseFieldPack(p)).toThrow();});
});

function directedMesh(rows:number[][]){const raw=new ArrayBuffer(4+rows.length*30),v=new DataView(raw);v.setUint32(0,rows.length,true);for(let id=0;id<rows.length;id++){[0,0,0,0,10,0,0,0,0,10,0,0].forEach((n,k)=>v.setInt16(4+id*24+k*2,n,true));for(let edge=0;edge<3;edge++)v.setUint16(4+rows.length*24+(id*3+edge)*2,rows[id][edge]??65535,true);}return decodeWalkmesh(raw);}
describe('Static raw directed Walkmesh network',()=>{
 it('groups a bidirectional component and preserves only recorded edges despite overlapping geometry',()=>{const n=new WalkmeshNetwork(directedMesh([[1],[0,2],[1],[]]));expect(n.wcc.groups).toEqual([[0,1,2],[3]]);expect(n.scc.groups).toEqual([[0,1,2],[3]]);expect(n.isolated).toEqual([3]);expect(Array.from(n.wcc.labels)).toEqual([0,0,0,1]);expect(n.path(0,2).ids).toEqual([0,1,2]);expect(n.path(0,3).reason).toBe('different_wcc');});
 it('does not reverse a one-way chain or create blocked edges',()=>{const n=new WalkmeshNetwork(directedMesh([[1],[2],[]]));expect(n.wcc.groups).toEqual([[0,1,2]]);expect(n.scc.groups).toEqual([[0],[1],[2]]);expect(n.reach(0).ids).toEqual([0,1,2]);expect(Array.from(n.reach(0).distance)).toEqual([0,1,2]);expect(n.reach(2).ids).toEqual([2]);expect(n.path(2,0)).toEqual({ids:[],steps:[],reason:'direction'});expect(n.path(1,1)).toEqual({ids:[1],steps:[],reason:null});expect(()=>n.evidence(2,0)).toThrow('Blocked');});
 it('keeps cycles, self-links and deterministic equal-depth Access slot evidence',()=>{const m=directedMesh([[2,1],[3],[3],[0],[4]]);m.vertices[24]=20;const n=new WalkmeshNetwork(m);expect(n.wcc.groups).toEqual([[0,1,2,3],[4]]);expect(n.scc.groups).toEqual([[0,1,2,3],[4]]);expect(n.isolated).toEqual([4]);expect(n.path(0,3).ids).toEqual([0,2,3]);expect(n.path(0,3).steps.map(e=>[e.from,e.to,e.edge,e.offset])).toEqual([[0,2,0,124],[2,3,0,136]]);expect(n.evidence(4,0).self).toBe(true);expect(n.evidence(0,0).asymmetric).toBe(true);expect(n.evidence(0,0).mismatch).toBe(true);expect(n.reach(0)).toBe(n.reach(0));});
 it('labels components by their minimum Triangle ID, including reversed SCC discovery order',()=>{const n=new WalkmeshNetwork(directedMesh([[3],[2],[1],[0],[]]));expect(n.wcc.groups).toEqual([[0,3],[1,2],[4]]);expect(n.scc.groups).toEqual([[0,3],[1,2],[4]]);});
 it.each([NaN,Infinity,-1,.5,3])('rejects invalid start/end %s',id=>{const n=new WalkmeshNetwork(directedMesh([[1],[2],[]]));expect(()=>n.reach(id)).toThrow();expect(()=>n.path(0,id)).toThrow();expect(()=>n.path(id,0)).toThrow();});
 it('handles an empty graph and a maximum-size directed chain without recursion',()=>{const empty=new WalkmeshNetwork(directedMesh([]));expect(empty.wcc.groups).toEqual([]);expect(empty.scc.groups).toEqual([]);expect(()=>empty.reach(0)).toThrow();const rows=Array.from({length:65535},(_,i)=>i===65534?[]:[i+1]),n=new WalkmeshNetwork(directedMesh(rows));expect(n.wcc.groups).toHaveLength(1);expect(n.scc.groups).toHaveLength(65535);expect(n.reach(0).distance[65534]).toBe(65534);expect(n.path(0,65534).steps).toHaveLength(65534);},10000);
 it('retains all exact Gateway candidates, excludes XY-only and never chooses a single ambiguous triangle',()=>{const m=directedMesh([[1],[]]),n=new WalkmeshNetwork(m),g={...anchorsFixture().gateways![0],sourceA:[-2,2,0],sourceB:[12,2,0]} as FieldGateway;expect(n.gateway(g)).toEqual([0,1]);expect(n.gateway(g)).toBe(n.gateway(g));expect(n.gateway({...g,sourceRelation:'xy_only',sourceA:[1,1,1],sourceB:[2,2,1]})).toEqual([]);expect(n.gateway({...g,sourceRelation:'disjoint'})).toEqual([]);expect(n.gateway({...g,sourceA:[20,20,0],sourceB:[30,30,0]})).toEqual([]);});
});

it.skipIf(!existsSync(localFields)||!existsSync(privateWalkmesh))('checks actual scene networks and anchors independently of expected component counts',async()=>{
 const fields=parseFieldPack(JSON.parse(readFileSync(localFields,'utf8'))),pack=await openWalkmeshPack(new File([readFileSync(privateWalkmesh)],'gaia-field-walkmesh.bin'),fields),reports=[];
 for(const name of ['mds5_1','bugin1c','mds5_5','farm','mds5_3','nivl_b1','mtcrl_0','itown1b']){const id=fields.nodes.find(n=>n.name===name)!.id,m=await pack.decode(id),n=new WalkmeshNetwork(m),anchors=sceneAnchors(fields,m,id);
  // Independent all-pairs reachability on these bounded real scenes proves
  // SCC membership and weak undirected closure; no audited counts hardcoded.
  const bfs=(start:number,weak=false)=>{const seen=new Set([start]),queue=[start];for(let i=0;i<queue.length;i++){const at=queue[i],neighbors=Array.from(m.access.subarray(at*3,at*3+3));if(weak)for(let j=0;j<m.triangles;j++)if(m.access.subarray(j*3,j*3+3).includes(at))neighbors.push(j);for(const to of neighbors)if(to!==65535&&!seen.has(to)){seen.add(to);queue.push(to);}}return seen;};
  const reach=Array.from({length:m.triangles},(_,i)=>bfs(i));for(let i=0;i<m.triangles;i++){expect(n.reach(i).ids).toEqual([...reach[i]].sort((a,b)=>a-b));for(let j=0;j<m.triangles;j++)expect(n.scc.labels[i]===n.scc.labels[j]).toBe(reach[i].has(j)&&reach[j].has(i));}
  for(const group of n.wcc.groups)expect([...bfs(group[0],true)].sort((a,b)=>a-b)).toEqual(group);
  const starts=anchors.filter(a=>a.kind!=='segment').map(a=>({key:a.key,triangle:a.kind==='entrance'?a.record.field_triangle:a.record.targetTriangle}));for(const a of starts)expect(n.reach(a.triangle).ids).toEqual([...reach[a.triangle]].sort((a,b)=>a-b));
  let typical:ReturnType<WalkmeshNetwork['path']>|null=null,unreachable:number[]|null=null;for(let i=0;i<m.triangles;i++){const r=n.reach(i);for(let j=0;j<m.triangles;j++){if(!typical&&r.distance[j]>=3)typical=n.path(i,j);if(!unreachable&&r.distance[j]===-1)unreachable=[i,j];}}
  if(typical)for(const e of typical.steps)expect(m.access[e.from*3+e.edge]).toBe(e.to);
  const gateways=anchors.flatMap(a=>a.kind==='segment'?[{gateway:a.record.gateway,relation:a.record.sourceRelation,candidates:n.gateway(a.record)}]:[]);for(const a of anchors)if(a.kind==='segment')for(const triangle of n.gateway(a.record)){const slice={...m,triangles:1,vertices:m.vertices.slice(triangle*12,triangle*12+12),access:new Uint16Array(3).fill(65535)};expect(gatewayRelation(slice,a.record.sourceA,a.record.sourceB)).toBe('surface');}
  reports.push({name,triangles:m.triangles,wcc:n.wcc.groups.map(g=>g.length),scc:n.scc.groups.map(g=>g.length),isolated:n.isolated,starts:starts.map(a=>({...a,reachable:n.reach(a.triangle).ids.length})),fromZero:n.reach(0).ids.length,path:typical?.ids,unreachable,gateways});
 }
 let directionCase:{name:string;start:number;end:number;reason:string|null}|null=null;const totals={scenes:0,triangles:0,wcc:0,scc:0,isolated:0};
 for(const [id,row] of pack.scenes)if(row.status==='available'){const m=await pack.decode(id),n=new WalkmeshNetwork(m);totals.scenes++;totals.triangles+=m.triangles;totals.wcc+=n.wcc.groups.length;totals.scc+=n.scc.groups.length;totals.isolated+=n.isolated.length;
  if(!directionCase&&n.scc.groups.length>n.wcc.groups.length){outer:for(let a=0;a<m.triangles;a++)for(let b=a+1;b<m.triangles;b++)if(n.wcc.labels[a]===n.wcc.labels[b]&&n.scc.labels[a]!==n.scc.labels[b]){const start=n.path(a,b).reason?a:b,end=start===a?b:a;expect(n.path(start,end).reason).toBe('direction');directionCase={name:fields.nodes.find(f=>f.id===id)!.name,start,end,reason:n.path(start,end).reason};break outer;}}
 }
 console.log('Private directed network evidence',JSON.stringify(reports));console.log('Private complete network totals',JSON.stringify({...totals,directionCase}));
},30000);
it.skipIf(!existsSync(localFields)||!existsSync(privateWalkmesh))('cross-checks actual private anchors against the lazy mesh with independent integer predicates',async()=>{
 const fields=parseFieldPack(JSON.parse(readFileSync(localFields,'utf8')));if(fields.version!==3)return;const pack=await openWalkmeshPack(new File([readFileSync(privateWalkmesh)],'gaia-field-walkmesh.bin'),fields),counts:Record<string,number>={entrance:0,segment:0,arrival:0};
 for(const [id,row] of pack.scenes)if(row.status==='available'){const m=await pack.decode(id),anchors=sceneAnchors(fields,m,id);for(const a of anchors){counts[a.kind]++;if(a.kind==='segment'){expect(a.record.sourceRelation).toBe(fields.gateways!.find(g=>g.fromField===id&&g.gateway===a.record.gateway)!.sourceRelation);counts[a.record.sourceRelation]=(counts[a.record.sourceRelation]??0)+1;}}
 }
 expect(counts.entrance).toBe(fields.entrances!.filter(e=>['inside','boundary'].includes(e.status)).length);expect(counts.arrival).toBe(fields.gateways!.filter(g=>['inside','boundary'].includes(g.destination.status)).length);expect(counts.segment).toBe(fields.gateways!.length);
 if(fields.sources['flevel.lgp']==='af695ccf7c681be222f5f716758160e39469ec02bc0af3dd6f20a5e9c2a34807'&&fields.sources['field.tbl']==='e20da8b862cf5d3c64ce1fefb73463d930703ebd46e92af09b7edd3cb4b805cb'){expect(counts).toEqual({entrance:65,segment:1036,arrival:978,surface:801,xy_only:225,disjoint:10});expect(fields.entrances!.filter(e=>e.status==='placeholder')).toHaveLength(63);expect(fields.gateways!.filter(g=>g.destination.status==='boundary')).toHaveLength(14);expect(fields.gateways!.find(g=>g.fromField===177&&g.gateway===0)).toMatchObject({sourceA:[-987,94,0],sourceB:[-900,-85,0],to:172,targetXY:[172,373],targetTriangle:40});}
 console.log('Private spatial anchors independently verified',JSON.stringify(counts));
},30000);


describe('Authored Atlas knowledge and spoiler-safe search',()=>{
 it('indexes translated gameplay facts in every locale',()=>{
  const e=content.entities.find(e=>e.id==='fort-condor')!;
  for(const lang of ['en','zh-CN','zh-TW','ja','ko'] as const){
   expect(searchAtlas(content,e.facts[0].text[lang],lang).map(e=>e.id)).toContain(e.id);
   expect(e.facts[0].text[lang].length).toBeGreaterThan(0);
  }
 });
 it('never indexes hidden facts, including all translated variants',()=>{
  const e=structuredClone(entity);e.facts=[{kind:'secret',spoilerLevel:'major',sources:e.sources,text:{en:'Secret revelation sentinel','zh-CN':'秘密剧情哨兵','zh-TW':'秘密劇情哨兵',ja:'秘密の展開の印',ko:'비밀 전개 표식'}}];
  const c={...content,entities:[e]};
  expect(atlasFactTerms(e)).toEqual([]);
  for(const lang of ['en','zh-CN','zh-TW','ja','ko'] as const){
   expect(searchAtlas(c,e.facts[0].text[lang],lang)).toEqual([]);
   expect(searchAtlas(c,e.facts[0].text[lang],lang,'hide-all')).toEqual([]);
   expect(searchAtlas(c,e.facts[0].text[lang],lang,'show-all')).toEqual([e]);
  }
 });
 it('removes minor reward mechanics from Hide all search terms',()=>{
  const e=content.entities.find(e=>e.id==='quadra-magic-cave-reward')!;
  expect(atlasFactTerms(e,'hide-all')).toEqual([]);
  expect(atlasFactTerms(e,'hide-major')).toContain(e.facts[0].text.en);
 });
});

// Raw plane invariants also apply to the SVG Graph, whose layout is not geography.
describe('main Field plane',()=>{
 it.each([[1200,700],[390,420],[320,320]])('fits actual CSS dimensions %sx%s and roundtrips raw units',(w,h)=>{const v=new FieldPlanView([-300,900,-500,600]);v.resize(w,h);for(const p of [[-300,-500],[900,600],[101,-27]]){const point=v.point(p[0],p[1]),raw=v.raw(...point);expect(raw[0]).toBeCloseTo(p[0]);expect(raw[1]).toBeCloseTo(p[1]);expect(point[0]).toBeGreaterThanOrEqual(0);expect(point[1]).toBeGreaterThanOrEqual(0);expect(point[0]).toBeLessThanOrEqual(w);expect(point[1]).toBeLessThanOrEqual(h);}});
 it('keeps a cursor anchor through zoom and preserves pan/relative zoom on resize',()=>{const v=new FieldPlanView([0,200,0,300]);v.resize(900,600);const raw=v.raw(191,263);v.zoom(2,191,263);expect(v.raw(191,263)[0]).toBeCloseTo(raw[0]);expect(v.raw(191,263)[1]).toBeCloseTo(raw[1]);v.pan(35,-20);const center=[v.centerX,v.centerY],ratio=v.scale/v.fit;v.resize(320,450);expect([v.centerX,v.centerY]).toEqual(center);expect(v.scale/v.fit).toBeCloseTo(ratio);v.reset();expect(v.centerX).toBe(100);expect(v.centerY).toBe(150);expect(v.scale).toBe(v.fit);});
 it('bounds zoom and tolerates a zero-area raw plane',()=>{const v=new FieldPlanView([2,2,3,3]);v.resize(1,1);v.zoom(1e8);expect(v.scale).toBe(v.fit*30);v.zoom(1e-8);expect(v.scale).toBe(v.fit*.1);expect(v.point(2,3)).toEqual([.5,.5]);});
});


it.skipIf(!process.env.GAIA_FIELD_GIS_ORACLE)('FieldLocal GIS labels, reach snapshots and paths agree with the actual Web network',async()=>{
 const {readFile}=await import('node:fs/promises'),rows=JSON.parse(await readFile(process.env.GAIA_FIELD_GIS_ORACLE!,'utf8'));
 expect(rows).toHaveLength(5);
 for(const row of rows){const bytes=Uint8Array.from(row.section5.match(/../g), (s:string)=>parseInt(s,16)),network=new WalkmeshNetwork(decodeWalkmesh(bytes.buffer));
  for(const kind of ['wcc','scc'] as const){expect(network[kind].groups).toEqual(row.network[kind].groups);expect(Array.from(network[kind].labels)).toEqual(row.network[kind].labels);}
  expect(network.isolated).toEqual(row.network.isolated);
  if(row.start!==null){const reach=network.reach(row.start);expect(Array.from(reach.distance)).toEqual(row.network.reach.distance);expect(Array.from(reach.parent)).toEqual(row.network.reach.parent);expect(Array.from(reach.parentEdge)).toEqual(row.network.reach.slot);const path=network.path(row.start,row.end);expect(path.ids).toEqual(row.network.path.ids);expect(path.reason).toEqual(row.network.path.reason);}
 }
});
describe('Field camera and private background contract',()=>{
 it('rejects oversized visual resources before hashing or network adoption',async()=>{await expect(discoverWorkspace([{name:'gaia-field-visual.bin',size:64_000_001} as File])).rejects.toThrow('large');expect(()=>parseManifest({schema:'gaiagis-workspace',version:1,tool_version:'0.0.0',timestamp_policy:'omitted',sources:{},assets:[{filename:'gaia-field-visual.bin',type:'field-visual',mapId:'shared',bytes:64_000_001,sha256:'a'.repeat(64),dependencies:[]}]})).toThrow('budget');});
 const camera:FieldCamera={id:0,offset:0,matrix:[4096,0,0,0,4096,0,0,0,4096],translation:[10,-20,100],repeatedRzz:4096,extra:[0,0,0,0],zoom:955};
 it('uses camera-space translation, 240 FOV and an actual inverse',()=>{expect(projectField(camera,[0,0,0])).toEqual([95.5,-191]);expect(cameraCenter(camera)).toEqual([-10,20,-100]);expect(cameraFov(camera)).toBeCloseTo(14.3239,4);const rounded={...camera,matrix:[4095,1,0,0,4094,2,1,0,4096]};const center=cameraCenter(rounded)!;for(let i=0;i<3;i++)expect(rounded.translation[i]+center.reduce((s,n,k)=>s+rounded.matrix[i*3+k]*n/4096,0)).toBeCloseTo(0,8);});
 it('rejects behind, near-zero and non-finite projections without moving vertices',()=>{expect(projectField(camera,[0,0,-100])).toBeNull();expect(projectField(camera,[0,0,-101])).toBeNull();expect(projectField(camera,[Infinity,0,0])).toBeNull();expect(cameraCenter({...camera,matrix:Array(9).fill(0)})).toBeNull();});
 const fields={sources:{'flevel.lgp':'a'.repeat(64),maplist:'b'.repeat(64)},nodes:[{id:1,status:'available'}]} as unknown as import('../src/data/fieldContext').FieldPack;
 const meta=()=>({schema:'gaiagis-field-visual',version:1,generator_revision:'field-visual-1',sources:fields.sources,scenes:[{fieldId:1,cameras:[camera],background:{status:'unsupported'}}]});
 const header=(m:unknown,totalExtra=0)=>{const json=new TextEncoder().encode(JSON.stringify(m)),buffer=new ArrayBuffer(16+json.length),v=new DataView(buffer);new Uint8Array(buffer).set(new TextEncoder().encode('GAIACAM\0'));v.setUint32(8,1,true);v.setUint32(12,json.length,true);new Uint8Array(buffer).set(json,16);return ()=>parseVisualHeader(buffer,buffer.byteLength+totalExtra,fields);};
 it('bounds camera metadata and requires matching private source identity',()=>{expect(header(meta())().scenes.size).toBe(1);const m=meta();m.scenes[0].cameras[0]={...camera,zoom:0};expect(header(m)).toThrow();const different=meta();different.sources={...fields.sources,maplist:'c'.repeat(64)};expect(header(different)).toThrow();expect(header(meta(),1)).toThrow();});
 it('refuses compressed streams that exceed their authorized decoded budget',async()=>{const compressed=await new Response(new Blob([new Uint8Array(1024)]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();await expect(inflateVisual(compressed,16)).rejects.toThrow('budget');expect((await inflateVisual(compressed,1024)).byteLength).toBe(1024);await expect(inflateVisual(compressed,1025)).rejects.toThrow('length');});
 it('bounds per-scene spans, references and pixel budgets before decode',()=>{const b={status:'static_base',bounds:[0,0,16,16],layers:Array.from({length:4},(_,id)=>({id,width:16,height:16,tiles:id===0?1:0})),tileCount:1,paletteRefs:[{id:0,transparent:true}],omitted:0,pixelBytes:256,offset:0,bytes:1,sha256:'a'.repeat(64)};const m=()=>({...meta(),scenes:[{fieldId:1,cameras:[camera],background:structuredClone(b)}]});expect(header(m(),1)().scenes.size).toBe(1);for(const bad of [{offset:1},{bytes:100},{pixelBytes:8_000_001},{tileCount:8193},{bounds:[0,0,4096,4096]},{paletteRefs:[{id:256,transparent:true}]}]){const value=m();Object.assign(value.scenes[0].background,bad);expect(header(value,1)).toThrow();}});
 it('validates source-tile descriptors after bounded decompression',async()=>{const raw=new Uint8Array(776);raw[6]=42;const compressed=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),n=>n.toString(16).padStart(2,'0')).join('');const m={...meta(),scenes:[{fieldId:1,cameras:[camera],background:{status:'static_base',bounds:[0,0,16,16],layers:Array.from({length:4},(_,id)=>({id,width:16,height:16,tiles:id===0?1:0})),tileCount:1,paletteRefs:[{id:0,transparent:true}],omitted:0,pixelBytes:256,offset:0,bytes:compressed.byteLength,sha256:digest}}]},json=new TextEncoder().encode(JSON.stringify(m)),head=new Uint8Array(16),v=new DataView(head.buffer);head.set(new TextEncoder().encode('GAIACAM\0'));v.setUint32(8,1,true);v.setUint32(12,json.length,true);const file=new File([head,json,compressed],'gaia-field-visual.bin'),pack=await openFieldVisual(file,fields);await expect(pack.decode(1)).rejects.toThrow('reference');});
 it('rebuilds RGB555 tiles in screen coordinates, retaining transparency',()=>{const pixels=new Uint8Array(256);pixels[0]=1;const scene={fieldId:1,cameras:[camera],background:{status:'static_base' as const,bounds:[-16,-8,0,8],pixelBytes:256,paletteRefs:[{id:0,transparent:true}],palettes:[Array.from({length:256},(_,i)=>i===1?31:0)],tiles:[{x:-16,y:-8,id:0,offset:0,sourceOffset:52,texture:0,palette:0}]}};const image=baseBackground(scene,pixels);expect(image.width).toBe(16);expect(Array.from(image.rgba.slice(0,8))).toEqual([255,0,0,255,0,0,0,0]);});
 it('keeps green opaque, aliases zero CLUT entries and does not treat bit 15 as alpha',()=>{
  const pixels=new Uint8Array(256);pixels.set([0,1,2,3]);const palette=Array(256).fill(0);palette[0]=992;palette[2]=0x801f;palette[3]=992;
  const scene={fieldId:1,cameras:[],background:{status:'static_base' as const,bounds:[0,0,16,16],pixelBytes:256,paletteRefs:[{id:5,transparent:true}],palettes:[palette],tiles:[{x:0,y:0,id:0,offset:0,sourceOffset:52,texture:0,palette:5}]}};
  expect(Array.from(baseBackground(scene,pixels).rgba.slice(0,16))).toEqual([0,0,0,0,0,255,0,255,255,0,0,255,0,255,0,255]);
  scene.background.paletteRefs[0].transparent=false;expect(Array.from(baseBackground(scene,pixels).rgba.slice(0,4))).toEqual([0,255,0,255]);
 });
 it('composes static overlays with the tile CLUT and preserves lower pixels through transparent index 0',()=>{
  const pixels=new Uint8Array(512);pixels.fill(1,0,256);pixels[256]=1;
  const scene={fieldId:1,cameras:[],background:{status:'static_base' as const,bounds:[0,0,16,16],pixelBytes:512,paletteRefs:[{id:0,transparent:true},{id:1,transparent:true}],palettes:[Array(256).fill(992),Array(256).fill(31744)],tiles:[{x:0,y:0,id:0,layer:0,offset:0,sourceOffset:52,texture:0,palette:0},{x:0,y:0,id:0,layer:1,offset:256,sourceOffset:131,texture:0,palette:1}]}};
  expect(Array.from(baseBackground(scene,pixels).rgba.slice(0,8))).toEqual([0,0,255,255,0,255,0,255]);
 });
 it('decodes revision-2 layer-local IDs, order and source offsets and rejects forged descriptors',async()=>{
  async function pack(edit?:(raw:Uint8Array)=>void){
   const raw=new Uint8Array(1040);raw[14]=64;edit?.(raw);
   const compressed=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer(),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),n=>n.toString(16).padStart(2,'0')).join('');
   const m={...meta(),generator_revision:'field-visual-2',scenes:[{fieldId:1,cameras:[camera],background:{status:'static_base',bounds:[0,0,16,16],layers:Array.from({length:4},(_,id)=>({id,width:16,height:16,tiles:id<2?1:0})),tileCount:2,paletteRefs:[{id:0,transparent:true}],omitted:0,pixelBytes:512,offset:0,bytes:compressed.byteLength,sha256}}]},json=new TextEncoder().encode(JSON.stringify(m)),head=new Uint8Array(16),v=new DataView(head.buffer);head.set(new TextEncoder().encode('GAIACAM\0'));v.setUint32(8,1,true);v.setUint32(12,json.length,true);
   return openFieldVisual(new File([head,json,compressed],'gaia-field-visual.bin'),fields);
  }
  const decoded=await(await pack()).decode(1);expect(decoded.scene.background.tiles!.map(t=>[t.layer,t.id,t.texture,t.sourceOffset])).toEqual([[0,0,0,52],[1,0,0,131]]);
  for(const edit of [(r:Uint8Array)=>r[14]=128,(r:Uint8Array)=>r[14]=106,(r:Uint8Array)=>r[14]=0,(r:Uint8Array)=>r[12]=1])await expect((await pack(edit)).decode(1)).rejects.toThrow('reference');
 });
 it('rejects revision-2 total tiles beyond the bounded original section',()=>{
  const m={...meta(),generator_revision:'field-visual-2',scenes:[{fieldId:1,cameras:[camera],background:{status:'partial',bounds:[0,0,16,16],layers:Array.from({length:4},(_,id)=>({id,width:16,height:16,tiles:8192})),tileCount:16384,paletteRefs:[],omitted:16384,pixelBytes:16384*256,offset:0,bytes:1,sha256:'a'.repeat(64)}}]};
  expect(header(m,1)).toThrow('accounting');
 });
});
