// SPDX-License-Identifier: GPL-3.0-only
import {createWorldEventGeography} from '../analysis/worldEventGeography';
import type {WM0Source} from '../analysis/wm0Source';
import type {EventsDataset,WorldEvent} from '../data/events';
import type {GameplayResource} from '../data/gameplay';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import type {GaiaMeta} from '../data/mesh';
import {appStore} from '../app/state';
import {ResourceScope} from '../app/resources';
import {sourceResultPager} from './surfaceQueries';
import {evidenceSection} from './contentPresentation';
import {sourceGeographic} from '../explorer/coordinates';
import {t,onLocaleChange,formatNumber} from '../i18n';
export function mountWorldEventGeography(viewer:GaiaViewer,meta:GaiaMeta,getSource:()=>WM0Source,getData:()=>EventsDataset|null,getHash:()=>string|null,getGameplay:()=>GameplayResource|null,usable:()=>boolean,selectFace:(id:number)=>void){
 const scope=new ResourceScope(),box=document.createElement('details');box.id='world-event-geography';box.className='analysis-group surface-query-panel';
 const make=<K extends keyof HTMLElementTagNameMap>(tag:K,parent:HTMLElement,text='')=>{const n=document.createElement(tag);n.textContent=text;parent.append(n);return n;};
 const title=make('summary',box),note=make('p',box),run=make('button',box),status=make('p',box),form=make('div',box),stats=make('div',box),distribution=make('div',box),rows=make('section',box),faces=make('section',box);form.className='event-evidence-form';
 run.id='eventgeo-run';status.id='eventgeo-status';status.setAttribute('role','status');run.type='button';document.getElementById('analysis-panel')!.prepend(box);
 const controls=new Map<string,HTMLSelectElement>(),labels=new Map<string,HTMLElement>();
 for(const key of ['scope','region','terrain']){const label=make('label',form),caption=make('span',label),input=make('select',label);labels.set(key,caption);controls.set(key,input);input.id='eventgeo-'+key;input.onchange=draw;}
 for(const kind of ['triggers','placements','unresolved']){const o=make('option',controls.get('scope')!);o.value=kind;}
 type Row={id:string;label:string;event?:WorldEvent;raw?:Record<string,unknown>};
 let engine:ReturnType<typeof createWorldEventGeography>|null=null,data:EventsDataset|null=null,sha:string|null=null,generation=-1,ticket=0,busy=false,failed=false,inspected:string|null=null;
 const pager=sourceResultPager<Row>(rows,'eventgeo-records',r=>r.label,select);
 const facePager=sourceResultPager<number>(faces,'eventgeo-faces',id=>{const s=engine!.source.source(id);return `#${id} · ${s.section}/${s.mesh}/${s.triangle}`;},id=>{if(!engine||!usable())return;selectFace(id);const p=engine.source.corners(id),c=[0,1,2].map(k=>p.reduce((s,v)=>s+v[k]/3,0)),g=sourceGeographic(...c as [number,number,number]);viewer.flyToLocation(g[0],g[1]);});scope.own(pager.dispose);scope.own(facePager.dispose);
 const valid=()=>!!engine&&data===getData()&&sha===getHash()&&generation===appStore.state.data.generation;
 function adoptOptions(key:'region'|'terrain'){const input=controls.get(key)!,previous=input.value;input.replaceChildren();const all=make('option',input,t('evgeo.all'));all.value='';if(engine){const q=engine.query(),map=key==='region'?q.regions:q.terrains,names=key==='region'?meta.region_names:meta.terrain_names;for(const id of [...map.keys()].sort((a,b)=>a-b)){const o=make('option',input,`${id} · ${names[id]??'?'}`);o.value=String(id);}}if([...input.options].some(o=>o.value===previous))input.value=previous;}
 function draw(){title.textContent=t('evgeo.worldTitle');note.textContent=t('evgeo.worldLimit');run.textContent=t(busy?'evgeo.busy':'evgeo.compute');run.disabled=busy||!usable()||!getData()||!getHash();for(const [k,l]of labels){l.textContent=t('evgeo.'+k);controls.get(k)!.setAttribute('aria-label',t('evgeo.'+k));}for(const o of controls.get('scope')!.options)o.textContent=t('evgeo.'+o.value);stats.replaceChildren();distribution.replaceChildren();
  if(!valid()){delete box.dataset.triggerCount;delete box.dataset.faceCount;delete box.dataset.area;status.textContent=t(failed?'evgeo.conflict':'evgeo.unavailable');pager.set([]);facePager.set([]);return;}
  const e=engine!,region=controls.get('region')!.value,terrain=controls.get('terrain')!.value,q=e.query(region===''?undefined:Number(region),terrain===''?undefined:Number(terrain));
  box.dataset.triggerCount=String(e.triggers.length);box.dataset.faceCount=String(q.faces.length);box.dataset.area=String(q.area);status.textContent=t('evgeo.worldCounts',{triggers:e.triggers.length,placements:e.placements.length,unresolved:e.data.unresolved.length,faces:q.faces.length,area:formatNumber(q.area,2)});
  const mode=controls.get('scope')!.value;let records:Row[]=[];
  if(mode==='unresolved')records=e.data.unresolved.map((r,i)=>({id:'unresolved:'+i,label:`${r.event_type??'CALL'} · ${r.call_table_record}:${r.instruction_offset} · ${r.reason}`,raw:r}));
  else if(mode==='placements')records=e.placements.map(event=>({id:event.id,label:`${event.display_name} · ${event.call_table_record}:${event.instruction_offset} · ${t('evgeo.placementOnly')}`,event}));
  else{const ids=new Set(q.faces.flatMap(f=>e.byFace.get(f)??[]));records=e.triggers.filter(r=>ids.has(r.id)).map(event=>({id:event.id,label:`${event.event_type} · ${event.call_table_record}:${event.instruction_offset} · ${event.trigger_triangle_ids.length} △`,event}));}
  controls.get('region')!.disabled=controls.get('terrain')!.disabled=mode!=='triggers';pager.set(records);facePager.set(mode==='triggers'?q.faces:[]);
  if(mode==='triggers'){make('p',stats,`${t('evgeo.zeroXZ')}: ${q.zero} · ${t('evgeo.duplicate')}: ${q.duplicates}`);for(const [key,map]of [['region',q.regions],['terrain',q.terrains]] as const){make('h4',distribution,t('evgeo.'+key));const table=make('table',distribution);table.className='native-result-table';const heading=make('tr',table);for(const label of [t('evgeo.'+key),t('regional.faces'),t('regional.area')])make('th',heading,label);for(const [id,r]of [...map].sort(([a],[b])=>a-b)){const tr=make('tr',table);make('th',tr,`${id} · ${(key==='region'?meta.region_names:meta.terrain_names)[id]??'?'}`);make('td',tr,String(r.faces));make('td',tr,formatNumber(r.area,2)+' raw²');}}}
 }
 function select(r:Row){if(!valid()||!usable())return;if(r.event){inspected=null;viewer.onEvent(r.event);return;}viewer.clearSelection();const host=document.getElementById('selection-details')!;host.replaceChildren();host.hidden=false;document.getElementById('selection-empty')!.hidden=true;make('h3',host,t('evgeo.unresolved'));make('p',host,t('evgeo.no_geometry'));make('p',host,t('evgeo.limit'));appStore.dispatch({type:'select',selection:{kind:'event',id:r.id,mapId:'WM0'}});
  inspected=r.id;const raw=evidenceSection(host,t('evgeo.provenance'));make('pre',raw,JSON.stringify({eventAssetSHA256:sha,sources:data!.sources,observation:r.raw},null,2));
  const gp=getGameplay(),o=r.raw!,matches=gp?.index.pack.links.assets as Record<string,{sha256:string;status?:string}>|undefined;
  if(gp&&gp.generation===generation&&gp.index.pack.sources['wm0.ev']===data!.sources['wm0.ev']&&matches?.['gaia-events.json']?.sha256===sha&&matches['gaia-events.json'].status==='matched'&&o.event_type==='scripted_battle'){
   const link=gp.index.pack.links.worldBattles.find(l=>l.callTableRecord===o.call_table_record&&l.functionId===o.function_id&&l.instructionOffset===o.instruction_offset&&l.memberSHA256===data!.sources['wm0.ev']&&l.member==='wm0.ev'&&l.sourceKind==='world_script'&&l.status==='matched'&&Array.isArray(o.raw_arguments)&&l.battleId===o.raw_arguments[0]&&l.formationId===l.battleId);
   if(link?.formationId!==null&&link?.formationId!==undefined){const b=make('button',host,t('gameplay.seeFormation')+' · '+link.formationId);b.type='button';b.onclick=()=>document.dispatchEvent(new CustomEvent('gaiagis:gameplay-open',{detail:{kind:'formation',id:link.formationId}}));}
  }document.dispatchEvent(new Event('gaiagis:inspect'));
 }
 async function calculate(){const current=getData(),hash=getHash(),g=appStore.state.data.generation,request=++ticket;if(!current||!hash||!usable())return;busy=true;draw();await new Promise<void>(r=>requestAnimationFrame(()=>r()));if(scope.disposed||request!==ticket)return;
  try{if(current!==getData()||hash!==getHash()||g!==appStore.state.data.generation||!usable())return;engine=createWorldEventGeography(getSource(),current);data=current;sha=hash;generation=g;failed=false;adoptOptions('region');adoptOptions('terrain');}catch{failed=true;engine=null;}finally{if(request===ticket){busy=false;draw();}}
 }
 function invalidate(){ticket++;busy=false;engine=null;data=null;sha=null;generation=-1;failed=false;const own=inspected;inspected=null;if(own&&appStore.state.selection?.kind==='event'&&appStore.state.selection.id===own){const host=document.getElementById('selection-details');if(host){host.replaceChildren();host.hidden=true;}const empty=document.getElementById('selection-empty');if(empty)empty.hidden=false;appStore.dispatch({type:'select',selection:null});}draw();}
 run.onclick=()=>void calculate();scope.listen(document,'gaiagis:events',invalidate);scope.own(appStore.subscribe(()=>{box.hidden=appStore.state.map.id!=='WM0'||appStore.state.view.spatial!=='world';if(engine&&!valid())invalidate();run.disabled=busy||!usable()||!getData()||!getHash();}));scope.own(onLocaleChange(()=>{if(engine){adoptOptions('region');adoptOptions('terrain');}draw();}));draw();
 return {inspect(face:number,host:HTMLElement){if(!valid())return;const ids=engine!.byFace.get(face);if(!ids?.length)return;const section=make('details',host);make('summary',section,t('evgeo.worldTitle'));for(const id of ids){const e=data!.events.find(e=>e.id===id)!;const b=make('button',section,`${e.event_type} @ ${e.instruction_offset}`);b.type='button';b.onclick=()=>select({id,label:id,event:e});}},dispose(){ticket++;engine=null;scope.dispose();box.remove();}};
}
