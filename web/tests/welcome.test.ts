// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi,afterEach} from 'vitest';
import {mountWelcome,welcomeState,startGuides,startWorkspace,RELEASES_URL} from '../src/ui/welcome';
import {appStore,initialState} from '../src/app/state';
import type {PanelId} from '../src/app/state';
import {updateWorkspaceConnection} from '../src/app/workspaceUX';
import {setLocale} from '../src/i18n';
const publicConnection={source:'public' as const,manifest:'absent' as const,loading:false};
let owner:ReturnType<typeof mountWelcome>|undefined;
afterEach(()=>{owner?.dispose();owner=undefined;vi.unstubAllGlobals();setLocale('en',false);appStore.dispatch({type:'reset-data'});appStore.dispatch({type:'local-workspace',phase:'none'});updateWorkspaceConnection({...publicConnection,issue:undefined});});

// Minimal EventTarget DOM for unit-level actions; no browser or layout automation.
class NodeStub extends EventTarget {
 children:NodeStub[]=[];parentNode:NodeStub|null=null;dataset:Record<string,string>={};attributes=new Map<string,string>();id='';hidden=false;open=false;disabled=false;tabIndex=0;type='';href='';target='';rel='';textContent='';onclick:(()=>void)|null=null;
 private classes=new Set<string>();constructor(readonly doc:DocStub,readonly tagName:string){super();}
 set className(value:string){this.classes=new Set(value.split(/\s+/).filter(Boolean));}get className(){return [...this.classes].join(' ');}
 classList={contains:(name:string)=>this.classes.has(name),add:(name:string)=>{this.classes.add(name);},remove:(name:string)=>{this.classes.delete(name);},toggle:(name:string,on?:boolean)=>{const next=on??!this.classes.has(name);if(next)this.classes.add(name);else this.classes.delete(name);return next;}};
 append(...nodes:NodeStub[]){for(const n of nodes){n.remove();n.parentNode=this;this.children.push(n);}}appendChild(n:NodeStub){this.append(n);return n;}
 insertBefore(n:NodeStub,next:NodeStub){n.remove();const at=this.children.indexOf(next);n.parentNode=this;this.children.splice(at<0?this.children.length:at,0,n);}
 get nextSibling():NodeStub|null{return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]??null;}
 remove(){if(this.parentNode){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}}
 setAttribute(k:string,v:string){this.attributes.set(k,v);}getAttribute(k:string){return this.attributes.get(k)??null;}
 all():NodeStub[]{return this.children.flatMap(n=>[n,...n.all()]);}querySelectorAll(selector:string){return this.all().filter(n=>selector==='[data-start-key]'&&n.dataset.startKey!==undefined);}
 focus(){this.doc.activeElement=this;}scrollIntoView=vi.fn();click(){if(!this.disabled){this.onclick?.();this.dispatchEvent(new Event('click'));}}
}
class DocStub extends EventTarget {
 body=new NodeStub(this,'body');activeElement:NodeStub|null=null;createElement=(tag:string)=>new NodeStub(this,tag);
 getElementById=(id:string)=>this.body.all().find(n=>n.id===id)??null;
 querySelector=(selector:string)=>selector==='.loading-actions'?this.body.all().find(n=>n.classList.contains('loading-actions'))??null:null;
}
function fixture(){const doc=new DocStub(),add=(id:string,parent:NodeStub=doc.body)=>{const n=doc.createElement('div');n.id=id;parent.append(n);return n;};const app=add('app');app.dataset.ready='false';const viewport=add('viewport',app),loading=add('loading',viewport);loading.className='loading needs-data';add('loading-text',loading).textContent='Original technical error';const actions=add('old-actions',loading);actions.className='loading-actions';add('open-local-data',actions);add('retry-viewer',actions);add('loading-help',actions);
 const intro=add('gaia-intro'),quick=add('quick-materia'),folder=add('load-workspace-folder'),manual=add('manual-loading'),close=add('integrated-close'),collapse=add('collapse-inspector');const picker=vi.fn();folder.onclick=picker;close.onclick=vi.fn();collapse.onclick=vi.fn();vi.stubGlobal('document',doc);const activate=vi.fn((panel:PanelId)=>appStore.dispatch({type:'panel',panel}));return {doc,app,viewport,loading,actions,intro,quick,folder,manual,close,collapse,picker,activate};}
