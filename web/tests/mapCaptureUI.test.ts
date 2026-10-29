// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,describe,expect,it,vi} from 'vitest';
import {mountWM0Source} from '../src/ui/wm0Source';
import {mountNativeQueries} from '../src/ui/nativeQueries';
import {analyzeNative} from '../src/analysis/native';
import {appStore} from '../src/app/state';
import type {GaiaViewer} from '../src/viewer/GaiaViewer';
import type {GaiaMeta} from '../src/data/mesh';
import type {NativeMap} from '../src/data/nativeMaps';
import type {NativeViewer} from '../src/viewer/NativeViewer';

const mocks=vi.hoisted(()=>({query:vi.fn(()=>({hits:[{face:0,kind:'surface',exactHeights:['4','4'],source:{section:1,mesh:2,triangle:3,wrapOffset:0,sourceSHA:'a'.repeat(64)}}],heightCount:1,status:'single',milliseconds:.1}))}));
vi.mock('../src/analysis/wm0Source',()=>({createWM0Source:()=>({summary:{faces:1,corners:3,zeroXZ:0,duplicateExcess:0,milliseconds:0}}),queryWM0:mocks.query}));
vi.mock('../src/ui/wm0Topology',()=>({mountWM0Topology:()=>({inspect(){},dispose(){}})}));
vi.mock('../src/ui/regionalTerrain',()=>({mountRegionalTerrain:()=>({dispose(){}})}));
vi.mock('../src/ui/regionalConnectivity',()=>({mountRegionalConnectivity:()=>({inspect(){},dispose(){}})}));

// Owner wiring only: no data reconstruction or browser layout claims.
class NodeStub extends EventTarget {
 children:NodeStub[]=[];parent:NodeStub|null=null;id='';className='';textContent='';title='';value='';hidden=false;disabled=false;open=false;dataset:Record<string,string>={};onclick:(()=>void)|null=null;
 private classes=new Set<string>();classList={contains:(key:string)=>this.classes.has(key),add:(key:string)=>this.classes.add(key),remove:(key:string)=>this.classes.delete(key)};
 constructor(readonly tag:string){super();}
 append(...nodes:NodeStub[]){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
 prepend(...nodes:NodeStub[]){for(const node of nodes.reverse()){node.remove();node.parent=this;this.children.unshift(node);}}
 replaceChildren(...nodes:NodeStub[]){for(const node of this.children)node.parent=null;this.children=[];this.append(...nodes);}
 remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
 all():NodeStub[]{return this.children.flatMap(node=>[node,...node.all()]);}
 querySelector(selector:string){return this.all().find(node=>selector.startsWith('#')?node.id===selector.slice(1):node.tag===selector)??null;}
 closest(selector:string):NodeStub|null{return selector==='#'+this.id?this:this.parent?.closest(selector)??null;}
 setAttribute(){}removeAttribute(){}focus(){}click(){if(!this.disabled)this.onclick?.();}
 get parentElement(){return this.parent;}
}
class DocStub extends EventTarget {
 body=new NodeStub('body');createElement=(tag:string)=>new NodeStub(tag);getElementById=(id:string)=>this.body.querySelector('#'+id);
}
let owner:ReturnType<typeof mountWM0Source>|undefined;
let nativeOwner:ReturnType<typeof mountNativeQueries>|undefined;
afterEach(()=>{owner?.dispose();owner=undefined;nativeOwner?.dispose();nativeOwner=undefined;vi.unstubAllGlobals();vi.clearAllMocks();appStore.dispatch({type:'map',id:'WM0'});appStore.dispatch({type:'reset-data'});});
function fixture(){
 const doc=new DocStub(),panel=doc.createElement('section'),viewport=doc.createElement('div'),canvas=doc.createElement('canvas');panel.id='analysis-panel';viewport.append(canvas);doc.body.append(panel,viewport);doc.body.classList.add('ux-rail');
 vi.stubGlobal('document',doc);vi.stubGlobal('innerWidth',390);
 const viewer={renderer:{domElement:canvas},setAutoRotate:vi.fn(),onSourcePositionPick:null as null|((p:number[])=>void)};
 owner=mountWM0Source(viewer as unknown as GaiaViewer,{} as GaiaMeta,()=>({}));
 return {doc,viewer,node:(id:string)=>doc.getElementById(id)!};
}
describe('map capture presentation lifecycle',()=>{
 it('opens the map for an explicit source pick and returns to that concrete tool after completion',()=>{
  const f=fixture(),capture=vi.fn(),open=vi.fn();f.doc.addEventListener('gaiagis:map-capture',e=>capture((e as CustomEvent).detail));f.doc.addEventListener('gaiagis:open-tool',e=>open((e as CustomEvent).detail));
  f.node('wm0-query-pick').click();expect(capture).toHaveBeenCalledExactlyOnceWith({toolId:'sourceQuery'});expect(f.viewer.onSourcePositionPick).toBeTypeOf('function');f.viewer.onSourcePositionPick!([12,34]);
  expect(f.node('wm0-query-x').value).toBe('12');expect(f.node('wm0-query-z').value).toBe('34');expect(f.viewer.onSourcePositionPick).toBeNull();expect(open).toHaveBeenCalledExactlyOnceWith({toolId:'sourceQuery'});expect(f.node('wm0-source-queries').dataset.hits).toBe('1');
 });
 it('pauses only pending capture, preserves the computed result and invalidates any stale callback',()=>{
  const f=fixture(),open=vi.fn();f.doc.addEventListener('gaiagis:open-tool',e=>open((e as CustomEvent).detail));f.node('wm0-query-run').click();f.node('wm0-query-pick').click();const stale=f.viewer.onSourcePositionPick!,event=new Event('gaiagis:ui-pause-capture',{cancelable:true});
  f.doc.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);expect(f.viewer.onSourcePositionPick).toBeNull();expect(f.node('wm0-source-queries').dataset.hits).toBe('1');expect(f.node('wm0-query-results').children).toHaveLength(1);
  stale([99,88]);expect(f.node('wm0-query-x').value).toBe('');expect(open).not.toHaveBeenCalled();expect(mocks.query).toHaveBeenCalledOnce();
 });
 it('returns a transect endpoint to the same transect tool without running or clearing prior query results',()=>{
  const f=fixture(),open=vi.fn();f.doc.addEventListener('gaiagis:open-tool',e=>open((e as CustomEvent).detail));f.node('wm0-query-run').click();f.node('wm0-transect-pick-a').click();f.viewer.onSourcePositionPick!([5,6]);expect(open).toHaveBeenCalledExactlyOnceWith({toolId:'sourceTransect'});expect(f.node('wm0-a-x').value).toBe('5');expect(f.node('wm0-a-z').value).toBe('6');expect(mocks.query).toHaveBeenCalledOnce();expect(f.node('wm0-source-queries').dataset.hits).toBe('1');
 });
 it('does not consume idle navigation and removes its capture listener on owner disposal',()=>{
  const f=fixture(),idle=new Event('gaiagis:ui-pause-capture',{cancelable:true});f.doc.dispatchEvent(idle);expect(idle.defaultPrevented).toBe(false);f.node('wm0-query-pick').click();owner!.dispose();owner=undefined;const event=new Event('gaiagis:ui-pause-capture',{cancelable:true});f.doc.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);expect(f.viewer.onSourcePositionPick).toBeNull();expect(f.doc.getElementById('wm0-source-queries')).toBeNull();
 });
});

