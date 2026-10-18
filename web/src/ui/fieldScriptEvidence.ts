// SPDX-License-Identifier: GPL-3.0-only
import {SCRIPT_OPCODES,filterScriptEvidence} from '../data/fieldScriptEvidence';
import type {ScriptEvidenceFilter,ScriptEvidenceRecord,ScriptEvidenceScene} from '../data/fieldScriptEvidence';
import {ResourceScope} from '../app/resources';

type Translate=(key:string,args?:Record<string,string|number>)=>string;
const element=<K extends keyof HTMLElementTagNameMap>(tag:K,parent:HTMLElement,text?:string)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;parent.append(e);return e;};
const detail=(parent:HTMLElement,title:string)=>{const d=element('details',parent);element('summary',d,title);return d;};
const pre=(parent:HTMLElement,text:string)=>{const e=element('pre',parent,text);e.style.whiteSpace='pre-wrap';e.style.overflowWrap='anywhere';return e;};

/** Borrowed data is displayed only; selection never executes an instruction. */
export function renderScriptEvidenceRecord(parent:HTMLElement,scene:ScriptEvidenceScene,record:ScriptEvidenceRecord,t:Translate,onPreview?:((group:number,bit:number)=>void),owner?:ResourceScope,canPreview?:((group:number,bit:number)=>boolean)){
 const host=element('div',parent);host.dataset.scriptOffset=String(record.offset);host.dataset.scriptOpcode=String(record.opcode);host.className='field-script-record';
 element('h4',host,`${SCRIPT_OPCODES[record.opcode].name} · Section 1 @ ${record.offset}`);
 element('p',host,t('scriptEvidence.limit'));
 element('p',host,t('scriptEvidence.source',{field:scene.name,hash:scene.section1SHA256}));
 const source=detail(host,t('scriptEvidence.original'));pre(source,`${record.raw}\nlength = ${record.length}\nconfidence = ${record.confidence}\nruntime = ${record.runtime}`);
 const operands=detail(host,t('scriptEvidence.operands'));
 pre(operands,record.operands.map(p=>`${p.name} @ +${p.offset} · ${p.bytes===1?'U8':p.signed?'S16':'U16'} = ${p.value} · bank ${p.bank??'—'} · ${p.kind}`).join('\n'));
 if(record.operands.some(p=>p.kind!=='literal'))element('p',host,t('scriptEvidence.variable'));
 const owners=detail(host,t('scriptEvidence.owners'));pre(owners,record.owners.map(id=>{const e=scene.entries[id];return `#${id} · Actor ${e.actor}${e.name===null?'':' / '+e.name} · Slot ${e.slot} · ${e.kind} @ ${e.entry}`;}).join('\n'));
 const a=record.association,association=element('p',host);
 association.textContent=a.group===null&&a.stateBit===null&&a.layer===null?t('scriptEvidence.noAssociation'):`${t('scriptEvidence.association')}: ${a.group===null?'':`Group ${a.group} `}${a.stateBit===null?'':`State Bit ${a.stateBit} `}${a.layer===null?'':`Layer operand ${a.layer}`}`;
 if(a.group!==null&&a.stateBit!==null){
  if(onPreview&&canPreview?.(a.group,a.stateBit)){const preview=element('button',host,t('scriptEvidence.preview'));preview.type='button';preview.dataset.scriptPreview=String(record.offset);const select=()=>{if(canPreview(a.group!,a.stateBit!))onPreview(a.group!,a.stateBit!);};if(owner)owner.listen(preview,'click',select);else preview.onclick=select;element('p',host,t('scriptEvidence.previewLimit'));}
  else element('p',host,t('scriptEvidence.noPreview'));
 }
 if(record.unknown.length)pre(host,record.unknown.map(v=>'UNKNOWN · '+v).join('\n'));
 return host;
}

