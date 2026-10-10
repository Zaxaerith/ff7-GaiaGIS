// SPDX-License-Identifier: GPL-3.0-only
import type {PoiDataset} from './poi';
import type {AtlasEntity,AtlasBinding,Precision} from './atlas';
import type {SaveSlot} from './save';

export interface FieldNode {id:number;name:string;status:'available'|'missing'|'corrupt';saveId:number|null;scriptName?:string|null;}
export interface FieldEdge {fromField:number;to:number;gateway:number;offset:number;}
export interface FieldScriptEdge {fromField:number;to:number;opcode:96;offset:number;}
export type SceneEdge=FieldEdge|FieldScriptEdge;
export interface NativeFieldRelation {map:'WM0'|'WM2'|'WM3';fieldId:number;entry:number;scenario:number;function:number;offset:number;opcode:792;}
export interface FieldBinding {entranceId:string;locationId:string;fieldId:number;status:'verified_direct'|'unresolved';}
export interface FieldPack {
 schema:'gaiagis-field-context';version:1|2;coordinateSpace:'FieldLocalIdentity';archive:'flevel.lgp';sources:Record<string,string>;
 nodes:FieldNode[];edges:FieldEdge[];exits:(FieldEdge&{name:string})[];
 unresolved:{fromField:number;to:number|null;gateway:number|null;reason:'invalid_section'|'missing_destination'}[];
 bindings:FieldBinding[];scriptTransitions:'unverified'|'bounded_mapjump';
 scriptEdges?:FieldScriptEdge[];scriptExits?:(FieldScriptEdge&{name:string})[];scriptUnresolved?:{fromField:number;offset:number|null;reason:'invalid_script'|'unsupported_opcode'|'unverified_boundary'|'missing_destination'}[];nativeRelations?:NativeFieldRelation[];
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
 const v2=(value as {version?:unknown})?.version===2;
 const d=shape(value,['schema','version','coordinateSpace','archive','sources','nodes','edges','exits','unresolved','bindings','scriptTransitions',...(v2?['scriptEdges','scriptExits','scriptUnresolved','nativeRelations']:[])]);
 if(d.schema!=='gaiagis-field-context'||![1,2].includes(Number(d.version))||d.coordinateSpace!=='FieldLocalIdentity'||d.archive!=='flevel.lgp'||d.scriptTransitions!==(v2?'bounded_mapjump':'unverified'))fail();
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
 if(base+end!==total)throw Error('Walkmesh trailing/unindexed bytes');return {base,scenes};
}
/** Keep one File handle; only the selected raw Section 5 is decoded, no database. */
export async function openWalkmeshPack(file:File,fields:FieldPack){
 if(file.name!=='gaia-field-walkmesh.bin'||file.size>32_000_000||file.size<16)throw Error('Walkmesh file bounds');
 const head=new DataView(await file.slice(0,16).arrayBuffer()),length=head.getUint32(12,true);if(length>512_000||16+length>file.size)throw Error('Walkmesh metadata limit');
 const header=parseWalkmeshHeader(await file.slice(0,16+length).arrayBuffer(),file.size,fields);
 return {scenes:header.scenes,async decode(id:number){const r=header.scenes.get(id);if(!r||r.status!=='available')throw Error('Walkmesh unavailable');const mesh=decodeWalkmesh(await file.slice(header.base+r.offset!,header.base+r.offset!+r.bytes!).arrayBuffer());if(mesh.triangles!==r.triangles||Object.entries(mesh.stats).some(([k,v])=>r[k as keyof WalkmeshStats]!==v))throw Error('Walkmesh statistics mismatch');return mesh;}};
}
