// SPDX-License-Identifier: GPL-3.0-only
import {ResourceScope} from '../app/resources';
import {formatNumber,onLocaleChange,t} from '../i18n';
import {analyzeEncounterRoute,createEncounterRouteIndex,createEncounterRouteProfile} from '../analysis/encounterJourney';
import type {EncounterPiece,EncounterRoute,EncounterRouteResult,EncounterRow} from '../analysis/encounterJourney';
import type {GeographyFamily,GeographyRange,GeographyTarget} from '../analysis/encounterGeography';
import type {EncounterResource} from '../data/encounters';
import type {GameplayResource} from '../data/gameplay';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import {evidenceSection} from './contentPresentation';

export interface EncounterJourneySources {
 encounters:()=>EncounterResource|null;
 gameplay:()=>GameplayResource|null;
}

const svgNS='http://www.w3.org/2000/svg';
const pageSize=50;
const sameGameplay=(a:GameplayResource|null,b:GameplayResource|null)=>a?.index===b?.index&&a?.sha256===b?.sha256&&a?.generation===b?.generation;

/** One panel for the foreground result, irrespective of which route owner published it. */
export function mountEncounterJourney(host:HTMLElement,viewer:GaiaViewer,sources:EncounterJourneySources,usable:()=>boolean){
 const scope=new ResourceScope();
 function make<K extends keyof HTMLElementTagNameMap>(tag:K,parent:HTMLElement,label=''){
  const node=document.createElement(tag);node.textContent=label;parent.append(node);return node;
 }
 const panel=make('details',host),heading=make('summary',panel),description=make('p',panel),controls=make('div',panel);
 panel.id='encounter-analysis';panel.className='vii-fold encounter-analysis';controls.className='encounter-analysis-controls';
 const status=make('p',panel);status.id='encounter-analysis-status';status.setAttribute('role','status');
 function field<K extends 'select'|'input'>(tag:K,id:string){
  const label=make('label',controls),caption=make('span',label),input=make(tag,label);
  input.id='encounter-analysis-'+id;return {caption,input};
 }
 const leg=field('select','leg'),range=field('select','range'),family=field('select','family'),kind=field('select','kind');
 const sort=field('select','sort'),filter=field('input','filter');filter.input.type='search';
 const cancel=make('button',controls);cancel.type='button';cancel.id='encounter-analysis-clear';
 const metrics=make('div',panel),plot=make('div',panel),list=make('div',panel),details=make('div',panel);
 metrics.id='encounter-analysis-metrics';plot.id='encounter-analysis-plot';list.id='encounter-analysis-list';details.id='encounter-analysis-selection';
 let profile:ReturnType<typeof createEncounterRouteProfile>|null=null,relationIndex:ReturnType<typeof createEncounterRouteIndex>|null=null;
 let route:EncounterRoute|null=null,answer:EncounterRouteResult|null=null,legIndex=-1,ticket=0,page=0,selected:string|null=null;
 let selectedPiece=0,stage='route',busy=false;

 function choices(select:HTMLSelectElement,items:[string,string][]){
  const previous=select.value;select.replaceChildren();
  for(const [id,label] of items){const option=make('option',select,label.startsWith('enc')?t(label):label);option.value=id;}
  if(items.some(row=>row[0]===previous))select.value=previous;
 }
 function action(parent:HTMLElement,label:string,run:()=>void){const button=make('button',parent,label);button.type='button';button.onclick=run;return button;}
 const km=(distance:number)=>`${formatNumber(distance/1000,3)} km`;
 const percent=(distance:number,total:number|null)=>total?formatNumber(distance/total*100,2)+'%':'—';
 const generation=()=>route?.source.generation??-1;
 function resetSelection(){selected=null;selectedPiece=0;viewer.setEncounterRoute([]);}
 function resetResult(key:string){ticket++;busy=false;answer=null;stage=key;page=0;resetSelection();draw();}
 function set(next:EncounterRoute|null){
  if(route===next||next&&route?.legs===next.legs&&route.kind===next.kind)return;
  route=next;profile=next?createEncounterRouteProfile(viewer.mesh,next):null;legIndex=-1;
  choices(leg.input,[['-1','encRoute.whole'],...(next?.legs.map((_,i)=>[String(i),String(i+1)] as [string,string])??[])]);leg.input.value='-1';
  resetResult(next?'ready':'route');
  if(next&&panel.open)void run();
 }
 async function run(){
  if(!route||!profile||!usable())return;
  const resource=sources.encounters(),gameplay=sources.gameplay();
  if(!resource){resetResult('missing');return;}
  if(!relationIndex||relationIndex.resource!==resource||!sameGameplay(relationIndex.gameplay,gameplay))relationIndex=createEncounterRouteIndex(resource,gameplay,generation());
  resetResult('busy');busy=true;draw();const attempt=ticket,local=profile,index=relationIndex;
  const current=()=>!scope.disposed&&attempt===ticket&&profile===local&&usable()&&resource===sources.encounters()&&sameGameplay(gameplay,sources.gameplay());
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  if(!current())return;
  const result=await analyzeEncounterRoute(local,index,{leg:legIndex===-1?undefined:legIndex,current,pause:()=>new Promise(resolve=>setTimeout(resolve,0))});
  if(!current())return;
  answer=result;busy=false;stage=result.reason??result.status;draw();
 }
 const kindValue=()=>kind.input.value as 'set'|'formation'|'enemy';
 const activeRows=()=>answer?.rows[range.input.value as GeographyRange][family.input.value as GeographyFamily][kindValue()];
 function geography(row:EncounterRow):GeographyTarget{
  if(kindValue()==='set')return {kind:'set',id:row.id};
  if(kindValue()==='formation')return {kind:'formation',id:Number(row.id)};
  const [sceneId,enemyId]=row.id.split('/').map(Number);return {kind:'enemy',sceneId,enemyId};
 }
 function label(row:EncounterRow){
  const names=relationIndex?.relations.index;
  if(kindValue()==='enemy'){const name=names?.enemies.get(row.id)?.name;return name?`${name} · ${row.id}`:row.id;}
  if(kindValue()==='formation')return `${t(names?'encgeo.formation':'encRoute.battle')} ${row.id}`;
  return row.id;
 }
 function pick(row:EncounterRow){
  selected=row.id;selectedPiece=row.spans[0].first;
  const pieces=row.spans.flatMap(span=>answer!.pieces.slice(span.first,span.last+1));
  viewer.setEncounterRoute(pieces);draw();
 }
 function showPiece(parent:HTMLElement,piece:EncounterPiece){
  const l=piece.lookup,s=l.set;
  make('p',parent,`${t('encRoute.piece')} ${piece.ordinal+1} · ${t('encRoute.leg')} ${piece.leg+1} · ${piece.lineage.join('/')} · ${km(piece.start)}–${km(piece.end)}`);
  make('p',parent,`Set ${s.id} · ${t(s.active?'encRoute.active':'encRoute.inactive')} · Script ${piece.script} · Tracks ${piece.tracks?'✓':'—'}`);
  make('p',parent,`Region ${l.sourceRegion} → ${l.effectiveRegion} · Terrain ${l.sourceTerrain} → ${l.effectiveTerrain}${l.fallback?' · '+t('encRoute.fallback'):''}`);
  action(parent,t('encRoute.source'),()=>viewer.selectSource(piece.triangle));
 }
 function drawPlot(result:EncounterRouteResult,row:EncounterRow|undefined){
  if(!result.pieces.length)return;
  const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 480 33');svg.setAttribute('role','img');svg.setAttribute('aria-label',t('encRoute.strips'));plot.append(svg);
  const x=(distance:number)=>4+(distance/(result.length||1))*472;
  const rect=(start:number,end:number,y:number,height:number,color:string)=>{
   const r=document.createElementNS(svgNS,'rect');r.setAttribute('x',String(x(start)));r.setAttribute('width',String(x(end)-x(start)));r.setAttribute('y',String(y));r.setAttribute('height',String(height));r.setAttribute('fill',color);svg.append(r);return r;
  };
  result.strips.forEach((strip,i)=>{
   const eligible=family.input.value==='ordinary'?strip.ordinary:strip.chocobo;
   const line=rect(strip.start,strip.end,4,15,range.input.value==='candidate'&&!eligible?'#526079':i%2?'#e9bc62':'#71c4b3');
   const tip=document.createElementNS(svgNS,'title');tip.textContent=`${strip.setId} · ${km(strip.start)}–${km(strip.end)}`;line.append(tip);
  });
  for(const span of row?.spans??[])rect(span.start,span.end,21,6,'#eb85fb');
  const marker=document.createElementNS(svgNS,'line');marker.setAttribute('y1','2');marker.setAttribute('y2','29');marker.setAttribute('stroke','#fff');svg.append(marker);
  const label=make('label',plot,t('encRoute.piece')),slider=make('input',label);slider.type='range';slider.min='0';slider.max=String(result.pieces.length-1);slider.step='1';
  const summary=make('div',plot);
  function inspect(at:number){selectedPiece=at;slider.value=String(at);const piece=result.pieces[at];marker.setAttribute('x1',String(x(piece.start)));marker.setAttribute('x2',String(x(piece.start)));summary.replaceChildren();showPiece(summary,piece);}
  slider.oninput=()=>inspect(Number(slider.value));
  svg.onpointerdown=event=>{
   const box=svg.getBoundingClientRect(),distance=Math.max(0,Math.min(1,(480*(event.clientX-box.left)/box.width-4)/472))*(result.length??0);
   let lo=0,hi=result.pieces.length-1;
   while(lo<hi){const mid=(lo+hi)>>1;if(result.pieces[mid].end<distance)lo=mid+1;else hi=mid;}
   inspect(lo);
  };
  inspect(selectedPiece);
 }
 function draw(){
  status.textContent=t('encRoute.'+stage);cancel.disabled=!busy&&!answer;panel.dataset.status=answer?.status??stage;
  metrics.replaceChildren();plot.replaceChildren();list.replaceChildren();details.replaceChildren();
  const result=answer;if(!result)return;
  const info=make('dl',metrics);info.className='property-list';
  function metric(key:string,value:string){const line=make('div',info);make('dt',line,t(key));make('dd',line,value);}
  metric('journey.graphDistance',km(result.graphCost));
  if(result.status!=='complete')return;
  metric('encRoute.length',km(result.length!));metric('encRoute.coverage',`${km(result.analyzed)} · ${percent(result.analyzed,result.length)}`);
  metric('encRoute.piecesFaces',`${result.pieces.length} / ${result.faces}`);
  metric('encRoute.setsSpans',`${result.rows.lookup.ordinary.set.size} / ${result.strips.length}`);
  for(const key of ['ordinary','chocobo','intersection','union'] as const){
   const distance=result.unions[key];metric('encRoute.'+key,`${km(distance)} · ${percent(distance,result.length)}`);
  }
  const evidence=evidenceSection(metrics,t('journey.source'));
  make('pre',evidence,JSON.stringify({kind:route!.kind,route:route!.source,scenario:route!.scenario,entrances:route!.legs.map(row=>[row.startEntrance,row.targetEntrance]),
   encounter:relationIndex!.resource.sha256,gameplay:relationIndex!.gameplay?.sha256,relation:result.relation,usage:result.usage,elapsedMs:result.elapsedMs},null,2));
  if(result.relation!=='available')make('p',metrics,t('encgeo.'+result.relation)+' · '+t('encRoute.rawOnly'));
  const rows=activeRows()!,row=selected===null?undefined:rows.get(selected);
  drawPlot(result,row);
  const query=filter.input.value.trim().toLocaleLowerCase();
  const filtered=[...rows.values()].filter(row=>!query||label(row).toLocaleLowerCase().includes(query)||row.id.includes(query));
  filtered.sort((a,b)=>sort.input.value==='name'?label(a).localeCompare(label(b)):sort.input.value==='id'?a.id.localeCompare(b.id,undefined,{numeric:true}):b.distance-a.distance||a.id.localeCompare(b.id));
  if(!filtered.length)make('p',list,t(kindValue()==='enemy'&&result.relation!=='available'?'encRoute.enemyUnavailable':'encRoute.none'));
  const last=Math.max(0,Math.ceil(filtered.length/pageSize)-1);page=Math.min(page,last);
  for(const entry of filtered.slice(page*pageSize,(page+1)*pageSize)){
   const b=action(list,`${label(entry)} · ${km(entry.distance)} · ${percent(entry.distance,result.length)}`,()=>pick(entry));
   b.setAttribute('aria-pressed',String(entry.id===selected));b.dataset.encounterRouteRow=entry.id;
  }
  if(last){action(list,'‹',()=>{page--;draw();}).disabled=page===0;make('span',list,` ${page+1}/${last+1} `);action(list,'›',()=>{page++;draw();}).disabled=page===last;}
  if(!row)return;
  make('h4',details,label(row));
  make('p',details,`${t('encRoute.spans')} ${row.spans.length} · ${t('encRoute.piecesFaces')} ${row.pieces} / ${row.faces.size}`);
  for(const span of row.spans.slice(0,pageSize))action(details,`${km(span.start)}–${km(span.end)}`,()=>{selectedPiece=span.first;draw();});
  if(row.spans.length>pageSize)make('p',details,t('encRoute.firstSpans'));
  const target=geography(row),verified=result.relation==='available';
  if(verified||target.kind==='set')action(details,t('encgeo.viewMap'),()=>document.dispatchEvent(new CustomEvent('gaiagis:encounter-geography',{detail:target})));
  if(verified&&target.kind!=='set')action(details,t('gameplay.title'),()=>document.dispatchEvent(new CustomEvent('gaiagis:gameplay-open',{detail:target})));
  const records=evidenceSection(details,t('journey.source'));
  make('pre',records,[...row.records].map(ref=>`${ref.setId} / ${ref.kind} · Battle ${ref.record.scene_id} · weight ${ref.record.weight} @ ${ref.record.byte_offset}`).join('\n'));
 }
 function translate(){
  heading.textContent=t('encRoute.title');description.textContent=t('encRoute.scope');cancel.textContent=t('encRoute.clear');
  for(const [control,key] of [[leg,'leg'],[range,'range'],[family,'family'],[kind,'kind'],[sort,'sort'],[filter,'filter']] as const)control.caption.textContent=t('encRoute.'+key);
  choices(range.input,[['candidate','encgeo.candidate'],['lookup','encgeo.lookup']]);
  choices(family.input,[['ordinary','encRoute.ordinary'],['chocobo','encRoute.chocobo']]);
  choices(kind.input,[['set','encgeo.set'],['formation','encgeo.formation'],['enemy','encgeo.enemy']]);
  choices(sort.input,[['distance','encRoute.length'],['id','encRoute.id'],['name','encRoute.name']]);
  const whole=leg.input.options[0];if(whole)whole.textContent=t('encRoute.whole');draw();
 }
 choices(leg.input,[['-1','encRoute.whole']]);
 leg.input.onchange=()=>{legIndex=Number(leg.input.value);void run();};
 for(const control of [range,kind,family])control.input.onchange=()=>{page=0;resetSelection();draw();};
 sort.input.onchange=filter.input.oninput=()=>{page=0;draw();};
 cancel.onclick=()=>resetResult(busy?'cancelled':'ready');
 scope.listen(panel,'toggle',()=>{if(panel.open&&route&&!answer&&!busy)void run();});
 function sourceChanged(){
  if(relationIndex&&relationIndex.resource===sources.encounters()&&sameGameplay(relationIndex.gameplay,sources.gameplay()))return;
  relationIndex=null;resetResult(route?'ready':'route');if(route&&panel.open)void run();
 }
 for(const event of ['gaiagis:encounters','gaiagis:gameplay-ready'])scope.listen(document,event,sourceChanged);
 scope.own(onLocaleChange(translate));translate();
 return {set,open(){panel.open=true;if(!answer&&!busy)void run();},dispose(){scope.dispose();ticket++;viewer.setEncounterRoute([]);panel.remove();}};
}
