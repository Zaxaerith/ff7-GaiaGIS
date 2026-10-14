// SPDX-License-Identifier: GPL-3.0-only
import type {FieldPack,FieldWalkmesh,WalkmeshReach} from './fieldContext';
import {inflateVisual} from './fieldCamera';

export interface InteractionGeometry {
 relation:'surface'|'xy_only'|'disjoint'|'unknown';candidates:number[];xyCandidates:number[];coplanar:number[];vertical:number[];
 zeroLength:boolean;zeroXY:boolean;rawZGap:string|null;rawZTriangle:number|null;
}
export interface InteractionOwner {actor:number;name:string|null;slot:number;entry:number;kind:'table'|'main';}
export interface InteractionRecord {
 kind:'trigger'|'line'|'linon'|'sline';key:string;offset:number;raw:string;
 a?:number[];b?:number[];geometry?:InteractionGeometry;slot?:number;group?:number;state?:number;behavior?:number;sound?:number;classification?:'record'|'unknown';
 background?:{status:'matched'|'no_match'|'unknown';reason:string|null;matches:{group:number;mask:number;layer:number;count:number;firstOffset:number}[]};
 opcode?:number;owners?:InteractionOwner[];entryReachable?:boolean;static?:boolean;switch?:number;banks?:number[];operands?:number[];lineOffsets?:number[];
}
export interface InteractionScene {
 fieldId:number;name:string;triangles:number;meshReason:string|null;section1Bytes:number;section8Bytes:number;
 section1SHA256:string;section8SHA256:string;section5SHA256:string|null;unusedTriggers:number;
 triggers:InteractionRecord[];scripts:InteractionRecord[];records:InteractionRecord[];
 stops:{offset:number|null;opcode:number|null;reason:string;entryReachable:boolean}[];
}
interface SceneSpan {fieldId:number;name:string;triangles:number;section5SHA256:string|null;offset:number;bytes:number;rawBytes:number;sha256:string;}
const integer=(v:unknown,lo=0,hi=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=lo&&Number(v)<=hi;
const fingerprint=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const shape=(v:unknown,required:string[],optional:string[]=[])=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Interaction object');
 const r=v as Record<string,any>;if(required.some(k=>!Object.hasOwn(r,k))||Object.keys(r).some(k=>![...required,...optional].includes(k)))throw Error('Interaction shape');return r;
};
const list=(v:unknown,max:number):any[]=>{if(!Array.isArray(v)||v.length>max)throw Error('Interaction list budget');return v;};
const vec=(v:unknown,n:number,lo=-32768,hi=32767)=>Array.isArray(v)&&v.length===n&&v.every(x=>integer(x,lo,hi));
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const raw=(v:unknown,size:number)=>{
 if(typeof v!=='string'||v.length!==size*2||!/^[a-f0-9]+$/.test(v))throw Error('Interaction record bytes');
 return new DataView(Uint8Array.from(v.match(/../g)!,s=>parseInt(s,16)).buffer);
};
const xyz=(v:DataView,at:number)=>[0,1,2].map(k=>v.getInt16(at+k*2,true));
const hash=async(v:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',v as Uint8Array<ArrayBuffer>)),n=>n.toString(16).padStart(2,'0')).join('');

export function parseInteractionHeader(buffer:ArrayBuffer,total:number,fields:FieldPack){
 const v=new DataView(buffer);if(total>8_000_000||v.byteLength<16||new TextDecoder().decode(buffer.slice(0,8))!=='GAIAINT\0'||v.getUint32(8,true)!==1)throw Error('Interaction header');
 const length=v.getUint32(12,true),base=16+length;if(length>512_000||base>total||v.byteLength!==base)throw Error('Interaction metadata bounds');
 const meta=shape(JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(buffer.slice(16))),['schema','version','coordinateSpace','generator_revision','sources','scenes']);
 if(meta.schema!=='gaiagis-field-interaction'||meta.version!==1||meta.coordinateSpace!=='FieldLocal'||meta.generator_revision!=='field-interaction-1')throw Error('Interaction schema');
 const sources=shape(meta.sources,['flevel.lgp','maplist']);if(Object.entries(sources).some(([k,h])=>!fingerprint(h)||h!==fields.sources[k]))throw Error('Interaction source identity mismatch');
 const scenes=new Map<number,SceneSpan>();let end=0;
 for(const value of list(meta.scenes,2000)){
  const r=shape(value,['fieldId','name','triangles','section5SHA256','offset','bytes','rawBytes','sha256']);
  if(!integer(r.fieldId,0,65535)||scenes.has(r.fieldId)||!fields.nodes.some(n=>n.id===r.fieldId&&n.name===r.name&&n.status==='available')||!integer(r.triangles,0,65535)||r.section5SHA256!==null&&!fingerprint(r.section5SHA256)||!fingerprint(r.sha256))throw Error('Interaction scene identity');
  if(r.offset!==end||!integer(r.bytes,1,2_000_000)||!integer(r.rawBytes,1,2_000_000)||base+end+r.bytes>total)throw Error('Interaction scene span');
  end+=r.bytes;scenes.set(r.fieldId,r as SceneSpan);
 }
 if(base+end!==total)throw Error('Interaction trailing bytes');return {base,scenes,sources:sources as Record<string,string>};
}