describe('current-session start state',()=>{
 it('shows source-only welcome regardless of remembered connection/intro history',()=>{const s=initialState();s.localWorkspace='loaded';expect(welcomeState(s,{...publicConnection,source:'auto',manifest:'valid'},false,true).visible).toBe(true);});
 it.each(['manual','auto'] as const)('hides welcome only for actual rendered %s geometry',source=>{const s=initialState();s.data.assets.geometry={status:'loaded',bytes:1};const c={...publicConnection,source,manifest:'valid' as const};expect(welcomeState(s,c,true,true)).toMatchObject({visible:false,connected:true,source});expect(welcomeState(s,c,false,true).visible).toBe(true);});
 it('uses the existing loader during auto-start and degrades after failure/reset',()=>{const s=initialState();s.localWorkspace='loading';expect(welcomeState(s,{...publicConnection,source:'auto',loading:true},false,false)).toMatchObject({visible:false,busy:true});s.localWorkspace='error';expect(welcomeState(s,{...publicConnection,source:'auto'},false,true)).toMatchObject({visible:true,error:'workspace.error'});s.data.assets.geometry={status:'loaded',bytes:1};expect(welcomeState(s,{...publicConnection,issue:{key:'shell.invalidManifest',files:''}},true,true).visible).toBe(false);expect(welcomeState(initialState(),publicConnection,false,true).visible).toBe(true);});
});
describe('welcome actions in the existing Shell',()=>{
 it('opens Explore and the existing three-action Quick Start even when it was collapsed',()=>{const f=fixture();f.intro.open=false;owner=mountWelcome(f.activate);f.doc.getElementById('welcome-guides')!.click();expect(f.activate).toHaveBeenCalledWith('explore');expect(appStore.state.preferences.panel).toBe('explore');expect(f.intro.open).toBe(true);expect(f.doc.activeElement).toBe(f.quick);expect(f.picker).not.toHaveBeenCalled();expect(f.doc.getElementById('welcome-return')!.hidden).toBe(false);});
 it('uses the existing Data folder entry and never opens a second picker',()=>{const f=fixture();owner=mountWelcome(f.activate);f.doc.getElementById('welcome-workspace')!.click();expect(f.activate).toHaveBeenCalledWith('data');expect(f.manual.open).toBe(true);expect(f.doc.activeElement).toBe(f.folder);expect(f.picker).not.toHaveBeenCalled();expect(f.folder.scrollIntoView).toHaveBeenCalled();});
 it('opens inline Windows steps with the canonical Releases URL; Escape returns focus',()=>{const f=fixture();owner=mountWelcome(f.activate);const original=f.doc.getElementById('welcome-original')!,host=f.doc.getElementById('gaia-welcome')!;original.click();const help=f.doc.getElementById('welcome-original-help')!;expect(help.hidden).toBe(false);expect(f.doc.activeElement).toBe(help);expect(help.all().find(n=>n.tagName==='a')?.href).toBe(RELEASES_URL);expect(RELEASES_URL).toBe('https://github.com/Zaxaerith/ff7-GaiaGIS/releases');const key=new Event('keydown');Object.defineProperty(key,'key',{value:'Escape'});host.dispatchEvent(key);expect(help.hidden).toBe(true);expect(f.doc.activeElement).toBe(original);});
 it('returns from guides without leaving the narrow Shell over the start choices',()=>{const f=fixture();owner=mountWelcome(f.activate);f.doc.getElementById('welcome-guides')!.click();f.doc.getElementById('welcome-return')!.click();expect(f.close.onclick).toHaveBeenCalled();expect(f.collapse.onclick).toHaveBeenCalled();expect(f.doc.activeElement).toBe(f.doc.getElementById('welcome-guides'));});
 it('reacts to current geometry/errors and restores existing advanced actions on disposal',()=>{const f=fixture();owner=mountWelcome(f.activate);const host=f.doc.getElementById('gaia-welcome')!;expect(host.hidden).toBe(false);expect(f.actions.parentNode?.id).toBe('welcome-advanced');updateWorkspaceConnection({source:'manual',issue:{key:'shell.missingManifest',files:''}});expect(f.doc.getElementById('welcome-status')!.textContent).not.toBe('');appStore.dispatch({type:'asset',id:'geometry',asset:{status:'loaded',bytes:1}});f.app.dataset.ready='true';f.doc.dispatchEvent(new Event('gaiagis:view-status'));expect(host.hidden).toBe(true);expect(f.picker).not.toHaveBeenCalled();appStore.dispatch({type:'reset-data'});expect(host.hidden).toBe(false);owner.dispose();expect(f.actions.parentNode).toBe(f.loading);expect(f.doc.getElementById('gaia-welcome')).toBeNull();expect(f.viewport.classList.contains('welcome-active')).toBe(false);});
 it('focus helpers do not require or create private game resources',()=>{const f=fixture();startGuides(f.activate,f.doc as unknown as Document);startWorkspace(f.activate,f.doc as unknown as Document);expect(f.picker).not.toHaveBeenCalled();expect(f.doc.activeElement).toBe(f.folder);});
});
