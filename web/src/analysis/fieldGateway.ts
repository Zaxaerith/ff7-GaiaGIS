// SPDX-License-Identifier: GPL-3.0-only
import {FieldIndex,WalkmeshNetwork,localPoint,validateWorldEntrance} from '../data/fieldContext';
import type {FieldGateway,FieldWalkmesh,WalkmeshAccess,openWalkmeshPack} from '../data/fieldContext';
import type {PoiDataset} from '../data/poi';
import {assertSourceAgreement} from '../data/sourceRoles';

export type GatewayStart={kind:'world';entranceId:string}|{kind:'arrival';fromField:number;gateway:number};
export interface GatewayIdentity {contextSHA256:string;walkmeshSHA256:string;generation:number;archive:string;sources:Record<string,string>;}
export type GatewayPack=Awaited<ReturnType<typeof openWalkmeshPack>>;
export interface GatewayPoint {fieldId:number;triangle:number;xy:readonly number[];derivedZ:number;}
export interface GatewayLeg {
 fromField:number;startTriangle:number;endTriangle:number;triangles:number[];access:WalkmeshAccess[];
 gateway:FieldGateway;candidates:number[];reachableCandidates:number[];arrival:GatewayPoint;
}
export interface GatewayState extends GatewayPoint {identity:GatewayIdentity;depth:number;parent:number|null;leg:GatewayLeg|null;}
export type GatewayReason='xy_only'|'disjoint'|'unknown'|'world_exit'|'target_invalid'|'mesh_unavailable'|'field_unavailable'|'source_mismatch'|'different_wcc'|'direction'|'access_mismatch';
export interface GatewayDiagnostic {fieldId:number;triangle:number;gateway:number;to:number;reason:GatewayReason;candidates:number[];}
export interface GatewayResult {
 status:'success'|'unreachable'|'limit'|'invalid_start'|'invalid_target'|'mesh_unavailable'|'source_mismatch'|'superseded';
 identity:GatewayIdentity;start:GatewayStart;targetField:number;maxTransfers:number;states:GatewayState[];legs:GatewayLeg[];
 diagnostics:GatewayDiagnostic[];counts:Partial<Record<GatewayReason,number>>;revisited:number;milliseconds:number;
}
export interface GatewayResources {
 index:FieldIndex;poi:PoiDataset|null;pack:GatewayPack;identity:GatewayIdentity;current:()=>boolean;
 decode?:(fieldId:number)=>Promise<FieldWalkmesh>;network?:(mesh:FieldWalkmesh)=>WalkmeshNetwork;
}
type Scene={mesh:FieldWalkmesh;network:WalkmeshNetwork};
type Gate={ok:true;candidates:number[];arrival:GatewayPoint}|{ok:false;reason:GatewayReason};
class GatewayError extends Error{constructor(readonly status:'source_mismatch'|'superseded'|'mesh_unavailable'|'invalid_start'){super(status);}}
const validPoint=(status:string)=>status==='inside'||status==='boundary';
const hash=(v:string)=>/^[a-f0-9]{64}$/.test(v);
/** Bounded composition of existing directed Access paths. No new routing graph. */
export class FieldGatewayNetwork {
 private scenes=new Map<number,Promise<Scene>>();private gates=new Map<FieldGateway,Promise<Gate>>();private outgoing=new Map<number,FieldGateway[]>();private edges=new Set<string>();private disposed=false;
 readonly identity:GatewayIdentity;
 constructor(readonly resources:GatewayResources){
  const {index,pack,identity}=resources,fields=index.pack;
  if(fields.version<3||!fields.gateways||!fields.entrances||!hash(identity.contextSHA256)||!hash(identity.walkmeshSHA256)||identity.archive!==fields.archive)throw new GatewayError('source_mismatch');
  assertSourceAgreement(fields.sources,pack.sources);assertSourceAgreement(fields.sources,identity.sources);
  for(const key of [fields.archive,'maplist'])if(pack.sources[key]!==fields.sources[key]||identity.sources[key]!==fields.sources[key])throw new GatewayError('source_mismatch');
  this.identity={...identity,sources:{...identity.sources}};
  for(const e of fields.edges)this.edges.add(`${e.fromField}/${e.gateway}/${e.to}/${e.offset}`);
  for(const g of fields.gateways){const list=this.outgoing.get(g.fromField)??[];list.push(g);this.outgoing.set(g.fromField,list);}
  for(const list of this.outgoing.values())list.sort((a,b)=>a.gateway-b.gateway);
 }
 private check(current=()=>true){if(this.disposed||!this.resources.current()||!current())throw new GatewayError('superseded');}
 async scene(id:number):Promise<Scene>{
  this.check();let pending=this.scenes.get(id);if(!pending){pending=(async()=>{
   const {index,pack}=this.resources;if(index.nodes.get(id)?.status!=='available'||pack.scenes.get(id)?.status!=='available')throw new GatewayError('mesh_unavailable');
   let mesh:FieldWalkmesh;try{mesh=await (this.resources.decode?.(id)??pack.decode(id));}catch{this.check();throw new GatewayError('mesh_unavailable');}this.check();
   if(mesh.triangles!==pack.scenes.get(id)?.triangles)throw new GatewayError('source_mismatch');
   return {mesh,network:this.resources.network?.(mesh)??new WalkmeshNetwork(mesh)};
  })();this.scenes.set(id,pending);}const result=await pending;this.check();return result;
 }
 async gateway(g:FieldGateway):Promise<Gate>{
  this.check();let pending=this.gates.get(g);if(!pending){pending=(async():Promise<Gate>=>{
   const {index}=this.resources;
   if(!this.edges.has(`${g.fromField}/${g.gateway}/${g.to}/${g.offset}`))return {ok:false,reason:index.pack.exits.some(e=>e.fromField===g.fromField&&e.gateway===g.gateway)?'world_exit':'source_mismatch'};
   if(index.nodes.get(g.fromField)?.status!=='available'||index.nodes.get(g.to)?.status!=='available')return {ok:false,reason:'field_unavailable'};
   if(g.sourceRelation!=='surface')return {ok:false,reason:g.sourceRelation};
   if(!validPoint(g.destination.status))return {ok:false,reason:'target_invalid'};
   try{const from=await this.scene(g.fromField),candidates=from.network.gateway(g);this.check();if(!candidates.length)return {ok:false,reason:'source_mismatch'};
    const target=await this.scene(g.to),p=localPoint(target.mesh,g.targetTriangle,g.targetXY);this.check();
    if(!validPoint(p.status)||p.derivedZ===null)return {ok:false,reason:'target_invalid'};
    if(p.status!==g.destination.status||g.destination.derivedZ===null||Math.abs(p.derivedZ-g.destination.derivedZ)>1e-8)return {ok:false,reason:'source_mismatch'};
    return {ok:true,candidates:[...candidates],arrival:{fieldId:g.to,triangle:g.targetTriangle,xy:[...g.targetXY],derivedZ:p.derivedZ}};
   }catch(e){if(e instanceof GatewayError&&e.status==='mesh_unavailable')return {ok:false,reason:'mesh_unavailable'};throw e;}
  })();this.gates.set(g,pending);}const result=await pending;this.check();return result;
 }
 private async root(start:GatewayStart):Promise<GatewayPoint>{
  const {index,poi,pack}=this.resources;
  if(start.kind==='world'){
   const e=poi?.entrances.find(e=>e.id===start.entranceId);if(!e)throw new GatewayError('invalid_start');
   const scene=await this.scene(e.field_id),v=validateWorldEntrance(index.pack,poi,e,scene.mesh,pack.sources);this.check();
   if(!v.ok||!v.record||v.record.derivedZ===null)throw new GatewayError(v.reason==='source_mismatch'?'source_mismatch':'invalid_start');
   return {fieldId:e.field_id,triangle:e.field_triangle,xy:[e.field_x,e.field_y],derivedZ:v.record.derivedZ};
  }
  const g=index.pack.gateways?.find(g=>g.fromField===start.fromField&&g.gateway===start.gateway);if(!g)throw new GatewayError('invalid_start');
  const verified=await this.gateway(g);if(!verified.ok)throw new GatewayError(verified.reason==='source_mismatch'?'source_mismatch':verified.reason==='mesh_unavailable'?'mesh_unavailable':'invalid_start');return verified.arrival;
 }
 async solve(start:GatewayStart,targetField:number,maxTransfers=3,current=()=>true):Promise<GatewayResult>{
  const began=performance.now(),result:GatewayResult={status:'unreachable',identity:this.identity,start:{...start},targetField,maxTransfers,states:[],legs:[],diagnostics:[],counts:{},revisited:0,milliseconds:0};
  const diagnose=(state:GatewayState,g:FieldGateway,reason:GatewayReason,candidates:number[]=[])=>{result.counts[reason]=(result.counts[reason]??0)+1;if(result.diagnostics.length<100)result.diagnostics.push({fieldId:state.fieldId,triangle:state.triangle,gateway:g.gateway,to:g.to,reason,candidates});};
  try{
   this.check(current);if(!Number.isInteger(maxTransfers)||maxTransfers<1||maxTransfers>3||!Number.isInteger(targetField)||this.resources.index.nodes.get(targetField)?.status!=='available'){result.status='invalid_target';return result;}
   const root=await this.root(start);this.check(current);result.states.push({...root,identity:this.identity,depth:0,parent:null,leg:null});const seen=new Set([`${root.fieldId}/${root.triangle}`]);let found:number|null=null,limited=false;
   for(let at=0;at<result.states.length;at++){
    this.check(current);const state=result.states[at];if(state.fieldId===targetField){found=at;break;}
    const gates=this.outgoing.get(state.fieldId)??[];
    if(state.depth===maxTransfers){limited||=gates.some(g=>g.sourceRelation==='surface'&&validPoint(g.destination.status)&&this.edges.has(`${g.fromField}/${g.gateway}/${g.to}/${g.offset}`)&&!seen.has(`${g.to}/${g.targetTriangle}`));continue;}
    const scene=await this.scene(state.fieldId);this.check(current);
    for(const g of gates){const verified=await this.gateway(g);this.check(current);if(!verified.ok){diagnose(state,g,verified.reason);continue;}
     const reachable=verified.candidates.filter(id=>scene.network.reach(state.triangle).distance[id]>=0).sort((a,b)=>scene.network.reach(state.triangle).distance[a]-scene.network.reach(state.triangle).distance[b]||a-b);
     if(!reachable.length){diagnose(state,g,verified.candidates.every(id=>scene.network.wcc.labels[id]!==scene.network.wcc.labels[state.triangle])?'different_wcc':'direction',verified.candidates);continue;}
     const end=reachable[0],path=scene.network.path(state.triangle,end);
     if(path.reason||path.steps.some(s=>s.mismatch)){diagnose(state,g,'access_mismatch',verified.candidates);continue;}
     const leg:GatewayLeg={fromField:state.fieldId,startTriangle:state.triangle,endTriangle:end,triangles:[...path.ids],access:path.steps.map(s=>({...s})),gateway:g,candidates:[...verified.candidates],reachableCandidates:reachable,arrival:{...verified.arrival,xy:[...verified.arrival.xy]}};
     const key=`${leg.arrival.fieldId}/${leg.arrival.triangle}`;if(seen.has(key)){result.revisited++;continue;}seen.add(key);result.states.push({...leg.arrival,identity:this.identity,depth:state.depth+1,parent:at,leg});
    }
   }
   if(found!==null){result.status='success';for(let at=found;result.states[at].parent!==null;at=result.states[at].parent!)result.legs.push(result.states[at].leg!);result.legs.reverse();}
   else result.status=limited?'limit':'unreachable';
  }catch(e){result.status=e instanceof GatewayError?e.status:'source_mismatch';result.legs=[];}
  finally{result.milliseconds=performance.now()-began;}
  return result;
 }
 dispose(){this.disposed=true;this.scenes.clear();this.gates.clear();}
 get cachedScenes(){return this.scenes.size;}
}