function geometry(value:unknown,r:InteractionRecord,triangles:number,meshReason:string|null){
 const g=shape(value,['relation','candidates','xyCandidates','coplanar','vertical','zeroLength','zeroXY','rawZGap','rawZTriangle']);
 if(!['surface','xy_only','disjoint','unknown'].includes(g.relation)||typeof g.zeroLength!=='boolean'||typeof g.zeroXY!=='boolean'||g.zeroLength!==same(r.a!,r.b!)||g.zeroXY!==same(r.a!.slice(0,2),r.b!.slice(0,2)))throw Error('Interaction geometry');
 for(const key of ['candidates','xyCandidates','coplanar','vertical']){
  const ids=list(g[key],65535);if(ids.some((id,i)=>!integer(id,0,triangles-1)||i>0&&ids[i-1]>=id))throw Error('Interaction candidate identity');
 }
 if(g.candidates.some((id:number)=>!g.xyCandidates.includes(id))||g.coplanar.some((id:number)=>!g.candidates.includes(id))||g.vertical.some((id:number)=>!g.xyCandidates.includes(id)))throw Error('Interaction candidate relation');
 if(g.relation==='surface'&&!g.candidates.length||g.relation==='xy_only'&&(g.candidates.length||!g.xyCandidates.length)||g.relation==='disjoint'&&(g.candidates.length||g.xyCandidates.length)||g.relation==='unknown'&&(!meshReason||g.candidates.length||g.xyCandidates.length))throw Error('Interaction classification');
 if(g.rawZGap!==null&&(typeof g.rawZGap!=='string'||g.rawZGap.length>64||!/^\d+(?:\/[1-9]\d*)?$/.test(g.rawZGap))||g.rawZTriangle!==null&&(!integer(g.rawZTriangle,0,triangles-1)||!g.xyCandidates.includes(g.rawZTriangle))||(g.rawZGap===null)!==(g.rawZTriangle===null))throw Error('Interaction Raw Z gap');
 return g as InteractionGeometry;
}

