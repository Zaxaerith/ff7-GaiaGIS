// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,describe,expect,it,vi} from 'vitest';
import {mountJourney,resetJourneyDraft} from '../src/ui/journey';
import type {JourneyRoutingPort} from '../src/ui/journey';
import {appStore} from '../src/app/state';
import {connectedComponents,findRoute,parseRouting} from '../src/data/routing';
import {routingFixture} from './fixtures/routing';
import type {PoiDataset} from '../src/data/poi';
import type {AtlasContent} from '../src/data/atlas';
import type {GaiaViewer} from '../src/viewer/GaiaViewer';
import {dictionaries,locales} from '../src/i18n';
import {journeyCatalog} from '../src/i18n/journeyCatalog';

vi.mock('../src/analysis/spatial',()=>({analyzeRoute:()=>({total:12})}));
class NodeStub extends EventTarget{
 children:NodeStub[]=[];parentElement:NodeStub|null=null;id='';className='';textContent='';value='';label='';type='';htmlFor='';checked=false;hidden=false;disabled=false;tabIndex=0;dataset:Record<string,string>={};attrs=new Map<string,string>();
 onclick:((e?:Event)=>unknown)|null=null;onchange:((e?:Event)=>unknown)|null=null;oninput:((e?:Event)=>unknown)|null=null;
 constructor(readonly doc:DocStub,readonly tagName:string){super();}
 all():NodeStub[]{return this.children.flatMap(n=>[n,...n.all()]);}
 append(...nodes:NodeStub[]){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
 prepend(...nodes:NodeStub[]){for(const node of [...nodes].reverse()){node.remove();node.parentElement=this;this.children.unshift(node);}}
 replaceChildren(...nodes:NodeStub[]){for(const n of this.children)n.parentElement=null;this.children=[];this.append(...nodes);}
 remove(){if(this.parentElement){const p=this.parentElement;p.children.splice(p.children.indexOf(this),1);this.parentElement=null;}}
 setAttribute(key:string,value:string){this.attrs.set(key,value);}getAttribute(key:string){return this.attrs.get(key)??null;}
 querySelectorAll(selector:string){return this.all().filter(n=>selector==='button'?n.tagName==='BUTTON':selector.startsWith('[data-journey-stop=')?n.dataset.journeyStop===selector.match(/"([^"]+)"/)?.[1]:false);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0]??null;}
 get options(){return this.all().filter(n=>n.tagName==='OPTION');}
 focus(){this.doc.activeElement=this;}scrollIntoView(){}
 click(){if(!this.disabled)return this.onclick?.(new Event('click'));}
 get text():string{return this.textContent+this.children.map(n=>n.text).join(' ');}
}
class DocStub extends EventTarget{
 body=new NodeStub(this,'BODY');activeElement:NodeStub=this.body;
 createElement=(tag:string)=>new NodeStub(this,tag.toUpperCase());
 getElementById=(id:string)=>this.body.all().find(n=>n.id===id)??null;
}
let owner:ReturnType<typeof mountJourney>|undefined;
afterEach(()=>{owner?.dispose();owner=undefined;resetJourneyDraft();vi.unstubAllGlobals();appStore.dispatch({type:'reset-data'});appStore.dispatch({type:'map',id:'WM0'});appStore.dispatch({type:'view',view:{spatial:'world',variantResearch:false}});appStore.dispatch({type:'explorer',phase:'idle'});});
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function fixture(sourceOnly=false){
 const doc=new DocStub();for(const id of ['app-group-explore','selection-details','selection-empty','inspector-title']){const n=doc.createElement('div');n.id=id;doc.body.append(n);}vi.stubGlobal('document',doc);
 const graph=parseRouting(routingFixture()),source={wm0:graph.sourceHash,routing:'bb'.repeat(32),poi:'cc'.repeat(32),atlas:'dd'.repeat(32),generation:appStore.state.data.generation};
 const entrance=(id:string,node:number)=>({id:'entrance-'+id,location_id:id,section_id:0,mesh_id:0,trigger_triangle_ids:[node],world_map:0,source_kind:'derived_from_entry_trigger'});
 const poi={locations:['a','b','c'].map((id,i)=>({id,display_name:'Place '+id,primary_entrance:'entrance-'+id,entrance_ids:['entrance-'+id],field_names:['field-'+id]})),entrances:[entrance('a',0),entrance('b',1),entrance('c',3)],sources:{'wm0.map':graph.sourceHash}} as unknown as PoiDataset;
 const names=(name:string)=>Object.fromEntries(locales.map(l=>[l,name]));
 const content={entities:[{id:'guide-a',canonicalName:'Guide A',localizedNames:names('Guide A'),spoilerLevel:'none',spatialBinding:{kind:'location',locationId:'a'}},{id:'parent',canonicalName:'Reward',localizedNames:names('Reward'),spoilerLevel:'none',spatialBinding:{kind:'parent_location',locationId:'b'}},{id:'field',canonicalName:'Field',localizedNames:names('Field'),spoilerLevel:'none',spatialBinding:{kind:'field_identity',fieldNames:['qa']}},{id:'cave-reward',canonicalName:'Cave reward',localizedNames:names('Cave reward'),spoilerLevel:'none',spatialBinding:{kind:'field_parent',locationId:'c',fieldNames:['field-c']}}]} as unknown as AtlasContent;
 let epoch=0;const display=vi.fn(),clear=vi.fn(),route=vi.fn(async(profile:string,conditional:boolean,starts:any,targets:any)=>findRoute(graph,connectedComponents(graph,profile,conditional).labels,starts,targets));
 const backend:JourneyRoutingPort={context:async()=>({graph,source}),components:async(profile,conditional)=>connectedComponents(graph,profile,conditional),route,claim:()=>++epoch,current:lease=>epoch===lease,display,clear};
 const viewer={setJourneyStops:vi.fn(),mesh:{}} as unknown as GaiaViewer;
 owner=mountJourney(()=>sourceOnly?undefined:viewer,()=>sourceOnly?null:backend,()=>sourceOnly?null:poi,()=>content);
 const node=(id:string)=>doc.getElementById(id)!;
 const add=(kind:'location'|'atlas',id:string,parentConfirmed=false)=>doc.dispatchEvent(new CustomEvent('gaiagis:journey-add',{detail:{target:{kind,id},parentConfirmed}}));
 return {doc,node,add,backend,route,display,clear,source,poi,viewer,content,replaceForeground:()=>{epoch++;}};
}
describe('Journey player owner and source-only draft',()=>{
 it('keeps source-only stable identities, reorders/removes and preserves draft across a layout replacement',()=>{const f=fixture(true);f.add('atlas','guide-a');f.add('atlas','parent');f.add('atlas','guide-a');expect(f.node('journey-planner').dataset.stops).toBe('3');expect(f.node('journey-status').text).toContain('Workspace');const list=f.node('journey-stops'),firstId=list.children[0].dataset.stopId;list.children[1].querySelectorAll('button')[1].click();expect(list.children[1].dataset.stopId).toBe(firstId);list.children[2].querySelectorAll('button')[3].click();expect(f.node('journey-planner').dataset.stops).toBe('2');owner?.dispose();owner=mountJourney(()=>undefined,()=>null,()=>null,()=>f.content);expect(f.node('journey-planner').dataset.stops).toBe('2');expect(f.display).not.toHaveBeenCalled();});
 it('caps the plan at six occurrences without silently deduplicating a repeated location',()=>{const f=fixture();for(let i=0;i<7;i++)f.add('location','a');expect(f.node('journey-planner').dataset.stops).toBe('6');expect(new Set(f.node('journey-stops').children.map(n=>n.dataset.stopId)).size).toBe(6);expect(f.node('journey-status').text).toMatch(/six/);});
 it('runs the existing route port and reclaims foreground only on explicit redisplay',async()=>{const f=fixture();f.add('location','a');f.add('location','b');f.add('location','c');f.node('journey-plan').click();await tick();expect(f.node('journey-planner').dataset.phase).toBe('success');expect(f.display).toHaveBeenCalledTimes(1);expect(f.route).toHaveBeenCalledTimes(2);expect(f.route.mock.calls[1][2]).toEqual([{node:1,entrance:'entrance-b'}]);f.replaceForeground();expect(f.node('journey-planner').dataset.phase).toBe('success');expect(f.display).toHaveBeenCalledTimes(1);f.node('journey-show-all').click();await tick();expect(f.display).toHaveBeenCalledTimes(2);});
 it('keeps Field-only material separate from the successful WM0 stop sequence',async()=>{const f=fixture();f.add('location','a');f.add('atlas','field');f.add('location','c');f.node('journey-plan').click();await tick();expect(f.node('journey-results').text).toContain('reference-only');expect(f.route).toHaveBeenCalledTimes(1);expect(f.node('journey-stops').children[1].text).toContain('excluded');});
 it('never silently substitutes a later place for a Field-only first stop',async()=>{const f=fixture();f.add('atlas','field');f.add('location','a');f.add('location','c');f.node('journey-plan').click();await tick();expect(f.route).not.toHaveBeenCalled();expect(f.node('journey-status').text).toContain('not a WM0');expect(f.node('journey-stops').children[0].text).not.toContain('Start');});
 it('does not route a Field parent reward until the explicit parent action is used',async()=>{const f=fixture();f.add('location','a');f.add('atlas','cave-reward');f.node('journey-plan').click();await tick();expect(f.route).not.toHaveBeenCalled();const row=f.node('journey-stops').children[1];row.children.at(-1)!.click();f.node('journey-plan').click();await tick();expect(f.node('journey-planner').dataset.phase).toBe('success');expect(f.route).toHaveBeenCalledTimes(1);expect(f.node('journey-stops').children[1].text).toContain('not the reward');});
 it('rejects a late calculation after source generation changes, preserving the list',async()=>{const f=fixture();let finish:(value:any)=>void=()=>{};f.backend.components=()=>new Promise(resolve=>{finish=resolve;});f.add('location','a');f.add('location','c');f.node('journey-plan').click();await tick();appStore.dispatch({type:'reset-data'});finish(connectedComponents(parseRouting(routingFixture()),'foot'));await tick();expect(f.display).not.toHaveBeenCalled();expect(f.node('journey-planner').dataset.stops).toBe('2');expect(f.node('journey-planner').dataset.routeNodes).toBe('0');expect(f.node('journey-status').text).toContain('changed');});
 it('lets a newer professional action win while an explicit redisplay is awaiting source validation',async()=>{const f=fixture();f.add('location','a');f.add('location','c');f.node('journey-plan').click();await tick();let finish:(value:any)=>void=()=>{};f.backend.context=()=>new Promise(resolve=>{finish=resolve;});f.node('journey-show-all').click();f.replaceForeground();finish({graph:parseRouting(routingFixture()),source:f.source});await tick();expect(f.display).toHaveBeenCalledTimes(1);expect(f.node('journey-planner').dataset.phase).toBe('success');});
 it('uses shared route Inspector and retains a result when Inspector closes or projection changes',async()=>{const f=fixture();f.add('location','a');f.add('location','c');f.node('journey-plan').click();await tick();f.node('journey-results').querySelectorAll('button')[1].click();await tick();expect(f.node('selection-details').dataset.journeyLeg).toBeTruthy();expect(appStore.state.selection?.kind).toBe('route');appStore.dispatch({type:'select',selection:null});appStore.dispatch({type:'view',view:{projection:'mercator'}});expect(f.node('journey-planner').dataset.phase).toBe('success');expect(f.route).toHaveBeenCalledTimes(1);});
 it('pauses planning controls in Native, Field and roaming without resetting a valid plan',async()=>{const f=fixture();f.add('location','a');f.add('location','c');f.node('journey-plan').click();await tick();appStore.dispatch({type:'map',id:'WM2'});expect(f.node('journey-plan').disabled).toBe(true);expect(f.node('journey-show-all').disabled).toBe(true);appStore.dispatch({type:'map',id:'WM0'});appStore.dispatch({type:'explorer',phase:'active'});expect(f.node('journey-plan').disabled).toBe(true);appStore.dispatch({type:'explorer',phase:'idle'});expect(f.node('journey-planner').dataset.phase).toBe('success');expect(f.node('journey-plan').disabled).toBe(false);});
 it('includes every new label in five locale dictionaries',()=>{for(const row of journeyCatalog)for(const language of locales)expect(dictionaries[language][row[0]]).toBeTruthy();});
});
