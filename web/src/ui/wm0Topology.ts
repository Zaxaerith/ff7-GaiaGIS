// SPDX-License-Identifier: GPL-3.0-only
import {createWM0Topology,releaseWM0Topology,compareTopologyRouting,topologyFilters} from '../analysis/wm0Topology';
import type {WM0Topology,TopologyFilter} from '../analysis/wm0Topology';
import type {WM0Source} from '../analysis/wm0Source';
import type {RoutingData} from '../data/routing';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import {sourceGeographic} from '../explorer/coordinates';
import {ResourceScope} from '../app/resources';
import {evidenceSection} from './contentPresentation';
import {appStore} from '../app/state';
import {t,onLocaleChange,formatNumber} from '../i18n';
import {sourceResultPager} from './surfaceQueries';

/** Borrows the current Source/Viewer/CSR owners; no resource loader or overlay. */
export function mountWM0Topology(viewer:GaiaViewer,getSource:()=>WM0Source,usable:()=>boolean,getRouting:()=>RoutingData|null,selectFace:(face:number)=>void){
 const scope=new ResourceScope(),box=document.createElement('details');box.id='wm0-topology';box.className='analysis-group surface-query-panel';
 const make=(tag:string,host:HTMLElement,text='')=>{const e=document.createElement(tag);e.textContent=text;host.append(e);return e;};
 const title=make('summary',box),note=make('p',box),build=make('button',box) as HTMLButtonElement,clear=make('button',box) as HTMLButtonElement,status=make('p',box),stats=make('div',box),label=make('label',box),filter=make('select',label) as HTMLSelectElement,count=make('p',box);
 build.type=clear.type='button';build.id='wm0-topology-build';clear.id='wm0-topology-clear';filter.id='wm0-topology-filter';stats.id='wm0-topology-statistics';status.setAttribute('role','status');note.className=status.className=count.className='control-note';
 const filterTitle=document.createElement('span');label.prepend(filterTitle);
 for(const value of topologyFilters){const o=make('option',filter) as HTMLOptionElement;o.value=value;}
 document.getElementById('analysis-panel')!.prepend(box);
 let index:WM0Topology|undefined,source:WM0Source|undefined,selected:{face:number;host:HTMLElement}|undefined,inspector:ResourceScope|undefined;
 let filterValue:TopologyFilter='all',ticket=0,frame=0,preparing=false,failed=false,lastRouting:RoutingData|null=null;
 const identity=(face:number)=>{const s=source!.source(face);return `${s.section}/${s.mesh}/${s.triangle}`;};
 function choose(face:number){if(!usable()||!index)return;const points=index.source.corners(face),center=[0,1,2].map(j=>points.reduce((sum,p)=>sum+p[j]/3,0)),geo=sourceGeographic(...center as [number,number,number]);selectFace(face);viewer.flyToLocation(geo[0],geo[1]);}
 const pager=sourceResultPager<number>(box,'wm0-topology',f=>identity(f),choose,(b,f)=>{b.dataset.topologyFace=String(f);});
 const properties=(host:HTMLElement,rows:[string,string][])=>{const dl=make('dl',host);dl.className='property-list';for(const [key,value]of rows){const row=make('div',dl);make('dt',row,key);make('dd',row,value);}};
 function render(){
  title.textContent=t('topology.title');note.textContent=t('topology.scope');build.textContent=t('topology.build');clear.textContent=t('topology.clear');filter.setAttribute('aria-label',t('topology.filter'));
  // Keep the selector node and its focus across locale changes.
  for(const o of filter.options)o.textContent=t('topology.'+o.value);filter.value=filterValue;
  filterTitle.textContent=t('topology.filter');status.textContent=t(preparing?'topology.busy':failed?'source.unavailable':index?'topology.ready':'topology.lazy');
  build.disabled=!usable()||preparing;clear.disabled=!index&&!preparing;filter.disabled=!usable()||!index;
  stats.replaceChildren();
  if(index){const s=index.summary;box.dataset.faces=String(s.faces);box.dataset.edgeKeys=String(s.edgeKeys);box.dataset.prepareMs=String(s.milliseconds);
   for(const [group,keys]of [['sourceRecords',['faces','vertexRecords','edgeRecords']],['derived',['uniqueVertices','edgeKeys','boundaryEdges','regularEdges','nonmanifoldEdges','collapsedKeys','collapsedOccurrences','repeatedKeys','repeatedOccurrences','duplicateGroups','duplicateFaces','duplicateExcess','duplicateEdges','geometricAmbiguous']],['periodicRelations',['periodicEdges','periodicPairs','periodicUnresolved','unresolvedEdges']]] as const){make('h4',stats,t('topology.'+group));properties(stats,keys.map(k=>[t('topology.'+k),formatNumber(s[k])]));}
   make('p',stats,t('topology.countScope')).className='control-note';
   properties(stats,[[t('topology.incidence'),Object.entries(s.incidence).map(([n,k])=>`${n}: ${formatNumber(k)}`).join(' / ')],[t('topology.multiplicity'),Object.entries(s.multiplicity).map(([n,k])=>`${n}: ${formatNumber(k)}`).join(' / ')||'0']]);
  }
  const rows=index?.faces(filterValue)??[];count.textContent=t('topology.matches',{count:rows.length});pager.set(rows);
 }
 function discardInspector(){inspector?.dispose();inspector=undefined;}
 function renderInspector(){
  discardInspector();if(!selected?.host.isConnected||!usable())return;
  const host=selected.host,face=selected.face,section=make('section',host);section.id='wm0-topology-inspector';inspector=new ResourceScope();const own=inspector;own.own(()=>section.remove());make('h4',section,t('topology.title'));
  if(!index){make('p',section,t(preparing?'topology.busy':failed?'source.unavailable':'topology.lazy'));return;}
  const comparison=compareTopologyRouting(index,face,getRouting());
  make('p',section,t('topology.routeScope'));make('p',section,t('topology.'+(comparison.reason??'compared')));
  function faceList(parent:HTMLElement,prefix:string,values:number[]){if(!values.length){make('p',parent,'—');return;}const p=sourceResultPager<number>(parent,prefix,f=>identity(f),choose,(b,f)=>{b.dataset.topologyNeighbor=String(f);});p.set(values);own.own(()=>p.dispose());}
  for(const [name,values]of [['rawNeighbors',comparison.raw],['periodicNeighbors',comparison.periodic],['routingNeighbors',comparison.routing],...(comparison.reason?[]:[['geometryOnly',comparison.geometryOnly],['routingOnly',comparison.routingOnly]])] as [string,number[]][]){make('h5',section,t('topology.'+name));faceList(section,'wm0-topology-'+name,values);}
  const duplicates=index.duplicates(face);if(duplicates.length>1){make('h5',section,t('topology.duplicate')+` × ${duplicates.length}`);faceList(section,'wm0-topology-duplicates',duplicates);}
  for(const edge of index.face(face)){
   const card=make('section',section);card.dataset.topologyEdge=String(edge.slot);make('h5',card,t('topology.edge',{slot:edge.slot,count:edge.incidence}));make('pre',evidenceSection(card,t('atlas.technical')),`raw (X,Z,Y) A [${edge.a.join(', ')}] → B [${edge.b.join(', ')}]`);
   make('p',card,[edge.boundary?'boundary':edge.incidence===2?'regular':null,edge.nonmanifold?'nonmanifold':null,edge.collapsed?'collapsed':null,edge.duplicate?'duplicate':null,edge.repeated?'repeated':null,edge.geometricAmbiguous?'ambiguous':null].filter(Boolean).map(k=>t('topology.'+k)).join(' · '));
   make('p',card,t('topology.'+(edge.uniqueRaw?'uniqueRaw':'allReferences')));
   const refs=sourceResultPager(card,`wm0-topology-edge-${edge.slot}`,r=>`${identity(r.face)} · ${t('topology.slot',{slot:r.slot})}${r.face!==face&&!comparison.reason?' · CSR '+(comparison.routing.includes(r.face)?'✓':'—'):''}`,(r:{face:number;slot:number})=>choose(r.face));refs.set(edge.references);own.own(()=>refs.dispose());
   if(edge.periodic.side){make('p',card,`X=${edge.periodic.side==='west'?0:294912} · `+t('topology.seam.'+edge.periodic.status));
    const refs=sourceResultPager(card,`wm0-topology-periodic-${edge.slot}`,r=>`${identity(r.face)} · ${t('topology.slot',{slot:r.slot})}${!comparison.reason?' · CSR '+(comparison.routing.includes(r.face)?'✓':'—'):''}`,(r:{face:number;slot:number})=>choose(r.face));refs.set(edge.periodic.references);own.own(()=>refs.dispose());}
  }
 }
 async function prepare(){
  if(!usable()||scope.disposed||preparing)return;if(index){render();renderInspector();return;}
  const request=++ticket;preparing=true;failed=false;render();renderInspector();
  await new Promise<void>(resolve=>{frame=requestAnimationFrame(()=>{frame=0;resolve();});});
  if(scope.disposed||request!==ticket||!usable())return;
  try{source=getSource();index=createWM0Topology(source);}catch(e){failed=true;status.title=String(e);}
  if(scope.disposed||request!==ticket||!usable())return;preparing=false;render();renderInspector();
 }
 function reset(){ticket++;if(frame)cancelAnimationFrame(frame);frame=0;preparing=failed=false;lastRouting=null;selected=undefined;discardInspector();if(source)releaseWM0Topology(source);source=undefined;index=undefined;filterValue='all';pager.set([]);stats.replaceChildren();for(const k of ['faces','edgeKeys','prepareMs'])delete box.dataset[k];status.removeAttribute('title');render();}
 build.onclick=()=>void prepare();clear.onclick=reset;filter.onchange=()=>{filterValue=filter.value as TopologyFilter;render();};scope.listen(box,'toggle',()=>{if(box.open)void prepare();});
 let available=usable();scope.own(appStore.subscribe(()=>{const next=usable();box.hidden=appStore.state.map.id!=='WM0'||appStore.state.view.spatial!=='world';if(available&&!next)reset();available=next;
  const graph=next?getRouting():null;if(graph!==lastRouting){lastRouting=graph;renderInspector();}
  if(selected&&(!['triangle','encounter'].includes(appStore.state.selection?.kind??'')||appStore.state.selection?.id!==String(selected.face))){selected=undefined;discardInspector();}
  build.disabled=!next||preparing;filter.disabled=!next||!index;
 }));scope.listen(document,'gaiagis-map-changing',reset);scope.own(onLocaleChange(()=>{render();renderInspector();}));render();
 return {inspect(face:number,host:HTMLElement){selected={face,host};if(index)renderInspector();else void prepare();},dispose(){reset();scope.dispose();pager.dispose();box.remove();}};
}
