// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,describe,it,expect,vi} from 'vitest';
import {mountEncounterGeography} from '../src/ui/encounterGeography';
import {appStore} from '../src/app/state';
import {encounterKinds} from '../src/data/encounters';
import type {EncounterResource} from '../src/data/encounters';
import type {WM0Source} from '../src/analysis/wm0Source';
import type {GaiaViewer} from '../src/viewer/GaiaViewer';
import type {GaiaMeta} from '../src/data/mesh';
import {dictionaries,locales,setLocale} from '../src/i18n';
import {encounterGeographyCatalog} from '../src/i18n/encounterGeographyCatalog';
class NodeStub extends EventTarget{
 children:NodeStub[]=[];parentElement:NodeStub|null=null;id='';className='';textContent='';value='';type='';min='';max='';step='';checked=false;hidden=false;disabled=false;open=false;dataset:Record<string,string>={};attrs=new Map<string,string>();onclick:(()=>unknown)|null=null;onchange:(()=>unknown)|null=null;
 constructor(readonly tagName:string){super();}
 all():NodeStub[]{return this.children.flatMap(n=>[n,...n.all()]);}
 append(...nodes:NodeStub[]){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}if(this.tagName==='SELECT'&&!this.value)this.value=this.children[0]?.value??'';}
 prepend(node:NodeStub){node.remove();node.parentElement=this;this.children.unshift(node);}
 insertBefore(node:NodeStub,before:NodeStub){node.remove();node.parentElement=this;this.children.splice(this.children.indexOf(before),0,node);}
 remove(){if(this.parentElement){const p=this.parentElement;p.children.splice(p.children.indexOf(this),1);this.parentElement=null;}}
 replaceChildren(...nodes:NodeStub[]){for(const n of this.children)n.parentElement=null;this.children=[];this.append(...nodes);}
 setAttribute(key:string,value:string){this.attrs.set(key,value);}removeAttribute(key:string){this.attrs.delete(key);}
 get options(){return this.children.filter(n=>n.tagName==='OPTION');}
 get childNodes(){return this.children;}
 closest(){return null;}focus(){}
 get text():string{return this.textContent+this.children.map(n=>n.text).join(' ');}
}
class DocStub extends EventTarget{body=new NodeStub('BODY');documentElement={lang:'en'};createElement=(tag:string)=>new NodeStub(tag.toUpperCase());getElementById=(id:string)=>this.body.all().find(n=>n.id===id)??null;}
let owner:ReturnType<typeof mountEncounterGeography>|undefined;
afterEach(()=>{owner?.dispose();owner=undefined;vi.unstubAllGlobals();appStore.dispatch({type:'reset-data'});appStore.dispatch({type:'map',id:'WM0'});setLocale('en',false);});
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function fixture(missing=false){
 const doc=new DocStub(),root=doc.createElement('section');root.id='analysis-panel';doc.body.append(root);vi.stubGlobal('document',doc);vi.stubGlobal('Element',class {});vi.stubGlobal('Node',class {static TEXT_NODE=3;});let frame:FrameRequestCallback|undefined;vi.stubGlobal('requestAnimationFrame',(f:FrameRequestCallback)=>{frame=f;return 1;});
 const records=Object.fromEntries(encounterKinds.map((kind,k)=>[kind,[{scene_id:64,weight:1,byte_offset:162+k*2,encounter_type:kind}]])),data={sources:{'wm0.map':'a'.repeat(64)},encounter_sets:[{id:'0:0',active:true,records}],regions:[{terrain_slots:[0,0,0,0]}]} as unknown as EncounterResource['data'];let resource:EncounterResource|null=missing?null:{data,sha256:'b'.repeat(64)};
 const source={sourceSHA:'a'.repeat(64),count:2,source:()=>({origin:0,region:0,terrain:0,script:0,chocobo:false,section:0,mesh:0,triangle:0}),metrics:()=>({area:2,zeroXZ:false,duplicateCount:1})} as unknown as WM0Source;
 let available=true;const viewer={setEncounterEvidence:vi.fn(),setServiceArea:vi.fn(),setRegionalComponent:vi.fn(),flyToLocation:vi.fn()} as unknown as GaiaViewer;
 owner=mountEncounterGeography(viewer,{region_names:{0:'Region'},terrain_names:{0:'Terrain'}} as unknown as GaiaMeta,()=>source,()=>resource,()=>null,()=>available,vi.fn());
 return {doc,viewer,node:(id:string)=>doc.getElementById(id)!,run:async()=>{doc.getElementById('encgeo-run')!.onclick?.();frame?.(0);await tick();},start:()=>doc.getElementById('encgeo-run')!.onclick?.(),frame:()=>frame?.(0),replace:()=>{resource={data:{...data},sha256:'c'.repeat(64)};doc.dispatchEvent(new Event('gaiagis:encounters'));},unavailable:()=>{available=false;appStore.dispatch({type:'map',id:'WM2'});}};
}
describe('Encounter Geography session owner',()=>{
 it('retains Set queries without Gameplay, paginates sources and owns only its mask',async()=>{const f=fixture();await f.run();expect(f.node('encounter-geography').dataset.faces).toBe('2');expect(f.node('encgeo-status').textContent).toBe(dictionaries.en['encgeo.ok']);expect(f.doc.body.text).toContain(dictionaries.en['encgeo.gameplay_missing']);expect(f.node('encgeo-faces-results').children).toHaveLength(2);expect(f.viewer.setServiceArea).not.toHaveBeenCalled();expect(f.viewer.setRegionalComponent).not.toHaveBeenCalled();f.node('encgeo-clear').onclick?.();expect(f.viewer.setEncounterEvidence).toHaveBeenLastCalledWith(null);expect(f.node('encgeo-faces-results').children).toHaveLength(0);});
 it('explains absent Encounter resources instead of fabricated coverage',()=>{const f=fixture(true);expect(f.node('encgeo-run').disabled).toBe(true);expect(f.node('encgeo-status').textContent).toBe(dictionaries.en['encgeo.missing']);expect(f.node('encgeo-faces-results').children).toHaveLength(0);});
 it('opens the existing GIS task from a stable Set identity, without a second Inspector',async()=>{const f=fixture(),open=vi.fn();f.doc.addEventListener('gaiagis:open-tool',open);f.doc.dispatchEvent(new CustomEvent('gaiagis:encounter-geography',{detail:{kind:'set',id:'0:0'}}));f.frame();await tick();expect(open).toHaveBeenCalledOnce();expect((open.mock.calls[0][0] as CustomEvent).detail.toolId).toBe('encounterGeography');expect(f.node('encgeo-kind').value).toBe('set');expect(f.node('encounter-geography').dataset.faces).toBe('2');});
 it('rejects delayed requests after asset replacement or disposal',async()=>{const f=fixture();f.start();f.replace();f.frame();await tick();expect(f.node('encounter-geography').dataset.faces).toBeUndefined();expect(f.viewer.setEncounterEvidence).toHaveBeenLastCalledWith(null);f.start();owner!.dispose();owner=undefined;f.frame();await tick();expect(f.doc.getElementById('encounter-geography')).toBeNull();});
 it('clears old masks on map changes and parameter edits without releasing other analysis owners',async()=>{const f=fixture();await f.run();f.node('encgeo-range').value='lookup';f.node('encgeo-range').onchange?.();expect(f.node('encgeo-faces-results').children).toHaveLength(0);await f.run();f.unavailable();expect(f.node('encounter-geography').hidden).toBe(true);expect(f.viewer.setEncounterEvidence).toHaveBeenLastCalledWith(null);expect(f.viewer.setRegionalComponent).not.toHaveBeenCalled();});
 it.each(locales)('has nonempty localized controls and reasons in %s',language=>{const f=fixture();setLocale(language,false);for(const [key]of encounterGeographyCatalog)expect(dictionaries[language][key]).toBeTruthy();expect(f.node('encgeo-run').textContent).toBe(dictionaries[language]['encgeo.query']);});
});
