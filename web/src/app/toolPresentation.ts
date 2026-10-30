// SPDX-License-Identifier: GPL-3.0-only
import {t,onLocaleChange,locales,dictionaries} from '../i18n';
import type {PanelId} from './state';

type ToolGroup='terrain'|'network'|'source'|'display';
export type ToolId='encounterGeography'|'regionalTerrain'|'regionalConnectivity'|'slopeAspect'|'routing'|'reachability'|'serviceArea'|'routeProfile'|'sourceQuery'|'sourceTransect'|'topology'|'measurement'|'projection'|'layers'|'maps'|'comparison'|'variants'|'distortion'|'staticEvents'|'nativeAnalysis';
export interface ToolDefinition {id:ToolId;group:ToolGroup;title:string;aliases:readonly string[];panels:readonly PanelId[];}
/** A bounded presentation directory over existing owners, not a second analysis state. */
export const toolCatalog:readonly ToolDefinition[]=[
 {id:'encounterGeography',group:'terrain',title:'encgeo.title',aliases:['encounter formation enemy 遭遇 编队 敵 敵人 지역 적'],panels:['analysis']},
 {id:'regionalTerrain',group:'terrain',title:'regional.title',aliases:['region terrain statistics 区域 地形 統計 지역 지형'],panels:['analysis']},
 {id:'regionalConnectivity',group:'terrain',title:'connectivity.title',aliases:['region connectivity boundary component 连通 连結 境界 경계 연결'],panels:['analysis']},
 {id:'slopeAspect',group:'terrain',title:'tools.slopeAspect',aliases:['slope aspect 坡度 坡向 傾斜 경사'],panels:['analysis']},
 {id:'routing',group:'network',title:'analysis.routing',aliases:['route path dijkstra 路径 路徑 経路 경로'],panels:['analysis']},
 {id:'reachability',group:'network',title:'tools.reachability',aliases:['reachable component 可达 可達 到達 도달'],panels:['analysis']},
 {id:'serviceArea',group:'network',title:'sp25.service',aliases:['service area distance 服务区 服務区 到達圏 서비스'],panels:['analysis']},
 {id:'routeProfile',group:'network',title:'sp25.profile',aliases:['profile terrain encounter 路线 路線 高程 路径剖面 標高 프로파일'],panels:['analysis']},
 {id:'sourceQuery',group:'source',title:'tools.sourceQuery',aliases:['source point exact X Z 来源 來源 照会 원본 점'],panels:['analysis']},
 {id:'sourceTransect',group:'source',title:'tools.sourceTransect',aliases:['source transect profile cross section 剖面 断面 단면'],panels:['analysis']},
 {id:'topology',group:'source',title:'topology.title',aliases:['topology edge duplicate seam 拓扑 拓樸 トポロジー 위상'],panels:['analysis']},
 {id:'measurement',group:'source',title:'analysis.measure',aliases:['measure distance area 量测 测量 測量 計測 측정'],panels:['analysis']},
 {id:'nativeAnalysis',group:'source',title:'tools.native',aliases:['WM2 WM3 diagnostic triangle Native 诊断 診斷 진단'],panels:['analysis']},
 {id:'projection',group:'display',title:'ui.projection',aliases:['projection globe 投影 球面 투영'],panels:['view']},
 {id:'layers',group:'display',title:'tools.layers',aliases:['layers texture terrain region grid 图层 圖層 テクスチャ 레이어'],panels:['layers','view']},
 {id:'maps',group:'display',title:'tools.maps',aliases:['WM0 WM2 WM3 map Field 地图 地圖 地図 지도'],panels:['map']},
 {id:'comparison',group:'display',title:'analysis.compare',aliases:['comparison movement projection 对照 比较 比較 비교'],panels:['analysis']},
 {id:'variants',group:'display',title:'variant.title',aliases:['world variants state 地形变体 地形變體 상태'],panels:['analysis']},
 {id:'distortion',group:'display',title:'analysis.projection',aliases:['distortion tissot indicatrix 畸变 变形 畸變 歪み 왜곡'],panels:['analysis']},
 {id:'staticEvents',group:'display',title:'ui.events',aliases:['script event battle 静态事件 世界事件 バトル 전투'],panels:['layers']},
];
export const toolById=(id:string)=>toolCatalog.find(tool=>tool.id===id);
export const toolPanels=(id:ToolId):PanelId[]=>[...toolById(id)!.panels];
export function searchTools(query:string){const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return toolCatalog.filter(tool=>{const text=[tool.id,...tool.aliases,...locales.map(language=>dictionaries[language][tool.title]??'')].join(' ').toLocaleLowerCase();return terms.every(term=>text.includes(term));});}

