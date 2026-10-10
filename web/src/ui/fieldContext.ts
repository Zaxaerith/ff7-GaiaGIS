// SPDX-License-Identifier: GPL-3.0-only
import {FieldIndex,parseFieldPack,validateFieldPoi,fieldEvidence,fieldAliases,openWalkmeshPack} from '../data/fieldContext';
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
 let meshes:Awaited<ReturnType<typeof openWalkmeshPack>>|null=null,walkView=false,walkScope:ResourceScope|null=null,walkTicket=0,meshTicket=0;
 const make=(tag:string,host:HTMLElement,text='')=>{const e=document.createElement(tag);e.textContent=text;host.append(e);return e;};
 const button=(host:HTMLElement,text:string,fn:()=>void)=>{const e=make('button',host,text) as HTMLButtonElement;e.onclick=fn;return e;};
 const emit=()=>{document.dispatchEvent(new CustomEvent('gaiagis:fields',{detail:index}));document.dispatchEvent(new Event('gaiagis:field-ready'));};
 function invalidate(){meshes=null;walkView=false;walkTicket++;meshTicket++;walkScope?.dispose();index=null;selected=null;sceneScope=[];if(filter==='context')filter='all';delete panel.dataset.parseMs;delete panel.dataset.walkParseMs;if(appStore.state.selection?.kind==='field')appStore.dispatch({type:'select',selection:null});refresh();emit();}
 function open(id:number){if(!index?.nodes.has(id)||appStore.state.explorer.phase!=='idle')return;selected=id;viewer?.clearSelection();viewer?.selectLocation(null);setNavigationSelection(null);appStore.dispatch({type:'select',selection:{kind:'field',id:String(id),mapId:appStore.state.map.id}});refresh();}
 scope.listen(document,'gaiagis:field-open',((e:CustomEvent<number>)=>open(e.detail)) as EventListener);
 function context(host:HTMLElement,locationId:string|null,names:string[]=[]){
  const section=make('details',host) as HTMLDetailsElement;section.className='field-place-context';make('summary',section,t('field.title'));make('p',section,t('field.nonGlobal'));
  if(!index){make('p',section,t('field.unavailable'));return;}
  const fields=names.length?[...index.nodes.values()].filter(n=>names.includes(n.name)):locationId?index.fieldsForPlace(locationId):[];
  if(!fields.length)make('p',section,t('field.unresolved'));
  for(const n of fields){const b=button(section,`${n.name} · ${n.id} · ${t('field.'+index.context(n.id).status)}`,()=>open(n.id));b.dataset.fieldId=String(n.id);}
  make('p',section,t('field.partial'));if(names.length&&fields.length)button(section,t('field.graph'),()=>{sceneScope=[...new Set(fields.flatMap(n=>[n.id,...index!.connected(n.id)]))];filter='context';showGraph();});if(locationId&&fields.length)button(section,t('field.graph'),()=>{filter=locationId;showGraph();});
 }
 scope.listen(document,'gaiagis:field-context',((e:CustomEvent<{host:HTMLElement;locationId:string|null;names:string[]}>)=>context(e.detail.host,e.detail.locationId,e.detail.names)) as EventListener);
 function inspect(){walkScope?.dispose();walkScope=null;walkTicket++;card.hidden=appStore.state.selection?.kind!=='field';card.replaceChildren();if(card.hidden||selected===null||!index)return;
  const n=index.nodes.get(selected)!;card.dataset.fieldId=String(n.id);make('h2',card,`${t('field.scene')} · ${n.name} / ${n.id}`);make('p',card,t('field.nonGlobal'));make('p',card,t('field.'+n.status));if(n.saveId===null)make('p',card,t('field.unverified'));
  const available=meshes?.scenes.get(n.id)?.status==='available';
  const view=button(card,t(walkView?'field.backGraph':'field.viewWalkmesh'),()=>{walkView=!walkView;inspect();if(!walkView){showGraph();}});view.id='field-view-walkmesh';view.dataset.uiSound=walkView?'cancel':'confirm';view.disabled=!available&&!walkView;
  if(walkView&&available){walkScope=new ResourceScope();const host=make('section',card);host.id='field-walkmesh';host.className='field-walkmesh';void walkmesh(host,n.id,walkTicket,walkScope);}else if(!available)make('p',card,t('field.walkUnavailable'));
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
 function showGraph(){panel.open=true;appStore.dispatch({type:'panel',panel:'explore'});if(!document.getElementById('integrated-panel')?.classList.contains('open'))document.getElementById('app-menu')?.click();else if(innerWidth<1100&&document.getElementById('integrated-inspector')?.classList.contains('open'))document.getElementById('collapse-inspector')?.click();refresh();}
 async function walkmesh(host:HTMLElement,id:number,request:number,owner:ResourceScope){
  make('p',host,t('field.walkLocal'));const status=make('p',host,t('workspace.loading'));const start=performance.now();
  try{
   const mesh=await meshes!.decode(id);if(owner.disposed||request!==walkTicket||selected!==id)return;
   host.dataset.decodeMs=String(performance.now()-start);host.dataset.fieldId=String(id);host.dataset.triangles=String(mesh.triangles);
   const s=mesh.stats;status.textContent=t('field.walkCounts',{triangles:mesh.triangles,blocked:s.blocked,accessible:s.accessible});make('p',host,t('field.walkAnomalies',{asymmetric:s.asymmetric,mismatch:s.edgeMismatch,self:s.selfLinks,degenerate:s.degenerate,flat:s.degenerateXY,padding:s.paddingVariants}));
   if(!mesh.triangles){make('p',host,t('field.walkEmpty'));return;}
   const controls=make('div',host);controls.className='user-actions';const canvas=make('canvas',host) as HTMLCanvasElement;canvas.id='field-walkmesh-canvas';canvas.width=1080;canvas.height=600;canvas.tabIndex=0;canvas.setAttribute('aria-label',t('field.walkmesh'));const ctx=canvas.getContext('2d')!;
   const label=make('label',controls,t('field.triangle')),input=make('input',label) as HTMLInputElement;input.id='field-triangle-id';input.type='number';input.min='0';input.max=String(mesh.triangles-1);input.value='0';
   const colorLabel=make('label',controls,t('field.zColor')),color=make('input',colorLabel) as HTMLInputElement;color.type='checkbox';color.id='field-z-color';
   const detail=make('div',host);detail.id='field-triangle-details';detail.className='field-triangle-details';const v=mesh.vertices,a=mesh.access;
   let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
   for(let i=0;i<v.length;i+=4){minX=Math.min(minX,v[i]);maxX=Math.max(maxX,v[i]);minY=Math.min(minY,v[i+1]);maxY=Math.max(maxY,v[i+1]);minZ=Math.min(minZ,v[i+2]);maxZ=Math.max(maxZ,v[i+2]);}
   const fit=Math.min(480/Math.max(1,maxX-minX),240/Math.max(1,maxY-minY)),midX=(minX+maxX)/2,midY=(minY+maxY)/2;let scale=fit,px=0,py=0,triangle=0,frame=0;
   const point=(i:number,k:number)=>[270+px+(v[i*12+k*4]-midX)*scale,150+py-(v[i*12+k*4+1]-midY)*scale];
   const draw=()=>{frame=0;if(owner.disposed)return;const began=performance.now();ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,540,300);const neighbors=new Set(a.subarray(triangle*3,triangle*3+3));
    for(let i=0;i<mesh.triangles;i++){const p=[point(i,0),point(i,1),point(i,2)];ctx.beginPath();ctx.moveTo(...p[0] as [number,number]);ctx.lineTo(...p[1] as [number,number]);ctx.lineTo(...p[2] as [number,number]);ctx.closePath();const z=(v[i*12+2]+v[i*12+6]+v[i*12+10])/3;ctx.fillStyle=i===triangle?'#ffd67a':neighbors.has(i)?'#72b8c9':color.checked?`hsl(${220-170*(z-minZ)/Math.max(1,maxZ-minZ)} 50% 38%)`:'#273a62';ctx.fill();
     for(let k=0;k<3;k++){ctx.beginPath();ctx.moveTo(...p[k] as [number,number]);ctx.lineTo(...p[(k+1)%3] as [number,number]);ctx.strokeStyle=a[i*3+k]===65535?'#ed8d9b':'#78bfae';ctx.lineWidth=i===triangle?2:0.7;ctx.stroke();}}
    host.dataset.renderMs=String(performance.now()-began);host.dataset.scale=String(scale);host.dataset.pan=px+','+py;
   };
   const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw);};owner.own(()=>{if(frame)cancelAnimationFrame(frame);});
   function select(value:number){if(!Number.isInteger(value)||value<0||value>=mesh.triangles)return;triangle=value;input.value=String(value);detail.replaceChildren();detail.dataset.triangleId=String(value);make('h4',detail,t('field.triangle')+' '+value);const raw=make('pre',detail);raw.textContent=[0,1,2].map(k=>'v'+k+' ['+Array.from(v.subarray(value*12+k*4,value*12+k*4+4)).join(', ')+']').join('\n');
    for(let k=0;k<3;k++){const n=a[value*3+k],line=make('p',detail,t('field.edge')+` ${k} (v${k} → v${(k+1)%3}): `);if(n===65535)line.append(t('field.blocked')+' · 0xFFFF');else{button(line,t('field.accessible')+' → '+n,()=>select(n));if(!a.subarray(n*3,n*3+3).includes(value))line.append(' · '+t('field.asymmetric'));if(n===value)line.append(' · '+t('field.selfLink'));const edgePoints=[0,1].map(j=>Array.from(v.subarray(value*12+((k+j)%3)*4,value*12+((k+j)%3)*4+3)).join(','));const shared=[0,1,2].some(j=>{const other=[0,1].map(h=>Array.from(v.subarray(n*12+((j+h)%3)*4,n*12+((j+h)%3)*4+3)).join(','));return edgePoints.every(p=>other.includes(p));});if(!shared)line.append(' · '+t('field.edgeMismatch'));}}
    schedule();
   }
   input.onchange=()=>select(Number(input.value));color.onchange=schedule;
   const zoomBy=(factor:number)=>{scale=Math.max(fit*.1,Math.min(fit*30,scale*factor));schedule();};button(controls,t('field.zoomIn'),()=>zoomBy(1.25)).id='field-walk-zoom-in';button(controls,t('field.zoomOut'),()=>zoomBy(.8));button(controls,t('field.reset'),()=>{scale=fit;px=py=0;schedule();}).id='field-walk-reset';
   let drag:{id:number;x:number;y:number;px:number;py:number;moved:boolean}|null=null;
   owner.listen(canvas,'pointerdown',((e:PointerEvent)=>{if(drag)return;canvas.focus();drag={id:e.pointerId,x:e.clientX,y:e.clientY,px,py,moved:false};canvas.setPointerCapture(e.pointerId);}) as EventListener);
   owner.listen(canvas,'pointermove',((e:PointerEvent)=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(drag.moved){const r=canvas.getBoundingClientRect();px=drag.px+dx*540/r.width;py=drag.py+dy*300/r.height;schedule();}}) as EventListener);
   owner.listen(canvas,'pointerup',((e:PointerEvent)=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(moved)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*540/r.width,y=(e.clientY-r.top)*300/r.height;
    for(let i=mesh.triangles-1;i>=0;i--){const p=[point(i,0),point(i,1),point(i,2)],cross=(u:number[],w:number[],x:number,y:number)=>(w[0]-u[0])*(y-u[1])-(w[1]-u[1])*(x-u[0]);const area=cross(p[0],p[1],p[2][0],p[2][1]);if(area===0)continue;const c=[cross(p[0],p[1],x,y),cross(p[1],p[2],x,y),cross(p[2],p[0],x,y)];if(c.every(n=>n>=0)||c.every(n=>n<=0)){select(i);break;}}
   }) as EventListener);owner.listen(canvas,'pointercancel',()=>{drag=null;});
   owner.listen(canvas,'wheel',((e:WheelEvent)=>{e.preventDefault();zoomBy(e.deltaY<0?1.1:1/1.1);}) as EventListener,{passive:false});
   owner.listen(canvas,'keydown',((e:KeyboardEvent)=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();select(triangle+(e.key==='ArrowRight'?1:-1));}else if(e.key==='+'||e.key==='=')zoomBy(1.25);else if(e.key==='-')zoomBy(.8);else if(e.key==='Home'){scale=fit;px=py=0;schedule();}}) as EventListener);
   make('p',host,t('field.walkLegend'));make('p',host,t('field.gatewayUnverified'));select(0);draw();
  }catch{if(!owner.disposed&&request===walkTicket){status.textContent=t('field.walkRejected');host.dataset.unavailable='true';}}
 }
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
  clearNavigation('fields');if(!index){make('p',panel,t('field.unavailable'));make('p',panel,t('field.walkUnavailable'));return;}
  registerNavigation('fields',[...index.nodes.values()].filter(n=>n.status==='available').map(n=>({id:'field:'+n.id,kind:'field',name:n.name,aliases:fieldAliases(n,index!.pack),mapId:'WM0',navigate:()=>open(n.id)})));
  make('p',panel,t('field.counts',{fields:index.pack.nodes.filter(n=>n.status==='available').length,edges:index.pack.edges.length+(index.pack.scriptEdges?.length??0)}));make('p',panel,t('field.partial'));
  const label=make('label',panel,t('field.filter')),select=make('select',panel) as HTMLSelectElement;select.id='field-parent-filter';label.setAttribute('for',select.id);const all=make('option',select,t('field.all')) as HTMLOptionElement;all.value='all';if(sceneScope.length){const o=make('option',select,t('field.selectedContext')) as HTMLOptionElement;o.value='context';}for(const p of poi?.locations??[]){const o=make('option',select,p.display_name) as HTMLOptionElement;o.value=p.id;}select.value=filter;select.onchange=()=>{filter=select.value;panX=panY=0;refresh();};
  if(panel.open)graph(panel);panel.dataset.openMs=String(performance.now()-start);
 }
 scope.listen(panel,'toggle',()=>{if(panel.open&&!panel.querySelector('svg'))refresh();});
 scope.own(workspaceLoader.register('field-context',async files=>{const request=++ticket,file=files[0],start=performance.now();invalidate();if(file.name!=='gaia-field-context.json'||file.size>4_000_000)throw Error('Field Context size/name');const pack=parseFieldPack(JSON.parse(await file.text()));if(!poi)throw Error('Field Context requires POI identity');validateFieldPoi(pack,poi);const next=new FieldIndex(pack);if(scope.disposed||request!==ticket)return;index=next;panel.dataset.parseMs=String(performance.now()-start);refresh();emit();}));
 scope.own(workspaceLoader.register('field-walkmesh',async files=>{const request=++meshTicket,start=performance.now();meshes=null;walkScope?.dispose();if(!index)throw Error('Walkmesh requires Field identity');const next=await openWalkmeshPack(files[0],index.pack);if(scope.disposed||request!==meshTicket)return;meshes=next;panel.dataset.walkParseMs=String(performance.now()-start);inspect();}));
 scope.listen(document,'gaiagis:poi',((e:CustomEvent<PoiDataset|null>)=>{ticket++;poi=e.detail;invalidate();}) as EventListener);
 let lastSelection='';scope.own(appStore.subscribe(()=>{panel.hidden=appStore.state.explorer.phase!=='idle';if(!['loading','loaded','legacy'].includes(appStore.state.data.assets['field-walkmesh']?.status??'')){meshes=null;walkScope?.dispose();}
  const key=JSON.stringify([appStore.state.selection,appStore.state.map.id,appStore.state.explorer.phase]);if(key===lastSelection)return;lastSelection=key;if(appStore.state.selection?.kind==='field')selected=Number(appStore.state.selection.id);inspect();}));scope.own(onLocaleChange(refresh));refresh();emit();
 return {dispose(){ticket++;walkTicket++;meshTicket++;walkScope?.dispose();meshes=null;graphScope?.dispose();clearNavigation('fields');index=null;emit();scope.dispose();}};
}
