// SPDX-License-Identifier: GPL-3.0-only
import {createFieldEventIndex,fieldEventPath} from '../analysis/fieldEventEvidence';
import type {FieldEventInput,FieldEventIndex,FieldEventRow,FieldEventFilter} from '../analysis/fieldEventEvidence';
import {FieldGatewayNetwork} from '../analysis/fieldGateway';
import type {GatewayResources,GatewayStart} from '../analysis/fieldGateway';
import {appStore} from '../app/state';
import {ResourceScope} from '../app/resources';
import {sourceResultPager} from './surfaceQueries';
import {evidenceSection} from './contentPresentation';
import {t,onLocaleChange} from '../i18n';
export interface FieldEventPorts {
 input():FieldEventInput|null;gateways():GatewayResources|null;triangle():number;inspector():HTMLElement;reveal?():void;clearPath?():void;
 select(row:FieldEventRow):void;showTriangle(id:number):void;showPath(start:number,end:number,anchor:string):void;
}
const stamp=(s:FieldEventInput)=>[s.generation,s.fieldId,s.contextSHA256,s.walkmeshSHA256,s.meshSHA256,s.interaction?.sha256,s.script?.sha256,s.gameplay?.sha256].join('/');
export function mountFieldEventEvidence(ports:FieldEventPorts){
 const scope=new ResourceScope(),box=document.createElement('details');box.id='field-event-evidence';box.className='field-event-tool';
 const make=<K extends keyof HTMLElementTagNameMap>(tag:K,parent:HTMLElement,text='')=>{const n=document.createElement(tag);n.textContent=text;parent.append(n);return n;};
 const button=(host:HTMLElement,text:string,fn:()=>void)=>{const b=make('button',host,text);b.type='button';b.onclick=fn;return b;};
 const title=make('summary',box),body=make('div',box),note=make('p',body),identity=make('p',body),form=make('div',body);form.className='event-evidence-form';
 const labels=new Map<string,HTMLElement>(),inputs=new Map<string,HTMLInputElement|HTMLSelectElement>();
 for(const key of ['actor','slot','entry','offset','triangle']){const label=make('label',form),caption=make('span',label),input=make('input',label);labels.set(key,caption);inputs.set(key,input);input.id='field-events-'+key;input.type='number';input.min='0';input.step='1';input.oninput=()=>{pageRows();};}
 for(const [key,values]of [['channel',['','interaction','script','gameplay']],['kind',['','trigger','line','linon','sline','item','materia','battle','flag']],['geometry',['','surface','xy_only','disjoint','variable','no_geometry']]] as const){const label=make('label',form),caption=make('span',label),input=make('select',label);labels.set(key,caption);inputs.set(key,input);input.id='field-events-'+key;for(const value of values){const o=make('option',input);o.value=value;o.textContent=value||t('evgeo.all');}input.onchange=pageRows;}
 const current=button(body,'',()=>filterTriangle(ports.triangle())),reset=button(body,'',()=>{for(const n of inputs.values())n.value='';pageRows();}),status=make('p',body),list=make('section',body),startLabel=make('label',body),startCaption=make('span',startLabel),start=make('select',startLabel),run=button(body,'',()=>void path());
 start.id='field-events-start';run.id='field-events-path';status.id='field-events-status';status.setAttribute('role','status');
 let index:FieldEventIndex|null=null,selected:FieldEventRow|null=null,last='',ticket=0,engine:FieldGatewayNetwork|null=null,inspection:ResourceScope|null=null,pathResult:ReturnType<typeof fieldEventPath>|null=null,seedProof:unknown=null,busy=false,issue='';
 let pending:{key:string;contextSHA256:string;gameplaySHA256:string;generation:number}|null=null;
 const seeds=new Map<string,GatewayStart>();
 const caption=(r:FieldEventRow)=>`${r.channel} · ${r.kind} @ ${r.offset} · ${r.owners.map(o=>`A${o.actor}/S${o.slot}/${o.kind}@${o.entry}`).join(' | ')||'Section 8'} · ${t('evgeo.'+r.geometry)}`;
 const pager=sourceResultPager<FieldEventRow>(list,'field-events',caption,select,(b,r)=>{b.dataset.eventEvidenceKey=r.key;});scope.own(pager.dispose);
 function pageRows(){if(!index){pager.set([]);delete box.dataset.rows;status.textContent=t('evgeo.unavailable');return;}const f:FieldEventFilter={};for(const [key,n]of inputs){if(!n.value)continue;if(['actor','slot','entry','offset','triangle'].includes(key)){const value=Number(n.value);if(!Number.isSafeInteger(value)||value<0){status.textContent=t('evgeo.invalid');pager.set([]);return;}(f as Record<string,unknown>)[key]=value;}else (f as Record<string,unknown>)[key]=n.value;}
  const rows=index.query(f);pager.set(rows);status.textContent=t('evgeo.results',{count:rows.length,total:index.rows.length})+(index.problems.length?' · '+t('evgeo.conflict')+' '+index.problems.join(', '):'');box.dataset.rows=String(rows.length);
 }
 function draw(){title.textContent=t('evgeo.fieldTitle');note.textContent=t('evgeo.limit');identity.textContent=index?`${index.input.fields.nodes.get(index.input.fieldId)!.name} / Field ${index.input.fieldId}`:t('evgeo.unavailable');for(const [key,label]of labels){label.textContent=t('evgeo.'+key);inputs.get(key)!.setAttribute('aria-label',t('evgeo.'+key));}for(const key of ['channel','kind','geometry'])for(const o of (inputs.get(key) as HTMLSelectElement).options)o.textContent=o.value?key==='kind'&&/^[A-Z]/.test(o.value)?o.value:t('evgeo.'+o.value):t('evgeo.all');current.textContent=t('evgeo.currentTriangle');reset.textContent=t('evgeo.reset');startCaption.textContent=t('evgeo.start');run.textContent=t(busy?'evgeo.busy':'evgeo.path');run.disabled=busy||!index||selected?.geometry!=='surface'||!start.value;
  current.disabled=!index;start.setAttribute('aria-label',t('evgeo.start'));pageRows();if(issue)status.textContent=t('evgeo.'+issue);
 }
 function choices(){const chosen=start.value;start.replaceChildren();seeds.clear();const r=ports.gateways(),id=index?.input.fieldId;if(!r||id===undefined)return;
  const add=(key:string,seed:GatewayStart,label:string)=>{seeds.set(key,seed);const o=make('option',start,label);o.value=key;};
  for(const e of r.poi?.entrances??[])if(e.field_id===id)add('world:'+e.id,{kind:'world',entranceId:e.id},`WM0 · FIELD.TBL ${e.field_table_record} → △${e.field_triangle}`);
  for(const g of r.index.pack.gateways??[])if(g.to===id&&g.sourceRelation==='surface'&&['inside','boundary'].includes(g.destination.status))add(`arrival:${g.fromField}:${g.gateway}`,{kind:'arrival',fromField:g.fromField,gateway:g.gateway},`${g.fromField} / G${g.gateway} → △${g.targetTriangle}`);
  if(seeds.has(chosen))start.value=chosen;
 }
 function same(snapshot:FieldEventInput){const now=ports.input();return !!now&&stamp(snapshot)===stamp(now)&&snapshot.fields===now.fields&&snapshot.mesh===now.mesh&&snapshot.gameplay?.index===now.gameplay?.index;}
 function refresh(){const input=ports.input();if(!input){if(index)invalidate();draw();return;}if(last!==stamp(input)||index?.input.fields!==input.fields||index.input.mesh!==input.mesh||index.input.gameplay?.index!==input.gameplay?.index){if(index)ports.clearPath?.();ticket++;busy=false;engine?.dispose();engine=null;inspection?.dispose();inspection=null;ports.inspector().querySelector('#field-event-inspection')?.remove();selected=null;pathResult=null;seedProof=null;issue='';index=createFieldEventIndex(input);last=stamp(input);const kind=inputs.get('kind') as HTMLSelectElement,chosen=kind.value;kind.replaceChildren();for(const value of ['',...new Set(index.rows.map(r=>r.kind))]){const o=make('option',kind);o.value=value;}if([...kind.options].some(o=>o.value===chosen))kind.value=chosen;choices();}
  draw();if(pending){const p=pending;pending=null;if(p.contextSHA256===input.contextSHA256&&p.gameplaySHA256===input.gameplay?.sha256&&p.generation===input.generation){const row=index!.rows.find(r=>r.key===p.key);if(row){box.open=true;select(row);}}}
 }
 function select(row:FieldEventRow){if(!index||!same(index.input))return;ports.clearPath?.();ticket++;busy=false;issue='';selected=row;pathResult=null;seedProof=null;ports.select(row);inspect(ports.inspector());draw();document.dispatchEvent(new Event('gaiagis:inspect'));}
 function inspect(host:HTMLElement){inspection?.dispose();inspection=null;host.querySelector('#field-event-inspection')?.remove();if(!index||!selected||!same(index.input))return;const row=selected,section=make('section',host);section.id='field-event-inspection';section.className='field-triangle-details';section.dataset.key=row.key;make('h3',section,t('evgeo.fieldTitle'));make('p',section,caption(row));make('p',section,t('evgeo.limit'));make('p',section,t('evgeo.verifiedSource'));
  if(row.candidates.length){make('p',section,t('evgeo.contact'));for(const id of row.candidates){const b=button(section,'△'+id,()=>ports.showTriangle(id));b.dataset.eventContact=String(id);}}else make('p',section,t('evgeo.no_geometry'));
  if(row.channel==='gameplay')document.dispatchEvent(new CustomEvent('gaiagis:gameplay-record-evidence',{detail:{host:section,recordId:(row.record as {id:string}).id}}));
  const related=make('details',section),summary=make('summary',related,t('evgeo.related'));summary.dataset.relation='candidate';make('p',related,t('evgeo.candidate'));const relations=index.relations(row),rp=sourceResultPager<(typeof relations)[number]>(related,'field-event-relations',r=>t('evgeo.'+r.relation)+' · '+caption(r.row),r=>select(r.row),(b,r)=>{b.dataset.eventRelation=r.row.key;});rp.set(relations);inspection=new ResourceScope();inspection.own(rp.dispose);
  if(pathResult){make('p',section,t('evgeo.'+pathResult.status));make('pre',section,JSON.stringify({start:seedProof,reachable:pathResult.reachable,unreachable:pathResult.unreachable,triangles:pathResult.path?.ids??[],access:pathResult.path?.steps??[]},null,2));section.dataset.reach=pathResult.status;}
  const raw=evidenceSection(section,t('evgeo.provenance'));make('pre',raw,JSON.stringify({contextSHA256:index.input.contextSHA256,walkmeshSHA256:index.input.walkmeshSHA256,section1SHA256:index.section1SHA256,section5SHA256:index.input.meshSHA256,section8SHA256:index.section8SHA256,interactionSHA256:index.input.interaction?.sha256,scriptSHA256:index.input.script?.sha256,gameplaySHA256:index.input.gameplay?.sha256,generation:index.input.generation,fieldId:index.input.fieldId,record:row.record},null,2));
 }
 async function path(){const current=index,row=selected,r=ports.gateways(),seed=seeds.get(start.value);if(!current||!row||!r||!seed||row.geometry!=='surface')return;const request=++ticket;busy=true;issue='';draw();
  try{engine?.dispose();const solver=engine=new FieldGatewayNetwork(r),answer=await solver.solve(seed,current.input.fieldId,1,()=>request===ticket&&same(current.input));if(scope.disposed||request!==ticket||!same(current.input)||!r.current())return;
   if(answer.status!=='success'||answer.legs.length){issue='invalidStart';}else{const root=answer.states[0],scene=await solver.scene(root.fieldId);if(scope.disposed||request!==ticket||!same(current.input))return;pathResult=fieldEventPath(row,scene.network,root.triangle);seedProof={seed,point:root,identity:answer.identity};if(pathResult.path){const key=seed.kind==='world'?'entrance:'+r.poi!.entrances.find(e=>e.id===seed.entranceId)!.field_table_record:`arrival:${seed.fromField}:${seed.gateway}`;ports.showPath(root.triangle,pathResult.path.ids.at(-1)!,key);box.open=false;}inspect(ports.inspector());}
  }catch{if(request===ticket)issue='conflict';}finally{if(request===ticket){busy=false;draw();}}
 }
 function filterTriangle(id:number){ports.reveal?.();inputs.get('triangle')!.value=String(id);box.open=true;pageRows();inputs.get('triangle')!.focus();}
 function invalidate(){ports.clearPath?.();ticket++;pending=null;busy=false;engine?.dispose();engine=null;inspection?.dispose();inspection=null;index=null;selected=null;last='';pathResult=null;seedProof=null;issue='';pager.set([]);ports.inspector().querySelector('#field-event-inspection')?.remove();}
 start.onchange=()=>{ports.clearPath?.();ticket++;busy=false;pathResult=null;seedProof=null;draw();inspect(ports.inspector());};scope.own(onLocaleChange(()=>{draw();inspect(ports.inspector());}));draw();
 return {attach(host:HTMLElement){host.append(box);refresh();},refresh,inspect,filterTriangle,invalidate,
  openRecord(key:string){refresh();const row=index?.rows.find(r=>r.key===key);if(row){ports.reveal?.();box.open=true;select(row);}},
  request(key:string,contextSHA256:string,gameplaySHA256:string,generation:number){pending={key,contextSHA256,gameplaySHA256,generation};box.open=true;},
  dispose(){invalidate();pending=null;scope.dispose();box.remove();}};
}
