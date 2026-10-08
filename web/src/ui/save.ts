import {currentSaveField} from '../data/fieldContext';
import type {FieldIndex} from '../data/fieldContext';
// SPDX-License-Identifier: GPL-3.0-only
import '../styles/save.css';
import {Vector3} from 'three';
import {appStore} from '../app/state';
import {saveSession} from '../app/saveSession';
import {ResourceScope} from '../app/resources';
import {SaveError} from '../data/save';
import {saveSurfacePoint} from '../data/saveSpatial';
import {sharedSurface} from '../explorer/sharedSurface';
import type {ExplorerController} from '../explorer/controller';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import type {MapId} from '../data/nativeMaps';
import {projections} from '../projections';
import {t,onLocaleChange,locale} from '../i18n';

export function mountSave(getViewer:()=>GaiaViewer|undefined,switchMap:(id:MapId)=>Promise<void>,getExplorer:()=>Promise<ExplorerController>){
 const scope=new ResourceScope(),panel=document.createElement('details'),title=document.createElement('summary'),card=document.createElement('section'),context=document.createElement('section'),marker=document.createElement('button');
 panel.id='my-save';panel.append(title);card.id='save-inspector';card.className='panel save-card';context.id='save-context';context.className='analysis-result';marker.id='save-player-marker';marker.className='save-player-marker';marker.hidden=true;
 document.getElementById('app-group-data')!.append(panel);document.getElementById('integrated-inspector')!.append(card);document.getElementById('app-group-explore')!.append(context);
 const host=getViewer()?.renderer.domElement.parentElement;host?.append(marker);scope.own(()=>{panel.remove();card.remove();context.remove();marker.remove();});
 const make=(tag:string,parent:HTMLElement,text='')=>{const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;};
 const button=(parent:HTMLElement,key:string,id:string,fn:()=>void)=>{const b=make('button',parent,t('save27.'+key)) as HTMLButtonElement;b.id=id;b.onclick=fn;return b;};
 const input=document.createElement('input');input.id='save-file';input.type='file';input.accept='.ff7';input.hidden=true;panel.append(input);
 const help=make('p',panel),actions=make('div',panel),status=make('p',panel),slots=make('div',panel);actions.className='user-actions';status.id='save-status';status.setAttribute('role','status');slots.id='save-slots';let error:string|null=null,importTicket=0,actionTicket=0;let fields:FieldIndex|null=null;
 const load=button(actions,'import','save-import',()=>input.click()),clear=button(actions,'clear','save-clear',()=>saveSession.clear());
 input.onchange=async()=>{const file=input.files?.[0],ticket=++importTicket;if(!file)return;try{await saveSession.import(file);if(ticket!==importTicket||scope.disposed)return;error=null;panel.open=true;show();}catch(e){if(ticket===importTicket&&!scope.disposed){error=t(e instanceof SaveError?'save27.'+e.code:'save27.error');refresh();}}finally{input.value='';}};
 const valid=()=>saveSession.slot?.status==='valid'?saveSession.slot:null;
 const binding=()=>valid()?.binding;
 function show(){if(!saveSession.slot)return;appStore.dispatch({type:'select',selection:{kind:'save',id:'session-slot-'+saveSession.slot.index,mapId:appStore.state.map.id}});refresh();}
 const rows=(parent:HTMLElement,values:[string,string][])=>{const dl=make('dl',parent);dl.className='property-list';for(const [key,value]of values){const row=make('div',dl);make('dt',row,t('save27.'+key));make('dd',row,value);}};
 function fill(parent:HTMLElement,compact=false){const s=valid();if(!s)return;const field=currentSaveField(s,fields);if(s.module===1){const current=make('p',parent,t('field.current')+': '+(field?`${field.name} / ${field.id}`:t('field.unverified')+` (${s.location})`));current.className='save-current-field';if(field){const open=make('button',parent,t('field.open')) as HTMLButtonElement;open.className='save-open-field';open.onclick=()=>document.dispatchEvent(new CustomEvent('gaiagis:field-open',{detail:field.id}));}}
 rows(parent,[['location',`${s.location} / ${s.module}`],['time',`${Math.floor(s.seconds/3600)}:${String(Math.floor(s.seconds/60)%60).padStart(2,'0')}:${String(s.seconds%60).padStart(2,'0')}`],['progress',`${s.progress} / ${s.disc??t('save27.unknown')}`],['visible',`0x${s.vehiclesVisible.toString(16)} / 0x${s.chocobosVisible.toString(16)}`]]);make('p',parent,t('save27.story'));if(compact)return;
 rows(parent,[['preview',s.locationPreview??t('save27.unknown')],['map',`${s.worldMap} / ${s.currentModel}`],['acquired',t('save27.unknown')],['chocobo',t('save27.unknown')]]);const gil=make('p',parent);gil.textContent=`Gil: ${s.gil.toLocaleString()}`;
 make('h3',parent,t('save27.party'));for(const member of s.party)make('p',parent,`${member.character?t('party.'+member.character):t('save27.unknown')} · ${t('save27.level')} ${member.level??'—'} · HP ${member.hp}/${member.maxHp} · MP ${member.mp}/${member.maxMp}`);
 make('h3',parent,t('save27.position'));make('p',parent,t(s.binding?'save27.bound':'save27.rawOnly'));make('p',parent,t('save27.raw'));const raw=make('pre',parent);raw.textContent=s.world.map(w=>`${w.record}: ${w.x} / ${w.z} / ${w.height} / ${w.model}`).join('\n');
 const a=make('div',parent);a.className='user-actions';const fly=button(a,'fly','save-fly',()=>void atPlayer('fly')),explore=button(a,'explore','save-explore',()=>void atPlayer('explore')),route=button(a,'route','save-route',()=>void atPlayer('route'));for(const b of [fly,explore,route])b.disabled=!s.binding||!getViewer()||appStore.state.explorer.phase!=='idle';make('p',parent,t('save27.previewState'));
 }
 async function atPlayer(kind:'fly'|'explore'|'route'){
  const slot=valid(),point=slot?.binding,viewer=getViewer(),ticket=++actionTicket;if(!point||!viewer)return;
  try{await switchMap('WM0');if(scope.disposed||ticket!==actionTicket||valid()!==slot)return;viewer.cancelMotion();
   if(kind==='fly'){viewer.flyToLocation(point.geographic[0],point.geographic[1]);show();return;}
   const surface=await sharedSurface(viewer.mesh,viewer.meta),hit=saveSurfacePoint(surface,point);if(!hit||scope.disposed||ticket!==actionTicket||valid()!==slot)throw Error('no surface');
   if(kind==='route'){document.dispatchEvent(new CustomEvent('gaiagis:save-route',{detail:{node:hit.triangle,geographic:point.geographic}}));appStore.dispatch({type:'panel',panel:'analysis'});return;}
   const explorer=await getExplorer();if(scope.disposed||ticket!==actionTicket||valid()!==slot)return;
   const leader=slot!.party[0]?.character;if(!leader||![0,1,2,3,5,6].includes(slot!.currentModel))throw Error('unknown preview');
   const visual=slot!.currentModel===3?'highwind':slot!.currentModel===5?'tiny-bronco':slot!.currentModel===6?'buggy':leader;
   if(!explorer.selectVisual(visual))throw Error('visual unavailable');await explorer.arm();if(scope.disposed||ticket!==actionTicket||valid()!==slot){explorer.exit(false);return;}
   if(!explorer.place(hit.triangle,hit.b)){explorer.exit(false);throw Error('ineligible');}
   appStore.dispatch({type:'panel',panel:'explore'});if(innerWidth>700){const controls=document.getElementById('explorer-panel') as HTMLDetailsElement|null;if(controls)controls.open=true;}
  }catch{if(!scope.disposed){error=t('save27.noSurface');refresh();}}
 }
 let lastRefresh:unknown[]=[];
 function refresh(){const stamp=[locale(),appStore.state.selection?.kind,appStore.state.map.id,appStore.state.explorer.phase,saveSession.slot,saveSession.slots,fields,error,!!getViewer()];if(stamp.every((v,i)=>v===lastRefresh[i]))return;lastRefresh=stamp;title.textContent=t('save27.title');help.textContent=t('save27.help');help.className='control-note';load.textContent=t('save27.import');clear.textContent=t('save27.clear');clear.disabled=saveSession.slots.length===0;input.setAttribute('aria-label',t('save27.import'));status.textContent=error??(saveSession.slots.length?'':t('save27.emptyState'));slots.replaceChildren();
  for(const s of saveSession.slots){const b=make('button',slots,`${t('save27.slot',{number:s.index})} · ${t('save27.'+s.status)}`) as HTMLButtonElement;b.dataset.slot=String(s.index);b.setAttribute('aria-pressed',String(s===saveSession.slot));b.onclick=()=>{error=null;saveSession.select(s.index-1);show();};}
  card.hidden=appStore.state.selection?.kind!=='save';card.replaceChildren();if(!card.hidden){make('h2',card,t('save27.title'));make('p',card,t('save27.'+(saveSession.slot?.status??'empty')));fill(card);}
  context.hidden=!valid();context.replaceChildren();if(!context.hidden){make('h3',context,t('save27.context'));fill(context,true);button(context,'title','save-show',show);}
  marker.textContent=t('save27.position');marker.setAttribute('aria-label',t('save27.position'));
 }
 function atlasContext(){const atlas=document.getElementById('atlas-card');if(!atlas||!valid()||atlas.querySelector('.save-atlas-context'))return;const e=document.createElement('section');e.className='save-atlas-context';make('h3',e,t('save27.context'));fill(e,true);atlas.append(e);}
 const observer=new MutationObserver(atlasContext);observer.observe(document.getElementById('integrated-inspector')!,{childList:true,subtree:true});scope.own(()=>observer.disconnect());
 scope.listen(document,'gaiagis:fields',((e:CustomEvent<FieldIndex|null>)=>{fields=e.detail;document.querySelector('.save-atlas-context')?.remove();refresh();atlasContext();}) as EventListener);
 scope.own(saveSession.subscribe(()=>{actionTicket++;error=null;document.querySelector('.save-atlas-context')?.remove();if(!saveSession.slot&&appStore.state.selection?.kind==='save')appStore.dispatch({type:'select',selection:null});refresh();atlasContext();}));scope.own(appStore.subscribe(refresh));scope.own(onLocaleChange(()=>{document.querySelector('.save-atlas-context')?.remove();refresh();atlasContext();}));marker.onclick=show;
 const p=new Vector3();let frame=0;function update(){if(scope.disposed)return;frame=requestAnimationFrame(update);const v=getViewer(),b=binding();marker.hidden=true;if(!v||!b||appStore.state.map.id!=='WM0'||appStore.state.explorer.phase!=='idle'||v.isMorphing)return;const projection=projections[v.projectionId],c=v.context,camera=v.overviewBridge.camera,[lon,lat]=b.geographic;if(projection.visibility(lon,lat,c)<=.02)return;p.set(...projection.project(lon,lat,1500,c));if(v.projectionId==='globe'&&p.dot(camera.position)-p.lengthSq()<.005)return;p.project(camera);const w=v.renderer.domElement.clientWidth,h=v.renderer.domElement.clientHeight,x=(p.x+1)*w/2,y=(1-p.y)*h/2;if(p.z< -1||p.z>1||x<16||x>w-16||y<16||y>h-16)return;marker.hidden=false;marker.style.left=`${x}px`;marker.style.top=`${y}px`;}
 update();scope.own(()=>{actionTicket++;importTicket++;cancelAnimationFrame(frame);});refresh();return {dispose:()=>scope.dispose()};
}
