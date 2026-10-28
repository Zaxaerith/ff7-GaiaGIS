// SPDX-License-Identifier: GPL-3.0-only
import {createWM0Source,queryWM0,transectWM0} from '../analysis/wm0Source';
import type {WM0Source} from '../analysis/wm0Source';
import {buildSourceEvidenceIndex} from '../analysis/sourceEvidence';
import type {SourceEvidenceResources,SourceEvidenceStatus} from '../analysis/sourceEvidence';
import {appStore} from '../app/state';
import {findNavigation} from '../app/navigation';
import {ResourceScope} from '../app/resources';
import {evidenceSection} from './contentPresentation';
import type {GaiaMeta} from '../data/mesh';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import {t,locale,onLocaleChange,formatNumber} from '../i18n';
import {surfaceCoordinate,sourceResultPager,drawSurfacePlot} from './surfaceQueries';
import {mountWM0Topology} from './wm0Topology';
import {mountRegionalTerrain} from './regionalTerrain';
import {mountRegionalConnectivity} from './regionalConnectivity';
import {createWM0Topology,prepareWM0Topology,releaseWM0Topology} from '../analysis/wm0Topology';
import type {WM0Topology} from '../analysis/wm0Topology';
import type {RoutingData} from '../data/routing';

/** The WM0 data owner supplies existing optional evidence; no second resource loader. */
export function mountWM0Source(viewer:GaiaViewer,meta:GaiaMeta,getResources:()=>SourceEvidenceResources,getRouting:()=>RoutingData|null=()=>null){
 const scope=new ResourceScope(),box=document.createElement('details');box.id='wm0-source-queries';box.className='analysis-group surface-query-panel';
 const title=document.createElement('summary'),note=document.createElement('p'),periodic=document.createElement('p'),display=document.createElement('p'),summary=document.createElement('p');for(const p of [note,periodic,display,summary])p.className='control-note';summary.id='wm0-source-summary';
 const inputs=new Map<string,HTMLInputElement>();
 const coordinate=(id:string,label:string)=>{const c=surfaceCoordinate('wm0-'+id,label);inputs.set(id,c.input);return c.wrap;};
 const button=(id:string,action:()=>void)=>{const b=document.createElement('button');b.type='button';b.id='wm0-'+id;b.onclick=action;return b;};
 const position=document.createElement('fieldset'),positionTitle=document.createElement('legend'),transect=document.createElement('fieldset'),transectTitle=document.createElement('legend');
 const query=button('query-run',runPoint),pick=button('query-pick',()=>arm('point')),pickA=button('transect-pick-a',()=>arm('a')),pickB=button('transect-pick-b',()=>arm('b')),run=button('transect-run',runTransect),clearButton=button('query-clear',clear);
 position.append(positionTitle,coordinate('query-x','X'),coordinate('query-z','Z'),query,pick);transect.append(transectTitle,coordinate('a-x','A · X'),coordinate('a-z','A · Z'),pickA,coordinate('b-x','B · X'),coordinate('b-z','B · Z'),pickB,run);
 const status=document.createElement('p'),chart=document.createElement('div');status.id='wm0-query-status';status.setAttribute('role','status');chart.id='wm0-transect-chart';
 box.append(title,note,summary,position,transect,periodic,display,clearButton,status,chart);document.getElementById('analysis-panel')!.prepend(box);
 type Hit=ReturnType<typeof queryWM0>['hits'][number];type Trace=ReturnType<typeof transectWM0>['traces'][number];type Row=Hit|Trace;
 let engine:WM0Source|undefined,point:ReturnType<typeof queryWM0>|null=null,profile:ReturnType<typeof transectWM0>|null=null,rows:Row[]=[],error=false,armed:string|null=null,unavailable=false;
 let pendingContext:Row|undefined,selected:{face:number;host:HTMLElement;context?:Row}|undefined;
 let evidence:ReturnType<typeof buildSourceEvidenceIndex>|undefined,resourceRefs:unknown[]=[];
 const sourceId=(r:Row)=>`${r.source.section}/${r.source.mesh}/${r.source.triangle}`;
 const describe=(r:Row)=>'exactHeights'in r?`${t('native.'+r.kind)} · raw Y ${r.exactHeights[0]}${r.kind==='surface'?'':' … '+r.exactHeights[1]}`:`${t('native.'+r.kind)} · t ${r.exactT.join(' … ')} · raw Y ${r.exactPath.map(p=>p[1]).join(' … ')}`;
 const caption=(r:Row)=>sourceId(r)+' · '+describe(r)+(r.source.wrapOffset?' · X '+(r.source.wrapOffset>0?'+':'')+r.source.wrapOffset:'');
 const pager=sourceResultPager<Row>(box,'wm0-query',caption,select,(b,r)=>{b.dataset.wm0Result=String(r.face);b.dataset.sourceId=sourceId(r);b.dataset.wrapOffset=String(r.source.wrapOffset);b.title=r.source.sourceSHA;});
 const read=(prefix:string)=>[inputs.get(prefix+'-x')!.value,inputs.get(prefix+'-z')!.value] as [string,string];
 const usable=()=>{const s=appStore.state;return s.map.id==='WM0'&&s.view.spatial==='world'&&s.explorer.phase==='idle'&&!s.view.variantResearch;};
 function source(){if(!engine){engine=createWM0Source(viewer.mesh,meta);const s=engine.summary;box.dataset.faces=String(s.faces);box.dataset.corners=String(s.corners);box.dataset.zeroXz=String(s.zeroXZ);box.dataset.duplicateExcess=String(s.duplicateExcess);box.dataset.prepareMs=String(s.milliseconds);}return engine;}
 // Topology and connectivity borrow the same index. Clearing either UI only
 // clears that tool; the Source/Viewer lifecycle owns index release.
 let sharedTopology:WM0Topology|undefined;
 const getTopology=()=>sharedTopology??=createWM0Topology(source());
 const getPreparedTopology=async(pause:()=>Promise<void>,current:()=>boolean)=>{const value=await prepareWM0Topology(source(),pause,()=>!scope.disposed&&current());if(current()&&!scope.disposed)sharedTopology=value;return value;};
 function releaseTopology(){if(sharedTopology){releaseWM0Topology(sharedTopology.source);sharedTopology=undefined;}}
 function cancelPick(){viewer.onSourcePositionPick=null;viewer.renderer.domElement.parentElement?.classList.remove('source-position-picking');if(armed)status.textContent='';armed=null;delete box.dataset.armed;}
 function clearResults(){cancelPick();point=profile=null;rows=[];error=false;pager.set(rows);chart.replaceChildren();status.textContent='';status.removeAttribute('title');for(const key of ['hits','heightCount','status','queryMs','traces','transectMs'])delete box.dataset[key];}
 function clear(){clearResults();for(const i of inputs.values())i.value='';}
 function arm(target:string){if(!usable())return;cancelPick();document.getElementById('draw-cancel')?.click();document.getElementById('measure-finish')?.click();appStore.dispatch({type:'analysis',tool:'none'});viewer.setAutoRotate(false);const rotation=document.getElementById('auto-rotate') as HTMLInputElement|null;if(rotation)rotation.checked=false;armed=target;box.dataset.armed=target;status.textContent=t('native.queryClick',{target:target==='point'?'X/Z':target.toUpperCase()});
  if(innerWidth<1100){document.getElementById('integrated-close')?.click();document.getElementById('collapse-inspector')?.click();}
  viewer.renderer.domElement.parentElement?.classList.add('source-position-picking');viewer.onSourcePositionPick=p=>{const prefix=target==='point'?'query':target;cancelPick();for(const [axis,value]of [['x',p[0]],['z',p[1]]] as const)inputs.get(prefix+'-'+axis)!.value=String(Number(value.toFixed(6)));if(target==='point')runPoint();else{status.textContent=t('native.endpointSet',{target:target.toUpperCase()});run.focus();}};viewer.renderer.domElement.focus();
 }
 function runPoint(){if(!usable())return;clearResults();try{point=queryWM0(source(),read('query'));rows=point.hits;box.dataset.hits=String(rows.length);box.dataset.heightCount=String(point.heightCount);box.dataset.status=point.status;box.dataset.queryMs=String(point.milliseconds);}catch(e){error=true;status.title=String(e);}render();}
 function runTransect(){if(!usable())return;clearResults();try{profile=transectWM0(source(),read('a'),read('b'));rows=profile.traces;box.dataset.traces=String(rows.length);box.dataset.transectMs=String(profile.milliseconds);}catch(e){error=true;status.title=String(e);}render();}
 function select(row:Row){if(!usable())return;pendingContext=row;viewer.selectSource(row.face);pendingContext=undefined;}
 function properties(host:HTMLElement,values:[string,string][]){const list=document.createElement('dl');list.className='property-list';for(const [label,value]of values){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);list.append(row);}host.append(list);}
 function evidenceIndex(){const resource=getResources(),refs=[resource.events,resource.poi,resource.encounters,resource.atlas,resource.field];if(!evidence||refs.some((r,i)=>r!==resourceRefs[i])){evidence=buildSourceEvidenceIndex(source().sourceSHA,resource);resourceRefs=refs;}return evidence;}
 const statusText=(value:SourceEvidenceStatus)=>t(value==='unavailable'?'source.resourceUnavailable':'source.'+value);
 function renderInspector(){
  if(!selected?.host.isConnected||!usable())return;const {face,host,context}=selected;host.querySelector('#wm0-source-inspector')?.remove();const geometry=source(),lineage=geometry.source(face),m=geometry.metrics(face),e=evidenceIndex().query(lineage);
  const section=document.createElement('section');section.id='wm0-source-inspector';section.className='source-inspector';section.dataset.sourceId=`${lineage.section}/${lineage.mesh}/${lineage.triangle}`;section.dataset.sourceFace=String(face);section.dataset.queryKind=context?.kind??'selection';section.dataset.wrapOffset=String(context?.source.wrapOffset??0);section.dataset.identity=e.identityKey??'';
  const heading=document.createElement('h3');heading.textContent=t('source.selection');section.append(heading);properties(section,[[t('ui.source'),'WM0 · '+section.dataset.sourceId],[t('native.area'),formatNumber(m.area,3)]]);
  if(context)properties(section,[[t('source.queryContext'),describe(context)],[t('source.wrap'),String(context.source.wrapOffset)]]);
  const raw=evidenceSection(section,t('atlas.technical')),hash=document.createElement('p'),rawNote=document.createElement('p');hash.className=rawNote.className='control-note';hash.textContent='wm0.map · SHA-256 '+lineage.sourceSHA;rawNote.textContent=t('source.rawUnavailable');raw.append(hash,rawNote);properties(raw,[[t('source.rawCorners'),geometry.corners(face).map(p=>p.join(', ')).join(' / ')],[t('source.diagnostics'),`${Number(m.zeroXZ)} / ${Number(m.degenerate3D)} / ${'duplicateCount'in m?m.duplicateCount:1}`]]);
  const relations=document.createElement('h4'),relationNote=document.createElement('p');relations.textContent=t('source.relations');relationNote.className='control-note';relationNote.textContent=t('source.relationScope');section.append(relations,relationNote);
  function group(key:string,value:SourceEvidenceStatus,count:number){const card=document.createElement('div'),label=document.createElement('h4');card.dataset.sourceRelation=key;card.dataset.relationStatus=value;label.textContent=t(key)+' · '+(value==='linked'?String(count):statusText(value));card.append(label);section.append(card);return card;}
  function link(host:HTMLElement,kind:'event'|'entrance'|'location'|'atlas'|'field',id:string,text:string,action?:()=>void){const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset['source'+kind[0].toUpperCase()+kind.slice(1)]=id;b.disabled=!action;b.onclick=action??null;host.append(b);}
  const encounters=group('ui.encounters',e.encounter.status,e.encounter.value?1:0);if(e.encounter.value){const r=e.encounter.value;properties(encounters,[[t('inspect.regionTable'),`${r.sourceRegion} → ${r.effectiveRegion}`],[t('inspect.effectiveTerrain'),`${r.sourceTerrain} → ${r.effectiveTerrain}`],[t('inspect.encSlot'),r.set.id+(r.fallback?' · '+t('message.terrainFallback'):'')],[t('inspect.scriptGate'),lineage.script===0?t('inspect.scriptPass'):t('message.scriptBlocks',{script:lineage.script??0})]]);const inspect=document.createElement('button');inspect.type='button';inspect.dataset.sourceEncounter=r.set.id;inspect.textContent=t('source.openContext');inspect.onclick=()=>{host.querySelector('.gameplay-inspector')?.scrollIntoView({block:'nearest'});appStore.dispatch({type:'select',selection:{kind:'encounter',id:String(face),mapId:'WM0'}});};encounters.append(inspect);}
  const events=group('ui.events',e.events.status,e.events.rows.length);for(const r of e.events.rows)link(events,'event',r.id,r.display_name+` · ${r.call_table_record}:${r.instruction_offset}`,()=>viewer.onEvent(r));
  const entrances=group('ui.entrances',e.entrances.status,e.entrances.rows.length);for(const r of e.entrances.rows){const target=findNavigation({kind:'entrance',id:r.id,mapId:'WM0'});link(entrances,'entrance',r.id,`${r.field_name} · ${r.entrance_table_id}/${r.scenario}`,target?.navigate);}
  const locations=group('ui.locations',e.locations.status,e.locations.rows.length);for(const r of e.locations.rows)link(locations,'location',r.id,r.display_name,findNavigation({kind:'location',id:r.id,mapId:'WM0'})?.navigate);
  const atlasRows=e.atlas.rows.map(r=>({row:r,target:findNavigation({kind:'atlas',id:r.entity.id,mapId:'WM0'})})).filter(r=>r.target);const atlas=group('atlas.title',e.atlas.status,atlasRows.length);for(const {row:r,target}of atlasRows)link(atlas,'atlas',r.entity.id,r.entity.localizedNames[locale()]+' · '+t('atlas.'+r.binding.precision),target!.navigate);if(atlasRows.length<e.atlas.rows.length){const hidden=document.createElement('p');hidden.className='control-note';hidden.textContent=t('source.filtered');atlas.append(hidden);}
  const fields=group('inspect.field',e.field.status,e.field.rows.length);for(const r of e.field.rows)link(fields,'field',String(r.node.id),`${r.node.name} · ${r.binding.entranceId} · ${t(r.tableStatus==='mesh_unavailable'?'anchors.mesh_unavailable':r.tableStatus?'nav39.unavailable':'field.verified_direct')}`,()=>document.dispatchEvent(new CustomEvent('gaiagis:field-open',{detail:r.node.id})));
  host.append(section);topology.inspect(face,section);connectivity.inspect(face,section);
 }
 function inspect(face:number,host:HTMLElement){selected=!unavailable&&face<viewer.mesh.sourceTriangleCount?{face,host,context:pendingContext}:undefined;if(selected)renderInspector();}
 function render(){title.textContent=t('source.title');note.textContent=t('source.note');periodic.textContent=t('source.periodic');display.textContent=t('source.displayScope');positionTitle.textContent=t('native.position');transectTitle.textContent=t('native.transect');for(const [b,key]of [[query,'native.queryRun'],[pick,'source.pick'],[pickA,'native.pickA'],[pickB,'native.pickB'],[run,'native.transectRun'],[clearButton,'native.queryClear']] as const)b.textContent=t(key);
  const s=engine?.summary;summary.textContent=unavailable?t('source.unavailable'):s?t('source.summary',{faces:s.faces,corners:s.corners,vertical:s.zeroXZ,duplicates:s.duplicateExcess}):'';
  if(point)status.textContent=t('native.query.'+point.status)+' · '+t('native.queryCount',{count:point.hits.length,heights:point.heightCount});else if(profile)status.textContent=t('native.transectCount',{count:profile.traces.length,gaps:profile.gaps.length});else if(error)status.textContent=t('native.queryInvalid');if(armed)status.textContent=t('native.queryClick',{target:armed==='point'?'X/Z':armed.toUpperCase()});pager.set(rows);
  if(profile)drawSurfacePlot(chart,[{label:'WM0',traces:profile.traces,gaps:profile.gaps}],profile.length,caption,select,r=>sourceId(r)+'@'+r.source.wrapOffset);else chart.replaceChildren();
 }
 const refreshEvidence=()=>{if(selected&&['triangle','encounter'].includes(appStore.state.selection?.kind??'')&&appStore.state.selection?.id===String(selected.face))renderInspector();};
 for(const name of ['gaiagis:poi','gaiagis:events','gaiagis:encounters','gaiagis:fields','gaiagis:field-ready','gaiagis-navigation'])scope.listen(document,name,()=>queueMicrotask(()=>{if(!scope.disposed)refreshEvidence();}));
 let available=usable();scope.own(appStore.subscribe(()=>{const next=usable();box.hidden=appStore.state.map.id!=='WM0'||appStore.state.view.spatial!=='world';if(available&&!next){clear();selected=undefined;releaseTopology();}available=next;if(!['triangle','encounter'].includes(appStore.state.selection?.kind??''))selected=undefined;for(const b of [query,pick,pickA,pickB,run])b.disabled=!next||unavailable;}));
 scope.listen(document,'gaiagis-map-changing',releaseTopology);
 scope.listen(document,'gaiagis:mapping-tool',cancelPick);scope.listen(box,'toggle',()=>{if(!box.open&&armed){cancelPick();status.textContent='';}});scope.listen(document,'click',e=>{const target=(e.target as Element)?.closest('button');if(target?.id==='measure-start')cancelPick();});scope.listen(viewer.renderer.domElement,'keydown',((e:KeyboardEvent)=>{if(e.key==='Escape'&&armed){cancelPick();status.textContent='';}}) as EventListener);
 scope.own(onLocaleChange(()=>{render();refreshEvidence();}));try{source();}catch(e){unavailable=true;summary.title=String(e);}render();for(const b of [query,pick,pickA,pickB,run])b.disabled=!usable()||unavailable;
 const topology=mountWM0Topology(viewer,source,()=>usable()&&!unavailable,getRouting,face=>{cancelPick();viewer.selectSource(face);},getTopology);
 const regional=mountRegionalTerrain(viewer,meta,source,()=>usable()&&!unavailable,face=>{cancelPick();viewer.selectSource(face);});
 const connectivity=mountRegionalConnectivity(viewer,meta,source,getPreparedTopology,getResources,()=>usable()&&!unavailable,face=>{cancelPick();viewer.selectSource(face);});
 return {inspect,clear,dispose(){connectivity.dispose();regional.dispose();topology.dispose();releaseTopology();cancelPick();selected=undefined;evidence=undefined;resourceRefs=[];scope.dispose();pager.dispose();box.remove();}};
}
