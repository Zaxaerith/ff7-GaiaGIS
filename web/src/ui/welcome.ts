// SPDX-License-Identifier: GPL-3.0-only
import {appStore,capabilities} from '../app/state';
import type {AppState,PanelId} from '../app/state';
import {workspaceConnection,onWorkspaceConnection} from '../app/workspaceUX';
import type {WorkspaceConnection} from '../app/workspaceUX';
import {ResourceScope} from '../app/resources';
import {menuIndex} from '../app/shellNavigation';
import {t,onLocaleChange,locale,locales,localeNames,setLocale} from '../i18n';
import {titleScene} from './titleScene';

export const RELEASES_URL='https://github.com/Zaxaerith/ff7-GaiaGIS/releases';
/** Neither a remembered introduction nor a remembered connection proves a map. */
export function welcomeState(state:Readonly<AppState>,connection:WorkspaceConnection,rendered:boolean,needsData:boolean){
 const connected=rendered&&capabilities(state).canInspectSurface;
 return {visible:needsData&&!connected,connected,busy:connection.loading||state.localWorkspace==='loading'&&connection.source!=='manual',source:connection.source,
  error:connection.issue?.key??(state.localWorkspace==='error'&&connection.source!=='manual'?'workspace.error':null)};
}
type Activate=(panel:PanelId)=>void;
export function startGuides(activate:Activate,doc:Document=document){
 activate('explore');const intro=doc.getElementById('gaia-intro') as HTMLDetailsElement|null;if(intro)intro.open=true;
 doc.getElementById('gaia-intro')?.scrollIntoView({block:'nearest'});doc.getElementById('quick-materia')?.focus();
}
export function startWorkspace(activate:Activate,doc:Document=document){
 activate('data');const manual=doc.getElementById('manual-loading') as HTMLDetailsElement|null;if(manual)manual.open=true;
 doc.getElementById('load-workspace-folder')?.scrollIntoView({block:'nearest'});doc.getElementById('load-workspace-folder')?.focus();
}
type Screen='menu'|'unlock'|'windows'|'settings';
/** Title owns presentation only. It never starts, resets or disposes a Viewer. */
export function mountWelcome(activate:Activate){
 const scope=new ResourceScope(),viewport=document.getElementById('viewport')!,host=document.createElement('section');host.id='gaia-welcome';host.className='welcome';host.setAttribute('aria-labelledby','welcome-title');
 const scene=document.createElement('div');scene.className='welcome-scene';scene.setAttribute('aria-hidden','true');scene.innerHTML=titleScene;host.append(scene);
 const content=document.createElement('div');content.className='welcome-content';host.append(content);
 const make=(tag:string,parent:HTMLElement,key:string)=>{const e=document.createElement(tag);e.dataset.startKey=key;e.textContent=t(key);parent.append(e);return e;};
 const brand=document.createElement('header');brand.className='welcome-brand';const heading=document.createElement('h1');heading.id='welcome-title';heading.textContent='GaiaGIS';brand.append(heading);make('p',brand,'start.tagline');content.append(brand);
 const nav=document.createElement('nav');nav.id='welcome-menu';content.append(nav);
 const panels=new Map<Screen,HTMLElement>([['menu',nav]]),menuButtons:HTMLButtonElement[]=[];
 let browsing=false,requested=false,screen:Screen='menu',connected=false,lastConnected=false,generation=appStore.state.data.generation;
 let returnFocus:HTMLElement|null=null;const history:{screen:Screen;focus:HTMLElement|null}[]=[];
 const button=(parent:HTMLElement,id:string,key:string,action:()=>void)=>{const b=make('button',parent,key) as HTMLButtonElement;b.id=id;b.type='button';b.onclick=action;return b;};
 function leave(){browsing=true;requested=false;history.length=0;screen='menu';refresh();}
 function show(next:Screen,from:HTMLElement){history.push({screen,focus:from});screen=next;refresh();panels.get(next)?.focus();}
 function back(){const previous=history.pop();screen=previous?.screen??'menu';refresh();(previous?.focus??menuButtons[0])?.focus();}
 function resume(){leave();returnFocus?.focus();}
 const explore=button(nav,'welcome-explore','start.explore',()=>{if(connected)resume();else show('unlock',explore);});menuButtons.push(explore);
 const guides=button(nav,'welcome-guides','start.gameGuides',()=>{leave();startGuides(activate);});menuButtons.push(guides);
 const workspace=button(nav,'welcome-workspace','start.loadWorkspace',()=>{leave();startWorkspace(activate);});menuButtons.push(workspace);
 const settings=button(nav,'welcome-settings','start.settings',()=>show('settings',settings));menuButtons.push(settings);
 for(const b of menuButtons){b.className='vii-choice';scope.listen(b,'focus',()=>{for(const item of menuButtons)item.dataset.selected=String(item===b);});}menuButtons[0].dataset.selected='true';
 const panel=(id:Screen,key:string)=>{const p=document.createElement('section');p.className='welcome-subview';p.id='welcome-'+id+'-panel';p.tabIndex=-1;make('h2',p,key);panels.set(id,p);content.append(p);return p;};
 const unlock=panel('unlock','start.unlock');make('p',unlock,'start.unlockHint');
 button(unlock,'welcome-unlock-guides','start.guides',()=>{leave();startGuides(activate);});
 button(unlock,'welcome-unlock-workspace','start.workspace',()=>{leave();startWorkspace(activate);});
 const original=button(unlock,'welcome-original','start.generateMap',()=>show('windows',original));
 const windows=panel('windows','start.generateMap');windows.id='welcome-original-help';
 const steps=document.createElement('ol');for(const key of ['download','extract','run','choose','generate'])make('li',steps,'start.'+key);windows.append(steps);
 const release=make('a',windows,'start.releases') as HTMLAnchorElement;release.href=RELEASES_URL;release.target='_blank';release.rel='noopener noreferrer';make('p',windows,'start.staticNote');make('p',windows,'start.support');make('p',windows,'start.privacy');
 const options=panel('settings','start.settings');
 const languageLabel=make('label',options,'nav.language');languageLabel.setAttribute('for','welcome-language');const language=document.createElement('select');language.id='welcome-language';for(let i=0;i<locales.length;i++){const option=document.createElement('option');option.value=locales[i];option.textContent=localeNames[i];language.append(option);}scope.listen(language,'change',()=>setLocale(language.value as ReturnType<typeof locale>));options.append(language);
 button(options,'welcome-interface','start.interface',()=>{leave();activate('view');document.getElementById('panel-content-title')?.focus();});
 button(options,'welcome-data-help','start.dataHelp',()=>{leave();startWorkspace(activate);const help=document.getElementById('workspace-help') as HTMLDetailsElement|null;if(help)help.open=true;});
 const advanced=document.createElement('details');advanced.id='welcome-advanced';make('summary',advanced,'start.advanced');make('p',advanced,'start.advancedHint');
 const actions=document.querySelector<HTMLElement>('.loading-actions'),parent=actions?.parentNode,next=actions?.nextSibling;if(actions)advanced.append(actions);options.append(advanced);
 if(actions)scope.listen(actions,'click',leave,{capture:true});
 for(const [id,p]of panels)if(id!=='menu')button(p,'welcome-back-'+id,'start.back',back);
 const status=document.createElement('p');status.id='welcome-status';status.setAttribute('role','status');content.append(status);
 const caption=make('p',host,'start.caption');caption.className='welcome-caption';document.body.append(host);
 const titleButton=document.createElement('button');titleButton.id='welcome-return';titleButton.type='button';titleButton.className='welcome-return';titleButton.onclick=()=>{returnFocus=document.activeElement as HTMLElement|null;requested=true;browsing=false;history.length=0;screen='menu';refresh();explore.focus();};document.body.append(titleButton);
 // Disable only existing background controls, leaving their state and owners intact.
 const inerted=new Map<HTMLElement,boolean>();
 function backgroundInert(on:boolean){if(on){for(const child of document.body.children){const node=child as HTMLElement;if(node===host||node===titleButton)continue;if(!inerted.has(node))inerted.set(node,node.inert);node.inert=true;}}else{for(const [node,value]of inerted)node.inert=value;inerted.clear();}}
 function refresh(){
  const loading=document.getElementById('loading'),state=welcomeState(appStore.state,workspaceConnection,document.getElementById('app')?.dataset.ready==='true',loading?.classList.contains('needs-data')??false);
  if(generation!==appStore.state.data.generation){generation=appStore.state.data.generation;browsing=false;requested=false;screen='menu';history.length=0;returnFocus=null;}
  connected=state.connected;if(connected&&!lastConnected){requested=false;browsing=true;screen='menu';history.length=0;}lastConnected=connected;
  const title=requested||state.visible&&!browsing;host.hidden=!title&&!state.visible;host.dataset.screen=title?screen:'ambient';host.dataset.source=state.source;content.hidden=!title;caption.hidden=!title;
  viewport.classList.toggle('welcome-active',state.visible);document.body.classList.toggle('title-open',title);backgroundInert(title);
  titleButton.hidden=title||!state.visible&&!connected;titleButton.textContent=t('start.return');workspace.disabled=state.busy;
  for(const [id,p]of panels)p.hidden=id!==screen;
  for(const node of host.querySelectorAll<HTMLElement>('[data-start-key]'))node.textContent=t(node.dataset.startKey!);
  nav.setAttribute('aria-label',t('start.title'));language.value=locale();explore.textContent=t(connected?'start.resume':'start.explore');
  status.textContent=state.error?t(state.error,{files:workspaceConnection.issue?.files??''}):loading?.classList.contains('error')?document.getElementById('loading-text')?.textContent??'':state.busy?t('shell.loading'):'';status.hidden=!status.textContent;
 }
 scope.listen(host,'keydown',((e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(screen!=='menu')back();else if(connected)resume();else explore.focus();return;}if(screen==='menu'){const index=menuIndex(e.key,Math.max(0,menuButtons.indexOf(document.activeElement as HTMLButtonElement)),menuButtons.length);if(index!==null){e.preventDefault();e.stopPropagation();menuButtons[index].focus();}}}) as EventListener);
 scope.listen(document,'gaiagis:view-status',refresh);scope.own(appStore.subscribe(refresh));scope.own(onWorkspaceConnection(refresh));scope.own(onLocaleChange(refresh));
 scope.own(()=>{backgroundInert(false);if(actions&&parent){if(next?.parentNode===parent)parent.insertBefore(actions,next);else parent.appendChild(actions);}host.remove();titleButton.remove();viewport.classList.remove('welcome-active');document.body.classList.remove('title-open');});refresh();
 return {dispose:()=>scope.dispose()};
}
