// SPDX-License-Identifier: GPL-3.0-only
import {appStore} from '../app/state';
import {localAdvertised} from '../app/localWorkspace';
import {onWorkspaceConnection,workspaceConnection} from '../app/workspaceUX';
import {ResourceScope} from '../app/resources';
import {formatNumber,onLocaleChange,t} from '../i18n';
import {databaseAssetsAdopted,databaseSourceToken,databaseWorkspace,eventKinds,fetchLocalDatabase,grades,pageOffsetLimit,visibleChannels} from '../app/localDatabase';
import type {ControlRow,DatabaseAvailable,DatabasePage,DatabaseQuery,DatabaseRequest,EventRow} from '../app/localDatabase';

type Trace=Awaited<ReturnType<typeof fetchLocalDatabase>>['trace'];
const eventColumns=['instructionOffset','kind','reachable','gameplayKind','gameplayStatus','textId','textStatus'] as const;
const controlColumns=['rootOffset','ifOffset','successor','targetOffset','kind','isStandard','isStrong','isCore'] as const;

export function mountLocalDatabase(host:HTMLElement){
 if(!localAdvertised())return ()=>{};
 const owner=new ResourceScope();
 const node=<K extends keyof HTMLElementTagNameMap>(parent:HTMLElement,tag:K,id?:string)=>{
  const child=document.createElement(tag);if(id)child.id=id;parent.append(child);return child;
 };
 const panel=node(host,'details','local-db');panel.className='vii-fold local-db';
 const title=node(panel,'summary'),status=node(panel,'p','local-db-status'),identity=node(panel,'p','local-db-identity'),channels=node(panel,'p','local-db-channels');
 status.setAttribute('role','status');identity.className=channels.className='control-note';
 const refresh=node(panel,'button','local-db-refresh');refresh.type='button';
 const form=node(panel,'form');form.className='local-db-form';
 const typeLabel=node(form,'label'),typeName=node(typeLabel,'span'),queryType=node(typeLabel,'select','local-db-type');
 for(const type of ['events','controls'])node(queryType,'option').value=type;
 const offsetLabel=node(form,'label'),offsetName=node(offsetLabel,'span'),offset=node(offsetLabel,'input','local-db-offset');
 offset.type='text';offset.inputMode='numeric';offset.maxLength=5;
 const kindLabel=node(form,'label'),kindName=node(kindLabel,'span'),kind=node(kindLabel,'select','local-db-kind');
 node(kind,'option').value='';
 for(const op of eventKinds){const option=node(kind,'option');option.value=option.textContent=op;}
 const gradeLabel=node(form,'label'),gradeName=node(gradeLabel,'span'),grade=node(gradeLabel,'select','local-db-grade');
 for(const value of grades)node(grade,'option').value=value;
 grade.value='core';
 const run=node(form,'button','local-db-run');run.type='submit';
 const traceText=node(panel,'p','local-db-http');traceText.className='control-note';traceText.setAttribute('aria-live','polite');
 const resultText=node(panel,'p','local-db-result');resultText.setAttribute('aria-live','polite');
 const scroll=node(panel,'div','local-db-scroll');scroll.className='local-db-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');
 const table=node(scroll,'table','local-db-table'),head=node(table,'thead'),body=node(table,'tbody');
 const paging=node(panel,'div');paging.className='guide-pages';
 const previous=node(paging,'button','local-db-previous'),next=node(paging,'button','local-db-next');previous.type=next.type='button';

 let token:ReturnType<typeof databaseSourceToken>|null=null,stale=false;
 let controller:AbortController|null=null,attempted=false;
 let database:DatabaseAvailable|null=null,answer:DatabasePage|null=null,trace:Trace|null=null,applied:DatabaseQuery|null=null;
 let notice='connect',resultNotice='';
 const eligible=()=>!stale&&databaseWorkspace(workspaceConnection,appStore.state);
 const currentToken=()=>!!token&&databaseSourceToken(appStore.state).every((value,i)=>value===token![i]);
 const cancel=()=>{controller?.abort();controller=null;};
 function clear(){
  cancel();database=null;answer=null;trace=null;applied=null;attempted=false;resultNotice='';
 }
 function render(){
  title.textContent=t('localdb.title');refresh.textContent=t('localdb.refresh');typeName.textContent=t('localdb.queryType');
  for(const option of queryType.options)option.textContent=t('localdb.'+option.value);
  const controls=queryType.value==='controls';
  offsetName.textContent=t(controls?'localdb.ifOffset':'localdb.optionalOffset');offset.required=controls;
  kindLabel.hidden=controls;gradeLabel.hidden=!controls;kindName.textContent=t('localdb.kind');gradeName.textContent=t('localdb.grade');
  kind.options[0].textContent=t('localdb.all');
  for(const option of grade.options)option.textContent=t('localdb.'+option.value);
  run.textContent=t('localdb.run');previous.textContent=t('guide.previous');next.textContent=t('guide.next');
  status.textContent=t('localdb.'+notice);status.dataset.state=notice;
  identity.textContent=database?t('localdb.identity',{field:database.fieldId,name:database.fieldName,tables:database.tableCount,spatial:database.spatialLayerCount}):'';
  channels.textContent=database?visibleChannels.map(key=>key+' · '+t('localdb.'+database!.channels[key])).join(' / '):'';
  refresh.disabled=!eligible()||!!controller;run.disabled=!database||!!controller;
  form.hidden=!database;
  traceText.textContent=trace?t('localdb.trace',{path:trace.path,http:trace.http,rows:trace.rows??'—',ms:Math.round(trace.elapsed)}):'';
  if(trace){traceText.dataset.path=trace.path;traceText.dataset.http=String(trace.http);}
  else{delete traceText.dataset.path;delete traceText.dataset.http;}
  const resultSummary=answer?t('localdb.page',{start:answer.rows.length?answer.offset+1:0,end:answer.rows.length?answer.offset+answer.rows.length:0,total:answer.total}):'';
  resultText.textContent=[resultSummary,answer?.coverage==='partial'?t('localdb.partial'):'',resultNotice?t('localdb.'+resultNotice):''].filter(Boolean).join(' · ');
  previous.disabled=!answer||answer.offset===0||!!controller;
  next.disabled=!answer?.hasMore||answer.offset+answer.limit>pageOffsetLimit||!!controller;
  paging.hidden=!answer||(answer.offset===0&&!answer.hasMore);
  scroll.hidden=!answer?.rows.length;scroll.setAttribute('aria-label',t('localdb.results'));
  head.replaceChildren();body.replaceChildren();
  if(answer?.rows.length){
   const row=node(head,'tr');
   const write=<R extends EventRow|ControlRow>(columns:readonly (keyof R)[],rows:R[])=>{
    for(const col of columns){const th=node(row,'th');th.scope='col';th.textContent=t('localdb.'+String(col));}
    for(const data of rows){const tr=node(body,'tr');for(const col of columns){
     const value=data[col];node(tr,'td').textContent=value===null?'—':typeof value==='number'?formatNumber(value,0):String(value);
    }}
   };
   if(answer.queryType==='events')write<EventRow>(eventColumns,answer.rows);
   else write<ControlRow>(controlColumns,answer.rows);
  }
 }
 async function send(request:DatabaseRequest){
  if(!eligible()||!currentToken())return;
  cancel();const pending=new AbortController();controller=pending;attempted=true;
  if(request.type==='status'){notice='loading';database=null;}
  else resultNotice='loading';
  answer=null;trace=null;render();
  const stillCurrent=()=>!owner.disposed&&controller===pending&&eligible()&&currentToken();
  try{
   const reply=await fetchLocalDatabase(request,pending.signal);
   if(!stillCurrent())return;
   trace=reply.trace;
   const result=reply.result;
   if(!result){
    if(request.type==='status')notice='transport_error';else resultNotice='transport_error';
   }else if('available' in result){
    if(result.available){
     if(databaseAssetsAdopted(appStore.state,result)){database=result;notice='available';}
     else notice='workspace_changed';
    }else if(request.type==='status'||['database_changed','source_mismatch','not_configured','database_unavailable','unsafe_journal','corrupt'].includes(result.status)){
     database=null;notice=result.status;resultNotice='';
    }else resultNotice=result.status;
   }else if(database?.fieldId!==result.fieldId){
    database=null;notice='source_mismatch';resultNotice='';
   }else{answer=result;resultNotice=result.rows.length?'':'empty';}
  }catch{
   if(stillCurrent()){if(request.type==='status')notice='transport_error';else resultNotice='transport_error';}
  }finally{if(stillCurrent()){controller=null;render();}}
 }
 function sourceChanged(){
  if(!databaseWorkspace(workspaceConnection,appStore.state)){
   clear();token=null;notice=workspaceConnection.source==='manual'?'workspace_changed':'connect';render();
   return;
  }
  if(!token)token=databaseSourceToken(appStore.state);
  else if(!currentToken())stale=true;
  if(stale){clear();notice='workspace_changed';render();return;}
  if(panel.open&&!attempted)void send({type:'status'});
  else if(!attempted){notice='idle';render();}
 }
 function readQuery():DatabaseQuery|null{
  const value=offset.value.trim();
  if(value&&(!/^[0-9]{1,5}$/.test(value)||Number(value)>65535)||!value&&queryType.value==='controls')return null;
  return queryType.value==='controls'?{type:'controls',ifOffset:Number(value),grade:grade.value as typeof grades[number]}:
   {type:'events',kind:kind.value?(kind.value as typeof eventKinds[number]):undefined,instructionOffset:value?Number(value):undefined};
 }
 const page=(at:number)=>{if(applied)void send({...applied,limit:20,offset:at});};
 refresh.onclick=()=>{resultNotice='';void send({type:'status'});};
 form.onsubmit=event=>{
  event.preventDefault();
  if(!database)return;
  const query=readQuery();
  if(!query){cancel();answer=null;trace=null;resultNotice='invalid_parameters';render();return;}
  applied=query;page(0);
 };
 function resetFilter(){if(database){cancel();answer=null;trace=null;resultNotice='';render();}}
 queryType.onchange=kind.onchange=grade.onchange=offset.oninput=resetFilter;
 previous.onclick=()=>{if(answer)page(Math.max(0,answer.offset-answer.limit));};
 next.onclick=()=>{if(answer?.hasMore&&answer.offset+answer.limit<=pageOffsetLimit)page(answer.offset+answer.limit);};
 owner.listen(panel,'toggle',()=>{if(panel.open)sourceChanged();else if(controller){cancel();resultNotice='';attempted=!!database;notice=database?'available':'idle';render();}});
 owner.own(appStore.subscribe(sourceChanged));
 owner.own(onWorkspaceConnection(sourceChanged));owner.own(onLocaleChange(render));
 owner.own(()=>{cancel();panel.remove();});
 sourceChanged();
 return ()=>owner.dispose();
}
