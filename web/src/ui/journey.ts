// SPDX-License-Identifier: GPL-3.0-only
import '../styles/journey.css';
import {appStore} from '../app/state';
import {ResourceScope} from '../app/resources';
import {findNavigation} from '../app/navigation';
import {userStateStorage} from '../app/userState';
import {locale,onLocaleChange,t,formatNumber} from '../i18n';
import {spoilerVisible} from '../data/atlas';
import type {AtlasContent} from '../data/atlas';
import type {PoiDataset} from '../data/poi';
import type {Endpoint,RoutingData,findRoute} from '../data/routing';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import {analyzeRoute} from '../analysis/spatial';
import {JOURNEY_MAX_STATIONS,journeyProfiles,solveJourney} from '../navigation/journey';
import type {JourneyStation,JourneySource,JourneyResult,JourneyLeg,JourneyReason} from '../navigation/journey';
import {resolveJourneyStation} from '../navigation/journeyTargets';

/** A borrower of the existing Analysis graph, Worker and foreground route lease. */
export interface JourneyRoutingPort {
 context(atlasIdentity:string):Promise<{graph:RoutingData;source:JourneySource}>;
 components(profile:string,conditional:boolean):Promise<{labels:Int32Array}>;
 route(profile:string,conditional:boolean,starts:Endpoint[],targets:Endpoint[]):Promise<ReturnType<typeof findRoute>>;
 claim():number;
 current(lease:number):boolean;
 display(lease:number,nodes:number[],from:string|null,to:string|null,distance:number):void;
 clear(lease:number):void;
}
export interface JourneyDraftStop {id:string;target:JourneyStation['target'];parentConfirmed:boolean;}
interface Draft {id:string;stops:JourneyDraftStop[];profile:string;conditional:boolean;}
// Only stable identities and user assumptions survive a layout/Workspace replacement.
// No graph, path, Inspector, private bytes or provenance snapshot is retained here.
let retained:Draft|null=null;
const uid=()=>crypto.randomUUID();
const fresh=():Draft=>({id:uid(),stops:[],profile:'foot',conditional:false});
const cloneDraft=(draft:Draft):Draft=>({...draft,stops:draft.stops.map(s=>({...s,target:{...s.target}}))});
export function resetJourneyDraft(){retained=null;}