export function parseInteractionScene(value:unknown,span:SceneSpan):InteractionScene {
 const scene=shape(value,['fieldId','name','triangles','meshReason','section1Bytes','section8Bytes','section1SHA256','section8SHA256','section5SHA256','unusedTriggers','triggers','scripts','stops']);
 if(scene.fieldId!==span.fieldId||scene.name!==span.name||scene.triangles!==span.triangles||scene.section5SHA256!==span.section5SHA256||!fingerprint(scene.section1SHA256)||!fingerprint(scene.section8SHA256)||!integer(scene.section1Bytes,32,8_000_000)||![536,740].includes(scene.section8Bytes)||![null,'mesh_unavailable'].includes(scene.meshReason)||!integer(scene.unusedTriggers,0,12))throw Error('Interaction payload identity');
 const triggers:InteractionRecord[]=[],scripts:InteractionRecord[]=[];let slot=-1,offset=-1,ownerBudget=0;
 for(const value of list(scene.triggers,12)){
  const r=shape(value,['slot','offset','raw','a','b','group','state','behavior','sound','classification','geometry','background']);
  if(!integer(r.slot,0,11)||r.slot<=slot||r.offset!==344+r.slot*16||['group','state','behavior','sound'].some(k=>!integer(r[k],0,255))||!vec(r.a,3)||!vec(r.b,3))throw Error('Trigger fields');slot=r.slot;
  const v=raw(r.raw,16);if(r.raw==='000000000000000000000000ff000000'||!same(xyz(v,0),r.a)||!same(xyz(v,6),r.b)||['group','state','behavior','sound'].some((k,i)=>r[k]!==v.getUint8(12+i))||r.classification!==(r.group===255||r.behavior>5||r.raw==='0'.repeat(32)?'unknown':'record'))throw Error('Trigger original record');
  const b=shape(r.background,['status','matches','reason']);if(!['matched','no_match','unknown'].includes(b.status)||b.reason!==null&&(typeof b.reason!=='string'||!b.reason.length||b.reason.length>256))throw Error('Trigger background status');
  for(const value of list(b.matches,16384)){
   const m=shape(value,['group','mask','layer','count','firstOffset']);if(m.group!==r.group||r.state>=8||!integer(m.mask,1,255)||!(m.mask&(1<<r.state))||!integer(m.layer,1,3)||!integer(m.count,1,16384)||!integer(m.firstOffset,0,8_000_000))throw Error('Trigger background mask');
  }
  if((b.status==='matched')!==!!b.matches.length||(b.status==='unknown')!==!!b.reason)throw Error('Trigger background evidence');
  r.geometry=geometry(r.geometry,r as InteractionRecord,scene.triangles,scene.meshReason);triggers.push({...r,kind:'trigger',key:'trigger:'+r.slot} as InteractionRecord);
 }
 if(triggers.length+scene.unusedTriggers!==12)throw Error('Trigger slot accounting');
 for(const value of list(scene.scripts,4096)){
  const opcode=(value as {opcode?:number})?.opcode,kind=opcode===208?'line':opcode===209?'linon':opcode===211?'sline':null;if(!kind)throw Error('Interaction opcode');
  const staticLine=kind==='line'||kind==='sline'&&(value as {static?:boolean}).static===true;
  const r=shape(value,['opcode','offset','raw','owners','entryReachable',...(kind==='linon'?['switch','lineOffsets']:kind==='line'?['a','b','static','geometry']:['banks','operands','static','lineOffsets',...(staticLine?['a','b','geometry']:[])])]);
  const size=kind==='line'?13:kind==='linon'?2:16;
  if(!integer(r.offset,0,65535-size)||r.offset<=offset||r.offset+size>scene.section1Bytes||r.entryReachable!==true)throw Error('Interaction instruction offset');offset=r.offset;
  const v=raw(r.raw,size);if(v.getUint8(0)!==opcode)throw Error('Interaction raw opcode');
  const owners=list(r.owners,2112),seen=new Set<string>();ownerBudget+=owners.length;if(!owners.length||ownerBudget>65536)throw Error('Interaction owner budget');
  for(const value of owners){const o=shape(value,['actor','name','slot','entry','kind']),key=[o.actor,o.slot,o.entry,o.kind].join(':');if(!integer(o.actor,0,63)||!integer(o.slot,0,31)||!integer(o.entry,0,Math.min(65535,scene.section1Bytes-1))||!['table','main'].includes(o.kind)||o.kind==='main'&&o.slot!==0||o.name!==null&&(typeof o.name!=='string'||o.name.length>8||!/^[\x20-\x7e]*$/.test(o.name))||seen.has(key))throw Error('Interaction entry owner');seen.add(key);}
  if(kind==='linon'){if(r.switch!==v.getUint8(1))throw Error('LINON parameter');}
  else if(kind==='sline'){
   const banks=[1,2,3].flatMap(at=>[v.getUint8(at)>>4,v.getUint8(at)&15]),operands=[...xyz(v,4),...xyz(v,10)];
   if(!vec(r.banks,6,0,15)||!vec(r.operands,6)||!same(banks,r.banks)||!same(operands,r.operands)||r.static!==banks.every(n=>n===0))throw Error('SLINE literal/bank classification');
   if(staticLine&&(!vec(r.a,3)||!vec(r.b,3)||!same(r.a,operands.slice(0,3))||!same(r.b,operands.slice(3))))throw Error('SLINE original coordinates');
  }else if(r.static!==true||!vec(r.a,3)||!vec(r.b,3)||!same(r.a,xyz(v,1))||!same(r.b,xyz(v,7)))throw Error('LINE original coordinates');
  if(staticLine){if(!vec(r.a,3)||!vec(r.b,3))throw Error('Interaction XYZ');r.geometry=geometry(r.geometry,r as InteractionRecord,scene.triangles,scene.meshReason);}
  scripts.push({...r,kind,key:kind+':'+r.offset} as InteractionRecord);
 }
 const lines=scripts.filter(r=>r.kind==='line');for(const r of scripts){if(r.kind==='line')continue;const related=lines.filter(line=>line.owners!.some(a=>r.owners!.some(b=>a.actor===b.actor))).map(line=>line.offset);if(!same(list(r.lineOffsets,4096),related))throw Error('Interaction LINE ownership link');}
 for(const value of list(scene.stops,4096)){const s=shape(value,['offset','opcode','reason','entryReachable']);if(typeof s.entryReachable!=='boolean'||!['unsupported_opcode','unverified_boundary','invalid_script'].includes(s.reason)||(s.reason==='invalid_script'?(s.offset!==null||s.opcode!==null||scripts.length>0):(!integer(s.offset,0,Math.min(65535,scene.section1Bytes-1))||!integer(s.opcode,0,255))))throw Error('Interaction script stop');}
 return {...scene,triggers,scripts,records:[...triggers,...scripts]} as InteractionScene;
}

