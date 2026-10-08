// SPDX-License-Identifier: GPL-3.0-only
import {FieldIndex,parseFieldPack,validateFieldPoi,fieldEvidence,fieldAliases} from '../data/fieldContext';
import type {EvidenceStep} from '../data/fieldContext';
import type {PoiDataset} from '../data/poi';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import {appStore} from '../app/state';
import {workspaceLoader} from '../app/assets';
import {registerNavigation,clearNavigation,setNavigationSelection} from '../app/navigation';
import {ResourceScope} from '../app/resources';
import {t,onLocaleChange} from '../i18n';

/** Shared Inspector/Atlas presentation; no new panel or theme. */
export function renderSpatialEvidence(host:HTMLElement,steps:EvidenceStep[],sources?:Record<string,string>){
 const group=document.createElement('details');group.className='spatial-evidence';group.open=false;const title=document.createElement('summary');title.textContent=t('field.evidence');group.append(title);host.append(group);
 const list=document.createElement('ol');group.append(list);for(const step of steps){const row=document.createElement('li');row.dataset.relation=step.relation;row.textContent=`${t('evidence.'+step.relation)} · ${step.sourceType}: ${step.sourceIdentity} · ${t('atlas.'+step.precision)}`;list.append(row);if(step.reason){const p=document.createElement('p');p.textContent=t('field.'+step.reason);row.append(p);}}
 if(sources){const detail=document.createElement('details'),label=document.createElement('summary');label.textContent=t('atlas.sources')+' · SHA-256';detail.append(label);group.append(detail);const hashes=document.createElement('ul');detail.append(hashes);for(const [name,hash] of Object.entries(sources)){const row=document.createElement('li');row.textContent=name+' · '+hash;hashes.append(row);}}
}