export function mountJourney(getViewer:()=>GaiaViewer|undefined,getBackend:()=>JourneyRoutingPort|null,getPoi:()=>PoiDataset|null,getAtlas:()=>AtlasContent){
 const scope=new ResourceScope(),root=document.createElement('section');root.id='journey-planner';root.className='journey-planner';
 const heading=document.createElement('h2'),intro=document.createElement('p'),list=document.createElement('ol'),controls=document.createElement('div'),choices=document.createElement('select'),chooseLabel=document.createElement('label'),append=document.createElement('button');
 const scenario=document.createElement('div'),modeLabel=document.createElement('label'),mode=document.createElement('select'),conditionLabel=document.createElement('label'),condition=document.createElement('input'),conditionText=document.createElement('span'),assumption=document.createElement('p');
 const actions=document.createElement('div'),plan=document.createElement('button'),clear=document.createElement('button'),status=document.createElement('p'),results=document.createElement('section'),tour=document.createElement('button'),tourNote=document.createElement('p');
 heading.id='journey-heading';heading.tabIndex=-1;root.setAttribute('aria-labelledby',heading.id);intro.className=assumption.className=status.className=tourNote.className='control-note';
 list.id='journey-stops';choices.id='journey-target';chooseLabel.htmlFor=choices.id;append.id='journey-add-stop';append.type='button';controls.className='journey-add';controls.append(chooseLabel,choices,append);
 mode.id='journey-mode';modeLabel.htmlFor=mode.id;condition.id='journey-conditional';condition.type='checkbox';conditionLabel.htmlFor=condition.id;conditionLabel.className='toggle-row';conditionLabel.append(condition,conditionText);scenario.className='journey-scenario';scenario.append(modeLabel,mode,conditionLabel);
 for(const profile of journeyProfiles){const option=document.createElement('option');option.value=profile.id;mode.append(option);}
 plan.id='journey-plan';clear.id='journey-clear';tour.id='journey-export-tour';for(const button of [plan,clear,tour])button.type='button';actions.className='journey-actions';actions.append(plan,clear);status.id='journey-status';status.setAttribute('role','status');results.id='journey-results';results.hidden=true;
 root.append(heading,intro,controls,list,scenario,assumption,actions,status,results,tour,tourNote);document.getElementById('app-group-explore')?.prepend(root);
 let draft=cloneDraft(retained??fresh()),result:JourneyResult|null=null,resultStations:JourneyStation[]=[],revision=0,busy=false,lease=-1,port:JourneyRoutingPort|null=null,message='journey.ready';
 let generation=appStore.state.data.generation,poiIdentity=getPoi(),atlasIdentity=getAtlas(),lastSupported=supported();
 const saveDraft=()=>{retained=cloneDraft(draft);};
 const reason=(value:JourneyReason)=>'journey.reason.'+value;
 function supported(){const s=appStore.state;return s.map.id==='WM0'&&s.view.spatial==='world'&&!s.view.variantResearch&&s.explorer.phase==='idle';}
 function visibleEntity(id:string){const entity=getAtlas().entities.find(e=>e.id===id),filter=(document.getElementById('atlas-spoilers') as HTMLSelectElement|null)?.value as 'hide-major'|'show-all'|'hide-all'|undefined;return entity&&spoilerVisible(entity.spoilerLevel,filter??'hide-major')?entity:null;}
 function name(stop:JourneyDraftStop|JourneyStation){const target=stop.target;if(target.kind==='atlas')return visibleEntity(target.id)?.localizedNames[locale()]??t('journey.hiddenGuide');const poi=getPoi(),entrance=target.kind==='entrance'?poi?.entrances.find(e=>e.id===target.id):null;return poi?.locations.find(l=>l.id===(entrance?.location_id??target.id))?.display_name??target.id;}
 function reference(stop:JourneyDraftStop){if(stop.target.kind!=='atlas')return false;const binding=getAtlas().entities.find(e=>e.id===stop.target.id)?.spatialBinding;return !binding||['field_identity','unresolved','non_spatial'].includes(binding.kind)||binding.kind==='field_parent'&&!stop.parentConfirmed;}
 function eraseInspector(){const details=document.getElementById('selection-details');if(details?.dataset.journeyLeg){delete details.dataset.journeyLeg;details.replaceChildren();details.hidden=true;if(appStore.state.selection?.kind==='route'&&appStore.state.selection.id.startsWith('journey:'))appStore.dispatch({type:'select',selection:null});}}
 function invalidate(key='journey.ready'){
  revision++;busy=false;if(port&&port.current(lease))port.clear(lease);lease=-1;result=null;resultStations=[];message=key;eraseInspector();drawResults();drawStatus();saveDraft();
 }
 function button(key:string,fn:()=>void){const b=document.createElement('button');b.type='button';b.textContent=t(key);b.onclick=fn;return b;}
 function drawChoices(){const previous=choices.value;choices.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=t('journey.choose');choices.append(empty);const poi=getPoi();if(poi){const places=document.createElement('optgroup');places.label=t('ui.locations');for(const l of poi.locations){const option=document.createElement('option');option.value='location:'+l.id;option.textContent=l.display_name;places.append(option);}choices.append(places);}const guides=document.createElement('optgroup');guides.label=t('guide.title');for(const e of getAtlas().entities){if(!visibleEntity(e.id))continue;const option=document.createElement('option');option.value='atlas:'+e.id;option.textContent=e.localizedNames[locale()];guides.append(option);}choices.append(guides);if([...choices.options].some(o=>o.value===previous))choices.value=previous;else choices.value='';}
 function drawStops(){
  list.replaceChildren();for(const [index,stop] of draft.stops.entries()){
   const row=document.createElement('li'),title=button('journey.open',()=>openStop(stop)),meta=document.createElement('p'),tools=document.createElement('div');title.textContent=`${index===0&&!reference(stop)?t('journey.start'):t('journey.stop')} ${index+1} · ${name(stop)}`;title.className='journey-stop-title';title.dataset.journeyStop=stop.id;meta.className='control-note';tools.className='journey-stop-actions';row.dataset.stopId=stop.id;
   const binding=stop.target.kind==='atlas'?getAtlas().entities.find(e=>e.id===stop.target.id)?.spatialBinding:null;
   meta.textContent=reference(stop)?t('journey.referenceOnly'):binding&&['parent_location','field_parent'].includes(binding.kind)?t('journey.parent'):t('journey.entrance');
   const up=button('journey.up',()=>move(index,-1)),down=button('journey.down',()=>move(index,1)),remove=button('journey.remove',()=>{draft.stops.splice(index,1);invalidate();drawStops();});up.disabled=index===0;down.disabled=index===draft.stops.length-1;tools.append(up,down,remove);row.append(title,meta,tools);
   if(binding?.kind==='field_parent'&&!stop.parentConfirmed){const confirm=button('journey.confirmParent',()=>{stop.parentConfirmed=true;invalidate();drawStops();});confirm.className='journey-parent-confirm';row.append(confirm);}
   list.append(row);
  }
  if(!draft.stops.length){const empty=document.createElement('p');empty.className='control-note';empty.textContent=t('journey.empty');list.append(empty);}drawStatus();
 }
 function move(index:number,direction:number){const next=index+direction;if(next<0||next>=draft.stops.length)return;[draft.stops[index],draft.stops[next]]=[draft.stops[next],draft.stops[index]];invalidate();drawStops();list.querySelector<HTMLElement>(`[data-journey-stop="${draft.stops[next].id}"]`)?.focus();}
 function add(target:JourneyStation['target'],parentConfirmed=false){if(draft.stops.length>=JOURNEY_MAX_STATIONS){message='journey.limit';drawStatus();return;}draft.stops.push({id:uid(),target:{...target},parentConfirmed});invalidate();drawStops();document.dispatchEvent(new CustomEvent('gaiagis:open-area',{detail:{area:'world'}}));heading.focus({preventScroll:true});root.scrollIntoView({block:'nearest'});}
 function openStop(stop:JourneyDraftStop|JourneyStation){if(!supported()){message=reason('unsupported_space');drawStatus();return;}const target={...stop.target,mapId:'WM0' as const},entry=findNavigation(target);if(entry){entry.navigate();return;}if(stop.target.kind==='atlas'&&visibleEntity(stop.target.id))document.dispatchEvent(new CustomEvent('gaiagis:guide',{detail:{category:'all',entity:stop.target.id}}));else if(stop.target.kind==='location')document.dispatchEvent(new CustomEvent('gaiagis-inspect-location',{detail:stop.target.id}));}
 function drawStatus(){
  status.textContent=t(!supported()?'journey.reason.unsupported_space':!getViewer()&&message==='journey.ready'?'journey.reason.workspace_missing':message);root.dataset.phase=busy?'planning':result?.status??'draft';root.dataset.stops=String(draft.stops.length);root.dataset.routeNodes=String(result?.nodes.length??0);plan.disabled=busy||draft.stops.length<2||!supported();append.disabled=draft.stops.length>=JOURNEY_MAX_STATIONS;tour.disabled=draft.stops.length===0;root.dataset.available=String(!!getBackend()&&supported());for(const button of results.querySelectorAll<HTMLButtonElement>('button'))button.disabled=!supported();
 }
 const km=(distance:number)=>formatNumber(distance/1000,3)+' km';
 function note(parent:HTMLElement,key:string){const p=document.createElement('p');p.className='control-note';p.textContent=t(key);parent.append(p);}
 function drawResults(){
  results.replaceChildren();results.hidden=!result;if(!result)return;
  results.dataset.status=result.status;results.dataset.totalDistance=result.totalDistance===null?'':String(result.totalDistance);results.dataset.component=result.component===null?'':String(result.component);
  if(result.status!=='success'){note(results,reason(result.reason??'route_failed'));return;}
  const h=document.createElement('h3');h.textContent=t('journey.success');results.append(h);const total=document.createElement('p');total.id='journey-total';total.textContent=t('journey.total')+': '+km(result.totalDistance!);results.append(total);
  const c=document.createElement('p');c.className='control-note';c.textContent=t('journey.common',{count:result.commonComponents.length,id:result.component!});results.append(c);
  const references=draft.stops.filter(reference).length;if(references){const p=document.createElement('p');p.className='control-note';p.textContent=t('journey.references',{count:references});results.append(p);}
  const show=button('journey.showAll',()=>void showRoute());show.id='journey-show-all';results.append(show);
  for(const [index,leg]of result.legs.entries()){const from=resultStations.find(s=>s.id===leg.from)!,to=resultStations.find(s=>s.id===leg.to)!,row=document.createElement('section'),title=document.createElement('h4'),distance=document.createElement('p'),show=button('journey.viewLeg',()=>void showRoute(index));row.className='journey-leg';row.dataset.leg=String(index);title.textContent=t('journey.leg',{index:index+1})+` · ${name(from)} → ${name(to)}`;distance.textContent=t('journey.graphDistance')+': '+km(leg.distance);show.dataset.journeyLeg=String(index);row.append(title,distance,show);results.append(row);}
  note(results,'journey.optimality');note(results,'journey.referenceScale');
 }
 async function run(){
  const backend=getBackend();if(!supported()){message=reason('unsupported_space');drawStatus();return;}if(!backend){message=reason(getViewer()?'routing_missing':'workspace_missing');drawStatus();return;}
  invalidate();const attempt=revision;port=backend;lease=backend.claim();const heldLease=lease,scenario={profile:draft.profile,conditional:draft.conditional},snapshot=cloneDraft(draft),content=getAtlas(),poi=getPoi();busy=true;message='journey.busy';drawStatus();
  const current=()=>!scope.disposed&&attempt===revision&&supported()&&backend.current(heldLease)&&poi===getPoi()&&content===getAtlas();
  try{
   const context=await backend.context(JSON.stringify(content));if(!current())return;
   if(reference(snapshot.stops[0])){message=reason('field_only');return;}
   const resolved=snapshot.stops.map(s=>resolveJourneyStation(s.id,s.target,s.parentConfirmed,poi,content,context.graph));
   const routeStops=resolved.filter((_,index)=>!reference(snapshot.stops[index]));if(routeStops.length<2){message=reason(snapshot.stops.some(reference)?'field_only':'invalid_plan');return;}
   const labels=await backend.components(scenario.profile,scenario.conditional);if(!current())return;
   const calculated=await solveJourney(context.graph,labels.labels,routeStops,scenario,context.source,(starts,targets)=>backend.route(scenario.profile,scenario.conditional,starts,targets),current);if(!current())return;
   result=calculated;resultStations=routeStops;message=calculated.status==='success'?'journey.success':reason(calculated.reason??'route_failed');
   if(calculated.status==='success'){backend.display(heldLease,calculated.nodes,routeStops[0].locationId,routeStops.at(-1)!.locationId,calculated.totalDistance!);getViewer()?.setJourneyStops(routeStops.map(s=>s.locationId!));}
  }catch(error){if(current()){const code=error instanceof Error?error.message:'';message=Object.hasOwn(reasonKeys,code)?reason(code as JourneyReason):reason('route_failed');}}
  finally{if(attempt===revision&&!scope.disposed){busy=false;if(!backend.current(heldLease)&&!result&&message==='journey.busy'){message=reason('superseded');}drawResults();drawStatus();}}
 }
 const reasonKeys:Record<JourneyReason,boolean>={workspace_missing:true,routing_missing:true,unverified_entrance:true,no_eligible_nodes:true,different_components:true,no_common_component:true,field_only:true,source_stale:true,superseded:true,unsupported_space:true,invalid_plan:true,invalid_scenario:true,invalid_route:true,route_failed:true};
 async function showRoute(index?:number){
  const solved=result,stations=resultStations,backend=getBackend();if(!solved||solved.status!=='success'||!backend||!supported())return;
  const attempt=revision;port=backend;lease=backend.claim();const heldLease=lease;try{const context=await backend.context(JSON.stringify(getAtlas()));if(attempt!==revision||scope.disposed||!backend.current(heldLease))return;if(JSON.stringify(context.source)!==JSON.stringify(solved.source)){invalidate(reason('source_stale'));return;}
   const leg=index===undefined?null:solved.legs[index],from=leg?stations.find(s=>s.id===leg.from)!:stations[0],to=leg?stations.find(s=>s.id===leg.to)!:stations.at(-1)!;backend.display(heldLease,leg?.nodes??solved.nodes,from.locationId,to.locationId,leg?.distance??solved.totalDistance!);getViewer()?.setJourneyStops(stations.map(s=>s.locationId!));if(leg&&index!==undefined)inspectLeg(leg,index,stations);
  }catch{if(attempt===revision)invalidate(reason('source_stale'));}
 }
 function inspectLeg(leg:JourneyLeg,index:number,stations:JourneyStation[]){
  const host=document.getElementById('selection-details');if(!host)return;const from=stations.find(s=>s.id===leg.from)!,to=stations.find(s=>s.id===leg.to)!;host.replaceChildren();host.hidden=false;host.dataset.journeyLeg=`${draft.id}:${index}`;document.getElementById('selection-empty')!.hidden=true;const title=document.createElement('h3');title.textContent=t('journey.leg',{index:index+1})+` · ${name(from)} → ${name(to)}`;host.append(title);
  const list=document.createElement('dl');list.className='property-list';const rows:[string,string][]=[['journey.graphDistance',km(leg.distance)],['journey.mode',t('mode.'+leg.scenario.profile)],['journey.conditional',String(leg.scenario.conditional)],['journey.component',String(leg.component)],['journey.endpoints',`${leg.startNode} (${leg.startEntrance}) → ${leg.endNode} (${leg.targetEntrance})`]];
  const viewer=getViewer();if(viewer){const summary=analyzeRoute(viewer.mesh,leg.nodes,null);rows.splice(1,0,['journey.corridorDistance',km(summary.total)]);}
  for(const [key,value]of rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=t(key);dd.textContent=value;row.append(dt,dd);list.append(row);}host.append(list,button('journey.open',()=>openStop(to)));const profile=button('sp25.profile',()=>document.dispatchEvent(new CustomEvent('gaiagis:open-tool',{detail:{toolId:'routeProfile'}})));host.append(profile);note(host,'journey.optimality');note(host,'journey.referenceScale');const evidence=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=t('journey.source');pre.textContent=JSON.stringify({source:leg.source,from:from.target,to:to.target,startNode:leg.startNode,endNode:leg.endNode,startEntrance:leg.startEntrance,targetEntrance:leg.targetEntrance,nodes:leg.nodes.length},null,2);evidence.className='vii-fold';evidence.append(summary,pre);host.append(evidence);document.getElementById('inspector-title')!.textContent=t('journey.title');appStore.dispatch({type:'select',selection:{kind:'route',id:`journey:${draft.id}:${index}`,mapId:'WM0'}});document.dispatchEvent(new Event('gaiagis:inspect'));
 }
 function exportTour(){const poi=getPoi(),content=getAtlas(),stops=draft.stops.map(s=>({draft:s,station:resolveJourneyStation(s.id,s.target,s.parentConfirmed,poi,content,null)})).filter(({draft:s,station})=>!reference(s)&&station.locationId);const storage=userStateStorage();if(!stops.length||storage.state.tours.length>=30){message='journey.exportUnavailable';drawStatus();return;}const eligible=stops.filter(({station})=>findNavigation({kind:'location',id:station.locationId!,mapId:'WM0'})?.canTour);if(!eligible.length){message='journey.exportUnavailable';drawStatus();return;}try{storage.update(s=>s.tours.push({id:uid(),name:t('journey.title'),created:Date.now(),stops:eligible.map(({draft:s,station})=>({id:uid(),target:{kind:'location',id:station.locationId!,mapId:'WM0'},duration:8,title:name(s)}))}));message='journey.exported';}catch{message='journey.exportUnavailable';}drawStatus();}
 function translate(){heading.textContent=t('journey.title');intro.textContent=t('journey.intro');chooseLabel.textContent=t('journey.choose');append.textContent=t('journey.append');modeLabel.textContent=t('journey.mode');for(const option of mode.options)option.textContent=t('mode.'+option.value);conditionText.textContent=t('journey.conditional');assumption.textContent=t('journey.assumption');plan.textContent=t('journey.plan');clear.textContent=t('journey.clear');tour.textContent=t('journey.export');tourNote.textContent=t('journey.tourNote');mode.value=draft.profile;condition.checked=draft.conditional;drawChoices();drawStops();drawResults();}
 append.onclick=()=>{const split=choices.value.indexOf(':');if(split<0)return;const kind=choices.value.slice(0,split),id=choices.value.slice(split+1);if(kind==='location'||kind==='atlas')add({kind,id});};mode.onchange=()=>{draft.profile=mode.value;invalidate();};condition.onchange=()=>{draft.conditional=condition.checked;invalidate();};plan.onclick=()=>void run();clear.onclick=()=>{invalidate();draft=fresh();saveDraft();translate();};tour.onclick=exportTour;
 scope.listen(document,'gaiagis:journey-add',((event:CustomEvent<{target:JourneyStation['target'];parentConfirmed?:boolean}>)=>{const target=event.detail?.target;if(target&&['location','entrance','atlas'].includes(target.kind)&&typeof target.id==='string')add(target,event.detail.parentConfirmed===true);}) as EventListener);
 scope.listen(document,'gaiagis:poi',()=>{poiIdentity=getPoi();invalidate(reason('source_stale'));drawChoices();drawStops();});
 scope.listen(document,'gaiagis:routing-source-change',()=>invalidate(reason('source_stale')));
 scope.listen(document,'gaiagis:journey-targets-change',()=>{atlasIdentity=getAtlas();invalidate(reason('source_stale'));drawChoices();drawStops();});
 scope.listen(document,'gaiagis-navigation',()=>{const content=getAtlas();if(content!==atlasIdentity){atlasIdentity=content;invalidate(reason('source_stale'));}drawChoices();});
 scope.listen(document,'change',((event:Event)=>{if((event.target as HTMLElement).id==='atlas-spoilers'){drawChoices();drawStops();drawResults();}}) as EventListener);
 scope.own(appStore.subscribe(s=>{if(s.data.generation!==generation||getPoi()!==poiIdentity){generation=s.data.generation;poiIdentity=getPoi();invalidate(reason('source_stale'));drawChoices();drawStops();}const now=supported();if(lastSupported&&!now){revision++;busy=false;if(message==='journey.busy')message=reason('superseded');}lastSupported=now;drawStatus();}));
 scope.own(onLocaleChange(translate));translate();saveDraft();
 return {dispose(){if(scope.disposed)return;revision++;saveDraft();if(port&&port.current(lease))port.clear(lease);eraseInspector();scope.dispose();root.remove();}};
}
