// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,describe,expect,it,vi} from 'vitest';
import {mountRegionalConnectivity,componentRows,adjacencyRows} from '../src/ui/regionalConnectivity';
import {createWM0Topology} from '../src/analysis/wm0Topology';
import {nativeTriangle} from '../src/analysis/native';
import type {NativePoint} from '../src/analysis/native';
import type {WM0Source} from '../src/analysis/wm0Source';
import type {GaiaMeta} from '../src/data/mesh';
import type {GaiaViewer} from '../src/viewer/GaiaViewer';
import type {PoiDataset} from '../src/data/poi';
import {appStore} from '../src/app/state';
import {dictionaries,locales,setLocale} from '../src/i18n';
import {regionalConnectivityCatalog} from '../src/i18n/regionalConnectivityCatalog';

// Wiring/lifecycle only. The bounded browser check separately measures real layout.
class NodeStub extends EventTarget {
 children:NodeStub[]=[];parent:NodeStub|null=null;id='';className='';textContent='';value='';hidden=false;disabled=false;open=false;checked=false;dataset:Record<string,string>={};onclick:(()=>unknown)|null=null;onchange:(()=>unknown)|null=null;
 constructor(readonly tag:string){super();}
 append(...nodes:NodeStub[]){for(const n of nodes){n.remove();n.parent=this;this.children.push(n);}}
 prepend(...nodes:NodeStub[]){for(const n of nodes.reverse()){n.remove();n.parent=this;this.children.unshift(n);}}
 replaceChildren(...nodes:NodeStub[]){this.children.forEach(n=>n.parent=null);this.children=[];this.append(...nodes);}
 remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
 all():NodeStub[]{return this.children.flatMap(n=>[n,...n.all()]);}
 get isConnected():boolean{return this.tag==='body'||!!this.parent?.isConnected;}
 get options(){return this.children.filter(n=>n.tag==='option');}
 get childNodes(){return this.children;}
 querySelector(selector:string){return this.all().find(n=>selector.startsWith('#')?n.id===selector.slice(1):n.tag===selector)??null;}
 setAttribute(){}removeAttribute(){}scrollIntoView(){}click(){if(!this.disabled)return this.onclick?.();}change(value:string){this.value=value;this.onchange?.();}
}
class DocStub extends EventTarget {
 body=new NodeStub('body');documentElement={lang:'en'};createElement=(tag:string)=>new NodeStub(tag);getElementById=(id:string)=>this.body.querySelector('#'+id);
}
let owner:ReturnType<typeof mountRegionalConnectivity>|undefined;
afterEach(()=>{owner?.dispose();owner=undefined;setLocale('en',false);vi.unstubAllGlobals();vi.restoreAllMocks();appStore.dispatch({type:'reset-data'});});
function fixture(withPoi=false){
 const doc=new DocStub(),panel=doc.createElement('section'),analysisTab=doc.createElement('button');panel.id='analysis-panel';analysisTab.id='app-tab-analysis';analysisTab.onclick=vi.fn();doc.body.append(panel,analysisTab);
 vi.stubGlobal('document',doc);vi.stubGlobal('Element',class {});vi.stubGlobal('Node',{TEXT_NODE:3});vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',clearTimeout);
 const points:NativePoint[][]=[];for(let x=0;x<32;x++)points.push([[x,0,0],[x+1,0,0],[x,1,0]],[[x+1,0,0],[x+1,1,0],[x,1,0]]);
 const metrics=points.map(p=>({...nativeTriangle(p),bounds:[0,32,0,1],duplicateCount:1})),sha='a'.repeat(64);
 const source:WM0Source={count:64,sourceSHA:sha,corners:i=>points[i],metrics:i=>metrics[i],source:i=>({sourceFace:i,sourceSHA:sha,mapId:'WM0',wrapOffset:0,origin:0,map:0,region:17,terrain:3,script:5,texture:0,chocobo:false,section:0,mesh:0,triangle:i,capTriangle:null}),summary:{faces:64,corners:192,zeroXZ:0,degenerate3D:0,duplicateExcess:0,milliseconds:0}};
 const getSource=vi.fn(()=>source),topology=createWM0Topology(source),getTopology=vi.fn(()=>topology),viewer={setRegionalComponent:vi.fn(),setRegionalBoundaries:vi.fn(),flyToLocation:vi.fn()},select=vi.fn();let usable=true;
 const poi={sources:{'wm0.map':sha},entrances:[{id:'entry',location_id:'place',world_map:0,source_kind:'derived_from_entry_trigger',source_script:2,region_id:17,section_id:0,mesh_id:0,triangle_id:0,trigger_triangle_ids:Array.from({length:64},(_,i)=>i),field_name:'scene'}],locations:[{id:'place',entrance_ids:['entry']}]} as unknown as PoiDataset;
 owner=mountRegionalConnectivity(viewer as unknown as GaiaViewer,{region_names:{17:'Sea'}} as unknown as GaiaMeta,getSource,getTopology,()=>withPoi?{poi}:{},()=>usable,select);
 const node=(id:string)=>doc.getElementById('connectivity-'+id)!;
 async function compute(){node('compute').click();await vi.waitFor(()=>expect(doc.getElementById('regional-connectivity')!.dataset.faces).toBe('64'));}
 return {doc,node,viewer,getSource,getTopology,source,select,compute,analysisTab,disable(){usable=false;appStore.dispatch({type:'view',view:{spatial:'field-walkmesh'}});}};
}
describe('regional connectivity UI over existing owners',()=>{
 it('offers every verified trigger source face, not just its representative',async()=>{const f=fixture(true);await f.compute();f.node('view').change('places');f.node('context-results').children[0].click();const button=f.doc.body.all().find(n=>n.tag==='button'&&n.textContent===dictionaries.en['connectivity.triggerScope'])!;button.click();expect(f.node('faces-results').children).toHaveLength(50);f.node('faces-next').click();expect(f.node('faces-results').children).toHaveLength(14);f.node('faces-results').children[0].click();expect(f.select).toHaveBeenLastCalledWith(50);});
 it('computes lazily, keeps Face ID0, pages at 50 and reuses geometry on filter/sort',async()=>{
  const f=fixture();expect(f.getSource).not.toHaveBeenCalled();await f.compute();f.node('view').change('regionView');f.node('region').change('17');f.doc.getElementById('connectivity-components-results')!.children[0].click();
  expect(f.select).toHaveBeenCalledWith(0);expect(f.viewer.flyToLocation).toHaveBeenCalled();expect(f.viewer.setRegionalComponent.mock.lastCall?.[0]?.length).toBe(64);
  expect(f.node('faces-results').children).toHaveLength(50);f.node('faces-next').click();expect(f.node('faces-results').children).toHaveLength(14);f.node('sort').change('id');f.node('strategy').change('B');expect(f.getSource).toHaveBeenCalledOnce();expect(f.getTopology).toHaveBeenCalledOnce();
 });
 it('links Source Inspector back through the existing Analysis tab and clears only its own overlays',async()=>{
  const f=fixture();await f.compute();const host=f.doc.createElement('section');f.doc.body.append(host);owner!.inspect(0,host as unknown as HTMLElement);host.querySelector('#connectivity-source-inspector')!.children.find(n=>n.tag==='button')!.click();expect(f.analysisTab.onclick).toHaveBeenCalledOnce();
  f.node('clear').click();expect(f.viewer.setRegionalComponent.mock.lastCall?.[0]).toBeNull();expect(f.viewer.setRegionalBoundaries.mock.lastCall?.[0]).toBeNull();expect(createWM0Topology(f.source)).toBe(f.getTopology.mock.results[0].value);expect(f.doc.getElementById('regional-connectivity')!.dataset.faces).toBeUndefined();
 });
 it('drops stale requests after map/source availability changes and removes all UI on disposal',async()=>{
  const f=fixture();f.node('compute').click();f.disable();await new Promise(resolve=>setTimeout(resolve,10));expect(f.getSource).not.toHaveBeenCalled();expect(f.node('compute').disabled).toBe(true);expect(f.doc.getElementById('regional-connectivity')!.dataset.faces).toBeUndefined();owner!.dispose();owner=undefined;expect(f.doc.getElementById('regional-connectivity')).toBeNull();expect(f.viewer.setRegionalComponent.mock.lastCall?.[0]).toBeNull();
 });
 it('drops prepared membership and overlay state when switching away from WM0 BASE',async()=>{
  const f=fixture();await f.compute();f.node('view').change('regionView');f.node('region').change('17');f.doc.getElementById('connectivity-components-results')!.children[0].click();f.disable();expect(f.doc.getElementById('regional-connectivity')!.dataset.faces).toBeUndefined();expect(f.viewer.setRegionalComponent.mock.lastCall?.[0]).toBeNull();expect(f.node('faces-results').children).toHaveLength(0);
 });
 it('keeps complete five-language labels and updates the current UI without recalculating',async()=>{
  const f=fixture();await f.compute();for(const locale of locales){for(const [key]of regionalConnectivityCatalog)expect(dictionaries[locale][key]?.trim()).toBeTruthy();setLocale(locale,false);expect(f.node('compute').textContent).toBe(dictionaries[locale]['connectivity.compute']);}expect(f.getSource).toHaveBeenCalledOnce();
 });
 it('sorts/filter categorical records without changing original totals or component0 identity',()=>{
  const rows=[{id:0,count:2,area:3,duplicateFaces:0},{id:3,count:1,area:10,duplicateFaces:1}] as unknown as Parameters<typeof componentRows>[0];expect(componentRows(rows,'count',true).map(c=>c.id)).toEqual([0]);expect(componentRows(rows,'area',false).map(c=>c.id)).toEqual([3,0]);expect(rows).toHaveLength(2);
  const pairs=[{key:'1/2',regionA:1,regionB:2,edges:3,length:4},{key:'2/3',regionA:2,regionB:3,edges:2,length:9}] as unknown as Parameters<typeof adjacencyRows>[0];expect(adjacencyRows(pairs,'area',2).map(p=>p.key)).toEqual(['2/3','1/2']);expect(adjacencyRows(pairs,'id',1).map(p=>p.key)).toEqual(['1/2']);
 });
});
