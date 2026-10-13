// SPDX-License-Identifier: GPL-3.0-only
import type {Entrance,PoiDataset} from './poi';
import type {AtlasEntity,AtlasBinding,Precision} from './atlas';
import type {SaveSlot} from './save';

export interface FieldNode {id:number;name:string;status:'available'|'missing'|'corrupt';saveId:number|null;scriptName?:string|null;}
export interface FieldEdge {fromField:number;to:number;gateway:number;offset:number;}
export interface FieldScriptEdge {fromField:number;to:number;opcode:96;offset:number;}
export type SceneEdge=FieldEdge|FieldScriptEdge;
export interface NativeFieldRelation {map:'WM0'|'WM2'|'WM3';fieldId:number;entry:number;scenario:number;function:number;offset:number;opcode:792;}
export interface FieldBinding {entranceId:string;locationId:string;fieldId:number;status:'verified_direct'|'unresolved';}
export type PointStatus='inside'|'boundary'|'outside'|'invalid_triangle'|'degenerate'|'mesh_unavailable'|'missing'|'placeholder'|'world';
export interface FieldEntrance extends Pick<import('./poi').Entrance,'field_id'|'field_name'|'field_x'|'field_y'|'field_triangle'|'field_direction'|'field_table_record'|'field_table_byte_offset'>{entry:number;scenario:0|1;status:PointStatus;derivedZ:number|null;}
export interface FieldGateway extends FieldEdge {sourceA:[number,number,number];sourceB:[number,number,number];targetXY:[number,number];targetTriangle:number;direction:[number,number,number,number];sourceRelation:'surface'|'xy_only'|'disjoint'|'unknown';destination:{status:PointStatus;derivedZ:number|null};}
export interface FieldPack {
 schema:'gaiagis-field-context';version:1|2|3;coordinateSpace:'FieldLocalIdentity';archive:'flevel.lgp';sources:Record<string,string>;
 nodes:FieldNode[];edges:FieldEdge[];exits:(FieldEdge&{name:string})[];
 unresolved:{fromField:number;to:number|null;gateway:number|null;reason:'invalid_section'|'missing_destination'}[];
 bindings:FieldBinding[];scriptTransitions:'unverified'|'bounded_mapjump';
 scriptEdges?:FieldScriptEdge[];scriptExits?:(FieldScriptEdge&{name:string})[];scriptUnresolved?:{fromField:number;offset:number|null;reason:'invalid_script'|'unsupported_opcode'|'unverified_boundary'|'missing_destination'}[];nativeRelations?:NativeFieldRelation[];
 entrances?:FieldEntrance[];gateways?:FieldGateway[];
}
const fail=():never=>{throw Error('Invalid Field Context identity/evidence');};
const integer=(v:unknown,max=65535)=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=max;
function shape(v:unknown,keys:string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v))return fail();
 const o=v as Record<string,unknown>;if(Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))return fail();return o;
}
const list=(v:unknown,max:number):unknown[]=>Array.isArray(v)&&v.length<=max?v:fail();
const text=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
// Same reviewed classic-PC table gate as the local generator. A private pack
// cannot claim save compatibility merely by setting saveId on an unknown table.
const saveMaplist='d6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29';
const saveConflicts=new Set([88,89,90,91,404,526,593,594,699]);
export function parseFieldPack(value:unknown):FieldPack {
 const version=(value as {version?:unknown})?.version,v2=version===2||version===3,v3=version===3;
 const d=shape(value,['schema','version','coordinateSpace','archive','sources','nodes','edges','exits','unresolved','bindings','scriptTransitions',...(v2?['scriptEdges','scriptExits','scriptUnresolved','nativeRelations']:[]),...(v3?['entrances','gateways']:[])]);
 if(d.schema!=='gaiagis-field-context'||![1,2,3].includes(Number(d.version))||d.coordinateSpace!=='FieldLocalIdentity'||d.archive!=='flevel.lgp'||d.scriptTransitions!==(v2?'bounded_mapjump':'unverified'))fail();
 if(!d.sources||typeof d.sources!=='object'||Array.isArray(d.sources))fail();const sources=d.sources as Record<string,unknown>;
 if(Object.keys(sources).length>32||!['flevel.lgp','maplist','field.tbl','wm0.ev','wm0.map'].every(k=>Object.hasOwn(sources,k))||!Object.entries(sources).every(([k,v])=>/^[a-z0-9_.-]{1,80}$/.test(k)&&typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)))fail();
 const ids=new Map<number,FieldNode>(),names=new Set<string>();
 for(const value of list(d.nodes,2000)){const n=shape(value,['id','name','status','saveId',...(v2?['scriptName']:[])]);if(!integer(n.id)||!text(n.name)||String(n.name).length>32||(n.name==='dummy'||/^wm\d+$/.test(String(n.name)))||!['available','missing','corrupt'].includes(String(n.status))||ids.has(Number(n.id))||names.has(String(n.name).toLowerCase()))fail();if(v2&&n.scriptName!==null&&(!text(n.scriptName)||String(n.scriptName).length>8))fail();const alias=({88:['qa','q_1'],89:['qb','q_2'],90:['qc','q_3'],91:['qd','q_4']} as Record<number,string[]>)[Number(n.id)];const reviewedAlias=v2&&alias?.[0]===n.name&&alias?.[1]===n.scriptName;
 if(n.saveId!==null&&(n.saveId!==n.id||n.status!=='available'||sources.maplist!==saveMaplist||saveConflicts.has(Number(n.id))&&!reviewedAlias))fail();ids.set(Number(n.id),n as unknown as FieldNode);names.add(String(n.name).toLowerCase());}
 const records=new Set<string>(),valid=(id:unknown)=>integer(id)&&ids.get(Number(id))?.status==='available';
 function edge(value:unknown,exit=false){const e=shape(value,exit?['fromField','to','gateway','offset','name']:['fromField','to','gateway','offset']);
  if(!valid(e.fromField)||!integer(e.gateway,11)||e.offset!==56+Number(e.gateway)*24||!integer(e.to)||records.has(e.fromField+':'+e.gateway))fail();
  if(exit?e.name!=='wm'+(Number(e.to)-1)||!integer(e.to,64)||e.to===0||ids.has(Number(e.to)):!valid(e.to))fail();records.add(e.fromField+':'+e.gateway);
 }
 for(const e of list(d.edges,24000))edge(e);for(const e of list(d.exits,24000))edge(e,true);
 for(const value of list(d.unresolved,24000)){const e=shape(value,['fromField','to','gateway','reason']);if(!integer(e.fromField)||!ids.has(Number(e.fromField)))fail();
  if(e.reason==='invalid_section'){if(e.to!==null||e.gateway!==null||ids.get(Number(e.fromField))?.status!=='corrupt')fail();}
  else if(e.reason==='missing_destination'){if(!valid(e.fromField)||!integer(e.to)||valid(e.to)||!integer(e.gateway,11)||records.has(e.fromField+':'+e.gateway))fail();records.add(e.fromField+':'+e.gateway);}
  else fail();
 }
 if(v2){
  const scriptRecords=new Set<string>();
  const script=(value:unknown,exit=false)=>{const e=shape(value,exit?['fromField','to','opcode','offset','name']:['fromField','to','opcode','offset']);if(!valid(e.fromField)||!integer(e.offset)||e.opcode!==96||!integer(e.to)||scriptRecords.has(e.fromField+':'+e.offset))fail();if(exit?e.name!=='wm'+(Number(e.to)-1)||!integer(e.to,64)||e.to===0||ids.has(Number(e.to)):!valid(e.to))fail();scriptRecords.add(e.fromField+':'+e.offset);};
  for(const e of list(d.scriptEdges,24000))script(e);for(const e of list(d.scriptExits,24000))script(e,true);
  for(const value of list(d.scriptUnresolved,48000)){const e=shape(value,['fromField','offset','reason']);if(!valid(e.fromField)||!['invalid_script','unsupported_opcode','unverified_boundary','missing_destination'].includes(String(e.reason))||(e.reason==='invalid_script'?e.offset!==null||ids.get(Number(e.fromField))?.scriptName!==null:!integer(e.offset))||scriptRecords.has(e.fromField+':'+e.offset))fail();scriptRecords.add(e.fromField+':'+e.offset);}
  const nativeRecords=new Set<string>();for(const value of list(d.nativeRelations,10000)){const e=shape(value,['map','fieldId','entry','scenario','function','offset','opcode']);if(!['WM0','WM2','WM3'].includes(String(e.map))||!valid(e.fieldId)||!integer(e.entry,64)||e.entry===0||!integer(e.scenario,1)||!integer(e.function)||!integer(e.offset)||e.opcode!==792||!sources[String(e.map).toLowerCase()+'.ev']||nativeRecords.has(e.map+':'+e.function+':'+e.offset))fail();nativeRecords.add(e.map+':'+e.function+':'+e.offset);}
 }
 const bindings=new Set<string>();for(const value of list(d.bindings,10000)){const b=shape(value,['entranceId','locationId','fieldId','status']);if(!text(b.entranceId)||!text(b.locationId)||!integer(b.fieldId)||!['verified_direct','unresolved'].includes(String(b.status))||b.status==='verified_direct'&&!valid(b.fieldId)||bindings.has(String(b.entranceId)))fail();bindings.add(String(b.entranceId));}
 if(v3){
  const signed=(v:unknown)=>Number.isInteger(v)&&Number(v)>=-32768&&Number(v)<=32767;
  const vector=(v:unknown,n:number)=>Array.isArray(v)&&v.length===n&&v.every(signed);
  const point=(v:unknown,allowed:string[])=>{const p=shape(v,['status','derivedZ']);if(!allowed.includes(String(p.status))||(['inside','boundary'].includes(String(p.status))?typeof p.derivedZ!=='number'||!Number.isFinite(p.derivedZ)||Math.abs(p.derivedZ)>32768:p.derivedZ!==null))fail();};
  const statuses=['inside','boundary','outside','invalid_triangle','degenerate','mesh_unavailable','missing'];
  const entrances=list(d.entrances,128);if(entrances.length!==128)fail();
  for(const [record,value] of entrances.entries()){const e=shape(value,['entry','scenario','field_id','field_name','field_x','field_y','field_triangle','field_direction','field_table_record','field_table_byte_offset','status','derivedZ']);point({status:e.status,derivedZ:e.derivedZ},[...statuses,'placeholder']);
   if(e.field_table_record!==record||e.field_table_byte_offset!==record*12||e.entry!==Math.floor(record/2)+1||e.scenario!==record%2||!integer(e.field_id)||!text(e.field_name)||String(e.field_name).length>32||!signed(e.field_x)||!signed(e.field_y)||!integer(e.field_triangle)||!integer(e.field_direction,255))fail();
   if(e.status==='placeholder'){if(e.field_name!=='dummy'||[e.field_id,e.field_x,e.field_y,e.field_triangle,e.field_direction].some(v=>v!==0))fail();}
   else if(e.status==='missing'?valid(e.field_id)||ids.has(Number(e.field_id))&&ids.get(Number(e.field_id))?.name!==e.field_name:ids.get(Number(e.field_id))?.name!==e.field_name||!valid(e.field_id))fail();
  }
  const gateways=new Set<string>();for(const value of list(d.gateways,24000)){const g=shape(value,['fromField','to','gateway','offset','sourceA','sourceB','targetXY','targetTriangle','direction','sourceRelation','destination']);const key=g.fromField+':'+g.gateway;
   if(!valid(g.fromField)||!integer(g.to)||g.to===32767||!integer(g.gateway,11)||g.offset!==56+Number(g.gateway)*24||!vector(g.sourceA,3)||!vector(g.sourceB,3)||!vector(g.targetXY,2)||!integer(g.targetTriangle)||!Array.isArray(g.direction)||g.direction.length!==4||!g.direction.every(v=>integer(v,255))||!['surface','xy_only','disjoint','unknown'].includes(String(g.sourceRelation))||gateways.has(key)||!records.has(key))fail();
   point(g.destination,[...statuses,'world']);const p=g.destination as {status:string};const exits=d.exits as FieldEdge[],edges=d.edges as FieldEdge[],unresolved=d.unresolved as {fromField:number;to:number|null;gateway:number|null}[];
   const evidence=[...exits,...edges,...unresolved].find(e=>e.fromField===g.fromField&&e.gateway===g.gateway);
   if(evidence?.to!==g.to||(p.status==='world')!==exits.some(e=>e.fromField===g.fromField&&e.gateway===g.gateway)||p.status==='missing'&&valid(g.to)||p.status!=='world'&&p.status!=='missing'&&!valid(g.to))fail();gateways.add(key);
  }
  const expected=(d.edges as unknown[]).length+(d.exits as unknown[]).length+(d.unresolved as {reason:string}[]).filter(e=>e.reason==='missing_destination').length;if(gateways.size!==expected)fail();
 }
 return d as unknown as FieldPack;
}
export function validateFieldPoi(pack:FieldPack,poi:PoiDataset){
 if(Object.entries(poi.sources).some(([key,hash])=>pack.sources[key]!==hash)||pack.bindings.length!==poi.entrances.length)throw Error('Field/POI source identity mismatch');
 for(const e of poi.entrances){const b=pack.bindings.find(b=>b.entranceId===e.id),n=pack.nodes.find(n=>n.id===e.field_id),verified=n?.status==='available'&&n.name===e.field_name&&e.source_kind==='derived_from_entry_trigger'&&e.script_calls.length>0&&e.world_map===0;
  if(!b||b.locationId!==e.location_id||b.fieldId!==e.field_id||b.status!==(verified?'verified_direct':'unresolved'))throw Error('Field entrance identity mismatch');
 }
}

