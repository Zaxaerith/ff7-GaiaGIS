// SPDX-License-Identifier: GPL-3.0-only
import {createEncounterGeography,validateEncounterRelations} from '../analysis/encounterGeography';
import type {GeographyTarget,GeographyRange,GeographyFamily,GeographyResult,EncounterRelations,EncounterReference} from '../analysis/encounterGeography';
import type {WM0Source} from '../analysis/wm0Source';
import type {EncounterResource} from '../data/encounters';
import {resolveEncounter} from '../data/encounters';
import type {GameplayIndex} from '../data/gameplay';
import type {GaiaMeta} from '../data/mesh';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import {appStore} from '../app/state';
import {ResourceScope} from '../app/resources';
import {t,onLocaleChange,formatNumber} from '../i18n';
import {sourceGeographic} from '../explorer/coordinates';
import {sourceResultPager} from './surfaceQueries';

/** Shares the WM0 Source lifetime; holds only session lookup/selection state. */
export function mountEncounterGeography(viewer:GaiaViewer,meta:GaiaMeta,getSource:()=>WM0Source,getEncounter:()=>EncounterResource|null,getGameplay:()=>GameplayIndex|null,usable:()=>boolean,selectFace:(face:number)=>void){
 const scope=new ResourceScope(),box=document.createElement('details');box.id='encounter-geography';box.className='analysis-group surface-query-panel';
 const make=<K extends keyof HTMLElementTagNameMap>(tag:K,parent:HTMLElement,text='')=>{const node=document.createElement(tag);node.textContent=text;parent.append(node);return node;};
 const title=make('summary',box),note=make('p',box),form=make('div',box);form.className='encounter-query-controls';
 const selector=(id:string,values:string[])=>{const label=make('label',form),caption=make('span',label),input=make('select',label);input.id='encgeo-'+id;for(const value of values){const o=make('option',input);o.value=value;}return {label,caption,input};};
 const kind=selector('kind',['all','set','formation','enemy']),set=selector('set',[]),range=selector('range',['candidate','lookup']),family=selector('family',['ordinary','chocobo']);
 const numeric=(id:string,max:number)=>{const label=make('label',form),caption=make('span',label),input=make('input',label);input.id='encgeo-'+id;input.type='number';input.min='0';input.max=String(max);input.step='1';input.value=id==='formation'?'64':id==='scene'?'16':'87';return {label,caption,input};};
 const formation=numeric('formation',1023),scene=numeric('scene',255),enemy=numeric('enemy',65534),run=make('button',box),clear=make('button',box),maskLabel=make('label',box),show=make('input',maskLabel),showText=make('span',maskLabel),status=make('p',box),summary=make('div',box),group=selector('group',['region','terrain','set']),distribution=make('div',box),refs=make('details',box),refsTitle=make('summary',refs),refsBody=make('div',refs),facesTitle=make('h4',box);
 show.type='checkbox';show.checked=true;show.id='encgeo-highlight';run.id='encgeo-run';clear.id='encgeo-clear';run.type=clear.type='button';status.id='encgeo-status';status.setAttribute('role','status');note.className=status.className='control-note';group.label.remove();box.insertBefore(group.label,distribution);
 document.getElementById('analysis-panel')!.prepend(box);
 let engine:ReturnType<typeof createEncounterGeography>|null=null,resource:EncounterResource|null=null,index:GameplayIndex|null=null,relations:EncounterRelations|null=null,result:GeographyResult|null=null,target:GeographyTarget={kind:'all'},ticket=0,busy=false,failed:'source_mismatch'|'unknown_identity'|null=null;
 const pager=sourceResultPager<number>(box,'encgeo-faces',face=>{const a=engine!.source.source(face);return `#${face} · ${a.section}/${a.mesh}/${a.triangle}`;},face=>{if(!engine||!usable())return;const corners=engine.source.corners(face),center=[0,1,2].map(j=>corners.reduce((sum,p)=>sum+p[j]/3,0)),geo=sourceGeographic(...center as [number,number,number]);selectFace(face);viewer.flyToLocation(geo[0],geo[1]);},(b,face)=>{b.dataset.encounterFace=String(face);});
 const records=sourceResultPager<EncounterReference>(refsBody,'encgeo-records',r=>`${r.setId} · ${r.kind} · @${r.record.byte_offset} · Formation ${r.record.scene_id} · ${t('encgeo.weight')} ${r.record.weight}`,r=>{if(r.record.weight>0&&relations?.status==='available')openGameplay({kind:'formation',id:r.record.scene_id});},(b,r)=>{b.disabled=r.record.weight===0||relations?.status!=='available';b.title=JSON.stringify(r.record);});
 function openGameplay(detail:GeographyTarget){document.dispatchEvent(new CustomEvent('gaiagis:gameplay-open',{detail}));}
 const property=(key:string,value:string)=>{const row=make('div',summary);row.className='encounter-metric';make('span',row,t(key));make('strong',row,value);};
 const number=(v:number)=>formatNumber(v,2);
 function draw(){
  title.textContent=t('encgeo.title');note.textContent=t('encgeo.scope')+' '+t(family.input.value==='chocobo'?'encgeo.chocoboNote':'encgeo.candidateNote');
  for(const [key,c]of Object.entries({kind,set,range,family,formation,scene,enemy,group})){c.caption.textContent=t('encgeo.'+key);c.input.setAttribute('aria-label',t('encgeo.'+key));}
  for(const c of [kind,range,family,group])for(const o of c.input.options)o.textContent=t('encgeo.'+o.value);
  set.label.hidden=kind.input.value!=='set';formation.label.hidden=kind.input.value!=='formation';scene.label.hidden=enemy.label.hidden=kind.input.value!=='enemy';
  const data=getEncounter()?.data,chosen=set.input.value;set.input.replaceChildren();for(const s of data?.encounter_sets??[]){const o=make('option',set.input,s.id+(s.active?'':' · '+t('inspect.inactive')));o.value=s.id;}if(chosen)set.input.value=chosen;
  run.textContent=t('encgeo.query');clear.textContent=t('encgeo.clear');showText.textContent=t('encgeo.highlight');facesTitle.textContent=t('regional.sourceFaces');refsTitle.textContent=t('encgeo.records');
  run.disabled=!usable()||!data||busy;clear.disabled=!engine&&!result&&!busy;show.disabled=!result||!usable();
  status.textContent=t('encgeo.'+(busy?'busy':failed??(!usable()?'unavailable':!data?'missing':result?.status??'ready')));
  summary.replaceChildren();distribution.replaceChildren();
  if(relations){const p=make('p',summary,t('encgeo.'+relations.status));p.className='control-note';if(relations.reason)p.title=relations.reason;if(relations.status==='available')property('encgeo.links',String(relations.records.length));}
  if(result){
   property('regional.faces',number(result.total.count));property('regional.area',number(result.total.area));
   for(const [key,value]of [['zeroXZ',result.zeroXZ],['duplicateMembers',result.duplicateMembers],['clamped',result.clamped],['aliased',result.aliased],['fallback',result.fallback]] as const)property('encgeo.'+key,number(value));
   if(target.kind==='formation'||target.kind==='enemy'){const b=make('button',summary,t('encgeo.openCard'));b.type='button';b.disabled=relations?.status!=='available';b.onclick=()=>openGameplay(target);}
   const axis=group.input.value,rows=axis==='region'?result.regions:axis==='terrain'?result.terrains:result.sets;
   const scroll=make('div',distribution);scroll.className='encounter-table-scroll';const table=make('table',scroll),head=make('tr',make('thead',table));for(const text of [t('encgeo.'+axis),t('regional.faces'),t('regional.area'),t('regional.areaPercent')])make('th',head,text);const body=make('tbody',table);
   for(const [id,row]of [...rows.entries()].sort((a,b)=>b[1].area-a[1].area||String(a[0]).localeCompare(String(b[0])))){const tr=make('tr',body),name=axis==='region'?meta.region_names[id]:axis==='terrain'?meta.terrain_names[id]:undefined;make('td',tr,String(id)+(name?' · '+name:''));for(const value of [number(row.count),number(row.area),result.total.area?number(row.area/result.total.area*100)+'%':t('regional.na')])make('td',tr,value);}
   make('p',distribution,t('encgeo.denominator'));const evidence=make('details',distribution);evidence.className='vii-fold vii-evidence';make('summary',evidence,t('gameplay.coverage'));make('pre',evidence,JSON.stringify({target,range:range.input.value,family:family.input.value,wm0Source:engine?.source.sourceSHA,encounterAsset:resource?.sha256,sources:resource?.data.sources,sourceRecord:resource?.data.source_record,indexBytes:engine?.bytes},null,2));pager.set(result.faces);records.set(result.records);
  }else{pager.set([]);records.set([]);}
 }
 function applyMask(){viewer.setEncounterEvidence(usable()&&show.checked&&result?.status==='ok'?result.mask:null);}
 function reset(){ticket++;busy=false;failed=null;engine=null;resource=null;index=null;relations=null;result=null;delete box.dataset.queryMs;delete box.dataset.faces;viewer.setEncounterEvidence(null);draw();}
 function readTarget():GeographyTarget{const integer=(input:HTMLInputElement)=>{const n=Number(input.value);if(input.value===''||!Number.isInteger(n)||n<0||n>Number(input.max))throw Error('Invalid ID');return n;};switch(kind.input.value){case 'set':return {kind:'set',id:set.input.value};case 'formation':return {kind:'formation',id:integer(formation.input)};case 'enemy':return {kind:'enemy',sceneId:integer(scene.input),enemyId:integer(enemy.input)};default:return {kind:'all'};}}
 async function query(){if(!usable()||scope.disposed)return;const next=getEncounter();if(!next)return;const request=++ticket;busy=true;failed=null;draw();await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));if(scope.disposed||request!==ticket||!usable()||next!==getEncounter())return;
  try{target=readTarget();const began=performance.now();if(!engine||resource!==next){engine=createEncounterGeography(getSource(),next.data);resource=next;}index=getGameplay();relations=validateEncounterRelations(next,index);result=engine.query(target,range.input.value as GeographyRange,family.input.value as GeographyFamily,relations);box.dataset.queryMs=String(performance.now()-began);box.dataset.faces=String(result.total.count);applyMask();}catch(e){failed=e instanceof Error&&e.message==='Invalid ID'?'unknown_identity':'source_mismatch';result=null;delete box.dataset.faces;viewer.setEncounterEvidence(null);status.title=String(e);}busy=false;draw();
 }
 run.onclick=()=>void query();clear.onclick=reset;show.onchange=applyMask;group.input.onchange=draw;
 // Parameters cannot leave an old mask looking like the newly selected query.
 for(const c of [kind,set,range,family,formation,scene,enemy])c.input.onchange=()=>{ticket++;busy=false;failed=null;result=null;delete box.dataset.faces;viewer.setEncounterEvidence(null);draw();};
 scope.listen(document,'gaiagis:encounter-geography',((e:CustomEvent<GeographyTarget>)=>{if(!usable())return;const value=e.detail;kind.input.value=value.kind;draw();if(value.kind==='set')set.input.value=value.id;if(value.kind==='formation')formation.input.value=String(value.id);if(value.kind==='enemy'){scene.input.value=String(value.sceneId);enemy.input.value=String(value.enemyId);}document.dispatchEvent(new CustomEvent('gaiagis:open-tool',{detail:{toolId:'encounterGeography'}}));box.open=true;const scroller=box.closest<HTMLElement>('.integrated-content');if(scroller)scroller.scrollTop=0;run.focus({preventScroll:true});void query();}) as EventListener);
 scope.listen(document,'gaiagis:encounters',reset);scope.listen(document,'gaiagis:gameplay-ready',()=>{if(index!==getGameplay()){ticket++;busy=false;index=getGameplay();relations=null;result=null;delete box.dataset.faces;viewer.setEncounterEvidence(null);draw();}});
 scope.listen(document,'gaiagis-map-changing',reset);let available=usable(),generation=appStore.state.data.generation;
 scope.own(appStore.subscribe(s=>{const next=usable();box.hidden=s.map.id!=='WM0'||s.view.spatial!=='world';if(generation!==s.data.generation||available&&!next){generation=s.data.generation;reset();}if(available!==next){available=next;draw();}}));scope.own(onLocaleChange(draw));draw();
 return {inspect(face:number,parent:HTMLElement){const r=getEncounter();if(!r||!usable())return;const a=getSource().source(face);if(a.region===null||a.terrain===null)return;const setId=resolveEncounter(r.data,a.region,a.terrain).set.id,d=make('details',parent),h=make('summary',d,t('encgeo.title'));h.dataset.encounterInspector='true';const b=make('button',d,t('encgeo.viewSet')+' · '+setId);b.type='button';b.onclick=()=>document.dispatchEvent(new CustomEvent('gaiagis:encounter-geography',{detail:{kind:'set',id:setId}}));},dispose(){scope.dispose();ticket++;engine=null;result=null;relations=null;resource=null;index=null;viewer.setEncounterEvidence(null);pager.dispose();records.dispose();box.remove();}};
}