function nativeFixture(){
 const doc=new DocStub(),panel=doc.createElement('section'),canvas=doc.createElement('canvas');doc.body.append(panel,canvas);doc.body.classList.add('ux-rail');vi.stubGlobal('document',doc);vi.stubGlobal('innerWidth',768);appStore.dispatch({type:'map',id:'WM2'});
 const map={positions:Float32Array.from([0,0,0,4,0,4,0,4,8]),sourceTriangleCount:1,attributes:()=>({section:0,mesh:0,triangle:0,terrain:1}),header:{mapId:'WM2',extent:[100,100],source_sha256:'a'.repeat(64)}} as unknown as NativeMap;
 const analysis=analyzeNative(map),viewer={map,renderer:{domElement:canvas},onPositionPick:null as null|((p:number[])=>void)},topdown=vi.fn();
 nativeOwner=mountNativeQueries(panel as unknown as HTMLElement,()=>viewer as unknown as NativeViewer,()=>analysis,vi.fn(),topdown);
 return {doc,viewer,topdown,node:(id:string)=>doc.getElementById(id)!};
}
describe('Native map capture uses the same presentation contract',()=>{
 it('returns an exact WM2 point to Source Query without switching the spatial owner or the map',()=>{
  const f=nativeFixture(),capture=vi.fn(),open=vi.fn();f.doc.addEventListener('gaiagis:map-capture',e=>capture((e as CustomEvent).detail));f.doc.addEventListener('gaiagis:open-tool',e=>open((e as CustomEvent).detail));f.node('native-query-pick').click();expect(capture).toHaveBeenCalledExactlyOnceWith({toolId:'sourceQuery'});expect(f.topdown).toHaveBeenCalledOnce();f.viewer.onPositionPick!([1,1]);expect(f.viewer.onPositionPick).toBeNull();expect(open).toHaveBeenCalledExactlyOnceWith({toolId:'sourceQuery'});expect(f.node('native-queries').dataset.hits).toBe('1');expect(f.node('native-query-results').children[0].textContent).toContain('raw Y 3');expect(appStore.state.map.id).toBe('WM2');expect(appStore.state.view.spatial).toBe('world');
 });
 it('pauses a Native transect pick, keeps existing results and rejects stale callbacks; changing source invalidates the result',()=>{
  const f=nativeFixture(),open=vi.fn();f.doc.addEventListener('gaiagis:open-tool',e=>open((e as CustomEvent).detail));f.node('native-query-x').value=f.node('native-query-z').value='1';f.node('native-query-run').click();f.node('native-transect-pick-a').click();const stale=f.viewer.onPositionPick!,event=new Event('gaiagis:ui-pause-capture',{cancelable:true});f.doc.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);expect(f.viewer.onPositionPick).toBeNull();expect(f.node('native-queries').dataset.hits).toBe('1');stale([2,2]);expect(open).not.toHaveBeenCalled();expect(f.node('native-a-x').value).toBe('');appStore.dispatch({type:'map',id:'WM3'});expect(f.node('native-queries').dataset.hits).toBeUndefined();expect(f.node('native-query-results').children).toHaveLength(0);
 });
});