export type WorldEntranceReason='context_unavailable'|'poi_unavailable'|'unknown_entrance'|'non_wm0'|'world_evidence_missing'|'source_mismatch'|'field_unavailable'|'legacy_context'|'table_mismatch'|'transition_mismatch'|'mesh_unavailable'|'point_invalid';
export interface WorldEntranceValidation {ok:boolean;reason:WorldEntranceReason|null;field:FieldNode|null;record:FieldEntrance|null;relations:NativeFieldRelation[];anchor:FieldAnchor|null;}
/** Cross-scale identity browsing, not a coordinate transform or runtime jump.
 * The POI representative must retain WM0 trigger provenance; a FIELD.TBL row
 * alone never establishes a global entrance. Decode only the selected scene
 * through openWalkmeshPack before passing its mesh and verified source hashes.
 */
export function validateWorldEntrance(pack:FieldPack|null,poi:PoiDataset|null,entrance:Entrance,mesh?:FieldWalkmesh|null,walkmeshSources?:Record<string,string>|null):WorldEntranceValidation {
 const result:WorldEntranceValidation={ok:false,reason:null,field:null,record:null,relations:[],anchor:null};
 const reject=(reason:WorldEntranceReason)=>({...result,reason});
 if(!pack)return reject('context_unavailable');if(!poi)return reject('poi_unavailable');
 const e=poi.entrances.find(e=>e.id===entrance.id);if(!e)return reject('unknown_entrance');
 result.field=pack.nodes.find(n=>n.id===e.field_id)??null;
 if(e.world_map!==0||entrance.world_map!==0)return reject('non_wm0');
 const sourceFields=['source_kind','source_file','source_record','source_script','confidence','section_id','mesh_id','triangle_id'] as const;
 const triggersAgree=Array.isArray(entrance.trigger_triangle_ids)&&entrance.trigger_triangle_ids.length===e.trigger_triangle_ids.length&&entrance.trigger_triangle_ids.every((id,i)=>id===e.trigger_triangle_ids[i]);
 const callsAgree=Array.isArray(entrance.script_calls)&&entrance.script_calls.length===e.script_calls.length&&entrance.script_calls.every((call,i)=>call&&call.call_table_record===e.script_calls[i].call_table_record&&call.instruction_word_offset===e.script_calls[i].instruction_word_offset);
 if(sourceFields.some(key=>entrance[key]!==e[key])||!triggersAgree||!callsAgree||e.source_kind!=='derived_from_entry_trigger'||e.source_file!=='wm0.map'||e.confidence!=='verified_trigger_derived_position'||e.source_record!==e.triangle_id||!e.trigger_triangle_ids.includes(e.triangle_id)||!e.script_calls.length||!e.script_calls.every(c=>integer(c.call_table_record,255)&&c.call_table_record>0&&integer(c.instruction_word_offset,13823)&&c.instruction_word_offset>0))return reject('world_evidence_missing');
 const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
 const same=(a:unknown,b:unknown)=>hash(a)&&hash(b)&&a.toLowerCase()===b.toLowerCase();
 if(['wm0.map','wm0.ev','field.tbl','maplist'].some(k=>!same(pack.sources[k],poi.sources[k]))||!hash(pack.sources['flevel.lgp'])||Object.entries(poi.sources).some(([key,value])=>Object.hasOwn(pack.sources,key)&&!same(value,pack.sources[key])))return reject('source_mismatch');
 const binding=pack.bindings.find(b=>b.entranceId===e.id);
 if(!result.field||result.field.status!=='available'||result.field.name!==e.field_name||!binding||binding.fieldId!==e.field_id||binding.locationId!==e.location_id||binding.status!=='verified_direct')return reject('field_unavailable');
 if(pack.version!==3||!pack.entrances)return reject('legacy_context');
 result.record=pack.entrances.find(r=>r.field_table_record===e.field_table_record)??null;const r=result.record;
 const fields=['location_id','field_id','field_name','field_x','field_y','field_triangle','field_direction','field_table_record','field_table_byte_offset','entrance_table_id','scenario'] as const;
 if(!r||fields.some(key=>entrance[key]!==e[key])||r.entry!==e.entrance_table_id||r.scenario!==e.scenario||r.field_table_record!==(r.entry-1)*2+r.scenario||r.field_table_byte_offset!==r.field_table_record*12||(['field_id','field_name','field_x','field_y','field_triangle','field_direction','field_table_record','field_table_byte_offset'] as const).some(key=>r[key]!==e[key])||!['inside','boundary'].includes(r.status))return reject('table_mismatch');
 const calls=new Set(e.script_calls.map(c=>c.instruction_word_offset));
 const related=(pack.nativeRelations??[]).filter(n=>n.map==='WM0'&&calls.has(n.offset));
 result.relations=related.filter(n=>n.opcode===0x318&&n.entry===r.entry&&n.scenario===r.scenario&&n.fieldId===r.field_id);
 if(related.length!==result.relations.length||[...calls].some(offset=>!result.relations.some(n=>n.offset===offset)))return reject('transition_mismatch');
 if(!mesh)return reject('mesh_unavailable');
 if(!walkmeshSources||['flevel.lgp','maplist'].some(k=>!same(walkmeshSources[k],pack.sources[k])))return reject('source_mismatch');
 const p=localPoint(mesh,r.field_triangle,[r.field_x,r.field_y]);
 if(!['inside','boundary'].includes(p.status)||p.status!==r.status||p.derivedZ===null||r.derivedZ===null||Math.abs(p.derivedZ-r.derivedZ)>1e-8)return reject('point_invalid');
 result.ok=true;result.anchor={key:'entrance:'+r.field_table_record,kind:'entrance',record:r,x:r.field_x,y:r.field_y};return result;
}

