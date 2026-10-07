// SPDX-License-Identifier: GPL-3.0-only
import type {PoiDataset} from './poi';
import type {SaveSlot} from './save';

export interface FieldNode {id:number;name:string;status:'available'|'missing'|'corrupt';saveId:number|null;}
export interface FieldEdge {fromField:number;to:number;gateway:number;offset:number;}
export interface FieldBinding {entranceId:string;locationId:string;fieldId:number;status:'verified_direct'|'unresolved';}
export interface FieldPack {
 schema:'gaiagis-field-context';version:1;coordinateSpace:'FieldLocalIdentity';archive:'flevel.lgp';sources:Record<string,string>;
 nodes:FieldNode[];edges:FieldEdge[];exits:(FieldEdge&{name:string})[];
 unresolved:{fromField:number;to:number|null;gateway:number|null;reason:'invalid_section'|'missing_destination'}[];
 bindings:FieldBinding[];scriptTransitions:'unverified';
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
 const d=shape(value,['schema','version','coordinateSpace','archive','sources','nodes','edges','exits','unresolved','bindings','scriptTransitions']);
 if(d.schema!=='gaiagis-field-context'||d.version!==1||d.coordinateSpace!=='FieldLocalIdentity'||d.archive!=='flevel.lgp'||d.scriptTransitions!=='unverified')fail();
 if(!d.sources||typeof d.sources!=='object'||Array.isArray(d.sources))fail();const sources=d.sources as Record<string,unknown>;
 if(Object.keys(sources).length>32||!['flevel.lgp','maplist','field.tbl','wm0.ev','wm0.map'].every(k=>Object.hasOwn(sources,k))||!Object.entries(sources).every(([k,v])=>/^[a-z0-9_.-]{1,80}$/.test(k)&&typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)))fail();
 const ids=new Map<number,FieldNode>(),names=new Set<string>();
 for(const value of list(d.nodes,2000)){const n=shape(value,['id','name','status','saveId']);if(!integer(n.id)||!text(n.name)||String(n.name).length>32||(n.name==='dummy'||/^wm\d+$/.test(String(n.name)))||!['available','missing','corrupt'].includes(String(n.status))||ids.has(Number(n.id))||names.has(String(n.name).toLowerCase()))fail();if(n.saveId!==null&&(n.saveId!==n.id||n.status!=='available'||sources.maplist!==saveMaplist||saveConflicts.has(Number(n.id))))fail();ids.set(Number(n.id),n as unknown as FieldNode);names.add(String(n.name).toLowerCase());}
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
 const bindings=new Set<string>();for(const value of list(d.bindings,10000)){const b=shape(value,['entranceId','locationId','fieldId','status']);if(!text(b.entranceId)||!text(b.locationId)||!integer(b.fieldId)||!['verified_direct','unresolved'].includes(String(b.status))||b.status==='verified_direct'&&!valid(b.fieldId)||bindings.has(String(b.entranceId)))fail();bindings.add(String(b.entranceId));}
 return d as unknown as FieldPack;
}
export function validateFieldPoi(pack:FieldPack,poi:PoiDataset){
 if(Object.entries(poi.sources).some(([key,hash])=>pack.sources[key]!==hash)||pack.bindings.length!==poi.entrances.length)throw Error('Field/POI source identity mismatch');
 for(const e of poi.entrances){const b=pack.bindings.find(b=>b.entranceId===e.id),n=pack.nodes.find(n=>n.id===e.field_id),verified=n?.status==='available'&&n.name===e.field_name&&e.source_kind==='derived_from_entry_trigger'&&e.script_calls.length>0&&e.world_map===0;
  if(!b||b.locationId!==e.location_id||b.fieldId!==e.field_id||b.status!==(verified?'verified_direct':'unresolved'))throw Error('Field entrance identity mismatch');
 }
}

/** Topology only. A unique mutual gateway association is not spatial containment. */
export class FieldIndex {
 readonly nodes:Map<number,FieldNode>;readonly outgoing=new Map<number,FieldEdge[]>();readonly incoming=new Map<number,FieldEdge[]>();
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
