// SPDX-License-Identifier: GPL-3.0-only
import {FieldGatewayNetwork} from '../analysis/fieldGateway';
import type {GatewayResources,GatewayStart,GatewayLeg,GatewayResult} from '../analysis/fieldGateway';
import {validateWorldEntrance} from '../data/fieldContext';
import {ResourceScope} from '../app/resources';
import {t,onLocaleChange,formatNumber} from '../i18n';
import {evidenceSection} from './contentPresentation';

type Scene=Awaited<ReturnType<FieldGatewayNetwork['scene']>>;
export interface FieldGatewayPorts {resources:()=>GatewayResources|null;usable:()=>boolean;showLeg:(leg:GatewayLeg,scene:Scene,start:GatewayStart)=>void;changed?:()=>void;}
const startKey=(s:GatewayStart)=>s.kind==='world'?'world:'+s.entranceId:`arrival:${s.fromField}:${s.gateway}`;
/** One session owner reused across Field render scopes; never mounts another Canvas. */
export function mountFieldGateway(ports:FieldGatewayPorts){
 const scope=new ResourceScope(),box=document.createElement('details');box.id='field-gateway-query';box.className='field-anchor-controls gateway-query';
 const make=<K extends keyof HTMLElementTagNameMap>(tag:K,host:HTMLElement,text='')=>{const e=document.createElement(tag);e.textContent=text;host.append(e);return e;};
 const title=make('summary',box),note=make('p',box),form=make('div',box);form.className='gateway-query-form';
 const select=(id:string)=>{const label=make('label',form),caption=make('span',label),input=make('select',label);input.id='field-gateway-'+id;return {label,caption,input};};
 const start=select('start'),target=select('target'),limit=select('limit'),run=make('button',form),clear=make('button',form),status=make('p',box),results=make('div',box),diagnostics=make('details',box),diagnosticsTitle=make('summary',diagnostics),diagnosticsBody=make('div',diagnostics);
 run.id='field-gateway-run';clear.id='field-gateway-clear';run.type=clear.type='button';status.id='field-gateway-status';status.setAttribute('role','status');note.className=status.className='control-note';
 let engine:FieldGatewayNetwork|null=null,result:GatewayResult|null=null,pending:GatewayResources|null=null,field:number|null=null,chosenStart='',chosenTarget='',chosenLimit=3,choices=new Map<string,GatewayStart>(),ticket=0,viewTicket=0,busy=false,problem='',activeLeg:number|null=null;
 const same=(a:GatewayResources,b:GatewayResources|null)=>!!b&&a.index===b.index&&a.pack===b.pack&&a.identity.contextSHA256===b.identity.contextSHA256&&a.identity.walkmeshSHA256===b.identity.walkmeshSHA256&&a.identity.generation===b.identity.generation&&a.current();
 const valid=(r:GatewayResources)=>engine?.resources.index===r.index&&engine.resources.pack===r.pack&&engine.identity.contextSHA256===r.identity.contextSHA256&&engine.identity.walkmeshSHA256===r.identity.walkmeshSHA256&&engine.identity.generation===r.identity.generation;
 const name=(id:number)=>{const n=ports.resources()?.index.nodes.get(id);return `${n?.name??'?'} / ${id}`;};
 function button(host:HTMLElement,text:string,fn:()=>void){const b=make('button',host,text);b.type='button';b.onclick=fn;return b;}
 function draw(){
  const r=ports.resources();title.textContent=t('gateway.title');note.textContent=t('gateway.scope');start.caption.textContent=t('gateway.start');target.caption.textContent=t('gateway.target');limit.caption.textContent=t('gateway.maxTransfers');
  for(const [c,key]of [[start,'start'],[target,'target'],[limit,'maxTransfers']] as const)c.input.setAttribute('aria-label',t('gateway.'+key));
  start.input.replaceChildren();target.input.replaceChildren();limit.input.replaceChildren();choices=new Map();const emptyStart=make('option',start.input,t('gateway.chooseStart'));emptyStart.value='';const emptyTarget=make('option',target.input,t('gateway.chooseTarget'));emptyTarget.value='';
  if(r){
   const world=make('optgroup',start.input);world.label=t('gateway.world');
   for(const e of r.poi?.entrances??[]){const v=validateWorldEntrance(r.index.pack,r.poi,e,null,r.pack.sources);if(v.reason!=='mesh_unavailable'||r.pack.scenes.get(e.field_id)?.status!=='available')continue;const s:GatewayStart={kind:'world',entranceId:e.id},key=startKey(s);choices.set(key,s);const o=make('option',world,`${e.field_name} / ${e.field_id} · FIELD.TBL ${e.field_table_record} · △${e.field_triangle}`);o.value=key;}
   const arrivals=make('optgroup',start.input);arrivals.label=t('gateway.arrival');
   for(const g of r.index.pack.gateways??[]){const key=`arrival:${g.fromField}:${g.gateway}`;if(g.to!==field&&key!==chosenStart)continue;if(g.sourceRelation!=='surface'||!['inside','boundary'].includes(g.destination.status)||!r.index.pack.edges.some(e=>e.fromField===g.fromField&&e.gateway===g.gateway&&e.to===g.to))continue;choices.set(key,{kind:'arrival',fromField:g.fromField,gateway:g.gateway});const o=make('option',arrivals,`${name(g.fromField)} G${g.gateway} → ${name(g.to)} · △${g.targetTriangle}`);o.value=key;}
   for(const n of r.index.nodes.values())if(n.status==='available'){const o=make('option',target.input,n.name+' / '+n.id);o.value=String(n.id);}
  }
  if(!choices.has(chosenStart))chosenStart='';start.input.value=chosenStart;target.input.value=chosenTarget;
  for(const n of [1,2,3]){const o=make('option',limit.input,String(n));o.value=String(n);}limit.input.value=String(chosenLimit);
  run.textContent=t('gateway.run');clear.textContent=t('gateway.clear');run.disabled=!ports.usable()||!r||busy||!chosenStart||chosenTarget==='';clear.disabled=!engine&&!result&&!busy;
  status.textContent=t('gateway.'+(busy?'busy':problem||(!r?'unavailable':result?.status??'ready')));results.replaceChildren();diagnosticsBody.replaceChildren();diagnosticsTitle.textContent=t('gateway.diagnostics');diagnostics.hidden=!result;
  if(result){box.dataset.status=result.status;box.dataset.legs=String(result.legs.length);box.dataset.elapsedMs=String(result.milliseconds);make('p',results,t('gateway.summary',{states:result.states.length,scenes:engine?.cachedScenes??0,ms:formatNumber(result.milliseconds,1)}));
   if(result.status==='success'&&!result.legs.length)make('p',results,t('gateway.alreadyHere'));
   result.legs.forEach((leg,i)=>{const b=button(results,`${i+1}. ${name(leg.fromField)} △${leg.startTriangle} → △${leg.endTriangle} · G${leg.gateway.gateway} → ${name(leg.arrival.fieldId)} △${leg.arrival.triangle}`,()=>void view(i));b.id='field-gateway-leg-'+i;b.setAttribute('aria-pressed',String(activeLeg===i));});
   for(const [key,value]of Object.entries(result.counts))make('p',diagnosticsBody,t('gateway.reason.'+key)+' · '+value);
   for(const d of result.diagnostics.slice(0,20))make('p',diagnosticsBody,`${name(d.fieldId)} △${d.triangle} · G${d.gateway} → ${name(d.to)} · ${t('gateway.reason.'+d.reason)}${d.candidates.length?' · ['+d.candidates.join(', ')+']':''}`);
   if(result.diagnostics.length>20)make('p',diagnosticsBody,t('gateway.boundedDiagnostics'));
  }else{delete box.dataset.status;delete box.dataset.legs;delete box.dataset.elapsedMs;}
 }
 function invalidate(){ticket++;viewTicket++;pending=null;busy=false;problem='';activeLeg=null;result=null;engine?.dispose();engine=null;chosenStart=chosenTarget='';draw();ports.changed?.();}
 async function query(){const r=ports.resources(),seed=choices.get(chosenStart);if(!r||!seed||!ports.usable())return;const request=++ticket;viewTicket++;pending=r;busy=true;result=null;activeLeg=null;problem='';draw();ports.changed?.();await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));if(scope.disposed||request!==ticket)return;if(!ports.usable()||!same(r,ports.resources())){invalidate();return;}
  try{if(!valid(r)){engine?.dispose();engine=new FieldGatewayNetwork(r);}const solver=engine!,answer=await solver.solve(seed,Number(chosenTarget),chosenLimit,()=>request===ticket&&!scope.disposed&&ports.usable());if(scope.disposed||request!==ticket)return;if(!same(r,ports.resources())||!valid(r)){invalidate();return;}result=answer;}catch{if(request===ticket)problem='source_mismatch';}
  if(request===ticket){pending=null;busy=false;draw();ports.changed?.();}
 }
 async function view(at:number){const plan=result,solver=engine,request=++viewTicket;if(!plan||plan.status!=='success'||!solver||!ports.usable())return;const leg=plan.legs[at];if(!leg)return;
  try{const scene=await solver.scene(leg.fromField);if(scope.disposed||request!==viewTicket||result!==plan||engine!==solver||!ports.usable()||!solver.resources.current())return;activeLeg=at;box.open=false;ports.showLeg(leg,scene,plan.start);draw();ports.changed?.();}catch{if(request===viewTicket){problem='source_mismatch';draw();}}
 }
 const edit=()=>{ticket++;viewTicket++;pending=null;busy=false;result=null;activeLeg=null;problem='';draw();ports.changed?.();};
 start.input.onchange=()=>{chosenStart=start.input.value;edit();};target.input.onchange=()=>{chosenTarget=target.input.value;edit();};limit.input.onchange=()=>{chosenLimit=Number(limit.input.value);edit();};run.onclick=()=>void query();clear.onclick=invalidate;
 scope.own(onLocaleChange(draw));draw();
 return {attach(host:HTMLElement,currentField:number|null,preferred?:GatewayStart){if(scope.disposed)return;const r=ports.resources();if(engine&&(!r||!valid(r))||pending&&!same(pending,r))invalidate();if(busy&&field!==currentField){ticket++;pending=null;busy=false;result=null;}field=currentField;if(!chosenStart&&preferred)chosenStart=startKey(preferred);host.append(box);draw();},invalidate,
  inspect(host:HTMLElement){host.querySelector('#field-gateway-evidence')?.remove();const leg=activeLeg===null?null:result?.legs[activeLeg];if(!leg||leg.fromField!==field||!result)return;const d=evidenceSection(host,t('gateway.evidence'));d.id='field-gateway-evidence';make('p',d,t('gateway.scope'));make('pre',d,JSON.stringify({identity:result.identity,start:result.start,targetField:result.targetField,leg},null,2));},
  result:()=>result,dispose(){scope.dispose();ticket++;viewTicket++;engine?.dispose();engine=null;result=null;choices.clear();box.remove();}};
}