/** Topology only. A unique mutual gateway association is not spatial containment. */
export class FieldIndex {
 readonly nodes:Map<number,FieldNode>;readonly outgoing=new Map<number,SceneEdge[]>();readonly incoming=new Map<number,SceneEdge[]>();
 private components=new Map<number,number[]>();
 private direct=new Map<number,FieldBinding[]>();private related=new Map<number[],FieldBinding[]>();
 private contexts=new Map<string,{status:string;parents:string[];bindings:FieldBinding[]}>();
 constructor(readonly pack:FieldPack){
  this.nodes=new Map(pack.nodes.map(n=>[n.id,n]));for(const n of pack.nodes){this.outgoing.set(n.id,[]);this.incoming.set(n.id,[]);}for(const e of pack.edges){this.outgoing.get(e.fromField)!.push(e);this.incoming.get(e.to)!.push(e);}
  // Iterative Kosaraju: cycles are finite, no recursive stack or frame simulation.
  const seen=new Set<number>(),order:number[]=[];
  for(const id of this.nodes.keys()){if(seen.has(id))continue;const stack:[number,boolean][]=[[id,false]];while(stack.length){const [id,end]=stack.pop()!;if(end){order.push(id);continue;}if(seen.has(id))continue;seen.add(id);stack.push([id,true]);for(const e of this.outgoing.get(id)!)if(!seen.has(e.to))stack.push([e.to,false]);}}
  seen.clear();for(const id of order.reverse()){if(seen.has(id))continue;const component:number[]=[],stack=[id];while(stack.length){const id=stack.pop()!;if(seen.has(id))continue;seen.add(id);component.push(id);for(const e of this.incoming.get(id)!)if(!seen.has(e.fromField))stack.push(e.fromField);}component.sort((a,b)=>a-b);for(const n of component)this.components.set(n,component);}
  for(const b of pack.bindings){if(b.status!=='verified_direct')continue;const direct=this.direct.get(b.fieldId)??[];direct.push(b);this.direct.set(b.fieldId,direct);const component=this.components.get(b.fieldId)!;const linked=this.related.get(component)??[];linked.push(b);this.related.set(component,linked);}
  for(const e of pack.scriptEdges??[]){this.outgoing.get(e.fromField)!.push(e);this.incoming.get(e.to)!.push(e);}
 }
 context(id:number){
  const direct=this.direct.get(id)??[],component=this.components.get(id);const key=direct.length?'node:'+id:'component:'+(component?.[0]??id);const cached=this.contexts.get(key);if(cached)return cached;
  const linked=component?this.related.get(component)??[]:[];
  const bindings=direct.length?direct:linked,parents=[...new Set(bindings.map(b=>b.locationId))].sort();
  const status=parents.length>1?'ambiguous':direct.length?'verified_direct':parents.length?'verified_parent':'unresolved';
  const result={status,parents,bindings};this.contexts.set(key,result);return result;
 }
 fieldsForPlace(id:string){return [...this.nodes.values()].filter(n=>this.context(n.id).parents.includes(id));}
 connected(id:number){return [...new Set([...(this.outgoing.get(id)??[]).map(e=>e.to),...(this.incoming.get(id)??[]).map(e=>e.fromField)])];}
}
export function currentSaveField(slot:SaveSlot|null,index:FieldIndex|null){
 if(!slot||slot.status!=='valid'||slot.module!==1||!index)return null;
 const n=index.nodes.get(slot.location);return n?.status==='available'&&n.saveId===slot.location?n:null;
}

