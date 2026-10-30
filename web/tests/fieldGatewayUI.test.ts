// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {mountFieldGateway} from '../src/ui/fieldGateway';
import type {GatewayResources,GatewayResult,GatewayStart} from '../src/analysis/fieldGateway';
import {dictionaries,locales,setLocale} from '../src/i18n';

const backend=vi.hoisted(()=>({instances:[] as any[],solve:vi.fn(),scene:vi.fn(),disposed:vi.fn(),world:vi.fn()}));
vi.mock('../src/analysis/fieldGateway',()=>({FieldGatewayNetwork:class {
 readonly identity;readonly cachedScenes=1;
 constructor(readonly resources:any){this.identity=resources.identity;backend.instances.push(this);}
 solve(...args:any[]){return backend.solve(...args);}scene(...args:any[]){return backend.scene(...args);}dispose(){backend.disposed();}
}}));
vi.mock('../src/data/fieldContext',()=>({validateWorldEntrance:(...args:any[])=>backend.world(...args)}));

class NodeStub extends EventTarget {
 children:NodeStub[]=[];parentElement:NodeStub|null=null;id='';className='';textContent='';value='';label='';type='';hidden=false;disabled=false;open=false;dataset:Record<string,string>={};attributes=new Map<string,string>();
 onclick:(()=>unknown)|null=null;onchange:(()=>unknown)|null=null;
 constructor(readonly tagName:string) {super();}
 all():NodeStub[]{return this.children.flatMap(n=>[n,...n.all()]);}
 append(...nodes:NodeStub[]){for(const n of nodes){n.remove();n.parentElement=this;this.children.push(n);}}
 remove(){if(this.parentElement){const siblings=this.parentElement.children;siblings.splice(siblings.indexOf(this),1);this.parentElement=null;}}
 replaceChildren(...nodes:NodeStub[]){for(const n of this.children)n.parentElement=null;this.children=[];this.append(...nodes);}
 setAttribute(k:string,v:string){this.attributes.set(k,v);}getAttribute(k:string){return this.attributes.get(k)??null;}
 querySelector(selector:string){return this.all().find(n=>selector==='#'+n.id)??null;}
 get childNodes(){return this.children;}get options(){return this.all().filter(n=>n.tagName==='OPTION');}
 get text():string{return this.textContent+this.children.map(n=>n.text).join(' ');}
 click(){if(!this.disabled)return this.onclick?.();}
}
class DocStub extends EventTarget {
 body=new NodeStub('BODY');documentElement={lang:'en'};
 createElement=(tag:string)=>new NodeStub(tag.toUpperCase());getElementById=(id:string)=>this.body.all().find(n=>n.id===id)??null;
}
let owner:ReturnType<typeof mountFieldGateway>|undefined;
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
beforeEach(()=>{backend.instances=[];backend.solve.mockReset();backend.scene.mockReset();backend.disposed.mockReset();backend.world.mockReset();backend.world.mockReturnValue({reason:'mesh_unavailable'});});
afterEach(()=>{owner?.dispose();owner=undefined;vi.unstubAllGlobals();setLocale('en',false);});
function fixture(missing=false){
 const doc=new DocStub(),host=doc.createElement('header');doc.body.append(host);vi.stubGlobal('document',doc);vi.stubGlobal('Element',class {});vi.stubGlobal('Node',class {static TEXT_NODE=3;});
 let frame:FrameRequestCallback|undefined;vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{frame=fn;return 1;});
 const g={fromField:2,to:1,gateway:0,offset:56,sourceRelation:'surface',destination:{status:'inside',derivedZ:0},targetTriangle:0};
 const pack={sources:{'flevel.lgp':'a'.repeat(64),maplist:'b'.repeat(64)},scenes:new Map([[0,{status:'available'}],[1,{status:'available'}],[2,{status:'available'}]])};
 let current=true,usable=true;
 const index={nodes:new Map([0,1,2].map(id=>[id,{id,name:'scene-'+id,status:'available'}])),pack:{edges:[g],gateways:[g]}};
 const identity={contextSHA256:'a'.repeat(64),walkmeshSHA256:'b'.repeat(64),generation:1,archive:'flevel.lgp',sources:pack.sources};
 let resources=missing?null:{index,pack,identity,poi:{entrances:[{id:'verified-entrance',field_name:'scene-1',field_id:1,field_triangle:0,field_table_record:0}]},current:()=>current} as unknown as GatewayResources;
 const leg={fromField:1,startTriangle:0,endTriangle:0,triangles:[0],access:[],gateway:{...g,fromField:1,to:0},candidates:[0],reachableCandidates:[0],arrival:{fieldId:0,triangle:0,xy:[0,0],derivedZ:0}};
 const answer={status:'success',identity,start:{kind:'arrival',fromField:2,gateway:0},targetField:0,maxTransfers:3,states:[],legs:[leg],diagnostics:[],counts:{},revisited:0,milliseconds:1} as unknown as GatewayResult;
 backend.solve.mockResolvedValue(answer);const scene={mesh:{triangles:1},network:{}};backend.scene.mockResolvedValue(scene);
 const showLeg=vi.fn();owner=mountFieldGateway({resources:()=>resources,usable:()=>usable,showLeg});owner.attach(host as unknown as HTMLElement,1,{kind:'arrival',fromField:2,gateway:0});
 const node=(id:string)=>doc.getElementById(id)!;
 const choose=(id:string,value:string)=>{node('field-gateway-'+id).value=value;node('field-gateway-'+id).onchange?.();};
 const target=()=>choose('target','0');const advance=async()=>{frame?.(0);await tick();};
 return {doc,host,node,choose,target,advance,answer,showLeg,scene,resource:()=>resources,run:async()=>{target();node('field-gateway-run').click();await advance();},start:()=>{target();node('field-gateway-run').click();},replace:()=>{current=false;resources={...resources!,index:{...index,nodes:new Map(index.nodes)},pack:{...pack},identity:{...identity,generation:2},current:()=>true} as unknown as GatewayResources;owner!.attach(host as unknown as HTMLElement,1);},unavailable:()=>{usable=false;owner!.invalidate();},restore:()=>{usable=true;owner!.attach(host as unknown as HTMLElement,1,{kind:'arrival',fromField:2,gateway:0});}};
}
describe('Field Gateway query session owner',()=>{
 it('explains unavailable resources without creating a query engine',()=>{const f=fixture(true);expect(f.node('field-gateway-run').disabled).toBe(true);expect(f.node('field-gateway-status').textContent).toBe(dictionaries.en['gateway.unavailable']);expect(backend.instances).toHaveLength(0);});
 it('uses stable arrival IDs and accepts target Field 0 without guessing a name or representative point',async()=>{const f=fixture();await f.run();expect(backend.solve).toHaveBeenCalledOnce();expect(backend.solve.mock.calls[0].slice(0,3)).toEqual([{kind:'arrival',fromField:2,gateway:0},0,3]);expect(owner!.result()).toBe(f.answer);expect(f.node('field-gateway-query').dataset.status).toBe('success');});
 it('preserves the exact reviewed WM0 Entrance identity instead of a display label',async()=>{const f=fixture();f.choose('start','world:verified-entrance');await f.run();expect(backend.solve.mock.calls[0][0]).toEqual({kind:'world',entranceId:'verified-entrance'});expect(backend.world).toHaveBeenCalled();});
 it('cancels a pending result on input edits and does not overwrite the newer target',async()=>{const f=fixture();let finish!:(r:GatewayResult)=>void;backend.solve.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));f.start();await f.advance();f.choose('target','2');finish(f.answer);await tick();expect(owner!.result()).toBeNull();expect(f.node('field-gateway-target').value).toBe('2');expect(f.node('field-gateway-query').dataset.status).toBeUndefined();expect(f.node('field-gateway-run').disabled).toBe(false);});
 it('rejects a late result after the actual source objects and generation are replaced',async()=>{const f=fixture();let finish!:(r:GatewayResult)=>void;backend.solve.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));f.start();await f.advance();f.replace();finish(f.answer);await tick();expect(owner!.result()).toBeNull();expect(backend.disposed).toHaveBeenCalled();expect(f.node('field-gateway-query').dataset.status).toBeUndefined();});
 it('cancels source replacement before the first animation frame without leaving a busy owner',async()=>{const f=fixture();f.start();f.replace();await f.advance();expect(backend.solve).not.toHaveBeenCalled();expect(owner!.result()).toBeNull();expect(f.node('field-gateway-status').textContent).not.toBe(dictionaries.en['gateway.busy']);});
 it('rejects a late result after owner disposal and removes the one UI root',async()=>{const f=fixture();let finish!:(r:GatewayResult)=>void;backend.solve.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));f.start();await f.advance();owner!.dispose();owner=undefined;finish(f.answer);await tick();expect(f.doc.getElementById('field-gateway-query')).toBeNull();expect(f.showLeg).not.toHaveBeenCalled();});
 it('views an existing leg through the parent Canvas port and keeps results across Inspector and render scopes',async()=>{const f=fixture();await f.run();f.node('field-gateway-leg-0').click();await tick();expect(f.showLeg).toHaveBeenCalledWith(f.answer.legs[0],f.scene,f.answer.start);const inspector=f.doc.createElement('section');f.doc.body.append(inspector);owner!.inspect(inspector as unknown as HTMLElement);expect(f.doc.getElementById('field-gateway-evidence')).not.toBeNull();inspector.remove();const next=f.doc.createElement('header');f.doc.body.append(next);owner!.attach(next as unknown as HTMLElement,1);expect(owner!.result()).toBe(f.answer);expect(backend.solve).toHaveBeenCalledOnce();expect(f.doc.body.all().filter(n=>n.id==='field-gateway-query')).toHaveLength(1);});
 it('does not display a late leg decode after resources are replaced',async()=>{const f=fixture();await f.run();let finish!:(r:typeof f.scene)=>void;backend.scene.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));f.node('field-gateway-leg-0').click();f.replace();finish(f.scene);await tick();expect(f.showLeg).not.toHaveBeenCalled();});
 it('clears session results when leaving an applicable space and permits a fresh query on return',async()=>{const f=fixture();await f.run();f.unavailable();expect(owner!.result()).toBeNull();f.restore();await f.run();expect(backend.solve).toHaveBeenCalledTimes(2);expect(owner!.result()).toBe(f.answer);});
 it('bounds the transfer selector to 1, 2 and 3 and passes the explicit chosen limit',async()=>{const f=fixture();expect(f.node('field-gateway-limit').options.map(o=>o.value)).toEqual(['1','2','3']);f.choose('limit','1');await f.run();expect(backend.solve.mock.calls[0][2]).toBe(1);});
 it.each(locales)('keeps the controls and result reasons localized in %s',language=>{const f=fixture();setLocale(language,false);expect(dictionaries[language]['gateway.title']).toBeTruthy();expect(f.node('field-gateway-run').textContent).toBe(dictionaries[language]['gateway.run']);expect(f.node('field-gateway-status').textContent).toBe(dictionaries[language]['gateway.ready']);});
});
