// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,describe,expect,it,vi} from 'vitest';
import {appStore} from '../src/app/state';
import {parseRouting,connectedComponents,findRoute} from '../src/data/routing';
import {mountAnalysis} from '../src/ui/analysis';
import type {GaiaViewer} from '../src/viewer/GaiaViewer';
import type {GaiaMeta} from '../src/data/mesh';
import {routingFixture} from './fixtures/routing';

const mocks=vi.hoisted(()=>({loaders:new Map<string,(files:{arrayBuffer:()=>Promise<ArrayBuffer>}[])=>Promise<unknown>>(),clear:vi.fn(),setRoute:vi.fn()}));
vi.mock('../src/app/assets',()=>({workspaceLoader:{register:(id:string,load:(files:{arrayBuffer:()=>Promise<ArrayBuffer>}[])=>Promise<unknown>)=>{mocks.loaders.set(id,load);return ()=>mocks.loaders.delete(id);}},loadedAsset:vi.fn()}));
vi.mock('../src/data/routing',async original=>({...await original<typeof import('../src/data/routing')>(),loadOptionalRouting:async()=>null}));
vi.mock('../src/ui/cartography',()=>({mountCartography:(_viewer:unknown,panel:HTMLElement)=>{const compare=document.createElement('section');panel.append(compare);return {compare,dispose:()=>compare.remove()};}}));
vi.mock('../src/ui/spatialAnalysis',()=>({mountSpatialAnalysis:(viewer:{setServiceArea:(value:null)=>void})=>({setRoute:mocks.setRoute,clear:()=>{mocks.clear();viewer.setServiceArea(null);},dispose:vi.fn()})}));

