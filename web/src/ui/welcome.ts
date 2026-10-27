// SPDX-License-Identifier: GPL-3.0-only
import {appStore,capabilities} from '../app/state';
import type {AppState,PanelId} from '../app/state';
import {workspaceConnection,onWorkspaceConnection} from '../app/workspaceUX';
import type {WorkspaceConnection} from '../app/workspaceUX';
import {ResourceScope} from '../app/resources';
import {t,onLocaleChange} from '../i18n';

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
/** Session UI only. Reuses Shell actions and never owns a resource picker/loader. */
export function mountWelcome(activate:Activate){
 const scope=new ResourceScope(),viewport=document.getElementById('viewport')!,host=document.createElement('section');host.id='gaia-welcome';host.className='welcome';host.setAttribute('aria-labelledby','welcome-title');
 const card=document.createElement('div');card.className='welcome-card';const heading=document.createElement('h2'),intro=document.createElement('p'),choices=document.createElement('div'),status=document.createElement('p');heading.id='welcome-title';choices.className='welcome-choices';status.id='welcome-status';status.setAttribute('role','status');card.append(heading,intro,status,choices);
 const make=(tag:string,parent:HTMLElement,key:string)=>{const e=document.createElement(tag);e.dataset.startKey=key;e.textContent=t(key);parent.append(e);return e;};
 const action=(id:string,key:string,description:string,fn:()=>void)=>{const group=document.createElement('section');group.className='welcome-choice';const b=make('button',group,key) as HTMLButtonElement;b.type='button';b.id=id;b.onclick=fn;make('p',group,description);choices.append(group);return b;};
 let browsing=false;
 const guides=action('welcome-guides','start.guides','start.guidesHint',()=>{browsing=true;refresh();startGuides(activate);});
 const workspace=action('welcome-workspace','start.workspace','start.workspaceHint',()=>{browsing=true;refresh();startWorkspace(activate);});
 const original=action('welcome-original','start.original','start.originalHint',()=>{help.hidden=false;original.setAttribute('aria-expanded','true');help.focus();});original.setAttribute('aria-controls','welcome-original-help');original.setAttribute('aria-expanded','false');
 const help=document.createElement('section');help.id='welcome-original-help';help.className='welcome-original-help';help.tabIndex=-1;help.hidden=true;make('h3',help,'start.original');const steps=document.createElement('ol');for(const key of ['download','extract','run','choose','generate'])make('li',steps,'start.'+key);help.append(steps);const release=make('a',help,'start.releases') as HTMLAnchorElement;release.href=RELEASES_URL;release.target='_blank';release.rel='noopener noreferrer';make('p',help,'start.staticNote');make('p',help,'start.support');
 const back=make('button',help,'start.back') as HTMLButtonElement;back.type='button';back.onclick=()=>{help.hidden=true;original.setAttribute('aria-expanded','false');original.focus();};card.append(help);
 make('p',card,'start.privacy');const advanced=document.createElement('details');advanced.id='welcome-advanced';make('summary',advanced,'start.advanced');make('p',advanced,'start.advancedHint');
 const actions=document.querySelector<HTMLElement>('.loading-actions'),parent=actions?.parentNode,next=actions?.nextSibling;if(actions)advanced.append(actions);card.append(advanced);
 const returnButton=document.createElement('button');returnButton.id='welcome-return';returnButton.type='button';returnButton.className='welcome-return';returnButton.dataset.startKey='start.return';returnButton.onclick=()=>{document.getElementById('integrated-close')?.click();document.getElementById('collapse-inspector')?.click();browsing=false;refresh();guides.focus();};host.append(card,returnButton);viewport.append(host);
 function refresh(){
  const loading=document.getElementById('loading'),state=welcomeState(appStore.state,workspaceConnection,document.getElementById('app')?.dataset.ready==='true',loading?.classList.contains('needs-data')??false);
  host.hidden=!state.visible;viewport.classList.toggle('welcome-active',state.visible);card.hidden=browsing;returnButton.hidden=!browsing;workspace.disabled=state.busy;host.dataset.source=state.source;
  heading.textContent=t('start.title');intro.textContent=t('start.intro');
  for(const node of host.querySelectorAll<HTMLElement>('[data-start-key]'))node.textContent=t(node.dataset.startKey!);
  status.textContent=state.error?t(state.error,{files:workspaceConnection.issue?.files??''}):loading?.classList.contains('error')?document.getElementById('loading-text')?.textContent??'':state.busy?t('shell.loading'):'';status.hidden=!status.textContent;
 }
 scope.listen(host,'keydown',((e:KeyboardEvent)=>{if(e.key==='Escape'&&!help.hidden){e.preventDefault();e.stopPropagation();back.click();}}) as EventListener);
 scope.listen(document,'gaiagis:view-status',refresh);scope.own(appStore.subscribe(refresh));scope.own(onWorkspaceConnection(refresh));scope.own(onLocaleChange(refresh));
 scope.own(()=>{if(actions&&parent){if(next?.parentNode===parent)parent.insertBefore(actions,next);else parent.appendChild(actions);}host.remove();viewport.classList.remove('welcome-active');});refresh();
 return {dispose:()=>scope.dispose()};
}