export async function openFieldInteraction(file:File,fields:FieldPack){
 if(file.name!=='gaia-field-interaction.bin'||file.size<16||file.size>8_000_000)throw Error('Interaction file bounds');
 const v=new DataView(await file.slice(0,16).arrayBuffer()),length=v.getUint32(12,true);if(length>512_000||16+length>file.size)throw Error('Interaction metadata budget');
 const header=parseInteractionHeader(await file.slice(0,16+length).arrayBuffer(),file.size,fields);
 return {scenes:header.scenes,sources:header.sources,async decode(id:number,mesh:FieldWalkmesh,signal?:AbortSignal){
  signal?.throwIfAborted();
  const span=header.scenes.get(id);if(!span||span.triangles!==mesh.triangles||!span.section5SHA256)throw Error('Interaction Walkmesh identity');
  const raw=new Uint8Array(4+mesh.triangles*30),v=new DataView(raw.buffer);v.setUint32(0,mesh.triangles,true);mesh.vertices.forEach((n,i)=>v.setInt16(4+i*2,n,true));mesh.access.forEach((n,i)=>v.setUint16(4+mesh.triangles*24+i*2,n,true));
  if(await hash(raw)!==span.section5SHA256)throw Error('Interaction Walkmesh fingerprint mismatch');
  signal?.throwIfAborted();const compressed=await file.slice(header.base+span.offset,header.base+span.offset+span.bytes).arrayBuffer();signal?.throwIfAborted();
  const bytes=await inflateVisual(compressed,span.rawBytes,signal);
  if(await hash(bytes)!==span.sha256)throw Error('Interaction scene fingerprint mismatch');
  signal?.throwIfAborted();
  return parseInteractionScene(JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes)),span);
 }};
}

/** A raw XYZ contact is evidence; it never decides enabled/gameplay state. */
export function interactionReach(record:InteractionRecord,reach:WalkmeshReach|null){
 const geometry=record.geometry;if(!geometry||geometry.relation!=='surface'||!geometry.candidates.length)return {status:'unknown' as const,reachable:[],unreachable:[]};
 if(!reach)return {status:'not_analyzed' as const,reachable:[],unreachable:[]};
 const reachable=geometry.candidates.filter(id=>reach.distance[id]>=0),unreachable=geometry.candidates.filter(id=>reach.distance[id]<0);
 return {status:reachable.length?'connected' as const:'notConnected' as const,reachable,unreachable};
}