// Wiring checks only, following existing tests' small DOM stubs. No layout claims.
class NodeStub extends EventTarget {
 children:NodeStub[]=[];parent:NodeStub|null=null;id='';className='';textContent='';value='';hidden=false;checked=false;disabled=false;title='';dataset:Record<string,string>={};attrs:Record<string,string>={};onclick:(()=>void)|null=null;onchange:(()=>void)|null=null;
 constructor(readonly doc:DocStub,readonly tagName:string){super();}
 classList={add:(name:string)=>{this.className+=' '+name;},remove:(name:string)=>{this.className=this.className.split(' ').filter(x=>x!==name).join(' ');}};
 get parentElement(){return this.parent;}
 append(...nodes:NodeStub[]){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);if(this.tagName==='SELECT'&&!this.value&&node.tagName==='OPTION')this.value=node.value;}}
 remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
 before(node:NodeStub){if(this.parent){node.remove();node.parent=this.parent;this.parent.children.splice(this.parent.children.indexOf(this),0,node);}}
 replaceChildren(...nodes:NodeStub[]){for(const node of this.children)node.parent=null;this.children=[];this.append(...nodes);}
 all():NodeStub[]{return this.children.flatMap(node=>[node,...node.all()]);}
 setAttribute(name:string,value:string){this.attrs[name]=value;if(name==='id')this.id=value;if(name==='class')this.className=value;}
 removeAttribute(name:string){delete this.attrs[name];}
 matches(selector:string){if(selector[0]==='#')return this.id===selector.slice(1);if(selector[0]==='.')return this.className.split(/\s+/).includes(selector.slice(1));const label=/^label\[for="([^"]+)"\]$/.exec(selector);return label?this.tagName==='LABEL'&&this.attrs.for===label[1]:this.tagName===selector.toUpperCase();}
 querySelector(selector:string){return this.all().find(node=>node.matches(selector))??null;}
 querySelectorAll(selector:string){return this.all().filter(node=>node.matches(selector));}
 set innerHTML(markup:string){this.replaceChildren();const stack:NodeStub[]=[this];for(const token of markup.matchAll(/<(\/?)([\w-]+)([^>]*)>/g)){const [,closing,tag,attributes]=token;if(closing){if(stack.length>1)stack.pop();continue;}const node=this.doc.createElement(tag);for(const attr of attributes.matchAll(/([\w-]+)="([^"]*)"/g))node.setAttribute(attr[1],attr[2]);stack.at(-1)!.append(node);if(!['input','br','hr'].includes(tag))stack.push(node);}}
}
class DocStub extends EventTarget {
 body=new NodeStub(this,'BODY');
 createElement=(tag:string)=>new NodeStub(this,tag.toUpperCase());createTextNode=(text:string)=>{const node=this.createElement('text');node.textContent=text;return node;};
 getElementById=(id:string)=>this.body.all().find(node=>node.id===id)??null;
 querySelector=(selector:string)=>this.body.querySelector(selector);
}
const graph=parseRouting(routingFixture());
class WorkerStub {
 onmessage:((event:{data:{request:number;result:unknown}})=>void)|null=null;onerror:(()=>void)|null=null;
 postMessage(data:{request:number;kind:string;mode:string;conditional:boolean;starts:Parameters<typeof findRoute>[2];targets:Parameters<typeof findRoute>[3]}){queueMicrotask(()=>{const c=data.kind==='init'?null:connectedComponents(graph,data.mode,data.conditional),result=data.kind==='init'?true:data.kind==='components'?c:findRoute(graph,c!.labels,data.starts,data.targets);this.onmessage?.({data:{request:data.request,result}});});}
 terminate(){}
}
let owner:ReturnType<typeof mountAnalysis>|undefined;
afterEach(()=>{owner?.dispose();owner=undefined;mocks.loaders.clear();mocks.clear.mockClear();mocks.setRoute.mockClear();vi.unstubAllGlobals();});
async function fixture(){
 const doc=new DocStub(),app=doc.createElement('main'),footer=doc.createElement('footer'),controls=doc.createElement('section');app.id='app';controls.className='controls';doc.body.append(app,footer,controls);vi.stubGlobal('document',doc);vi.stubGlobal('Worker',WorkerStub);
 appStore.dispatch({type:'reset-data'});appStore.dispatch({type:'asset',id:'routing',asset:{status:'loaded',bytes:1}});
 const viewer={mesh:{sourceTriangleCount:4,attributes:(i:number)=>({origin:0,section:0,mesh:0,triangle:i,terrain:0,script:0})},setRouteColor:vi.fn(),setAnalysis:vi.fn(),setComparisonFlags:vi.fn(),setComparedRoutes:vi.fn(),setJourneyStops:vi.fn(),setServiceArea:vi.fn()};
 owner=mountAnalysis(viewer as unknown as GaiaViewer,{stage1:{source_wm0_sha256:graph.sourceHash}} as unknown as GaiaMeta,()=>true);
 await mocks.loaders.get('routing')!([{arrayBuffer:async()=>routingFixture()}]);
 const poi={locations:['a','b'].map((id,i)=>({id,name:id,display_name:id,aliases:[],field_names:[],primary_entrance:id,entrance_ids:[id]})),entrances:['a','b'].map((id,i)=>({id,location_id:id,section_id:0,mesh_id:0,trigger_triangle_ids:[i?3:0]})),sources:{'wm0.map':graph.sourceHash}};
 doc.dispatchEvent(new CustomEvent('gaiagis:poi',{detail:poi}));mocks.clear.mockClear();mocks.setRoute.mockClear();viewer.setServiceArea.mockClear();
 return {doc,viewer,port:owner.journey(),node:(id:string)=>doc.getElementById(id)!};
}
describe('existing Analysis and Journey foreground integration',()=>{
 it('clears Journey route/profile without erasing a separately calculated Service Area',async()=>{
  const f=await fixture(),lease=f.port.claim();f.port.display(lease,[0,1],'a','b',2);mocks.setRoute.mockClear();
  f.port.clear(lease);
  expect(f.viewer.setAnalysis).toHaveBeenLastCalledWith(null,[],null,null,null);expect(mocks.setRoute).toHaveBeenCalledWith([],0);
  expect(mocks.clear).not.toHaveBeenCalled();expect(f.viewer.setServiceArea).not.toHaveBeenCalled();expect(f.port.current(lease)).toBe(false);
 });
 it('an explicit saved professional comparison selection replaces, rather than overlaps, a Journey',async()=>{
  const f=await fixture();f.node('route-from').value='a';f.node('route-to').value='b';f.node('compare-routes').onclick!();
  await vi.waitFor(()=>expect(f.node('comparison-results').dataset.routes).toBe('9'));
  const checkbox=f.node('comparison-results').all().find(node=>node.tagName==='INPUT'&&node.dataset.routeOverlay==='0')!;
  const lease=f.port.claim();f.port.display(lease,[0,1,2,3],'a','b',9);f.viewer.setAnalysis.mockClear();f.viewer.setComparedRoutes.mockClear();mocks.setRoute.mockClear();
  checkbox.checked=true;checkbox.onchange!();
  expect(f.port.current(lease)).toBe(false);expect(f.viewer.setAnalysis).toHaveBeenCalledWith(null,[],null,null,null);expect(mocks.setRoute).toHaveBeenCalledWith([],0);
  expect(f.viewer.setComparedRoutes).toHaveBeenLastCalledWith([[0,1,2,3]]);expect(f.viewer.setAnalysis.mock.invocationCallOrder[0]).toBeLessThan(f.viewer.setComparedRoutes.mock.invocationCallOrder[0]);
 });
});
