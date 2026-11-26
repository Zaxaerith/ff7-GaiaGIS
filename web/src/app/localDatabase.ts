// SPDX-License-Identifier: GPL-3.0-only
import {localAdvertised} from './localWorkspace';
import type {AppState,AssetId} from './state';
import type {WorkspaceConnection} from './workspaceUX';

export const databasePrefix='/__gaiagis_local__/db/';
export const eventKinds=['MESSAGE','ASK','STITM','SMTRA','BATTLE','REQ','REQSW','REQEW'] as const;
export const grades=['standard','strong','core'] as const;
export const pageOffsetLimit=10000;
const responseLimit=256*1024;
export const sourceAssets=['field-context','field-walkmesh','field-interaction','field-dialogue','gameplay','field-script-evidence'] as const;
export const visibleChannels=['context','walkmesh','interaction','dialogue','gameplay','script','conditional'] as const;
const runStates=['complete','unavailable','limited','cancelled','not_run'] as const;
const failures=['not_configured','incompatible','invalid_path','corrupt','unsafe_journal','database_unavailable','database_changed','source_mismatch',
 'invalid_parameters','forbidden','method_not_allowed','unknown_endpoint','busy','query_timeout','query_failed','channel_unavailable',
 'conditional_unavailable','conditional_limited','conditional_cancelled','conditional_not_run','response_limit'] as const;
type FailureCode=typeof failures[number];
type Bit=0|1;
export interface DatabaseError {available:false;status:FailureCode;readOnly:true;sourceMatched:false;}
export interface DatabaseAvailable {
 available:true;status:'available';schema:'gaiagis-fieldlocal-gpkg';version:3;fieldId:number;fieldName:string;coordinateSpace:'FieldLocal';
 readOnly:true;sourceMatched:true;tableCount:number;spatialLayerCount:number;channels:Record<typeof visibleChannels[number],string>;
 requiredAssets:typeof sourceAssets[number][];
}
export interface EventRow {
 instructionOffset:number;kind:typeof eventKinds[number];reachable:Bit;
 gameplayKind:'item'|'materia'|'battle'|null;gameplayStatus:'static'|'unknown'|null;
 textId:number|null;textStatus:'valid'|'unavailable'|null;
}
export interface ControlRow {
 rootOffset:number;ifOffset:number;successor:number;targetOffset:number;kind:typeof eventKinds[number];isStandard:1;isStrong:Bit;isCore:Bit;
}
export type DatabaseQuery={type:'events';kind?:typeof eventKinds[number];instructionOffset?:number}|
 {type:'controls';ifOffset:number;grade:typeof grades[number]};
interface Page {status:'complete';fieldId:number;total:number;limit:number;offset:number;hasMore:boolean;coverage:'complete'|'partial';}
export type DatabasePage=Page&({queryType:'events';rows:EventRow[]}|{queryType:'controls';rows:ControlRow[]});
type DatabaseResult=DatabaseError|DatabaseAvailable|DatabasePage;
export type DatabaseRequest={type:'status'}|(DatabaseQuery&{limit:number;offset:number});
const invalid=()=>new Error('Invalid local database response');
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw invalid();return v as Record<string,unknown>;};
const member=<T extends readonly string[]>(values:T,value:unknown):value is T[number]=>typeof value==='string'&&(values as readonly string[]).includes(value);
const integer=(value:unknown,min=0,max=65535)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
const bit=(value:unknown)=>value===0||value===1;
function eventRow(raw:unknown):EventRow{
 const r=object(raw);
 if(!integer(r.instructionOffset)||!member(eventKinds,r.kind)||!bit(r.reachable)||
  (r.gameplayKind===null?r.gameplayStatus!==null:!member(['item','materia','battle'],r.gameplayKind)||!member(['static','unknown'],r.gameplayStatus))||
  (r.textId===null?r.textStatus!==null:!integer(r.textId,0,255)||!member(['valid','unavailable'],r.textStatus)))throw invalid();
 return {instructionOffset:r.instructionOffset,kind:r.kind,reachable:r.reachable,gameplayKind:r.gameplayKind,gameplayStatus:r.gameplayStatus,textId:r.textId,textStatus:r.textStatus} as EventRow;
}
function controlRow(raw:unknown):ControlRow{
 const r=object(raw);
 if(![r.rootOffset,r.ifOffset,r.successor,r.targetOffset].every(v=>integer(v))||!member(eventKinds,r.kind)||
  r.isStandard!==1||!bit(r.isStrong)||!bit(r.isCore)||Number(r.isCore)>Number(r.isStrong))throw invalid();
 return {rootOffset:r.rootOffset,ifOffset:r.ifOffset,successor:r.successor,targetOffset:r.targetOffset,kind:r.kind,isStandard:r.isStandard,isStrong:r.isStrong,isCore:r.isCore} as ControlRow;
}