/** An authored field request becomes field_only only with exact local evidence.
 * No graph connectivity promotes an Atlas entity to a geographic anchor. */
export function resolveFieldAtlas(entity:AtlasEntity,binding:AtlasBinding,index:FieldIndex|null):AtlasBinding {
 if(entity.spatialBinding.kind!=='field_identity'||!index||index.pack.sources.maplist!==saveMaplist)return binding;
 const names=entity.spatialBinding.fieldNames??[];
 if(!names.length||names.some(name=>![...index.nodes.values()].some(n=>n.name===name&&n.status==='available')))return binding;
 return {...binding,precision:'field_only',evidence:'field_link',fieldNames:[...names],locationId:null,entranceId:null,relatedEntrances:[],relatedTransitions:[],marker:false};
}
export const spatialStatus=(precision:Precision)=>['exact_source','verified_anchor','entrance_level'].includes(precision)?'resolved':precision==='field_only'?'field_only':precision==='parent_place'?'parent_place':'unresolved';
export interface EvidenceStep {sourceType:string;sourceIdentity:string;precision:Precision;relation:'known'|'inferred'|'unresolved';reason?:string;}
/** A chain references actual directed gateway records. Mutual topology is an
 * inferred association, never geographic containment or a Field position. */
export function fieldEvidence(index:FieldIndex,id:number):EvidenceStep[]{
 const n=index.nodes.get(id);if(!n)return [{sourceType:'maplist',sourceIdentity:String(id),precision:'unresolved',relation:'unresolved',reason:'missing_destination'}];
 const result:EvidenceStep[]=[{sourceType:'maplist',sourceIdentity:`flevel.lgp / maplist[${id}] / ${n.name}`,precision:n.status==='available'?'field_only':'unresolved',relation:n.status==='available'?'known':'unresolved'}];
 if(n.scriptName)result.push({sourceType:'script_header',sourceIdentity:`${n.name} / section 1 / ${n.scriptName}`,precision:'field_only',relation:'known'});
 const incoming=new Map<number,SceneEdge|null>([[id,null]]),queue=[id];let native:NativeFieldRelation|undefined;
 for(let i=0;i<queue.length&&!native;i++){const at=queue[i];native=index.pack.nativeRelations?.find(e=>e.fieldId===at);if(native)break;for(const e of index.incoming.get(at)??[])if(!incoming.has(e.fromField)){incoming.set(e.fromField,e);queue.push(e.fromField);}}
 if(native){result.push({sourceType:'world_script',sourceIdentity:`${native.map.toLowerCase()}.ev / function ${native.function} @ ${native.offset} / ENTER_FIELD 0x318 / ${native.map}`,precision:'field_only',relation:'known',reason:'nativeContext'},{sourceType:'field_table',sourceIdentity:`field.tbl[${(native.entry-1)*2+native.scenario}] → ${index.nodes.get(native.fieldId)!.name}`,precision:'field_only',relation:'known'});
  let at=native.fieldId;while(at!==id){const e=incoming.get(at);if(!e)break;result.push({sourceType:'scene_transition',sourceIdentity:`${index.nodes.get(e.fromField)!.name} → ${index.nodes.get(e.to)!.name} / ${'gateway' in e?'section 8 gateway '+e.gateway:'section 1 MAPJUMP 0x60'} @ ${e.offset}`,precision:'field_only',relation:'known'});at=e.to;}}
 const c=index.context(id);if(c.status==='ambiguous'||!c.bindings.length){result.push({sourceType:'world_anchor',sourceIdentity:n.name,precision:'unresolved',relation:'unresolved',reason:c.status});return result;}
 const b=c.bindings[0];if(b.fieldId!==id){
  const queue=[id],previous=new Map<number,FieldEdge|null>([[id,null]]);for(let i=0;i<queue.length&&!previous.has(b.fieldId);i++)for(const e of index.pack.edges.filter(e=>e.fromField===queue[i]))if(!previous.has(e.to)){previous.set(e.to,e);queue.push(e.to);}
  const chain:FieldEdge[]=[];let at=b.fieldId;while(at!==id){const e=previous.get(at);if(!e)break;chain.push(e);at=e.fromField;}
  for(const e of chain.reverse())result.push({sourceType:'gateway',sourceIdentity:`${index.nodes.get(e.fromField)!.name} → ${index.nodes.get(e.to)!.name} / section 8 / gateway ${e.gateway} @ ${e.offset}`,precision:'field_only',relation:'known'});
  result.push({sourceType:'topology_association',sourceIdentity:b.locationId,precision:'field_only',relation:'inferred',reason:'parentNote'});
 }
 result.push({sourceType:'entrance',sourceIdentity:b.entranceId,precision:'entrance_level',relation:'known'},{sourceType:'location',sourceIdentity:b.locationId,precision:'entrance_level',relation:'known'});return result;
}
export function atlasEvidence(entity:AtlasEntity,binding:AtlasBinding,index:FieldIndex|null,poi:PoiDataset|null):EvidenceStep[]{
 const result:EvidenceStep[]=[{sourceType:'atlas_annotation',sourceIdentity:entity.id+' / '+entity.sources.join(', '),precision:binding.precision,relation:'inferred'}];
 if(binding.fieldNames.length&&index){for(const name of binding.fieldNames){const n=[...index.nodes.values()].find(n=>n.name===name);if(n)result.push(...fieldEvidence(index,n.id));}}
 if(binding.locationId&&!binding.entranceId){const location=poi?.locations.find(l=>l.id===binding.locationId);if(location)result.push({sourceType:'parent_location',sourceIdentity:location.id+' / '+location.primary_entrance,precision:binding.precision,relation:'inferred',reason:'parentNote'});}
 if(binding.entranceId){const e=poi?.entrances.find(e=>e.id===binding.entranceId);if(e){result.push({sourceType:'field_table',sourceIdentity:`field.tbl[${e.field_table_record}] / ${e.field_name}`,precision:'entrance_level',relation:'known'});for(const c of e.script_calls)result.push({sourceType:'world_script',sourceIdentity:`wm0.ev @ ${c.instruction_word_offset}`,precision:'entrance_level',relation:'known'});result.push({sourceType:'entrance',sourceIdentity:e.id,precision:'entrance_level',relation:'known'},{sourceType:'location',sourceIdentity:e.location_id,precision:'entrance_level',relation:'known'},{sourceType:'WM0_anchor',sourceIdentity:e.id+' / existing Entrance representative',precision:'entrance_level',relation:'known'});}}
 if(binding.precision==='unresolved'||!binding.marker)result.push({sourceType:'global_anchor',sourceIdentity:entity.id,precision:'unresolved',relation:'unresolved',reason:'nonGlobal'});
 return result;
}