/** No nodes move and no business owner is mounted, disposed or cleared here. */
export function mountToolPresentation(host:HTMLElement,onSelect:(id:ToolId)=>void){
 const searchLabel=document.createElement('label'),searchText=document.createElement('span'),search=document.createElement('input'),list=document.createElement('div'),empty=document.createElement('p');
 searchLabel.className='tool-directory-search';search.id='gis-tool-search';search.type='search';search.autocomplete='off';searchLabel.htmlFor=search.id;searchLabel.append(searchText,search);host.append(searchLabel,list,empty);
 const unavailable=document.createElement('p');unavailable.id='tool-presentation-unavailable';unavailable.className='control-note';unavailable.hidden=true;host.after(unavailable);
 let selected:ToolId|null=null,suspended=false,disposed=false;
 const touched=new Map<HTMLElement,boolean>();let opened=new WeakSet<HTMLElement>();
 function visible(node:HTMLElement|undefined|null,show:boolean,active=false){if(!node)return;if(!touched.has(node))touched.set(node,node.inert);node.classList.toggle('ux-tool-hidden',!show);node.classList.toggle('ux-tool-active',show&&active);node.inert=show?touched.get(node)!:true;}
 function restore(){for(const [node,inert]of touched){node.classList.remove('ux-tool-hidden','ux-tool-active');node.inert=inert;}touched.clear();}
 const node=(id:string)=>document.getElementById(id);
 const children=(parent:HTMLElement|null,ids:Set<HTMLElement>,active=false)=>{if(parent)for(const child of parent.children)visible(child as HTMLElement,ids.has(child as HTMLElement),active&&ids.has(child as HTMLElement));};
 function drawDirectory(){const matches=searchTools(search.value);list.replaceChildren();for(const group of ['terrain','network','source','display'] as const){const rows=matches.filter(tool=>tool.group===group);if(!rows.length)continue;const section=document.createElement('section'),title=document.createElement('h3'),grid=document.createElement('div');section.className='tool-group';title.textContent=t('tools.'+group);grid.className='tool-grid';for(const tool of rows){const button=document.createElement('button'),name=document.createElement('span');button.type='button';button.id='tool-'+tool.id;button.className='tool-button';name.className='tool-name';name.textContent=t(tool.title);button.append(name);button.onclick=()=>onSelect(tool.id);grid.append(button);}section.append(title,grid);list.append(section);}empty.className='control-note';empty.textContent=t('tools.noMatches');empty.hidden=matches.length!==0;searchText.textContent=t('tools.search');search.placeholder=t('tools.searchHint');search.setAttribute('aria-label',t('tools.search'));}
 search.oninput=drawDirectory;
 function refresh(){if(disposed||suspended)return;restore();host.hidden=selected!==null;unavailable.hidden=true;if(!selected)return;
  const id=selected,analysis=node('analysis-panel'),outerAnalysis=node('app-group-analysis'),spatial=node('spatial-analysis'),view=node('app-group-view'),layers=node('wm0-layer-controls'),map=node('app-group-map'),native=node('native-analysis');
  const keepAnalysis=new Set<HTMLElement>(),keepSpatial=new Set<HTMLElement>(),keepView=new Set<HTMLElement>();
  const want=(target:HTMLElement|null,set:Set<HTMLElement>)=>{if(target)set.add(target);return target;};
  let found=false;
  const choose=(targetId:string,set=keepAnalysis)=>{const target=want(node(targetId),set);if(target){found=true;if(target.tagName==='DETAILS'&&!opened.has(target)){(target as HTMLDetailsElement).open=true;opened.add(target);}}return target;};
  if(id==='encounterGeography')choose('encounter-geography');
  if(id==='regionalTerrain')choose('regional-terrain-statistics');
  if(id==='regionalConnectivity')choose('regional-connectivity');
  if(id==='slopeAspect')choose('spatial-surface',keepSpatial);
  if(['routing','reachability','routeProfile','serviceArea'].includes(id)){choose('analysis-routing');want(analysis?.querySelector<HTMLElement>('.analysis-endpoints')??null,keepAnalysis);}
  if(id==='serviceArea')choose('spatial-network',keepSpatial);
  if(id==='routeProfile')for(const targetId of ['spatial-profile','spatial-terrain','spatial-exposure'])choose(targetId,keepSpatial);
  if(id==='sourceQuery'||id==='sourceTransect')choose('wm0-source-queries');
  if(id==='topology')choose('wm0-topology');
  if(id==='measurement')choose('analysis-measurement');
  if(id==='comparison'){choose('analysis-compare');want(analysis?.querySelector<HTMLElement>('.analysis-endpoints')??null,keepAnalysis);}
  if(id==='distortion')choose('analysis-projection');
  if(id==='variants')choose('world-variants');
  if(keepSpatial.size&&spatial)keepAnalysis.add(spatial);
  children(analysis,keepAnalysis,true);children(spatial,keepSpatial,true);
  // The routing closure still finds every input under #analysis-panel. Only its
  // presentation changes; service-area reads these same mode/endpoint controls.
  const route=node('analysis-routing');if(route&&id==='serviceArea')for(const child of route.children){const el=child as HTMLElement;visible(el,['load-routing','routing-file','routing-status','analysis-location-status','route-mode'].includes(el.id)||el.tagName==='LABEL'&&el.getAttribute('for')==='route-mode');}
  if(route&&id==='reachability'){visible(node('find-route'),false);visible(node('go-route-target'),false);}
  const query=node('wm0-source-queries');if(query&&(id==='sourceQuery'||id==='sourceTransect')){const fields=query.querySelectorAll<HTMLElement>('fieldset');fields.forEach((field,index)=>visible(field,index===(id==='sourceQuery'?0:1)));}
  if(id==='projection'){const target=view?.querySelector<HTMLElement>('.projection-control');if(target){keepView.add(target);found=true;}want(node('projection-info'),keepView);want(node('share-controls'),keepView);const scale=node('scale-toggle')?.parentElement;if(scale)keepView.add(scale);}
  if(id==='layers'){const textures=view?.querySelector<HTMLElement>('.texture-controls');if(textures)keepView.add(textures);if(layers||node('native-layer-controls'))found=true;}
  children(view,keepView);visible(layers,id==='layers'||id==='staticEvents');visible(node('native-layer-controls'),id==='layers');visible(node('native-view-controls'),id==='projection');
  if(layers&&id==='staticEvents'){for(const child of layers.children)visible(child as HTMLElement,child.classList.contains('event-controls'));found=!layers.hidden&&!!layers.querySelector('.event-controls');}
  if(keepAnalysis.size&&(!analysis||analysis.hidden||![...keepAnalysis].some(target=>!target.hidden&&!target.classList.contains('analysis-endpoints'))))found=false;
  if(id==='projection'&&node('native-view-controls')&&!node('native-view-controls')!.hidden)found=true;
  if(map)for(const child of map.children)visible(child as HTMLElement,id==='maps');if(id==='maps'&&map?.children.length)found=true;
  visible(native,id==='nativeAnalysis'||id==='sourceQuery'||id==='sourceTransect'||id==='topology'||id==='measurement',true);
  if(native&&!native.hidden&&['nativeAnalysis','sourceQuery','sourceTransect','topology','measurement'].includes(id)){found=true;if(!opened.has(native)){(native as HTMLDetailsElement).open=true;opened.add(native);}}
  const nativeQueries=node('native-queries');if(native&&(id==='sourceQuery'||id==='sourceTransect')){for(const child of native.children)visible(child as HTMLElement,child===nativeQueries);if(nativeQueries)nativeQueries.querySelectorAll<HTMLElement>('fieldset').forEach((field,index)=>visible(field,index===(id==='sourceQuery'?0:1)));}else if(nativeQueries&&['topology','measurement'].includes(id))visible(nativeQueries,false);
  // Some long-lived owners intentionally mount beside #analysis-panel. Select
  // them here rather than moving them inside a new wrapper or leaving them on
  // every operation page.
  if(outerAnalysis)for(const child of outerAnalysis.children){const el=child as HTMLElement;if(el===analysis)continue;if(el===native)continue;visible(el,id==='variants'&&el.id==='world-variants'||['routing','routeProfile'].includes(id)&&el.id==='discovery-route',id==='variants'&&el.id==='world-variants');}
  const layerGroup=node('app-group-layers');if(layerGroup)for(const child of layerGroup.children){if(child===layers||child===node('native-layer-controls'))continue;visible(child as HTMLElement,id==='layers');}
  // Native query/diagnostic ownership remains unchanged and keeps its source and
  // current map. The full Native tool remains directly available in the directory.
  if(!found){unavailable.textContent=t('tools.unavailable');unavailable.hidden=false;}
 }
 function show(id:ToolId|null){const changed=selected!==id||suspended;selected=id;suspended=false;if(changed){opened=new WeakSet<HTMLElement>();drawDirectory();}refresh();}
 const stop=onLocaleChange(()=>{drawDirectory();refresh();});drawDirectory();
 return {show,refresh,selected:()=>selected,suspend(){if(suspended)return;suspended=true;restore();host.hidden=true;unavailable.hidden=true;},dispose(){if(disposed)return;disposed=true;stop();restore();search.oninput=null;host.replaceChildren();unavailable.remove();}};
}