export function parseDatabaseResponse(value:unknown,request:DatabaseRequest):DatabaseResult{
 const r=object(value);
 if(r.available===false){
  if(!member(failures,r.status)||r.readOnly!==true||r.sourceMatched!==false)throw invalid();
  return {available:false,status:r.status,readOnly:true,sourceMatched:false};
 }
 if(request.type==='status'){
  if(r.available!==true||r.status!=='available'||r.schema!=='gaiagis-fieldlocal-gpkg'||r.version!==3||r.coordinateSpace!=='FieldLocal'||
   r.readOnly!==true||r.sourceMatched!==true||!integer(r.fieldId)||typeof r.fieldName!=='string'||!/^[A-Za-z0-9_-]{1,32}$/.test(r.fieldName)||
   !integer(r.tableCount,1,512)||!integer(r.spatialLayerCount,0,Number(r.tableCount))||!Array.isArray(r.requiredAssets)||
   r.requiredAssets.length>sourceAssets.length||new Set(r.requiredAssets).size!==r.requiredAssets.length||
   !r.requiredAssets.every(a=>member(sourceAssets,a))||!r.requiredAssets.includes('field-context')||!r.requiredAssets.includes('field-walkmesh'))throw invalid();
  const channels=object(r.channels);
  for(const c of visibleChannels)if(!member(c==='conditional'?runStates:['available','unavailable'],channels[c]))throw invalid();
  return {available:true,status:'available',schema:r.schema,version:3,fieldId:r.fieldId,fieldName:r.fieldName,coordinateSpace:r.coordinateSpace,readOnly:true,
   sourceMatched:true,tableCount:r.tableCount,spatialLayerCount:r.spatialLayerCount,requiredAssets:r.requiredAssets,
   channels:Object.fromEntries(visibleChannels.map(c=>[c,channels[c]]))} as DatabaseAvailable;
 }
 if(r.status!=='complete'||r.queryType!==request.type||!integer(r.fieldId)||r.limit!==request.limit||r.offset!==request.offset||
  typeof r.total!=='number'||!integer(r.total,0,250000)||typeof r.hasMore!=='boolean'||!member(['complete','partial'],r.coverage)||
  !Array.isArray(r.rows)||r.rows.length!==Math.min(request.limit,Math.max(0,r.total-request.offset))||
  r.hasMore!==(request.offset+r.rows.length<r.total))throw invalid();
 const page={status:r.status,fieldId:r.fieldId,total:r.total,limit:r.limit,offset:r.offset,hasMore:r.hasMore,coverage:r.coverage} as Page;
 if(request.type==='events'){
  const rows=r.rows.map(eventRow);
  if(rows.some(row=>request.kind!==undefined&&row.kind!==request.kind||request.instructionOffset!==undefined&&row.instructionOffset!==request.instructionOffset))throw invalid();
  return {...page,queryType:'events',rows};
 }
 const rows=r.rows.map(controlRow);
 if(r.coverage!=='complete'||rows.some(row=>row.ifOffset!==request.ifOffset||
  (request.grade==='core'&&row.isCore!==1)||(request.grade==='strong'&&row.isStrong!==1)))throw invalid();
 return {...page,queryType:'controls',rows};
}

export function databaseRequestPath(request:DatabaseRequest){
 if(request.type==='status')return databasePrefix+'status';
 const args=new URLSearchParams();
 if(request.type==='events'){
  if(request.kind!==undefined)args.set('kind',request.kind);
  if(request.instructionOffset!==undefined)args.set('instruction_offset',String(request.instructionOffset));
 }else{args.set('if_offset',String(request.ifOffset));args.set('grade',request.grade);}
 args.set('limit',String(request.limit));args.set('offset',String(request.offset));
 return databasePrefix+request.type+'?'+args.toString();
}

async function readPayload(response:Response){
 if(!response.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')||
  Number(response.headers.get('Content-Length'))>responseLimit||!response.body)throw invalid();
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
 let length=0,text='';
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.length;
   if(length>responseLimit){await reader.cancel();throw invalid();}
   text+=decoder.decode(value,{stream:true});
  }
  return JSON.parse(text+decoder.decode()) as unknown;
 }finally{reader.releaseLock();}
}

export async function fetchLocalDatabase(request:DatabaseRequest,signal:AbortSignal,fetcher:typeof fetch=fetch,doc:Document=document){
 if(!localAdvertised(doc))throw Error('Local HTTP mode not advertised');
 const path=databaseRequestPath(request),started=performance.now();
 const response=await fetcher(path,{method:'GET',headers:{'X-GaiaGIS-DB':'1'},cache:'no-store',credentials:'same-origin',redirect:'error',signal});
 const trace={path,http:response.status,elapsed:0,rows:null as number|null};
 try{
  const result=parseDatabaseResponse(await readPayload(response),request);
  if(!response.ok&&(!('available' in result)||result.available))throw invalid();
  if('rows' in result)trace.rows=result.rows.length;
  trace.elapsed=performance.now()-started;
  return {trace,result};
 }catch{
  signal.throwIfAborted();
  trace.elapsed=performance.now()-started;
  return {trace,result:null};
 }
}

export function databaseWorkspace(connection:WorkspaceConnection,state:Readonly<AppState>){
 return connection.source==='auto'&&connection.manifest==='valid'&&!connection.loading&&state.localWorkspace==='loaded';
}

export function databaseSourceToken(state:Readonly<AppState>){
 return [state.data.generation,...(['geometry',...sourceAssets] satisfies AssetId[]).map(id=>state.data.assets[id])];
}

export function databaseAssetsAdopted(state:Readonly<AppState>,status:DatabaseAvailable){
 return status.requiredAssets.every(id=>state.data.assets[id]?.status==='loaded');
}
