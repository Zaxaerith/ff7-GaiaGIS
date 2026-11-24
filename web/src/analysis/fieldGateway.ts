// SPDX-License-Identifier: GPL-3.0-only
import {FieldIndex,WalkmeshNetwork,localPoint,validateWorldEntrance} from '../data/fieldContext';
import type {FieldGateway,FieldWalkmesh,WalkmeshAccess,WorldEntranceValidation,openWalkmeshPack} from '../data/fieldContext';
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
 entrance?:WorldEntranceValidation;entranceMs?:number;limitReason?:'transfers'|GatewayWork;
}
export interface GatewayResources {
 index:FieldIndex;poi:PoiDataset|null;pack:GatewayPack;identity:GatewayIdentity;current:()=>boolean;
 decode?:(fieldId:number)=>Promise<FieldWalkmesh>;network?:(mesh:FieldWalkmesh)=>WalkmeshNetwork;
}
type Scene={mesh:FieldWalkmesh;network:WalkmeshNetwork};
type Gate={ok:true;candidates:number[];arrival:GatewayPoint}|{ok:false;reason:GatewayReason};
class GatewayError extends Error{constructor(readonly status:'source_mismatch'|'superseded'|'mesh_unavailable'|'invalid_start'){super(status);}}
const gatewayLimits={states:512,scenes:128,gateways:1536,checks:500_000};
type GatewayWork=keyof typeof gatewayLimits;
class WorkLimit extends Error{constructor(readonly work:GatewayWork){super(work);}}
export class GatewayBudget {
 readonly used={states:0,scenes:0,gateways:0,checks:0};
 constructor(private readonly limits:Partial<typeof gatewayLimits>={}){}
 spend(work:GatewayWork,count=1){
  if(this.used[work]+count>Math.min(this.limits[work]??gatewayLimits[work],gatewayLimits[work]))throw new WorkLimit(work);
  this.used[work]+=count;
 }
}
export interface GatewaySearchOptions {
 budget:GatewayBudget;
 accept?:(point:GatewayPoint,scene:Scene)=>boolean|Promise<boolean>;
 yield?:()=>Promise<void>;
}
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
 async scene(id:number,budget?:GatewayBudget):Promise<Scene>{
  this.check();let pending=this.scenes.get(id);if(!pending){pending=(async()=>{
   const {index,pack}=this.resources;if(index.nodes.get(id)?.status!=='available'||pack.scenes.get(id)?.status!=='available')throw new GatewayError('mesh_unavailable');
   budget?.spend('scenes');budget?.spend('checks',3*pack.scenes.get(id)!.triangles!);
   let mesh:FieldWalkmesh;try{mesh=await (this.resources.decode?.(id)??pack.decode(id));}catch{this.check();throw new GatewayError('mesh_unavailable');}this.check();
   if(mesh.triangles!==pack.scenes.get(id)?.triangles)throw new GatewayError('source_mismatch');
   return {mesh,network:this.resources.network?.(mesh)??new WalkmeshNetwork(mesh)};
  })();this.scenes.set(id,pending);}const result=await pending;this.check();return result;
 }
 async gateway(g:FieldGateway,budget?:GatewayBudget):Promise<Gate>{
  this.check();budget?.spend('gateways');let pending=this.gates.get(g);if(!pending){pending=(async():Promise<Gate>=>{
   const {index}=this.resources;
   if(!this.edges.has(`${g.fromField}/${g.gateway}/${g.to}/${g.offset}`))return {ok:false,reason:index.pack.exits.some(e=>e.fromField===g.fromField&&e.gateway===g.gateway)?'world_exit':'source_mismatch'};
   if(index.nodes.get(g.fromField)?.status!=='available'||index.nodes.get(g.to)?.status!=='available')return {ok:false,reason:'field_unavailable'};
   if(g.sourceRelation!=='surface')return {ok:false,reason:g.sourceRelation};
   if(!validPoint(g.destination.status))return {ok:false,reason:'target_invalid'};
   try{const from=await this.scene(g.fromField,budget);budget?.spend('checks',from.mesh.triangles);const candidates=from.network.gateway(g);this.check();if(!candidates.length)return {ok:false,reason:'source_mismatch'};
    const target=await this.scene(g.to,budget),p=localPoint(target.mesh,g.targetTriangle,g.targetXY);this.check();
    if(!validPoint(p.status)||p.derivedZ===null)return {ok:false,reason:'target_invalid'};
    if(p.status!==g.destination.status||g.destination.derivedZ===null||Math.abs(p.derivedZ-g.destination.derivedZ)>1e-8)return {ok:false,reason:'source_mismatch'};
    return {ok:true,candidates:[...candidates],arrival:{fieldId:g.to,triangle:g.targetTriangle,xy:[...g.targetXY],derivedZ:p.derivedZ}};
   }catch(e){if(e instanceof GatewayError&&e.status==='mesh_unavailable')return {ok:false,reason:'mesh_unavailable'};throw e;}
  })();this.gates.set(g,pending);}const result=await pending;this.check();return result;
 }
 private async root(start:GatewayStart,result:GatewayResult,budget?:GatewayBudget):Promise<GatewayPoint>{
  const {index,poi,pack}=this.resources;
  if(start.kind==='world'){
   const e=poi?.entrances.find(e=>e.id===start.entranceId);if(!e)throw new GatewayError('invalid_start');
   const scene=await this.scene(e.field_id,budget),v=validateWorldEntrance(index.pack,poi,e,scene.mesh,pack.sources);this.check();result.entrance=v;
   if(!v.ok||!v.record||v.record.derivedZ===null)throw new GatewayError(v.reason==='source_mismatch'?'source_mismatch':'invalid_start');
   return {fieldId:e.field_id,triangle:e.field_triangle,xy:[e.field_x,e.field_y],derivedZ:v.record.derivedZ};
  }
  const g=index.pack.gateways?.find(g=>g.fromField===start.fromField&&g.gateway===start.gateway);if(!g)throw new GatewayError('invalid_start');
  const verified=await this.gateway(g,budget);if(!verified.ok)throw new GatewayError(verified.reason==='source_mismatch'?'source_mismatch':verified.reason==='mesh_unavailable'?'mesh_unavailable':'invalid_start');return verified.arrival;
 }
 async solve(start:GatewayStart,targetField:number,maxTransfers=3,current=()=>true,options?:GatewaySearchOptions):Promise<GatewayResult>{
  const began=performance.now(),result:GatewayResult={status:'unreachable',identity:this.identity,start:{...start},targetField,maxTransfers,states:[],legs:[],diagnostics:[],counts:{},revisited:0,milliseconds:0};
  const diagnose=(state:GatewayState,g:FieldGateway,reason:GatewayReason,candidates:number[]=[])=>{result.counts[reason]=(result.counts[reason]??0)+1;if(result.diagnostics.length<100)result.diagnostics.push({fieldId:state.fieldId,triangle:state.triangle,gateway:g.gateway,to:g.to,reason,candidates});};
  try{
   this.check(current);if(!Number.isInteger(maxTransfers)||maxTransfers<(options?0:1)||maxTransfers>3||!Number.isInteger(targetField)||this.resources.index.nodes.get(targetField)?.status!=='available'){result.status='invalid_target';return result;}
   const budget=options?.budget,root=await this.root(start,result,budget);result.entranceMs=performance.now()-began;this.check(current);budget?.spend('states');result.states.push({...root,identity:this.identity,depth:0,parent:null,leg:null});const seen=new Set([`${root.fieldId}/${root.triangle}`]);let found:number|null=null,limited=false;
   let batch=0;
   const pause=async()=>{if(options?.yield&&++batch%16===0)await options.yield();this.check(current);};
   for(let at=0;at<result.states.length;at++){
    await pause();const state=result.states[at];
    if(state.fieldId===targetField){const accepted=!options?.accept||await options.accept(state,await this.scene(state.fieldId,budget));this.check(current);if(accepted){found=at;break;}}
    if(maxTransfers===0){limited=state.fieldId!==targetField;continue;}
    const gates=this.outgoing.get(state.fieldId)??[];
    const atLimit=state.depth===maxTransfers;
    if(atLimit&&!options){limited||=gates.some(g=>g.sourceRelation==='surface'&&validPoint(g.destination.status)&&this.edges.has(`${g.fromField}/${g.gateway}/${g.to}/${g.offset}`)&&!seen.has(`${g.to}/${g.targetTriangle}`));continue;}
    if(!gates.length)continue;
    const scene=await this.scene(state.fieldId,budget);this.check(current);
    budget?.spend('checks',3*scene.mesh.triangles);
    const distance=scene.network.reach(state.triangle).distance;
    for(const g of gates){await pause();const verified=await this.gateway(g,budget);this.check(current);if(!verified.ok){diagnose(state,g,verified.reason);continue;}
     const reachable=verified.candidates.filter(id=>distance[id]>=0).sort((a,b)=>distance[a]-distance[b]||a-b);
     if(!reachable.length){diagnose(state,g,verified.candidates.every(id=>scene.network.wcc.labels[id]!==scene.network.wcc.labels[state.triangle])?'different_wcc':'direction',verified.candidates);continue;}
     let end=reachable[0],path:ReturnType<WalkmeshNetwork['path']>|undefined;
     for(const candidate of options?reachable:[end]){
      budget?.spend('checks',distance[candidate]);
      const proposed=scene.network.path(state.triangle,candidate);
      if(!proposed.reason&&!proposed.steps.some(s=>s.mismatch)){end=candidate;path=proposed;break;}
     }
     if(!path){diagnose(state,g,'access_mismatch',verified.candidates);continue;}
     const key=`${verified.arrival.fieldId}/${verified.arrival.triangle}`;
     if(seen.has(key)){result.revisited++;continue;}
     if(atLimit){limited=true;continue;}
     budget?.spend('states');
     const leg:GatewayLeg={fromField:state.fieldId,startTriangle:state.triangle,endTriangle:end,triangles:[...path.ids],access:path.steps.map(s=>({...s})),gateway:g,candidates:[...verified.candidates],reachableCandidates:reachable,arrival:{...verified.arrival,xy:[...verified.arrival.xy]}};
     seen.add(key);result.states.push({...leg.arrival,identity:this.identity,depth:state.depth+1,parent:at,leg});
    }
   }
   if(found!==null){result.status='success';for(let at=found;result.states[at].parent!==null;at=result.states[at].parent!)result.legs.push(result.states[at].leg!);result.legs.reverse();}
   else{result.status=limited?'limit':'unreachable';if(limited)result.limitReason='transfers';}
  }catch(e){result.status=e instanceof WorkLimit?'limit':e instanceof GatewayError?e.status:'source_mismatch';if(e instanceof WorkLimit)result.limitReason=e.work;result.legs=[];}
  finally{result.milliseconds=performance.now()-began;}
  return result;
 }
 dispose(){this.disposed=true;this.scenes.clear();this.gates.clear();}
 get cachedScenes(){return this.scenes.size;}
}
