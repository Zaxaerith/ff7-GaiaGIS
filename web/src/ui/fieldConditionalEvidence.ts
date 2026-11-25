// SPDX-License-Identifier: GPL-3.0-only
import {createFieldConditionalSession} from '../analysis/fieldConditionalSession';
import type {ConditionalResult} from '../analysis/fieldConditionalEvidence';
import type {FieldEventIndex,FieldEventRow} from '../analysis/fieldEventEvidence';
import {dialogueGuards} from '../data/fieldDialogue';
import {fieldDecoder} from '../data/fieldProvenance';
import {sourceResultPager} from './surfaceQueries';
import {onLocaleChange,t} from '../i18n';

type ConditionalEvent = ConditionalResult['events'][number];
type Control = ConditionalResult['controls'][number];
type Root = ConditionalResult['roots'][number];
type AskLink = ConditionalResult['askLinks'][number];
type RequestLink = ConditionalResult['requestLinks'][number];
const levels = ['direct','witness','strong','core','candidate','unknown','rejected'] as const;
type Level = typeof levels[number];
interface Evidence {
 level:Level; event:ConditionalEvent|null; root:number|null;
 ifOffset:number|null; successor:number|null; reason:string|null; control?:Control;
}
interface Filters {ifOffset?:number;actor?:number;entry?:number;kind:string;level:Level;}
export interface FieldConditionalPorts {
 select:(row:FieldEventRow)=>void;
 current:()=>FieldEventIndex|null;
}
const make = <K extends keyof HTMLElementTagNameMap>(tag:K,parent?:HTMLElement,text='') => {
 const node=document.createElement(tag);node.textContent=text;parent?.append(node);return node;
};
const button = (host:HTMLElement,text:string,run:()=>void) => {
 const node=make('button',host,text);node.type='button';node.onclick=run;return node;
};
const offset = (value:number|null) => value===null?'—':String(value)+' (0x'+value.toString(16)+')';
const text = (key:string,args:Record<string,string|number>={}) => t('conditional.'+key,args);
const identityKey = (index:FieldEventIndex) => {
 const i=index.input,p=i.fields.pack,d=i.dialogue,g=i.gameplay,s=i.script,a=i.interaction;
 return JSON.stringify([i.generation,i.fieldId,i.contextSHA256,i.walkmeshSHA256,i.meshSHA256,p.version,p.scriptDecoder,p.archive,p.sources,
  i.fields.nodes.get(i.fieldId),d?.sha256,d?.generation,d?.contextSHA256,d?.sources,
  g?.sha256,g?.generation,g?.contextSHA256,g?.index.pack.sources,g?.index.pack.decoder,g?.index.pack.generator_revision,
  s?.sha256,s?.contextSHA256,s?.decoder,s?.sources,a?.sha256,a?.contextSHA256,a?.decoder,a?.sources,
  index.section1SHA256,index.section8SHA256,index.problems]);
};
const matchesEvent = (event:ConditionalEvent,row:FieldEventRow) => event.key===row.key||
 row.section===1&&event.offset===row.offset&&event.kind===row.kind;
const sameInput = (a:FieldEventIndex|null,b:FieldEventIndex|null) => a===b || !!a&&!!b&&identityKey(a)===identityKey(b)&&
 a.input.fields===b.input.fields&&a.input.mesh===b.input.mesh&&a.input.dialogue?.scene===b.input.dialogue?.scene&&
 a.input.gameplay?.index===b.input.gameplay?.index&&a.input.script?.scene===b.input.script?.scene&&
 a.input.interaction?.scene===b.input.interaction?.scene;
// Unknown is not false. Structural rejection and missing/budget evidence remain separate.
const unknownReason = (reason:string|null) => !!reason&&/budget|limit|unknown|missing|unavailable|legacy|cancel|source|decoder|incomplete|stop/i.test(reason);

/** A single current-Field session is shared by the collapsed query and Inspector.
 * This module never makes geometry, marker, path, or coordinate claims. */
