// SPDX-License-Identifier: GPL-3.0-only
import {analyzeFieldConditionalSnapshot,toFieldConditionalInput,FIELD_CONDITIONAL_REVISION} from './fieldConditionalEvidence';
import {CMUSC8_CFG} from '../data/fieldProvenance';
import type {ConditionalResult,FieldConditionalInput} from './fieldConditionalEvidence';
import type {FieldEventInput} from './fieldEventEvidence';

export interface ConditionalWorkerRequest {type:'analyze';job:number;identityKey:string;input:FieldConditionalInput;}
export interface ConditionalWorkerResponse {type:'result';job:number;identityKey:string;result:ConditionalResult;}
export interface ConditionalWorker {
 postMessage(message:ConditionalWorkerRequest):void;terminate():void;
 onmessage:((event:MessageEvent<ConditionalWorkerResponse>)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;
}
export interface ConditionalSessionState {
 status:'empty'|'idle'|'running'|'complete'|'unavailable'|'limited'|'cancelled'|'disposed';
 result:ConditionalResult|null;identityKey:string|null;error:string|null;
}
export interface ConditionalSessionOptions {workerFactory?:()=>ConditionalWorker;}
export interface ConditionalAnalyzeOptions {signal?:AbortSignal;}
/** Metadata only: no graph serialization, text, geometry or global Gameplay in the identity. */
export function fieldConditionalIdentityKey(input:FieldConditionalInput):string {
 const d=input.dialogue,g=input.gameplay,s=d?.scene;
 return JSON.stringify([input.fieldId,input.generation,input.contextSHA256,input.context.version,input.context.scriptDecoder,input.context.archive,input.context.sources,input.node,input.meshSection5SHA256,d?.sha256,d?.generation,d?.contextSHA256,d?.sources,s?.memberSHA256,s?.section1SHA256,s?.section5SHA256,s?.section8SHA256,g?.sha256,g?.generation,g?.contextSHA256,g?.sources,g?.decoder,g?.version,g?.generator_revision,g?.scene?.memberSHA256,g?.scene?.section1SHA256,input.related.map(h=>[h.kind,h.sha256,h.contextSHA256,h.sources,h.decoder,h.section1SHA256,h.section5SHA256,h.section8SHA256])]);
}
// Source hashes bind graph contents; compute only metadata here, never clone the graph on rerender.
function sourceIdentityKey(input:FieldEventInput):string {
 const p=input.fields.pack,d=input.dialogue,s=d?.scene,g=input.gameplay,gs=g?.index.scenes.get(input.fieldId);
 return JSON.stringify([input.fieldId,input.generation,input.contextSHA256,p.version,p.scriptDecoder,p.archive,p.sources,input.fields.nodes.get(input.fieldId),input.mesh===null?null:input.meshSHA256,d?.sha256,d?.generation,d?.contextSHA256,d?.sources,s?.fieldId,s?.name,s?.memberSHA256,s?.section1SHA256,s?.section5SHA256,s?.section8SHA256,s?.section1Bytes,g?.sha256,g?.generation,g?.contextSHA256,g?.index.pack.sources,g?.index.pack.decoder,g?.index.pack.version,g?.index.pack.generator_revision,gs?.fieldId,gs?.name,gs?.memberSHA256,gs?.section1SHA256,gs?.section1Bytes,[input.interaction,input.script].map(a=>a?[a.sha256,a.contextSHA256,a.decoder,a.sources,a.scene.fieldId,a.scene.name,a.scene.section1SHA256,a.scene.section8SHA256,a.scene.section1Bytes]:null)]);
}
/** One worker at most, constructed only for explicit analyze(). Replacement never queues old work. */
export function createFieldConditionalSession(options:ConditionalSessionOptions={}) {
 let input:FieldEventInput|null=null,sourceKey:string|null=null,disposed=false,job=0,worker:ConditionalWorker|null=null,pending:((value:ConditionalResult|null)=>void)|null=null,abortCleanup:(()=>void)|null=null;
 let state:ConditionalSessionState={status:'empty',result:null,identityKey:null,error:null};
 const subscribers=new Set<(state:ConditionalSessionState)=>void>();
 const publish=(next:ConditionalSessionState)=>{state=next;for(const fn of subscribers)fn(state);};
 const stop=()=>{job++;if(worker){worker.onmessage=null;worker.onerror=null;worker.terminate();worker=null;}abortCleanup?.();abortCleanup=null;const resolve=pending;pending=null;resolve?.(null);};
 const cancel=()=>{if(disposed)return;stop();publish({status:input?'cancelled':'empty',result:null,identityKey:null,error:null});};
 const invalidate=()=>{if(disposed)return;stop();input=null;sourceKey=null;publish({status:'empty',result:null,identityKey:null,error:null});};
 const setInput=(value:FieldEventInput|null)=>{if(disposed)return;let key:string|null=null;try{key=value?sourceIdentityKey(value):null;}catch{/* Invalid input remains analyzable as unavailable. */}if(value===input&&key===sourceKey&&state.status!=='cancelled')return;stop();input=value;sourceKey=key;publish({status:value?'idle':'empty',result:null,identityKey:null,error:null});};
 const analyze=(args:ConditionalAnalyzeOptions={}):Promise<ConditionalResult|null>=>{
  if(disposed||!input)return Promise.resolve(null);stop();
  if(args.signal?.aborted){publish({status:'cancelled',result:null,identityKey:null,error:null});return Promise.resolve(null);}
  const token=job;let snapshot:FieldConditionalInput,key:string;
  try{snapshot=toFieldConditionalInput(input);key=fieldConditionalIdentityKey(snapshot);}catch{const result=analyzeFieldConditionalSnapshot({} as FieldConditionalInput);publish({status:'unavailable',result,identityKey:null,error:'invalid_input'});return Promise.resolve(result);}
  let resolve!:(value:ConditionalResult|null)=>void;const promise=new Promise<ConditionalResult|null>(done=>{resolve=done;});pending=resolve;
  const live=()=>!disposed&&token===job&&!args.signal?.aborted;
  publish({status:'running',result:null,identityKey:key,error:null});
  if(!live()){if(token===job)cancel();return promise;}
  if(args.signal){const signal=args.signal,onAbort=()=>cancel();signal.addEventListener('abort',onAbort,{once:true});abortCleanup=()=>signal.removeEventListener('abort',onAbort);}
  const finish=(result:ConditionalResult|null,error:string|null)=>{if(disposed||token!==job)return;const done=pending;pending=null;abortCleanup?.();abortCleanup=null;if(worker){worker.onmessage=null;worker.onerror=null;worker.terminate();worker=null;}publish({status:result?.status??'unavailable',result,identityKey:key,error});done?.(result);};
  try{
   const created=(options.workerFactory??(()=>new Worker(new URL('./fieldConditional.worker.ts',import.meta.url),{type:'module'})))();
   if(!live()){created.terminate();return promise;}worker=created;
   worker.onmessage=event=>{
    const message=event.data;if(disposed||token!==job||!message||message.type!=='result'||message.job!==token||message.identityKey!==key)return;
    const r=message.result,id=r?.identity,d=snapshot.dialogue,s=d?.scene;
    if(!r||!['complete','unavailable','limited','cancelled'].includes(r.status)||r.complete!==(r.status==='complete')||r.stats?.complete!==r.complete||![r.roots,r.events,r.controls,r.askLinks,r.requestLinks].every(Array.isArray)||!r.complete&&[r.roots,r.events,r.controls,r.askLinks,r.requestLinks].some(a=>a.length)){finish(null,'invalid_worker_result');return;}
    if(r.complete&&!id||id&&(id.analysisRevision!==FIELD_CONDITIONAL_REVISION||id.decoder!==CMUSC8_CFG||id.decoder!==snapshot.context.scriptDecoder||id.fieldName!==snapshot.node?.name||id.generation!==snapshot.generation||id.fieldId!==snapshot.fieldId||id.contextSHA256!==snapshot.contextSHA256||id.dialogueSHA256!==d?.sha256||id.gameplaySHA256!==(snapshot.gameplay?.sha256??null)||id.memberSHA256!==s?.memberSHA256||id.section1SHA256!==s?.section1SHA256||id.section5SHA256!==s?.section5SHA256||id.section8SHA256!==s?.section8SHA256)){finish(null,'stale_worker_result');return;}
    finish(r,null);
   };
   worker.onerror=()=>finish(null,'worker_error');
   if(!live()){if(token===job)cancel();return promise;}worker.postMessage({type:'analyze',job:token,identityKey:key,input:snapshot});
  }catch{finish(null,'worker_unavailable');}
  return promise;
 };
 return {get state(){return state;},setInput,analyze,cancel,invalidate,subscribe(fn:(state:ConditionalSessionState)=>void){if(disposed)return ()=>{};subscribers.add(fn);fn(state);return ()=>{subscribers.delete(fn);};},dispose(){if(disposed)return;stop();input=null;disposed=true;publish({status:'disposed',result:null,identityKey:null,error:null});subscribers.clear();}};
}
export type FieldConditionalSession=ReturnType<typeof createFieldConditionalSession>;
