// SPDX-License-Identifier: GPL-3.0-only
import {appStore} from '../app/state';
import {navigationSelection,setNavigationSelection} from '../app/navigation';
import {ResourceScope} from '../app/resources';
import {dictionaries,formatNumber,onLocaleChange,t} from '../i18n';
import type {AtlasContent} from '../data/atlas';
import type {PoiDataset} from '../data/poi';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import type {JourneyResult,JourneyScenario,JourneyStation} from '../navigation/journey';
import {resolveJourneyStation} from '../navigation/journeyTargets';
import {exploreWorldField,sameJourneySource} from '../navigation/worldFieldExploration';
import type {ExplorationFieldView,ExplorationFields,ExplorationResult,ExplorationTarget} from '../navigation/worldFieldExploration';
import type {JourneyRoutingPort} from './journey';
import {encounterJourneyRoute} from '../analysis/encounterJourney';
import type {mountFieldContext} from './fieldContext';
import {evidenceSection} from './contentPresentation';

export type ExplorationFieldPort=Pick<ReturnType<typeof mountFieldContext>,'evidence'|'explorationResources'|'showExploration'|'returnFromExploration'|'explorationControls'|'clearExploration'>;

export function mountWorldFieldExploration(parent:HTMLElement,ports:{
 viewer:()=>GaiaViewer|undefined; backend:()=>JourneyRoutingPort|null; poi:()=>PoiDataset|null; atlas:()=>AtlasContent;
 field:()=>ExplorationFieldPort|undefined; supported:()=>boolean; scenario:()=>JourneyScenario;
 journey:()=>{result:JourneyResult;stations:JourneyStation[]}|null;
}){
 const scope=new ResourceScope();
 function add<K extends keyof HTMLElementTagNameMap>(tag:K,host:HTMLElement,text=''){
  const element=document.createElement(tag);element.textContent=text;host.append(element);return element;
 }
 const root=add('details',parent),title=add('summary',root),form=add('div',root),note=add('p',root);
 root.id='world-field-exploration';root.className='vii-fold world-field-exploration';form.className='world-field-form';
 const makeInput=<K extends 'select'|'input'>(tag:K,id:string)=>{
  const label=add('label',form),caption=add('span',label),input=add(tag,label);input.id='world-field-'+id;return {input,caption};
 };
 const reuse=makeInput('input','reuse');reuse.input.type='checkbox';
 const origin=makeInput('select','origin'),entrance=makeInput('select','entrance'),targetField=makeInput('input','field');
 const targetKind=makeInput('select','target-kind'),targetID=makeInput('input','target'),limit=makeInput('select','transfers');
 const sceneOptions=add('datalist',root);sceneOptions.id='world-field-scenes';targetField.input.setAttribute('list',sceneOptions.id);
 for(const input of [targetField.input,targetID.input]){input.type='number';input.min='0';input.max='65535';input.step='1';}
 function action(host:HTMLElement,key:string,fn:()=>void){const b=add('button',host,t(key));b.type='button';b.onclick=fn;return b;}
 const run=action(root,'worldField.run',()=>void calculate()),cancel=action(root,'journey.cancel',()=>invalidate('cancelled'));
 run.id='world-field-run';cancel.id='world-field-cancel';
 const status=add('p',root);status.id='world-field-status';status.setAttribute('role','status');
 const results=add('div',root);results.id='world-field-result';
 const fieldControl=document.createElement('details');fieldControl.className='vii-fold world-field-exploration';fieldControl.id='world-field-field-controls';fieldControl.hidden=true;
 const fieldTitle=add('summary',fieldControl),fieldActions=add('div',fieldControl);
 let answer:ExplorationResult|null=null,fieldSources:ExplorationFields|null=null,owner:ExplorationFieldPort|undefined;
 let journeyGeneration=appStore.state.data.generation,ticket=0,viewTicket=0,busy=false,report='ready';
 let controller:AbortController|null=null,worldLocations:[string|null,string|null]=[null,null];
 let poiIdentity=ports.poi();
 const current=()=>!scope.disposed&&journeyGeneration===appStore.state.data.generation&&ports.poi()===poiIdentity&&ports.field()===owner&&(!fieldSources||fieldSources.current());
 function invalidate(message='ready'){
  ticket++;viewTicket++;controller?.abort();controller=null;busy=false;answer=null;fieldSources=null;report=message;
  owner?.clearExploration();
  const detail=document.getElementById('world-field-world-evidence');
  if(detail){detail.remove();const host=document.getElementById('selection-details')!;delete host.dataset.journeyLeg;
   if(appStore.state.selection?.id==='journey:world-field')appStore.dispatch({type:'select',selection:null});}
  draw();
 }
 function option(host:HTMLElement,value:string,label:string){const row=add('option',host,label);row.value=value;return row;}
 function formChoices(){
  const oldOrigin=origin.input.value,oldEntrance=entrance.input.value,poi=ports.poi();
  origin.input.replaceChildren();option(origin.input,'',t('journey.choose'));
  for(const place of poi?.locations??[])option(origin.input,place.id,place.display_name);
  if(oldOrigin)origin.input.value=oldOrigin;
  entrance.input.replaceChildren();option(entrance.input,'',t('gateway.chooseStart'));
  const completed=reuse.input.checked?ports.journey():null;
  for(const row of poi?.entrances??[]){
   const place=poi!.locations.find(place=>place.id===row.location_id)!;
   if(completed&&row.location_id!==completed.stations.at(-1)?.locationId)continue;
   option(entrance.input,row.id,`${place.display_name} · ${t(row.scenario?'anchors.alternative':'anchors.default')} · ${row.field_name}/${row.field_id} · ${row.entrance_table_id} → △${row.field_triangle}`);
  }
  if(oldEntrance&&[...entrance.input.options].some(o=>o.value===oldEntrance))entrance.input.value=oldEntrance;
  sceneOptions.replaceChildren();
  for(const scene of ports.field()?.evidence()?.nodes??[])if(scene.status==='available')option(sceneOptions,String(scene.id),scene.name);
 }
 const integer=(input:HTMLInputElement)=>input.value!==''&&input.validity.valid&&Number.isInteger(input.valueAsNumber)?input.valueAsNumber:null;
 function ready(){return ports.supported()&&!busy&&!!entrance.input.value&&integer(targetField.input)!==null&&
  (!targetKind.input.value||integer(targetID.input)!==null)&&(reuse.input.checked?!!ports.journey():!!origin.input.value);}
 function draw(){
  const result=answer;
  status.textContent=t('worldField.'+report);
  run.disabled=!ready();cancel.disabled=!busy&&!result;
  origin.input.disabled=reuse.input.checked;
  targetID.input.disabled=!targetKind.input.value;
  results.replaceChildren();fieldActions.replaceChildren();
  fieldControl.hidden=!result?.start;
  if(!result){delete results.dataset.status;return;}
  results.dataset.status=result.status;
  if(result.reason){
   const key=['worldField.reason.','journey.reason.','gateway.reason.','gateway.'].map(prefix=>prefix+result.reason).find(key=>Object.hasOwn(dictionaries.en,key));
   if(key)add('p',results,t(key));
  }
  if(result.world?.status==='success'){
   const distance=formatNumber(result.world.totalDistance!/1000,3);
   add('p',results,t('journey.graphDistance')+' · '+distance+' km');
   action(results,'worldField.world',()=>void showWorld()).id='world-field-world';
   action(fieldActions,'worldField.world',()=>void showWorld());
   if(ports.backend()?.openEncounter){
    action(results,'encRoute.title',()=>void showWorld(true)).id='world-field-encounter-analysis';
    action(fieldActions,'encRoute.title',()=>void showWorld(true));
   }
  }
  if(result.start){
   const record=result.transfer!.record!,first=result.start;
   const view:ExplorationFieldView={point:first,anchor:`entrance:${record.field_table_record}`,evidence:{world:result.worldArrival,source:result.fieldSource,transfer:result.transfer}};
   const open=()=>void showField(view);
   const label=`${t('worldField.transfer')} · FIELD.TBL ${record.field_table_record} → ${record.field_name}/${first.fieldId} △${first.triangle}`;
   action(results,'worldField.transfer',open).textContent=label;
   action(fieldActions,'worldField.transfer',open).textContent=label;
   result.legs.forEach((leg,index)=>{
    const point=index===0?first:result.legs[index-1].arrival;
    const legView:ExplorationFieldView={point,anchor:`segment:${leg.fromField}:${leg.gateway.gateway}`,gateway:leg.gateway,
     path:{ids:leg.triangles,steps:leg.access,reason:null},evidence:{source:result.fieldSource,leg}};
    const label=`${leg.fromField} △${leg.startTriangle} → G${leg.gateway.gateway} → ${leg.arrival.fieldId} △${leg.arrival.triangle} · ${leg.access.length} ${t('worldField.hops')}`;
    action(results,'worldField.leg',()=>void showField(legView)).textContent=label;
    action(fieldActions,'worldField.leg',()=>void showField(legView)).textContent=label;
   });
   if(result.arrival){
    const last=result.legs.at(-1),point=result.arrival,local=result.final;
    const finalView:ExplorationFieldView={point,anchor:last?`arrival:${last.fromField}:${last.gateway.gateway}`:view.anchor,
     path:local?.path,lineKey:local?.line?.key,evidence:{source:result.fieldSource,arrival:point,local}};
    const label=`${t('worldField.final')} · ${point.fieldId} △${point.triangle}`+(local?` → △${local.endTriangle} · ${local.path.steps.length} ${t('worldField.hops')}`:'');
    action(results,'worldField.final',()=>void showField(finalView)).textContent=label;
    action(fieldActions,'worldField.final',()=>void showField(finalView)).textContent=label;
   }
  }
  const details=evidenceSection(results,t('worldField.evidence'));
  add('p',details,t('worldField.scope'));
  add('pre',details,JSON.stringify({world:result.world?.source,scenario:result.world?.scenario,arrival:result.worldArrival,
   field:result.fieldSource,usage:result.usage,milliseconds:result.timings,reusedWorld:result.reusedWorld},null,2));
 }
 async function calculate(){
  if(!ready())return;
  const backend=ports.backend(),poi=ports.poi(),atlas=ports.atlas();
  if(!backend||!poi){invalidate('unavailable');return;}
  const selectedEntrance=poi.entrances.find(row=>row.id===entrance.input.value)!;
  const completed=reuse.input.checked?ports.journey():null;
  const originId=origin.input.value,profile=ports.scenario();
  const target:ExplorationTarget|null=targetKind.input.value==='line'?{kind:'line',offset:integer(targetID.input)!}:
   targetKind.input.value==='triangle'?{kind:'triangle',triangle:integer(targetID.input)!}:null;
  const request={entranceId:selectedEntrance.id,entranceScenario:selectedEntrance.scenario as 0|1,targetField:integer(targetField.input)!,
   maxTransfers:Number(limit.input.value),target,scenario:profile};
  invalidate();busy=true;report='busy';
  owner=ports.field();poiIdentity=poi;journeyGeneration=appStore.state.data.generation;fieldSources=owner?.explorationResources(target?.kind==='line')??null;
  const stamp=ticket,lease=backend.claim(),signal=(controller=new AbortController()).signal;
  const valid=()=>stamp===ticket&&current()&&ports.supported()&&backend.current(lease)&&ports.atlas()===atlas;
  draw();
  try{
   const {graph,source}=await backend.context(JSON.stringify(atlas));if(!valid())return;
   const stations=completed?.stations??[
    resolveJourneyStation('exploration-origin',{kind:'location',id:originId},false,poi,atlas,graph),
    resolveJourneyStation('exploration-entrance',{kind:'entrance',id:selectedEntrance.id},false,poi,atlas,graph)];
   const {labels}=await backend.components(profile.profile,profile.conditional);if(!valid())return;
   const result=await exploreWorldField({request,graph,source,labels,poi,stations,fields:fieldSources,journey:completed?.result,signal,current:valid,
    solve:(from,to)=>backend.route(profile.profile,profile.conditional,from,to),yield:()=>new Promise(resolve=>setTimeout(resolve,0))});
   if(!valid())return;
   answer=result;report=result.status;worldLocations=[stations[0].locationId,selectedEntrance.location_id];
   if(result.world?.status==='success')backend.display(lease,result.world.nodes,...worldLocations,result.world.totalDistance!,encounterJourneyRoute(result.world,'world-field'));
  }catch(error){if(valid())report=error instanceof Error&&error.message==='source_stale'?'unresolved':'unavailable';}
  finally{if(stamp===ticket){busy=false;controller=null;if(report==='busy')report='cancelled';draw();}}
 }
 function captureWorld(){
  const state=appStore.state,viewer=ports.viewer()!,bridge=viewer.overviewBridge;
  const selection=state.selection,nav=navigationSelection(),projection=state.view.projection,generation=state.data.generation;
  const {camera,controls}=bridge,position=camera.position.clone(),up=camera.up.clone(),target=controls.target.clone(),zoom=camera.zoom;
  return ()=>{
   if(generation!==appStore.state.data.generation||appStore.state.map.id!=='WM0'||viewer!==ports.viewer())return;
   if(projection===appStore.state.view.projection){camera.position.copy(position);camera.up.copy(up);camera.zoom=zoom;controls.target.copy(target);camera.updateProjectionMatrix();controls.update();}
   setNavigationSelection(nav);
   if(selection?.kind==='triangle')viewer.selectSource(Number(selection.id));
   if(nav)viewer.selectLocation(nav.location.id,nav.entrance);
   appStore.dispatch({type:'select',selection});
  };
 }
 async function showField(view:ExplorationFieldView){
  const result=answer,field=ports.field(),stamp=++viewTicket;
  if(!result||!field||!current()||!ports.viewer())return;
  const valid=()=>viewTicket===stamp&&answer===result&&current();
  try{if(!await field.showExploration(view,appStore.state.view.spatial==='world'?captureWorld():()=>{},valid)&&valid()){report='unavailable';draw();}}
  catch{if(valid()){report='unavailable';draw();}}
 }
 async function showWorld(encounter=false){
  const result=answer,world=result?.world,backend=ports.backend(),stamp=++viewTicket;
  if(!world||!backend||!current())return;
  if(appStore.state.view.spatial!=='world')ports.field()?.returnFromExploration();
  if(!ports.supported())return;
  const lease=backend.claim();
  try{
   const {source}=await backend.context(JSON.stringify(ports.atlas()));
   if(viewTicket!==stamp||answer!==result||!current()||!backend.current(lease))return;
   if(!sameJourneySource(world.source,source)){invalidate('unresolved');return;}
   backend.display(lease,world.nodes,...worldLocations,world.totalDistance!,encounterJourneyRoute(world,'world-field'));
   if(encounter){backend.openEncounter?.();return;}
   const host=document.getElementById('selection-details');
   if(host){
    host.replaceChildren();host.hidden=false;host.dataset.journeyLeg='world-field';
    const detail=evidenceSection(host,t('worldField.evidence'));detail.id='world-field-world-evidence';detail.open=true;
    add('pre',detail,JSON.stringify({legs:world.legs,arrival:result.worldArrival},null,2));
    appStore.dispatch({type:'select',selection:{kind:'route',id:'journey:world-field',mapId:'WM0'}});
    document.dispatchEvent(new Event('gaiagis:inspect'));
   }
  }catch{if(viewTicket===stamp&&current())invalidate('unresolved');}
 }
 function refresh(){
  if(scope.disposed)return;
  reuse.input.disabled=!ports.journey();if(reuse.input.disabled)reuse.input.checked=false;
  if((busy||answer)&&!current())invalidate('unresolved');
  formChoices();draw();
 }
 function translate(){
  title.textContent=fieldTitle.textContent=t('worldField.title');note.textContent=t('worldField.scope');
  for(const [control,key] of [[origin,'journey.start'],[entrance,'worldField.entrance'],[targetField,'gateway.target'],[targetKind,'worldField.final'],[targetID,'worldField.targetID'],[limit,'gateway.maxTransfers'],[reuse,'worldField.reuse']] as const)control.caption.textContent=t(key);
  const kind=targetKind.input.value;targetKind.input.replaceChildren();option(targetKind.input,'',t('gateway.target'));option(targetKind.input,'triangle',t('ui.triangleInspector'));option(targetKind.input,'line','LINE');targetKind.input.value=kind;
  run.textContent=t('worldField.run');cancel.textContent=t('journey.cancel');refresh();
 }
 for(const number of [0,1,2,3])option(limit.input,String(number),String(number));limit.input.value='3';
 form.onchange=event=>{
  if(event.target===reuse.input)formChoices();
  if(event.target===entrance.input&&entrance.input.value){const selected=ports.poi()?.entrances.find(row=>row.id===entrance.input.value);if(selected)targetField.input.value=String(selected.field_id);}
  invalidate();
 };
 form.oninput=()=>{run.disabled=!ready();};
 scope.own(onLocaleChange(translate));
 scope.own(appStore.subscribe(()=>{if((busy||answer)&&!current())invalidate('unresolved');else if(busy&&!ports.supported())invalidate('cancelled');else run.disabled=!ready();}));
 scope.listen(document,'gaiagis:field-ready',refresh);
 scope.listen(document,'gaiagis:routing-source-change',()=>invalidate('unresolved'));
 scope.listen(document,'gaiagis:poi',refresh);
 ports.field()?.explorationControls(fieldControl);translate();
 return {refresh,dispose(){viewTicket++;controller?.abort();fieldControl.remove();root.remove();scope.dispose();}};
}