export function fieldAliases(n:FieldNode,pack:FieldPack):string[]{
 const aliases=[String(n.id),'0x'+n.id.toString(16)];
 if(pack.sources.maplist===saveMaplist&&n.id>=88&&n.id<=91&&n.saveId===n.id&&n.scriptName==='q_'+(n.id-87))aliases.push(n.scriptName);
 return aliases;
}

/** Section 5 is a separate local domain; no geographic/projected coordinates. */
export interface WalkmeshStats {blocked:number;accessible:number;asymmetric:number;edgeMismatch:number;selfLinks:number;degenerate:number;degenerateXY:number;paddingVariants:number;}
export interface FieldWalkmesh {coordinateSpace:'FieldLocal';triangles:number;vertices:Int16Array;access:Uint16Array;stats:WalkmeshStats;}
export function localPoint(mesh:FieldWalkmesh,triangle:number,xy:readonly number[]):{status:PointStatus;derivedZ:number|null}{
 if(xy.length!==2||!xy.every(n=>Number.isInteger(n)&&n>=-32768&&n<=32767))return {status:'outside',derivedZ:null};
 if(!Number.isInteger(triangle)||triangle<0||triangle>=mesh.triangles)return {status:'invalid_triangle',derivedZ:null};
 const v=mesh.vertices,o=triangle*12,a=[v[o],v[o+1]],b=[v[o+4],v[o+5]],c=[v[o+8],v[o+9]],d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
 if(!d)return {status:'degenerate',derivedZ:null};const u=((b[1]-c[1])*(xy[0]-c[0])+(c[0]-b[0])*(xy[1]-c[1]))/d,w=((c[1]-a[1])*(xy[0]-c[0])+(a[0]-c[0])*(xy[1]-c[1]))/d;
 // Third numerator is computed independently: a rounded 1-u-w must not turn
 // an exact edge into an outside point. All XY determinants fit safe integers.
 const z=((a[1]-b[1])*(xy[0]-b[0])+(b[0]-a[0])*(xy[1]-b[1]))/d;
 return Math.min(u,w,z)<0?{status:'outside',derivedZ:null}:{status:Math.min(u,w,z)===0?'boundary':'inside',derivedZ:u*v[o+2]+w*v[o+6]+z*v[o+10]};
}
/** Independent exact integer predicate, evaluated only for this scene's lines. */
export function gatewayRelation(mesh:FieldWalkmesh,a:readonly number[],b:readonly number[],candidates?:number[]):FieldGateway['sourceRelation']{
 if([a,b].some(p=>p.length!==3||!p.every(n=>Number.isInteger(n)&&n>=-32768&&n<=32767)))return 'unknown';
 type Rat=[bigint,bigint];const fraction=(n:bigint,d:bigint):Rat=>d<0n?[-n,-d]:[n,d],less=(a:Rat,b:Rat)=>a[0]*b[1]<b[0]*a[1];
 const aa=a.map(BigInt),bb=b.map(BigInt);let xy=false,surface=false;
 for(let i=0;i<mesh.triangles;i++){
  const p=[0,1,2].map(k=>Array.from(mesh.vertices.subarray(i*12+k*4,i*12+k*4+3),BigInt)),u=p[1].map((v,k)=>v-p[0][k]),v=p[2].map((v,k)=>v-p[0][k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  if(n.every(v=>v===0n))continue;
  const clip=(x:number,y:number):[Rat,Rat]|null=>{const cross=(a:bigint[],b:bigint[],q:bigint[])=>(b[x]-a[x])*(q[y]-a[y])-(b[y]-a[y])*(q[x]-a[x]),area=cross(p[0],p[1],p[2]);
   if(!area){const r=[bb[x]-aa[x],bb[y]-aa[y]],cross2=(a:bigint[],b:bigint[])=>a[0]*b[1]-a[1]*b[0],zero:Rat=[0n,1n],one:Rat=[1n,1n],spans:[Rat,Rat][]=[];
    for(let k=0;k<3;k++){const q=p[k],end=p[(k+1)%3],s=[end[x]-q[x],end[y]-q[y]],delta=[q[x]-aa[x],q[y]-aa[y]],den=cross2(r,s);
     if(den){const t=fraction(cross2(delta,s),den),u=fraction(cross2(delta,r),den);if(!less(t,zero)&&!less(one,t)&&!less(u,zero)&&!less(one,u))spans.push([t,t]);}
     else if(r.every(v=>v===0n)){if(cross2(s,delta)===0n&&[x,y].every(i=>aa[i]>=(q[i]<end[i]?q[i]:end[i])&&aa[i]<=(q[i]>end[i]?q[i]:end[i])))spans.push([zero,one]);}
     else if(cross2(delta,r)===0n){const i=r[0]?x:y,t=fraction(q[i]-aa[i],bb[i]-aa[i]),u=fraction(end[i]-aa[i],bb[i]-aa[i]);let lo=less(t,u)?t:u,hi=less(t,u)?u:t;if(less(lo,zero))lo=zero;if(less(one,hi))hi=one;if(!less(hi,lo))spans.push([lo,hi]);}
    }return spans.length?[spans.reduce((a,b)=>less(a,b[0])?a:b[0],one),spans.reduce((a,b)=>less(a,b[1])?b[1]:a,zero)]:null;
   }
   const sign=area<0n?-1n:1n;let lo:Rat=[0n,1n],hi:Rat=[1n,1n];for(let k=0;k<3;k++){const start=sign*cross(p[k],p[(k+1)%3],aa),end=sign*cross(p[k],p[(k+1)%3],bb),delta=end-start;if(!delta){if(start<0n)return null;}else{const t=fraction(-start,delta);if(delta>0n){if(less(lo,t))lo=t;}else if(less(t,hi))hi=t;}}return less(hi,lo)?null:[lo,hi];};
  xy||=clip(0,1)!==null;const abs=(n:bigint)=>n<0n?-n:n,axis=abs(n[0])>=abs(n[1])&&abs(n[0])>=abs(n[2])?0:abs(n[1])>=abs(n[2])?1:2,axes=[0,1,2].filter(k=>k!==axis),span=clip(axes[0],axes[1]);if(!span)continue;
  const da=n.reduce((sum,n,k)=>sum+n*(aa[k]-p[0][k]),0n),db=n.reduce((sum,n,k)=>sum+n*(bb[k]-p[0][k]),0n);
  let contact=da===0n&&db===0n;if(da!==db){const t=fraction(-da,db-da);contact=!less(t,span[0])&&!less(span[1],t);}
  if(contact){surface=true;if(!candidates)return 'surface';candidates.push(i);}
 }
 return surface?'surface':xy?'xy_only':'disjoint';
}
export type FieldAnchor={key:string;kind:'entrance';record:FieldEntrance;x:number;y:number}|{key:string;kind:'segment'|'arrival';record:FieldGateway;x:number;y:number};
export function sceneAnchors(pack:FieldPack,mesh:FieldWalkmesh,id:number):FieldAnchor[]{
 const result:FieldAnchor[]=[];const agrees=(status:PointStatus,z:number|null,triangle:number,xy:number[])=>{const p=localPoint(mesh,triangle,xy);return p.status===status&&p.derivedZ!==null&&z!==null&&Math.abs(p.derivedZ-z)<1e-8;};
 for(const e of pack.entrances??[])if(e.field_id===id&&['inside','boundary'].includes(e.status)&&agrees(e.status,e.derivedZ,e.field_triangle,[e.field_x,e.field_y]))result.push({key:'entrance:'+e.field_table_record,kind:'entrance',record:e,x:e.field_x,y:e.field_y});
 for(const g of pack.gateways??[]){if(g.fromField===id){const verified={...g,sourceRelation:gatewayRelation(mesh,g.sourceA,g.sourceB)};result.push({key:'segment:'+g.fromField+':'+g.gateway,kind:'segment',record:verified,x:(g.sourceA[0]+g.sourceB[0])/2,y:(g.sourceA[1]+g.sourceB[1])/2});}
  if(g.to===id&&['inside','boundary'].includes(g.destination.status)&&agrees(g.destination.status,g.destination.derivedZ,g.targetTriangle,g.targetXY))result.push({key:'arrival:'+g.fromField+':'+g.gateway,kind:'arrival',record:g,x:g.targetXY[0],y:g.targetXY[1]});}
 return result;
}

export interface WalkmeshAccess {from:number;to:number;edge:number;offset:number;asymmetric:boolean;self:boolean;mismatch:boolean;}
export interface WalkmeshReach {start:number;ids:number[];distance:Int32Array;parent:Int32Array;parentEdge:Int8Array;}
export interface WalkmeshPath {ids:number[];steps:WalkmeshAccess[];reason:'different_wcc'|'direction'|null;}
/** One scene's raw directed Access graph. No geometric edges or reverse repairs.
 * Iterative Kosaraju and undirected traversal are O(V+E), including canonical
 * component numbering and member ordering by ascending Triangle ID.
 */
export class WalkmeshNetwork {
 readonly outgoing:number[][];readonly incoming:number[][];
 readonly wcc:{groups:number[][];labels:Int32Array};readonly scc:{groups:number[][];labels:Int32Array};readonly isolated:number[];
 private lastReach:WalkmeshReach|null=null;private contacts=new WeakMap<FieldGateway,number[]>();
 constructor(readonly mesh:FieldWalkmesh){
  const n=mesh.triangles;if(!Number.isInteger(n)||n<0||n>65535||mesh.access.length!==n*3)throw Error('Invalid walkmesh network');
  this.outgoing=Array.from({length:n},()=>[]);this.incoming=Array.from({length:n},()=>[]);
  for(let id=0;id<n;id++)for(let edge=0;edge<3;edge++){const to=mesh.access[id*3+edge];if(to===65535)continue;if(to>=n)throw Error('Invalid Access target');this.outgoing[id].push(to);this.incoming[to].push(id);}
  const normalize=(raw:Int32Array)=>{const remap=new Map<number,number>(),groups:number[][]=[],labels=new Int32Array(n);for(let id=0;id<n;id++){const old=raw[id];if(!remap.has(old)){remap.set(old,groups.length);groups.push([]);}const c=remap.get(old)!;labels[id]=c;groups[c].push(id);}return {groups,labels};};
  const weak=new Int32Array(n).fill(-1);let component=0;
  for(let id=0;id<n;id++)if(weak[id]===-1){weak[id]=component;const stack=[id];while(stack.length){const at=stack.pop()!;for(const to of [...this.outgoing[at],...this.incoming[at]])if(weak[to]===-1){weak[to]=component;stack.push(to);}}component++;}
  this.wcc=normalize(weak);this.isolated=this.wcc.groups.filter(g=>g.length===1).map(g=>g[0]);
  const seen=new Uint8Array(n),order:number[]=[];
  for(let id=0;id<n;id++)if(!seen[id]){seen[id]=1;const stack:[number,number][]=[[id,0]];while(stack.length){const frame=stack[stack.length-1],edges=this.outgoing[frame[0]];if(frame[1]===edges.length){order.push(frame[0]);stack.pop();continue;}const to=edges[frame[1]++];if(!seen[to]){seen[to]=1;stack.push([to,0]);}}}
  const strong=new Int32Array(n).fill(-1);component=0;
  for(let i=order.length-1;i>=0;i--){const id=order[i];if(strong[id]!==-1)continue;strong[id]=component;const stack=[id];while(stack.length){const at=stack.pop()!;for(const to of this.incoming[at])if(strong[to]===-1){strong[to]=component;stack.push(to);}}component++;}
  this.scc=normalize(strong);
 }
 valid(id:number){return Number.isInteger(id)&&id>=0&&id<this.mesh.triangles;}
 reach(start:number):WalkmeshReach {
  if(!this.valid(start))throw Error('Invalid start Triangle ID');if(this.lastReach?.start===start)return this.lastReach;
  const n=this.mesh.triangles,distance=new Int32Array(n).fill(-1),parent=new Int32Array(n).fill(-1),parentEdge=new Int8Array(n).fill(-1),queue=[start];distance[start]=0;
  // Equal-length paths follow original Access slot order 0,1,2, never a
  // guessed geometric route. Indexed queue avoids quadratic array shifts.
  for(let i=0;i<queue.length;i++){const at=queue[i];for(let edge=0;edge<3;edge++){const to=this.mesh.access[at*3+edge];if(to===65535||distance[to]!==-1)continue;distance[to]=distance[at]+1;parent[to]=at;parentEdge[to]=edge;queue.push(to);}}
  const ids:number[]=[];for(let i=0;i<n;i++)if(distance[i]>=0)ids.push(i);return this.lastReach={start,ids,distance,parent,parentEdge};
 }
 path(start:number,end:number):WalkmeshPath {
  if(!this.valid(end))throw Error('Invalid end Triangle ID');const r=this.reach(start);
  if(r.distance[end]===-1)return {ids:[],steps:[],reason:this.wcc.labels[start]!==this.wcc.labels[end]?'different_wcc':'direction'};
  const ids=[end],steps:WalkmeshAccess[]=[];for(let at=end;at!==start;at=r.parent[at]){steps.push(this.evidence(r.parent[at],r.parentEdge[at]));ids.push(r.parent[at]);}return {ids:ids.reverse(),steps:steps.reverse(),reason:null};
 }
 evidence(from:number,edge:number):WalkmeshAccess {
  if(!this.valid(from)||!Number.isInteger(edge)||edge<0||edge>2)throw Error('Invalid Access record');const m=this.mesh,to=m.access[from*3+edge];if(to===65535)throw Error('Blocked Access record');
  const point=(id:number,k:number)=>Array.from(m.vertices.subarray(id*12+k*4,id*12+k*4+3)),equal=(a:number[],b:number[])=>a.every((n,i)=>n===b[i]),a=point(from,edge),b=point(from,(edge+1)%3);
  const mismatch=![0,1,2].some(k=>{const c=point(to,k),d=point(to,(k+1)%3);return equal(a,c)&&equal(b,d)||equal(a,d)&&equal(b,c);});
  return {from,to,edge,offset:4+m.triangles*24+(from*3+edge)*2,asymmetric:!this.outgoing[to].includes(from),self:to===from,mismatch};
 }
 gateway(g:FieldGateway):number[]{
  if(g.sourceRelation!=='surface')return [];const cached=this.contacts.get(g);if(cached)return cached;const candidates:number[]=[];gatewayRelation(this.mesh,g.sourceA,g.sourceB,candidates);this.contacts.set(g,candidates);return candidates;
 }
}
export function decodeWalkmesh(buffer:ArrayBuffer):FieldWalkmesh{
 const v=new DataView(buffer);if(v.byteLength<4)throw Error('Truncated walkmesh');const count=v.getUint32(0,true);
 if(count>65535||v.byteLength!==4+count*30)throw Error('Walkmesh count/size limit');
 const vertices=new Int16Array(count*12),access=new Uint16Array(count*3);
 for(let i=0;i<vertices.length;i++)vertices[i]=v.getInt16(4+i*2,true);
 for(let i=0;i<access.length;i++){const n=v.getUint16(4+count*24+i*2,true);if(n!==65535&&n>=count)throw Error('Walkmesh adjacency bounds');access[i]=n;}
 const stats:WalkmeshStats={blocked:0,accessible:0,asymmetric:0,edgeMismatch:0,selfLinks:0,degenerate:0,degenerateXY:0,paddingVariants:0};
 const point=(i:number,k:number)=>Array.from(vertices.subarray(i*12+k*4,i*12+k*4+3));
 const equal=(a:number[],b:number[])=>a.every((v,i)=>v===b[i]);
 for(let i=0;i<count;i++){
  const p=[point(i,0),point(i,1),point(i,2)],a=p[1].map((v,j)=>v-p[0][j]),b=p[2].map((v,j)=>v-p[0][j]);const c=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  stats.degenerate+=Number(c.every(v=>v===0));stats.degenerateXY+=Number(c[2]===0);for(let k=0;k<3;k++)stats.paddingVariants+=Number(vertices[i*12+k*4+3]!==vertices[i*12+2]);
  for(let k=0;k<3;k++){const n=access[i*3+k];if(n===65535){stats.blocked++;continue;}stats.accessible++;stats.asymmetric+=Number(!access.subarray(n*3,n*3+3).includes(i));stats.selfLinks+=Number(n===i);
   const a=p[k],b=p[(k+1)%3];stats.edgeMismatch+=Number(![0,1,2].some(j=>{const u=point(n,j),w=point(n,(j+1)%3);return equal(a,u)&&equal(b,w)||equal(a,w)&&equal(b,u);}));
  }
 }
 return {coordinateSpace:'FieldLocal',triangles:count,vertices,access,stats};
}
export interface WalkmeshScene extends Partial<WalkmeshStats>{fieldId:number;status:'available'|'corrupt';offset?:number;bytes?:number;triangles?:number;}
export function parseWalkmeshHeader(buffer:ArrayBuffer,total:number,fields:FieldPack){
 const v=new DataView(buffer);if(total>32_000_000||v.byteLength<16||new TextDecoder().decode(buffer.slice(0,8))!=='GAIAFLD\0'||v.getUint32(8,true)!==1)throw Error('Walkmesh pack header');
 const length=v.getUint32(12,true),base=16+length;if(length>512_000||base>total||v.byteLength!==base)throw Error('Walkmesh metadata bounds');
 const m=shape(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.slice(16))),['schema','version','coordinateSpace','generator_revision','sources','scenes']);
 if(m.schema!=='gaiagis-field-walkmesh'||m.version!==1||m.coordinateSpace!=='FieldLocal'||m.generator_revision!=='field-walkmesh-1')throw Error('Walkmesh schema/revision');
 const sources=shape(m.sources,['flevel.lgp','maplist']);if(Object.entries(sources).some(([k,h])=>h!==fields.sources[k]))throw Error('Walkmesh Field source identity mismatch');
 const scenes=new Map<number,WalkmeshScene>();let end=0;const statsKeys=Object.keys({blocked:0,accessible:0,asymmetric:0,edgeMismatch:0,selfLinks:0,degenerate:0,degenerateXY:0,paddingVariants:0});
 for(const value of list(m.scenes,2000)){const r=value as WalkmeshScene,o=shape(value,['fieldId','status',...(r.status==='available'?['offset','bytes','triangles',...statsKeys]:[])]);
  if(!integer(o.fieldId)||scenes.has(r.fieldId)||!fields.nodes.some(n=>n.id===r.fieldId&&n.status==='available')||!['available','corrupt'].includes(r.status))throw Error('Walkmesh scene identity');
  if(r.status==='available'){if(!integer(r.triangles)||r.offset!==end||r.bytes!==4+r.triangles!*30||statsKeys.some(k=>!integer(o[k],196605))||Number(o.blocked)+Number(o.accessible)!==r.triangles!*3||base+end+r.bytes!>total)throw Error('Walkmesh scene span/statistics');end+=r.bytes!;}scenes.set(r.fieldId,r);
 }
 if(base+end!==total)throw Error('Walkmesh trailing/unindexed bytes');return {base,scenes,sources:sources as Record<string,string>};
}
/** Keep one File handle; only the selected raw Section 5 is decoded, no database. */
export async function openWalkmeshPack(file:File,fields:FieldPack){
 if(file.name!=='gaia-field-walkmesh.bin'||file.size>32_000_000||file.size<16)throw Error('Walkmesh file bounds');
 const head=new DataView(await file.slice(0,16).arrayBuffer()),length=head.getUint32(12,true);if(length>512_000||16+length>file.size)throw Error('Walkmesh metadata limit');
 const header=parseWalkmeshHeader(await file.slice(0,16+length).arrayBuffer(),file.size,fields);
 return {scenes:header.scenes,sources:header.sources,async decode(id:number){const r=header.scenes.get(id);if(!r||r.status!=='available')throw Error('Walkmesh unavailable');const mesh=decodeWalkmesh(await file.slice(header.base+r.offset!,header.base+r.offset!+r.bytes!).arrayBuffer());if(mesh.triangles!==r.triangles||Object.entries(mesh.stats).some(([k,v])=>r[k as keyof WalkmeshStats]!==v))throw Error('Walkmesh statistics mismatch');return mesh;}};
}