/** One lifecycle owner for private topology, search, cards and the SVG browser. */
export function mountFieldContext(viewer?:GaiaViewer,getPoi?:()=>PoiDataset|null){
 const scope=new ResourceScope(),panel=document.createElement('details'),card=document.createElement('section');
 panel.id='field-context';card.id='field-inspector';card.className='app-card field-card';
 document.getElementById('app-group-explore')!.append(panel);document.getElementById('integrated-inspector')!.append(card);
 scope.own(()=>{panel.remove();card.remove();});let index:FieldIndex|null=null,poi=getPoi?.()??null,selected:number|null=null,ticket=0;
 const make=(tag:string,host:HTMLElement,text='')=>{const e=document.createElement(tag);e.textContent=text;host.append(e);return e;};
 const button=(host:HTMLElement,text:string,fn:()=>void)=>{const e=make('button',host,text) as HTMLButtonElement;e.onclick=fn;return e;};
 const emit=()=>{document.dispatchEvent(new CustomEvent('gaiagis:fields',{detail:index}));document.dispatchEvent(new Event('gaiagis:field-ready'));};
 function invalidate(){index=null;selected=null;sceneScope=[];if(filter==='context')filter='all';delete panel.dataset.parseMs;if(appStore.state.selection?.kind==='field')appStore.dispatch({type:'select',selection:null});refresh();emit();}
 function open(id:number){if(!index?.nodes.has(id)||appStore.state.explorer.phase!=='idle')return;selected=id;viewer?.clearSelection();viewer?.selectLocation(null);setNavigationSelection(null);appStore.dispatch({type:'select',selection:{kind:'field',id:String(id),mapId:appStore.state.map.id}});refresh();}
 scope.listen(document,'gaiagis:field-open',((e:CustomEvent<number>)=>open(e.detail)) as EventListener);
 function context(host:HTMLElement,locationId:string|null,names:string[]=[]){
  const section=make('details',host) as HTMLDetailsElement;section.className='field-place-context';make('summary',section,t('field.title'));make('p',section,t('field.nonGlobal'));
  if(!index){make('p',section,t('field.unavailable'));return;}
  const fields=names.length?[...index.nodes.values()].filter(n=>names.includes(n.name)):locationId?index.fieldsForPlace(locationId):[];
  if(!fields.length)make('p',section,t('field.unresolved'));
  for(const n of fields){const b=button(section,`${n.name} · ${n.id} · ${t('field.'+index.context(n.id).status)}`,()=>open(n.id));b.dataset.fieldId=String(n.id);}
  make('p',section,t('field.partial'));if(names.length&&fields.length)button(section,t('field.graph'),()=>{sceneScope=[...new Set(fields.flatMap(n=>[n.id,...index!.connected(n.id)]))];filter='context';panel.open=true;appStore.dispatch({type:'panel',panel:'explore'});document.getElementById('integrated-panel')?.classList.add('open');refresh();});if(locationId&&fields.length)button(section,t('field.graph'),()=>{filter=locationId;panel.open=true;appStore.dispatch({type:'panel',panel:'explore'});document.getElementById('integrated-panel')?.classList.add('open');refresh();});
 }
 scope.listen(document,'gaiagis:field-context',((e:CustomEvent<{host:HTMLElement;locationId:string|null;names:string[]}>)=>context(e.detail.host,e.detail.locationId,e.detail.names)) as EventListener);
 function inspect(){card.hidden=appStore.state.selection?.kind!=='field';card.replaceChildren();if(card.hidden||selected===null||!index)return;
  const n=index.nodes.get(selected)!;card.dataset.fieldId=String(n.id);make('h2',card,`${t('field.scene')} · ${n.name} / ${n.id}`);make('p',card,t('field.nonGlobal'));make('p',card,t('field.'+n.status));if(n.saveId===null)make('p',card,t('field.unverified'));
  const c=index.context(n.id);make('p',card,t('field.'+c.status));make('p',card,t('field.parentNote'));
  for(const id of c.parents){const place=poi?.locations.find(l=>l.id===id);const parent=button(card,t('field.openParent')+' · '+(place?.display_name??id),()=>document.dispatchEvent(new CustomEvent('gaiagis-inspect-location',{detail:id})));parent.disabled=appStore.state.map.id!=='WM0';}
  // A Field never supplies coordinates; these actions borrow a validated POI Entrance.
  if(viewer)for(const b of c.bindings){const entrance=poi?.entrances.find(e=>e.id===b.entranceId);if(entrance){const fly=button(card,t('field.flyEntrance')+' · '+entrance.field_name,()=>viewer.flyToLocation(entrance.longitude,entrance.latitude));fly.dataset.entranceId=entrance.id;fly.disabled=appStore.state.map.id!=='WM0';}}
  make('h3',card,t('field.connections'));for(const [key,edges]of [['outgoing',index.outgoing.get(n.id)!],['incoming',index.incoming.get(n.id)!]] as const){make('h4',card,t('field.'+key));for(const e of edges){const other=index.nodes.get(key==='outgoing'?e.to:e.fromField)!;const b=button(card,`${other.name} / ${other.id} · ${'gateway' in e?'gateway '+e.gateway:'MAPJUMP 0x60'} @ ${e.offset}`,()=>open(other.id));b.dataset.fieldId=String(other.id);}if(!edges.length)make('p',card,t('field.none'));}
  for(const e of index.pack.exits.filter(e=>e.fromField===n.id))make('p',card,`${t('field.worldExit')}: ${e.name} / ${e.to} · ${'gateway' in e?'gateway '+e.gateway:'MAPJUMP 0x60'} @ ${e.offset}`);
  for(const e of index.pack.unresolved.filter(e=>e.fromField===n.id))make('p',card,`${t('field.unresolved')}: ${e.to??'—'} · gateway ${e.gateway??'—'}`);
  renderSpatialEvidence(card,fieldEvidence(index,n.id),index.pack.sources);
  for(const e of index.pack.nativeRelations??[]){if(e.fieldId===n.id)make('p',card,`${t('evidence.known')}: ${e.map} → ${n.name} / ${e.map.toLowerCase()}.ev function ${e.function} @ ${e.offset} / ENTER_FIELD 0x318 → field.tbl[${(e.entry-1)*2+e.scenario}]`);}
  for(const e of index.pack.scriptExits??[]){if(e.fromField===n.id)make('p',card,`${t('field.worldExit')}: ${e.name} / MAPJUMP @ ${e.offset}`);}
  for(const e of index.pack.scriptUnresolved??[]){if(e.fromField===n.id)make('p',card,`${t('evidence.unresolved')}: ${t('field.'+e.reason)} @ ${e.offset??'—'}`);}
  make('h3',card,t('field.evidence'));make('p',card,`flevel.lgp / maplist [${n.id}] / ${n.name} · section 8`);for(const b of c.bindings){const e=poi?.entrances.find(e=>e.id===b.entranceId);if(e)make('p',card,`field.tbl [${e.field_table_record}] → ${e.field_id} · wm0.ev ${e.script_calls.map(c=>c.instruction_word_offset).join(', ')}`);}make('p',card,t('field.partial'));
 }
 let sceneScope:number[]=[];let filter='all',zoom=1,panX=0,panY=0;let graphScope:ResourceScope|null=null;
 function graph(host:HTMLElement){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),group=document.createElementNS(ns,'g');svg.id='field-graph';svg.setAttribute('viewBox','0 0 600 280');svg.setAttribute('role','group');svg.setAttribute('aria-label',t('field.graph'));const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker'),arrow=document.createElementNS(ns,'path');marker.id='field-arrow';marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','9');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','6');marker.setAttribute('markerHeight','6');marker.setAttribute('orient','auto-start-reverse');arrow.setAttribute('d','M 0 0 L 10 5 L 0 10 z');arrow.style.fill='var(--muted)';marker.append(arrow);defs.append(marker);svg.append(defs,group);host.append(svg);
  const nodes=(filter==='context'?sceneScope.map(id=>index!.nodes.get(id)!).filter(Boolean):filter==='all'?[...index!.nodes.values()]:index!.fieldsForPlace(filter)).filter(n=>n.status==='available'),positions=new Map(nodes.map((n,i)=>[n.id,[55+(i%5)*115,30+Math.floor(i/5)*65]]));
  const transform=()=>group.setAttribute('transform',`translate(${panX} ${panY}) scale(${zoom})`);
  const actions=make('div',host);actions.className='user-actions';button(actions,t('field.zoomIn'),()=>{zoom=Math.min(4,zoom*1.25);transform();});button(actions,t('field.zoomOut'),()=>{zoom=Math.max(.2,zoom/1.25);transform();});button(actions,t('field.reset'),()=>{zoom=1;panX=panY=0;transform();});
  const neighbors=selected===null?[]:index!.connected(selected);
  for(const edge of [...index!.pack.edges,...index!.pack.scriptEdges??[]]){const from=positions.get(edge.fromField),to=positions.get(edge.to);if(!from||!to)continue;const path=document.createElementNS(ns,'path');const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length,inset=Math.min(Math.abs(52/ux),Math.abs(21/uy));path.setAttribute('d',length?`M ${from[0]+ux*inset} ${from[1]+uy*inset} L ${to[0]-ux*inset} ${to[1]-uy*inset}`:`M ${from[0]-20} ${from[1]-18} C ${from[0]-75} ${from[1]-75} ${from[0]+75} ${from[1]-75} ${from[0]+20} ${from[1]-18}`);path.setAttribute('marker-end','url(#field-arrow)');path.classList.add('field-edge');if(edge.fromField===selected||edge.to===selected)path.classList.add('neighbor');group.append(path);}
  for(const n of nodes){const [x,y]=positions.get(n.id)!,g=document.createElementNS(ns,'g'),rect=document.createElementNS(ns,'rect'),text=document.createElementNS(ns,'text');g.setAttribute('transform',`translate(${x} ${y})`);g.dataset.fieldId=String(n.id);g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-label',`${n.name} / ${n.id}`);g.setAttribute('aria-pressed',String(selected===n.id));g.classList.add('field-node');if(neighbors.includes(n.id))g.classList.add('neighbor');rect.setAttribute('x','-50');rect.setAttribute('y','-18');rect.setAttribute('width','100');rect.setAttribute('height','38');text.setAttribute('text-anchor','middle');text.textContent=n.name;g.append(rect,text);group.append(g);g.onclick=()=>open(n.id);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(n.id);}};}
  // Only user input changes topology viewport; no rendering loop or graph simulation.
  let drag:{id:number;x:number;y:number;panX:number;panY:number}|null=null;
  graphScope!.listen(svg,'pointerdown',((e:PointerEvent)=>{if((e.target as Element).closest('.field-node'))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,panX,panY};svg.setPointerCapture(e.pointerId);}) as EventListener);
  graphScope!.listen(svg,'pointermove',((e:PointerEvent)=>{if(!drag||drag.id!==e.pointerId)return;const r=svg.getBoundingClientRect();panX=drag.panX+(e.clientX-drag.x)*600/r.width;panY=drag.panY+(e.clientY-drag.y)*280/r.height;transform();}) as EventListener);
  const release=()=>{drag=null;};graphScope!.listen(svg,'pointerup',release);graphScope!.listen(svg,'pointercancel',release);
  graphScope!.listen(svg,'wheel',((e:WheelEvent)=>{e.preventDefault();zoom=Math.max(.2,Math.min(4,zoom*(e.deltaY<0?1.1:1/1.1)));transform();}) as EventListener,{passive:false});transform();
 }
 function refresh(){const start=performance.now();graphScope?.dispose();graphScope=new ResourceScope();panel.replaceChildren();make('summary',panel,t('field.title'));make('p',panel,t('field.nonGlobal'));inspect();
  clearNavigation('fields');if(!index){make('p',panel,t('field.unavailable'));return;}
  registerNavigation('fields',[...index.nodes.values()].filter(n=>n.status==='available').map(n=>({id:'field:'+n.id,kind:'field',name:n.name,aliases:fieldAliases(n,index!.pack),mapId:'WM0',navigate:()=>open(n.id)})));
  make('p',panel,t('field.counts',{fields:index.pack.nodes.filter(n=>n.status==='available').length,edges:index.pack.edges.length+(index.pack.scriptEdges?.length??0)}));make('p',panel,t('field.partial'));
  const label=make('label',panel,t('field.filter')),select=make('select',panel) as HTMLSelectElement;select.id='field-parent-filter';label.setAttribute('for',select.id);const all=make('option',select,t('field.all')) as HTMLOptionElement;all.value='all';if(sceneScope.length){const o=make('option',select,t('field.selectedContext')) as HTMLOptionElement;o.value='context';}for(const p of poi?.locations??[]){const o=make('option',select,p.display_name) as HTMLOptionElement;o.value=p.id;}select.value=filter;select.onchange=()=>{filter=select.value;panX=panY=0;refresh();};
  if(panel.open)graph(panel);panel.dataset.openMs=String(performance.now()-start);
 }
 scope.listen(panel,'toggle',()=>{if(panel.open&&!panel.querySelector('svg'))refresh();});
 scope.own(workspaceLoader.register('field-context',async files=>{const request=++ticket,file=files[0],start=performance.now();invalidate();if(file.name!=='gaia-field-context.json'||file.size>4_000_000)throw Error('Field Context size/name');const pack=parseFieldPack(JSON.parse(await file.text()));if(!poi)throw Error('Field Context requires POI identity');validateFieldPoi(pack,poi);const next=new FieldIndex(pack);if(scope.disposed||request!==ticket)return;index=next;panel.dataset.parseMs=String(performance.now()-start);refresh();emit();}));
 scope.listen(document,'gaiagis:poi',((e:CustomEvent<PoiDataset|null>)=>{ticket++;poi=e.detail;invalidate();}) as EventListener);
 scope.own(appStore.subscribe(()=>{panel.hidden=appStore.state.explorer.phase!=='idle';if(appStore.state.selection?.kind!=='field'){card.hidden=true;return;}const id=Number(appStore.state.selection.id);if(selected!==id)selected=id;inspect();}));scope.own(onLocaleChange(refresh));refresh();emit();
 return {dispose(){ticket++;graphScope?.dispose();clearNavigation('fields');index=null;emit();scope.dispose();}};
}