export function mountFieldConditionalEvidence(ports:FieldConditionalPorts) {
 const session=createFieldConditionalSession();
 let index:FieldEventIndex|null=null,result:ConditionalResult|null=null,request=0;
 let controller:AbortController|null=null,busy=false,failed=false,disposed=false,invalidated=false;
 let inspection:ReturnType<typeof createView>|null=null;
 const witnessCache=new Map<string,ReturnType<typeof dialogueGuards>>();
 const panel=make('details');panel.id='field-conditional-evidence';panel.className='field-event-tool field-conditional-tool';
 const main=createView(panel,'field-conditional',null);

 function live(snapshot:FieldEventIndex|null=index) {return !disposed&&!invalidated&&!!snapshot&&sameInput(snapshot,ports.current());}
 function open() {return panel.open||!!inspection?.fold.open;}
 function stopPending() {
  request++;controller?.abort();controller=null;
  if(busy)session.cancel();busy=false;
 }
 function removeInspection() {
  inspection?.dispose();inspection?.fold.remove();inspection=null;
 }
 function bind(next:FieldEventIndex|null) {
  if(sameInput(index,next)){index=next;return;}
  stopPending();result=null;failed=false;witnessCache.clear();removeInspection();
  index=next;session.setInput(next?.input??null);main.reset();
 }
 function matchesIdentity(answer:ConditionalResult,snapshot:FieldEventIndex) {
  const id=answer.identity,i=snapshot.input;
  if(!id)return answer.status==='unavailable'||answer.status==='cancelled';
  const scene=i.dialogue?.scene;
  return !!scene&&id.generation===i.generation&&id.fieldId===i.fieldId&&id.fieldName===scene.name&&
   id.decoder===fieldDecoder(i.fields.pack)&&id.contextSHA256===i.contextSHA256&&
   id.dialogueSHA256===i.dialogue?.sha256&&id.gameplaySHA256===(i.gameplay?.sha256??null)&&
   id.memberSHA256===scene.memberSHA256&&id.section1SHA256===snapshot.section1SHA256&&
   id.section1SHA256===scene.section1SHA256&&id.section8SHA256===snapshot.section8SHA256&&
   id.section8SHA256===scene.section8SHA256&&id.section5SHA256===scene.section5SHA256&&
   (i.mesh===null||id.section5SHA256===i.meshSHA256);
 }
 async function analyze() {
  if(disposed||invalidated)return;
  bind(ports.current());
  if(!open()||!index||result||busy||failed){render();return;}
  const snapshot=index,ticket=++request,abort=new AbortController();controller=abort;busy=true;failed=false;render();
  try {
   const answer=await session.analyze({signal:abort.signal});
   if(ticket!==request||abort.signal.aborted||!live(snapshot)||!open())return;
   if(answer&&!matchesIdentity(answer,snapshot)){failed=true;return;}
   if(!answer){failed=true;return;}
   if(answer.status!=='cancelled')result=answer;
  } catch {
   if(ticket===request&&!abort.signal.aborted&&live(snapshot))failed=true;
  } finally {
   if(ticket===request){controller=null;busy=false;render();}
  }
 }
 function original(event:ConditionalEvent) {
  return index?.rows.find(row=>matchesEvent(event,row));
 }
 function select(event:ConditionalEvent) {
  if(!live())return refresh(ports.current());
  const row=original(event);if(row)ports.select(row);
 }
 function selectOffset(value:number,channel?:FieldEventRow['channel']) {
  if(!live())return refresh(ports.current());
  const row=index?.rows.find(r=>r.section===1&&r.offset===value&&(!channel||r.channel===channel));
  if(row)ports.select(row);
 }
 function root(entry:number|null) {return result?.roots.find(r=>r.entry===entry);}
 function successors(ifOffset:number|null) {return ifOffset===null?[]:index?.input.dialogue?.scene.cfg.find(n=>n[0]===ifOffset)?.slice(4)??[];}
 function eventFor(row:FieldEventRow|null) {
  return row?result?.events.find(e=>matchesEvent(e,row)):null;
 }
 function sourceEvents():ConditionalEvent[] {
  const events=new Map<number,ConditionalEvent>();
  for(const event of result?.events??[])events.set(event.offset,event);
  const kinds:Record<number,ConditionalEvent['kind']>={1:'REQ',2:'REQSW',3:'REQEW',64:'MESSAGE',72:'ASK',88:'STITM',91:'SMTRA',112:'BATTLE'};
  for(const row of index?.rows??[]) {
   if(row.section!==1||!['dialogue','request','gameplay'].includes(row.channel)||events.has(row.offset))continue;
   const opcode=row.record.opcode,kind=opcode===undefined?undefined:kinds[opcode];if(!kind)continue;
   events.set(row.offset,{key:row.key,offset:row.offset,opcode:opcode!,kind,owners:[...row.owners],
    owningRoots:[...new Set(row.owners.map(o=>o.entry))],entryReachable:'entryReachable' in row.record?row.record.entryReachable===true:!!row.owners.length});
  }
  return [...events.values()].sort((a,b)=>a.offset-b.offset);
 }
 function filterEvent(e:ConditionalEvent,f:Filters,fixed:FieldEventRow|null) {
  if(fixed&&!matchesEvent(e,fixed))return false;
  if(f.kind&&e.kind!==f.kind)return false;
  // Actor and Entry must belong to one alias, not two unrelated owners.
  return (f.actor===undefined&&f.entry===undefined)||e.owners.some(o=>(f.actor===undefined||o.actor===f.actor)&&(f.entry===undefined||o.entry===f.entry));
 }
 function filterRoot(entry:number|null,f:Filters) {
  if(f.entry!==undefined&&entry!==f.entry)return false;
  return f.actor===undefined||entry===null||!!root(entry)?.aliases.some(o=>o.actor===f.actor);
 }
 function evidenceRows(f:Filters,fixed:FieldEventRow|null):{rows:Evidence[];limited:boolean} {
  const events=sourceEvents().filter(e=>filterEvent(e,f,fixed)),byOffset=new Map(events.map(e=>[e.offset,e]));
  let rows:Evidence[]=[],limited=false;
  if(f.level==='direct') {
   if(f.ifOffset===undefined)rows=events.map(event=>({level:'direct',event,root:null,ifOffset:null,successor:null,reason:null}));
  } else if(f.level==='witness') {
   const scene=index?.input.dialogue?.scene;
   let queries=0;
   if(scene)for(const event of events) {
    const record=scene.records.find(r=>r.offset===event.offset&&r.opcode===event.opcode);
    if(!record)continue; // The old API never proved Gameplay-only records.
    for(const entry of event.owningRoots) {
     if(!filterRoot(entry,f))continue;
     const key=event.key+'/'+entry;
     let proof=witnessCache.get(key);
     if(!proof){
      if(++queries>64){limited=true;continue;}
      proof=dialogueGuards(scene,record,entry);witnessCache.set(key,proof);
      if(witnessCache.size>256)witnessCache.delete(witnessCache.keys().next().value!);
     }
     if(proof.status!=='complete')limited=true;
     for(const candidate of proof.proofs) {
      if(f.ifOffset!==undefined&&candidate.offset!==f.ifOffset)continue;
      rows.push({level:'witness',event,root:entry,ifOffset:candidate.offset,successor:null,reason:proof.status});
     }
    }
   }
  } else if(!result) {
   return {rows:[],limited:false};
  } else if(f.level==='strong'||f.level==='core'||f.level==='candidate') {
   for(const control of result.controls) {
    const event=byOffset.get(control.targetOffset);
    if(!event||!filterRoot(control.root,f)||f.ifOffset!==undefined&&control.ifOffset!==f.ifOffset)continue;
    if(f.level==='strong'&&!control.strong||f.level==='core'&&!control.core||f.level==='candidate'&&control.strong)continue;
    rows.push({level:f.level,event,root:control.root,ifOffset:control.ifOffset,successor:control.successor,reason:null,control});
   }
   if(f.level==='candidate'&&f.ifOffset===undefined)for(const event of events)if(!event.entryReachable)
    rows.push({level:'candidate',event,root:null,ifOffset:null,successor:null,reason:'not_entry_reachable'});
  } else {
   for(const r of result.roots) {
    if(r.status!=='rejected'||(f.level==='unknown')!==unknownReason(r.reason)||!filterRoot(r.entry,f))continue;
    const affected=events.filter(e=>e.owningRoots.includes(r.entry));
    if(affected.length)for(const event of affected) {
     if(f.ifOffset!==undefined&&!index?.input.dialogue?.scene.records.some(q=>q.offset===f.ifOffset&&q.owners.some(id=>index!.input.dialogue!.scene.entries[id].entry===r.entry)))continue;
     rows.push({level:f.level,event,root:r.entry,ifOffset:f.ifOffset??null,successor:null,reason:r.reason});
    }
    else if(!fixed&&!f.kind&&f.ifOffset===undefined)rows.push({level:f.level,event:null,root:r.entry,ifOffset:null,successor:null,reason:r.reason});
   }
   if(f.level==='unknown'&&!fixed&&!f.kind&&f.entry===undefined&&f.actor===undefined&&f.ifOffset===undefined)
    for(const reason of result.problems)rows.push({level:'unknown',event:null,root:null,ifOffset:null,successor:null,reason});
  }
  return {rows,limited};
 }
 function proofCaption(row:Evidence) {
  const event=row.event?row.event.kind+' @ '+offset(row.event.offset):text('root')+' '+offset(row.root);
  return text(row.level)+' · '+event+(row.ifOffset===null?'':' · IF '+offset(row.ifOffset))+
   (row.root===null?'':' · Entry '+offset(row.root))+(row.reason?' · '+row.reason:'');
 }
 function showProof(host:HTMLElement,row:Evidence) {
  host.replaceChildren();make('h4',host,text('detail'));make('p',host,proofCaption(row));
  const r=root(row.root),s=row.control?.successors??successors(row.ifOffset);
  if(row.ifOffset!==null)make('p',host,text('successors')+': '+(s.length?s.map(n=>offset(n)).join(' / '):text('noSuccessor')));
  if(row.successor!==null)make('p',host,text('edge')+': '+offset(row.successor));
  if(row.level==='direct')make('p',host,text('directNote'));
  else if(row.level==='witness')make('p',host,text('witnessNote'));
  else if(row.control){
   make('p',host,text('pdom'));make('p',host,text(row.control.strong?'dom':'notDom'));
   if(row.control.core)make('p',host,text('coreNote'));
  } else make('p',host,text('noProof'));
  make('pre',host,JSON.stringify({originalEvent:row.event,rawRoot:r??null,owningRoots:row.event?.owningRoots.map(entry=>root(entry)),
   ifOffset:row.ifOffset,successors:s,specifiedSuccessor:row.successor,level:row.level,reason:row.reason,control:row.control??null},null,2));
  make('h4',host,text('source'));make('pre',host,JSON.stringify(result?.identity??null,null,2));
  if(row.event){const pick=button(host,text('select'),()=>select(row.event!));pick.disabled=!original(row.event);if(pick.disabled)make('p',host,text('notIndexed'));}
 }
 function showRoot(host:HTMLElement,r:Root) {
  host.replaceChildren();make('h4',host,text('aliases'));make('p',host,offset(r.entry)+' · '+text(r.status==='accepted'?'accepted':unknownReason(r.reason)?'unknown':'rejected'));
  make('p',host,text('reason')+': '+(r.reason??'—'));make('pre',host,JSON.stringify(r,null,2));
 }
 function showAsk(host:HTMLElement,link:AskLink) {
  host.replaceChildren();make('p',host,text('askLimit'));make('p',host,text('reason')+': '+(link.reason??'—'));
  make('pre',host,JSON.stringify(link,null,2));button(host,'ASK @ '+offset(link.askOffset),()=>selectOffset(link.askOffset,'dialogue'));
  button(host,'IF @ '+offset(link.ifOffset),()=>selectOffset(link.ifOffset,'condition'));
 }
 function showRequest(host:HTMLElement,link:RequestLink) {
  host.replaceChildren();make('p',host,text('requestLimit'));make('pre',host,JSON.stringify(link,null,2));
  const sourceProofs=(result?.controls??[]).filter(c=>c.targetOffset===link.sourceOffset&&c.strong);
  const sourceLevel=sourceProofs.some(c=>c.core)?'core':sourceProofs.length?'strong':'empty';
  make('p',host,text('requestSourceEvidence')+' · '+text(sourceLevel));
  const sourceKind=result?.events.find(event=>event.offset===link.sourceOffset)?.kind??'REQ';
  button(host,sourceKind+' @ '+offset(link.sourceOffset),()=>selectOffset(link.sourceOffset,'request'));
  if(link.targetEntry===null)return;
  make('p',host,text('requestTargetEvidence')+' · Entry '+offset(link.targetEntry));
  const targetProofs=new Map<number,'core'|'strong'>();
  for(const control of result?.controls??[]){
   if(control.root===link.targetEntry&&control.strong&&targetProofs.get(control.targetOffset)!=='core')
    targetProofs.set(control.targetOffset,control.core?'core':'strong');
  }
  for(const target of link.targetEventOffsets){
   const row=make('div',host);row.dataset.requestTargetEvidence=targetProofs.get(target)??'empty';
   make('span',row,text(row.dataset.requestTargetEvidence)+' · ');
   button(row,text('select')+' @ '+offset(target),()=>selectOffset(target));
  }
 }
 function readNumber(input:HTMLInputElement):number|undefined|null {
  const value=input.value.trim();if(!value)return undefined;
  if(!/^(?:[0-9]+|0x[0-9a-f]+)$/i.test(value))return null;
  const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;
 }
 function createView(fold:HTMLDetailsElement,prefix:string,fixed:FieldEventRow|null) {
  const title=make('summary',fold),body=make('div',fold),limit=make('p',body),summary=make('p',body),units=make('p',body);
  const form=make('div',body);form.className='event-evidence-form field-conditional-form';
  const labels=new Map<string,HTMLElement>();
  const inputs=new Map<string,HTMLInputElement>();
  for(const name of ['ifOffset','actor','entry']) {
   const label=make('label',form);labels.set(name,make('span',label));const input=make('input',label);
   input.type='text';input.id=prefix+'-'+name;input.autocomplete='off';input.spellcheck=false;inputs.set(name,input);
   input.oninput=()=>changed();
  }
  const kindLabel=make('label',form);labels.set('targetKind',make('span',kindLabel));const kind=make('select',kindLabel);kind.id=prefix+'-targetKind';kind.onchange=()=>changed();
  const levelLabel=make('label',form);labels.set('level',make('span',levelLabel));const level=make('select',levelLabel);level.id=prefix+'-level';
  for(const value of levels){const option=make('option',level);option.value=value;}
  level.value='strong';level.onchange=()=>changed();
  const resetButton=button(body,'',()=>{reset();changed();});resetButton.id=prefix+'-reset';
  const status=make('p',body);status.id=prefix+'-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const list=make('section',body),details=make('details',body),detailsTitle=make('summary',details),detailBody=make('div',details);
  details.id=prefix+'-detail';
  let focused:Evidence|null=null;
  const pager=sourceResultPager<Evidence>(list,prefix,proofCaption,row=>{
   if(!live())return refresh(ports.current());focused=row;details.open=true;showProof(detailBody,row);if(row.event)select(row.event);
  },(node,row)=>{node.dataset.conditionalLevel=row.level;if(row.event)node.dataset.eventEvidenceKey=row.event.key;if(row.ifOffset!==null)node.dataset.ifOffset=String(row.ifOffset);});
  const rootsFold=make('details',body),rootsTitle=make('summary',rootsFold),rootDetail=make('div',rootsFold);
  rootsFold.id=prefix+'-roots';
  const rootsPager=sourceResultPager<Root>(rootsFold,prefix+'-roots',r=>offset(r.entry)+' · '+text(r.status==='accepted'?'accepted':unknownReason(r.reason)?'unknown':'rejected')+' · '+r.aliases.length,
   r=>{if(live())showRoot(rootDetail,r);});
  const askFold=make('details',body),askTitle=make('summary',askFold),askNote=make('p',askFold),askDetail=make('div',askFold);
  askFold.id=prefix+'-ask';
  const askPager=sourceResultPager<AskLink>(askFold,prefix+'-ask',r=>text(r.status==='local'?'local':'candidate')+' · ASK '+offset(r.askOffset)+' → IF '+offset(r.ifOffset)+' · Entry '+offset(r.root),r=>{if(live())showAsk(askDetail,r);});
  const requestFold=make('details',body),requestTitle=make('summary',requestFold),requestNote=make('p',requestFold),requestDetail=make('div',requestFold);
  requestFold.id=prefix+'-request';
  const requestPager=sourceResultPager<RequestLink>(requestFold,prefix+'-request',r=>text(r.status)+' · REQ '+offset(r.sourceOffset)+' → A'+r.targetActor+'/S'+r.slot+' @ '+offset(r.targetEntry),r=>{if(live())showRequest(requestDetail,r);});
  const sourceFold=make('details',body),sourceTitle=make('summary',sourceFold),sourceBody=make('pre',sourceFold);
  sourceFold.id=prefix+'-source';
  const diagnosticsFold=make('details',body),diagnosticsTitle=make('summary',diagnosticsFold),diagnosticsBody=make('pre',diagnosticsFold);
  diagnosticsFold.id=prefix+'-diagnostics';
  let kindSignature='',viewDisposed=false;
  function reset() {
   for(const input of inputs.values())input.value='';kind.value='';level.value='strong';focused=null;
   details.open=false;detailBody.replaceChildren();rootDetail.replaceChildren();askDetail.replaceChildren();requestDetail.replaceChildren();
  }
  function changed() {if(disposed||viewDisposed)return;if(!live()){refresh(ports.current());return;}focused=null;detailBody.replaceChildren();update();if(fold.open)void analyze();}
  function filters():Filters|null {
   const values=Object.fromEntries([...inputs].map(([key,input])=>[key,readNumber(input)]));
   if(Object.values(values).some(v=>v===null))return null;
   return {ifOffset:values.ifOffset,actor:values.actor,entry:values.entry,kind:kind.value,level:level.value as Level} as Filters;
  }
  function empty() {
   pager.set([]);rootsPager.set([]);askPager.set([]);requestPager.set([]);detailBody.replaceChildren();rootDetail.replaceChildren();askDetail.replaceChildren();requestDetail.replaceChildren();
   sourceBody.textContent='';diagnosticsBody.textContent='';delete fold.dataset.rows;delete fold.dataset.rawRoots;delete fold.dataset.events;
  }
  function update() {
   if(viewDisposed)return;
   title.textContent=text(fixed?'inspect':'title')+(fixed?' · '+fixed.kind+' @ '+offset(fixed.offset):'');
   limit.textContent=text('limit');units.textContent=text('units');resetButton.textContent=text('reset');detailsTitle.textContent=text('detail');
   rootsTitle.textContent=text('roots');askTitle.textContent=text('ask');askNote.textContent=text('askLimit');
   requestTitle.textContent=text('request');requestNote.textContent=text('requestLimit');sourceTitle.textContent=text('source');diagnosticsTitle.textContent=text('diagnostics');
   for(const [name,label]of labels){label.textContent=text(name);(inputs.get(name)??(name==='targetKind'?kind:level)).setAttribute('aria-label',text(name));}
   for(const option of level.options)option.textContent=text(option.value);
   const kinds:string[]=[...new Set(sourceEvents().map(e=>e.kind))].sort(),signature=kinds.join('/');
   if(kindSignature!==signature||!kind.options.length){const chosen=kind.value;kind.replaceChildren();for(const value of ['',...kinds]){const option=make('option',kind);option.value=value;option.textContent=value||text('all');}kind.value=kinds.includes(chosen)?chosen:'';kindSignature=signature;}
   else if(kind.options.length)kind.options[0].textContent=text('all');
   if(!index||!live()){
    summary.textContent=index?text('lazy'):text('unavailable');status.textContent=busy?text('busy'):failed?text('error'):index?text('lazy'):text('unavailable');
    fold.dataset.state=busy?'running':failed?'error':index?'idle':'unavailable';empty();return;
   }
   const all=sourceEvents();
   fold.dataset.state=busy?'running':failed?'error':result?.status??'idle';
   summary.textContent=result?text('summary',{roots:result.roots.length,aliases:result.roots.reduce((n,r)=>n+r.aliases.length,0),events:all.length,relations:result.controls.length}):text('lazy');
   fold.dataset.rawRoots=String(result?.roots.length??0);fold.dataset.events=String(all.length);
   sourceBody.textContent=result?JSON.stringify(result.identity,null,2):'';
   diagnosticsBody.textContent=result?JSON.stringify({status:result.status,complete:result.complete,problems:result.problems,stats:result.stats},null,2):'';
   const f=filters();if(!f){status.textContent=text('invalid');pager.set([]);rootsPager.set([]);askPager.set([]);requestPager.set([]);delete fold.dataset.rows;return;}
   const selection=evidenceRows(f,fixed);pager.set(selection.rows);fold.dataset.rows=String(selection.rows.length);
   status.textContent=busy?text('busy'):failed?text('error'):!result?text('lazy'):result.status==='unavailable'?text('unavailable'):text('matches',{count:selection.rows.length})+(selection.rows.length?'':' · '+text('empty'));
   if(result&&(result.status==='limited'||!result.complete)||selection.limited)status.textContent+=' · '+text('limited');
   const target=eventFor(fixed),entries=target?.owningRoots??fixed?.owners.map(o=>o.entry);
   rootsPager.set((result?.roots??[]).filter(r=>(!entries||entries.includes(r.entry))&&filterRoot(r.entry,f)));
   const relevantIfs=fixed?new Set((result?.controls??[]).filter(c=>c.targetOffset===fixed.offset).map(c=>c.ifOffset)):null;
   askPager.set((result?.askLinks??[]).filter(a=>(f.ifOffset===undefined||a.ifOffset===f.ifOffset)&&filterRoot(a.root,f)&&
    (!fixed||a.askOffset===fixed.offset||a.ifOffset===fixed.offset||!!relevantIfs?.has(a.ifOffset))));
   requestPager.set((result?.requestLinks??[]).filter(r=>(f.actor===undefined||r.targetActor===f.actor)&&(f.entry===undefined||r.targetEntry===f.entry)&&
    (!fixed||r.sourceOffset===fixed.offset||r.targetEventOffsets.includes(fixed.offset))&&
    (!f.kind||r.targetEventOffsets.some(o=>all.some(e=>e.offset===o&&e.kind===f.kind)))));
   if(focused)showProof(detailBody,focused);
  }
  function toggle() {
   if(disposed||viewDisposed)return;
   if(fold.open){if(failed)failed=false;void analyze();}else if(busy&&!open()){stopPending();render();}
  }
  fold.addEventListener('toggle',toggle);
  return {fold,fixed,update,reset,focusIf(offset:number){const input=inputs.get('ifOffset');if(input)input.value=String(offset);update();},dispose(){viewDisposed=true;fold.removeEventListener('toggle',toggle);pager.dispose();rootsPager.dispose();askPager.dispose();requestPager.dispose();for(const input of inputs.values())input.oninput=null;kind.onchange=level.onchange=null;resetButton.onclick=null;}};
 }
 function render() {
  if(disposed)return;
  if(index&&!live())bind(invalidated?null:ports.current());
  main.update();inspection?.update();
 }
 function refresh(next:FieldEventIndex|null) {
  if(disposed)return;invalidated=false;bind(next);render();if(open())void analyze();
 }
 function inspect(host:HTMLElement,row:FieldEventRow) {
  if(disposed||invalidated)return;
  bind(ports.current());
  const wasOpen=inspection?.fixed===row&&inspection.fold.open;removeInspection();
  host.querySelector('#field-conditional-inspection')?.remove();
  if(!index||!live()||!index.rows.includes(row)){if(busy&&!open())stopPending();return;}
  const fold=make('details',host);fold.id='field-conditional-inspection';fold.className='field-conditional-inspection';
  inspection=createView(fold,'field-conditional-inspection',row);fold.open=!!wasOpen;inspection.update();
  if(fold.open)void analyze();else if(busy&&!open())stopPending();
 }
 function clearInspection() {
  if(disposed)return;removeInspection();if(busy&&!open())stopPending();render();
 }
 function invalidate() {
  if(disposed)return;invalidated=true;stopPending();session.invalidate();index=null;result=null;failed=false;witnessCache.clear();removeInspection();main.reset();render();
 }
 const unlisten=onLocaleChange(render);
 refresh(ports.current());
 return {element:panel,refresh,inspect,clearInspection,invalidate,focusIf:main.focusIf,dispose(){if(disposed)return;invalidate();disposed=true;unlisten();main.dispose();session.dispose();panel.remove();}};
}
