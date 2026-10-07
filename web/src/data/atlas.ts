import {nearName} from './nameSearch';
// SPDX-License-Identifier: GPL-3.0-only
import type {Locale} from '../i18n';
import type {PoiDataset,Location,Entrance} from './poi';

export const atlasKinds=['city','town','village','settlement','dungeon','landmark','materia_cave','world_map_site','chocobo_site','vehicle_site','secret_area','collectible_site','treasure_group'] as const;
export const precisionClasses=['exact_source','verified_anchor','entrance_level','parent_place','field_only','non_spatial','unresolved'] as const;
export type Precision=typeof precisionClasses[number];
export type Spoiler='none'|'minor'|'major';
export type Localized=Record<Locale,string>;
export interface AtlasSource {id:string;provider:string;title:string;url:string;reviewed:string;type:'game_identity'|'reverse_engineering'|'wiki'|'reference';notes:string;}
export interface BindingRequest {kind:'location'|'parent_location'|'field_parent'|'field_identity'|'non_spatial'|'unresolved';locationId?:string;fieldNames?:string[];}
export interface AtlasFact {kind:'access'|'gameplay'|'reward'|'category'|'secret';text:Localized;spoilerLevel:Spoiler;sources:string[];}
export interface AtlasEntity {id:string;kind:typeof atlasKinds[number];canonicalName:string;localizedNames:Localized;aliases:string[];summary:Localized;region:string;tags:string[];spoilerLevel:Spoiler;spatialBinding:BindingRequest;relatedLocations:string[];relatedEntities:string[];collectibles:string[];secrets:string[];sources:string[];facts:AtlasFact[];notes:string[];}
export interface AtlasContent {schema:'gaiagis-atlas-content';version:1;sources:AtlasSource[];entities:AtlasEntity[];exclusions:{locationId:string;reason:string}[];}
export interface AtlasBinding {kind:BindingRequest['kind'];precision:Precision;evidence:'existing_entrance'|'parent_only'|'field_link'|'non_spatial'|'unresolved';locationId:string|null;entranceId:string|null;fieldNames:string[];relatedEntrances:string[];relatedTransitions:string[];marker:boolean;}
export interface AtlasPack {schema:'gaiagis-atlas';version:1;curated_sha256:string;content:AtlasContent;sources:Record<string,string>;bindings:Record<string,AtlasBinding>;}
const fail=():never=>{throw Error('Invalid Atlas schema/provenance/spatial binding');};
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail();
const shape=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const text=(v:unknown,max=500)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\x00-\x1f]/.test(v);
const id=(v:unknown)=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,99}$/.test(v);
const strings=(v:unknown)=>Array.isArray(v)&&v.length<=100&&v.every(s=>text(s,100))&&new Set(v).size===v.length;
const localized=(v:unknown)=>{const o=object(v);return shape(o,['en','zh-CN','zh-TW','ja','ko'])&&Object.values(o).every(s=>text(s));};
const spoiler=(v:unknown)=>['none','minor','major'].includes(v as string);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function parseAtlasContent(value:unknown):AtlasContent{
 const c=object(value);if(!shape(c,['schema','version','sources','entities','exclusions'])||c.schema!=='gaiagis-atlas-content'||c.version!==1||!Array.isArray(c.sources)||!c.sources.length||c.sources.length>200||!Array.isArray(c.entities)||!c.entities.length||c.entities.length>2000||!Array.isArray(c.exclusions))fail();
 const sourceIds=new Set<string>();for(const row of c.sources as unknown[]){const s=object(row);if(!shape(s,['id','provider','title','url','reviewed','type','notes'])||!id(s.id)||sourceIds.has(s.id as string)||!['provider','title','notes'].every(k=>text(s[k]))||!text(s.url,1000)||!text(s.reviewed,10)||!/^\d{4}-\d{2}-\d{2}$/.test(s.reviewed as string)||!Number.isFinite(Date.parse(s.reviewed as string))||!['game_identity','reverse_engineering','wiki','reference'].includes(s.type as string))fail();const url=new URL(s.url as string);if(url.protocol!=='https:'||!url.hostname||url.username||url.password)fail();sourceIds.add(s.id as string);}
 const refs=(v:unknown)=>strings(v)&&(v as string[]).length>0&&(v as string[]).every(s=>sourceIds.has(s));
 const ids=new Set<string>(),locations=new Set<string>();for(const row of c.entities as unknown[]){const e=object(row);if(!shape(e,['id','kind','canonicalName','localizedNames','aliases','summary','region','tags','spoilerLevel','spatialBinding','relatedLocations','relatedEntities','collectibles','secrets','sources','facts','notes'])||!id(e.id)||ids.has(e.id as string)||!atlasKinds.includes(e.kind as AtlasEntity['kind'])||!spoiler(e.spoilerLevel)||!text(e.canonicalName,100)||!localized(e.localizedNames)||!localized(e.summary)||!['eastern','western','northern','wutai','islands','underwater','unknown'].includes(e.region as string)||!refs(e.sources)||!['aliases','tags','relatedLocations','relatedEntities','collectibles','secrets','notes'].every(k=>strings(e[k])))fail();ids.add(e.id as string);
  const b=object(e.spatialBinding),kind=b.kind as string;const keys=kind==='unresolved'||kind==='non_spatial'?['kind']:kind==='field_identity'?['kind','fieldNames']:kind==='field_parent'?['kind','locationId','fieldNames']:['kind','locationId'];if(!['location','parent_location','field_parent','field_identity','non_spatial','unresolved'].includes(kind)||!shape(b,keys)||keys.includes('locationId')&&!id(b.locationId)||['field_parent','field_identity'].includes(kind)&&(!strings(b.fieldNames)||!(b.fieldNames as string[]).length||!(b.fieldNames as string[]).every(n=>/^[a-zA-Z0-9_-]{1,32}$/.test(n))))fail();if(kind==='location'){if(locations.has(b.locationId as string))fail();locations.add(b.locationId as string);}
  if(!Array.isArray(e.facts)||e.facts.length>30)fail();for(const row of e.facts as unknown[]){const f=object(row);if(!shape(f,['kind','text','spoilerLevel','sources'])||!['access','gameplay','reward','category','secret'].includes(f.kind as string)||!localized(f.text)||!spoiler(f.spoilerLevel)||!refs(f.sources))fail();}
 }
 for(const row of c.entities as unknown[]){const e=row as AtlasEntity;for(const key of ['relatedEntities','collectibles','secrets'] as const)if(e[key].some(ref=>!ids.has(ref)||ref===e.id))fail();if(e.relatedLocations.some(ref=>!locations.has(ref)))fail();if(['parent_location','field_parent'].includes(e.spatialBinding.kind)&&!locations.has(e.spatialBinding.locationId!))fail();}
 const excluded=new Set<string>();for(const row of c.exclusions as unknown[]){const e=object(row);if(!shape(e,['locationId','reason'])||!id(e.locationId)||!text(e.reason)||excluded.has(e.locationId as string)||locations.has(e.locationId as string))fail();excluded.add(e.locationId as string);}
 return value as AtlasContent;
}
export function parseAtlasPack(value:unknown):AtlasPack{
 const p=object(value);if(!shape(p,['schema','version','curated_sha256','content','sources','bindings'])||p.schema!=='gaiagis-atlas'||p.version!==1||!hash(p.curated_sha256))fail();const content=parseAtlasContent(p.content),sources=object(p.sources),bindings=object(p.bindings);if(!Object.keys(sources).length||!Object.entries(sources).every(([k,h])=>/^[a-z0-9_.-]{1,100}$/.test(k)&&!['__proto__','constructor','prototype'].includes(k)&&hash(h))||Object.keys(bindings).length!==content.entities.length)fail();
 for(const e of content.entities){const b=object(bindings[e.id]);if(!shape(b,['kind','precision','evidence','locationId','entranceId','fieldNames','relatedEntrances','relatedTransitions','marker'])||b.kind!==e.spatialBinding.kind||!precisionClasses.includes(b.precision as Precision)||typeof b.marker!=='boolean'||!strings(b.fieldNames)||!strings(b.relatedEntrances)||!strings(b.relatedTransitions))fail();
  if(b.precision==='unresolved'||b.precision==='non_spatial'){if(b.evidence!==b.precision||b.marker||b.locationId!==null||b.entranceId!==null||(b.fieldNames as string[]).length||(b.relatedEntrances as string[]).length||(b.relatedTransitions as string[]).length||b.precision==='non_spatial'&&b.kind!=='non_spatial')fail();}
  else {if(b.locationId!==e.spatialBinding.locationId||!id(b.locationId))fail();const expected=b.kind==='location'?['entrance_level','existing_entrance']:b.kind==='parent_location'?['parent_place','parent_only']:b.kind==='field_parent'?['field_only','field_link']:[];if(b.precision!==expected[0]||b.evidence!==expected[1]||b.marker!==(b.kind==='location')||b.kind==='location'&&(!text(b.entranceId,100)||!(b.relatedEntrances as string[]).includes(b.entranceId as string))||b.kind!=='location'&&b.entranceId!==null||JSON.stringify(b.fieldNames)!==JSON.stringify(e.spatialBinding.fieldNames??[]))fail();}
 }
 return value as AtlasPack;
}
export function resolveBinding(e:AtlasEntity,poi:PoiDataset|null):AtlasBinding{
 const request=e.spatialBinding,location=poi?.locations.find(l=>l.id===request.locationId),base:AtlasBinding={kind:request.kind,precision:request.kind==='non_spatial'?'non_spatial':'unresolved',evidence:request.kind==='non_spatial'?'non_spatial':'unresolved',locationId:null,entranceId:null,fieldNames:[],relatedEntrances:[],relatedTransitions:[],marker:false};
 if(!location)return base;const entrance=poi!.entrances.find(e=>e.id===location.primary_entrance);if(!entrance||entrance.source_kind!=='derived_from_entry_trigger')fail();
 if(request.kind==='field_parent'&&request.fieldNames?.some(f=>!location.field_names.includes(f)))fail();return {...base,locationId:location.id,entranceId:request.kind==='location'?entrance!.id:null,precision:request.kind==='location'?'entrance_level':request.kind==='field_parent'?'field_only':'parent_place',evidence:request.kind==='location'?'existing_entrance':request.kind==='field_parent'?'field_link':'parent_only',fieldNames:request.fieldNames??[],relatedEntrances:[...location.entrance_ids],marker:request.kind==='location'};
}
export function validateAtlasPoi(pack:AtlasPack,poi:PoiDataset){
 if(Object.keys(pack.sources).length!==Object.keys(poi.sources).length)fail();
 if(Object.entries(pack.sources).some(([k,h])=>poi.sources[k]?.toLowerCase()!==h))fail();
 for(const entity of pack.content.entities){const expected=resolveBinding(entity,poi),binding=pack.bindings[entity.id];for(const key of ['kind','precision','evidence','locationId','entranceId','fieldNames','relatedEntrances','marker'] as const)if(JSON.stringify(expected[key])!==JSON.stringify(binding[key]))fail();}
}
export function atlasAnchor(binding:AtlasBinding,poi:PoiDataset|null,parent=false):{location:Location;entrance:Entrance}|null{
 if(!poi||!binding.locationId||!parent&&!binding.marker)return null;const location=poi.locations.find(l=>l.id===binding.locationId),entrance=poi.entrances.find(e=>e.id===(parent?location?.primary_entrance:binding.entranceId));return location&&entrance?{location,entrance}:null;
}
export const spoilerVisible=(level:Spoiler,mode:'hide-major'|'show-all'|'hide-all'='hide-major')=>mode==='show-all'||level==='none'||mode==='hide-major'&&level==='minor';
export type AtlasCategory='all'|'places'|'secrets'|'collectibles';
export function atlasCategory(e:AtlasEntity,category:AtlasCategory){return category==='all'||category==='collectibles'&&e.tags.includes('collectible')||category==='secrets'&&e.tags.includes('secret')||category==='places'&&e.tags.includes('place');}
export const normalizeAtlas=(s:string)=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en').replace(/[↔<>\s_-]+/g,' ').trim();
export function searchAtlas(content:AtlasContent,query:string,lang:Locale,mode:'hide-major'|'show-all'|'hide-all'='hide-major',category:AtlasCategory='all',region='all',kind='all'){
 const q=normalizeAtlas(query);const visible=content.entities.filter(e=>spoilerVisible(e.spoilerLevel,mode));const byId=new Map(visible.map(e=>[e.id,e]));
 const rank=(e:AtlasEntity)=>{const local=normalizeAtlas(e.localizedNames[lang]),canonical=normalizeAtlas(e.canonicalName);const names=Object.values(e.localizedNames).map(normalizeAtlas),aliases=e.aliases.map(normalizeAtlas);const rewards=e.collectibles.map(id=>byId.get(id)).filter(Boolean).flatMap(e=>[e!.canonicalName,...Object.values(e!.localizedNames),...e!.aliases]).map(normalizeAtlas),facets=[e.kind,e.region,...e.tags].map(normalizeAtlas);return !q?0:local===q?0:canonical===q?1:local.startsWith(q)?2:names.some(n=>n.startsWith(q))?3:names.some(n=>n.includes(q))?4:aliases.some(a=>a.includes(q))?5:rewards.some(r=>r.includes(q))?6:facets.some(f=>f.includes(q))?7:[...names,...aliases,...rewards].some(n=>nearName(q,n))?8:Infinity;};
 return visible.filter(e=>atlasCategory(e,category)&&(region==='all'||e.region===region)&&(kind==='all'||e.kind===kind)).map(e=>({entity:e,rank:rank(e)})).filter(r=>Number.isFinite(r.rank)).sort((a,b)=>a.rank-b.rank||a.entity.localizedNames[lang].localeCompare(b.entity.localizedNames[lang],lang)||a.entity.id.localeCompare(b.entity.id)).map(r=>r.entity);
}