export interface ScriptEvidencePanelOptions {
 owner:ResourceScope;t:Translate;scene:ScriptEvidenceScene|null;problem?:string|null;
 onSelect?:(record:ScriptEvidenceRecord)=>void;onClear?:()=>void;onPreview?:(group:number,bit:number)=>void;canPreview?:(group:number,bit:number)=>boolean;
}
/** One current scene, paged selects, native controls and scoped listeners. */
export function mountFieldScriptEvidence(parent:HTMLElement,options:ScriptEvidencePanelOptions){
 const scope=new ResourceScope(),{t,scene}=options,host=detail(parent,t('scriptEvidence.title'));host.id='field-script-evidence';host.style.minWidth='0';
 let selectionScope:ResourceScope|null=null,disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;const hadSelection=selectionScope!==null;selectionScope?.dispose();selectionScope=null;scope.dispose();host.replaceChildren();host.remove();if(hadSelection)options.onClear?.();};options.owner.own(dispose);
 element('p',host,t('scriptEvidence.limit'));
 if(!scene){host.dataset.state=options.problem?'rejected':'absent';element('p',host,t(options.problem?'scriptEvidence.rejected':'scriptEvidence.absent'));return {element:host,dispose};}
 host.dataset.state='ready';host.dataset.fieldId=String(scene.fieldId);host.dataset.records=String(scene.records.length);host.dataset.status=scene.status;
 element('p',host,t('scriptEvidence.count',{records:scene.records.length,decoded:scene.decodedInstructions,reachable:scene.reachableInstructions,entries:scene.entries.length}));
 if(['partial','limited','invalid_source'].includes(scene.status))element('p',host,t('scriptEvidence.partial'));
 const filters=detail(host,t('scriptEvidence.filters')),tools=element('div',filters);tools.className='field-canvas-controls';
 const inputs:Partial<Record<keyof ScriptEvidenceFilter,HTMLInputElement>>={},limits:{key:keyof ScriptEvidenceFilter;max:number}[]=[{key:'actor',max:63},{key:'slot',max:31},{key:'group',max:255},{key:'layer',max:3},{key:'offset',max:Math.max(0,(scene.codeEnd??1)-1)}];
 for(const {key,max}of limits){const label=element('label',tools,t('scriptEvidence.'+key)),input=element('input',label);input.type='number';input.min='0';input.max=String(max);input.step='1';input.id='field-script-filter-'+key;input.setAttribute('aria-label',t('scriptEvidence.'+key));input.placeholder=t('scriptEvidence.all');input.style.maxWidth='100%';input.style.width='9em';inputs[key]=input;}
 const opcodeLabel=element('label',tools,t('scriptEvidence.opcode')),opcode=element('select',opcodeLabel);opcode.id='field-script-filter-opcode';element('option',opcode,t('scriptEvidence.all')).value='';for(const id of [...new Set(scene.records.map(r=>r.opcode))].sort((a,b)=>a-b))element('option',opcode,SCRIPT_OPCODES[id].name).value=String(id);
 const reset=element('button',tools,t('scriptEvidence.reset'));reset.type='button';reset.id='field-script-filter-reset';
 const listLabel=element('label',host,t('scriptEvidence.select')),select=element('select',listLabel);select.id='field-script-selector';select.style.width='100%';select.style.maxWidth='100%';select.setAttribute('aria-label',t('scriptEvidence.select'));
 const navigation=element('div',host);navigation.className='field-canvas-controls';const previous=element('button',navigation,t('scriptEvidence.previous')),next=element('button',navigation,t('scriptEvidence.next')),pageLabel=element('p',host);previous.type=next.type='button';previous.id='field-script-previous';next.id='field-script-next';
 const selected=element('div',host);selected.id='field-script-details';
 const coverage=detail(host,t('scriptEvidence.coverage'));coverage.id='field-script-coverage';pre(coverage,JSON.stringify({status:scene.status,reason:scene.reason,codeStart:scene.codeStart,codeEnd:scene.codeEnd,decodedBytes:scene.decodedBytes,reachableBytes:scene.reachableBytes,uncovered:scene.uncovered,unreachable:scene.unreachable,stops:scene.stops,section1SHA256:scene.section1SHA256,section8SHA256:scene.section8SHA256},null,2));
 let page=0,matching=scene.records;
 const clearSelection=()=>{const hadSelection=selectionScope!==null;selectionScope?.dispose();selectionScope=null;selected.replaceChildren();delete host.dataset.selectedOffset;if(hadSelection)options.onClear?.();};
 const update=()=>{
  if(disposed)return;clearSelection();const filter:ScriptEvidenceFilter={};let valid=true;
  for(const {key,max}of limits){const input=inputs[key]!;input.removeAttribute('aria-invalid');if(input.value==='')continue;const value=Number(input.value);if(!Number.isSafeInteger(value)||value<0||value>max){input.setAttribute('aria-invalid','true');input.title=t('scriptEvidence.invalidFilter');valid=false;}else{input.removeAttribute('title');filter[key]=value;}}
  if(opcode.value!=='')filter.opcode=Number(opcode.value);matching=valid?filterScriptEvidence(scene,filter):[];const pages=Math.max(1,Math.ceil(matching.length/100));page=Math.min(page,pages-1);
  select.replaceChildren();element('option',select,t('scriptEvidence.select')).value='';for(const r of matching.slice(page*100,(page+1)*100))element('option',select,`${SCRIPT_OPCODES[r.opcode].name} @ ${r.offset}`).value=String(r.offset);
  select.disabled=!matching.length;previous.disabled=page===0;next.disabled=page>=pages-1;pageLabel.textContent=t(matching.length?'scriptEvidence.page':'scriptEvidence.empty',{count:matching.length,page:page+1,pages});host.dataset.matches=String(matching.length);
 };
 scope.listen(select,'change',()=>{clearSelection();if(select.value==='')return;const record=matching.find(r=>r.offset===Number(select.value));if(!record)return;selectionScope=new ResourceScope();renderScriptEvidenceRecord(selected,scene,record,t,options.onPreview,selectionScope,options.canPreview);host.dataset.selectedOffset=String(record.offset);options.onSelect?.(record);});
 for(const input of Object.values(inputs))scope.listen(input,'input',()=>{page=0;update();});scope.listen(opcode,'change',()=>{page=0;update();});
 scope.listen(reset,'click',()=>{for(const input of Object.values(inputs))input.value='';opcode.value='';page=0;update();});scope.listen(previous,'click',()=>{page--;update();});scope.listen(next,'click',()=>{page++;update();});
 scope.own(clearSelection);update();return {element:host,dispose};
}
