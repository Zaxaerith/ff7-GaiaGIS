// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,describe,expect,it,vi} from 'vitest';
import {ExplorerController} from '../src/explorer/controller';
import type {ExplorerState} from '../src/explorer/controller';
import type {ExplorerPack} from '../src/data/explorer';
import {workspaceLoader} from '../src/app/assets';
import {appStore} from '../src/app/state';

// UI wiring only: no renderer, geometry, resource decode, walker or browser.
class NodeStub extends EventTarget{
 children:NodeStub[]=[];parent:NodeStub|null=null;id='';className='';textContent='';value='';label='';title='';hidden=false;disabled=false;open=false;dataset:Record<string,string>={};onclick:(()=>unknown)|null=null;
 private classes=new Set<string>();classList={contains:(v:string)=>this.classes.has(v),add:(v:string)=>this.classes.add(v),remove:(v:string)=>this.classes.delete(v)};
 constructor(readonly doc:DocStub,readonly tagName:string){super();}
 append(...nodes:NodeStub[]){for(const n of nodes){n.remove();n.parent=this;this.children.push(n);}}replaceChildren(...nodes:NodeStub[]){this.children.forEach(n=>n.parent=null);this.children=[];this.append(...nodes);}
 remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
 all():NodeStub[]{return this.children.flatMap(n=>[n,...n.all()]);}querySelectorAll(selector:string){return this.all().filter(n=>n.tagName===selector);}
 setAttribute(_key:string,_value:string){}focus(){this.doc.focused=this;}click(){if(!this.disabled)this.onclick?.();}
 get options(){return this.all().filter(n=>n.tagName==='option');}
}
class DocStub extends EventTarget{
 body=new NodeStub(this,'body');focused:NodeStub|null=null;createElement=(tag:string)=>new NodeStub(this,tag);
 getElementById=(id:string)=>this.body.all().find(n=>n.id===id)??null;
 querySelector=(selector:string)=>selector==='.multimap-bar'?this.body.all().find(n=>n.className==='multimap-bar')??null:null;
 querySelectorAll=()=>[];
}
let owner:ExplorerController|undefined;
afterEach(()=>{owner?.dispose();owner=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();appStore.dispatch({type:'reset-data'});});
function fixture(map='WM0',ids=['cloud','barret','tifa','aerith','red-xiii','yuffie','cait-sith','vincent','cid','buggy','tiny-bronco','highwind','submarine','chocobo']){
 const doc=new DocStub(),bar=doc.createElement('div'),selector=doc.createElement('select');bar.className='multimap-bar';selector.id='map-selector';selector.value=map;doc.body.append(bar,selector);vi.stubGlobal('document',doc);vi.stubGlobal('window',new EventTarget());vi.spyOn(workspaceLoader,'register').mockReturnValue(()=>{});
 const controller=owner=new ExplorerController(()=>undefined,()=>undefined);
 const pack={header:{models:ids.map(id=>({id,sourceKind:'world_map',animation_identity:'neutral_clip_indices',clips:[]}))}} as unknown as ExplorerPack;
 return {doc,controller,pack,node:(id:string)=>doc.getElementById(id)!};
}
describe('direct Character Explorer controls',()=>{
 it('opens the existing panel with Cloud and foot before the start action, even without its optional asset',()=>{const f=fixture();f.controller.openCharacterExplorer();expect(f.node('explorer-panel').open).toBe(true);expect(f.node('explorer-model').value).toBe('cloud');expect(f.node('explorer-mode').value).toBe('foot');expect(f.node('explorer-start').disabled).toBe(true);expect(f.node('explorer-status').textContent).toContain('gaia-explorer.bin');expect(f.node('explorer-instructions').textContent).toContain('WASD');expect(f.node('explorer-exit').hidden).toBe(false);});
 it('shows all nine party choices before independent vehicle and Chocobo groups',()=>{const f=fixture();f.controller.pack=f.pack;f.controller.openCharacterExplorer();const model=f.node('explorer-model'),groups=model.children;expect(groups).toHaveLength(3);expect(groups[0].children.map(n=>n.value)).toEqual(['cloud','barret','tifa','aerith','red-xiii','yuffie','cait-sith','vincent','cid']);expect(groups[1].children.map(n=>n.value)).toEqual(['buggy','tiny-bronco','highwind','submarine']);expect(groups[2].children.every(n=>n.value.startsWith('chocobo-'))).toBe(true);expect(model.disabled).toBe(false);expect(f.node('explorer-panel').children.indexOf(model)).toBeLessThan(f.node('explorer-panel').children.indexOf(f.node('explorer-mode')));});
 it('enables the original start action after an Explorer asset is available',()=>{const f=fixture();f.controller.pack=f.pack;f.controller.openCharacterExplorer();const start=vi.spyOn(f.controller,'arm').mockResolvedValue();expect(f.node('explorer-start').disabled).toBe(false);f.node('explorer-start').click();expect(start).toHaveBeenCalledOnce();expect(f.controller.armed).toBe(false);});
 it('keeps Tifa/Cid walking and vehicle selections synchronized with the actual movement selector',()=>{const f=fixture();f.controller.pack=f.pack;f.controller.openCharacterExplorer();for(const [id,mode]of [['tifa','foot'],['cid','foot'],['buggy','buggy'],['highwind','highwind']]){expect(f.controller.selectVisual(id)).toBe(true);expect(f.node('explorer-model').value).toBe(id);expect(f.controller.profile).toBe(mode);expect(f.node('explorer-mode').value).toBe(mode);}});
 it('does not offer a missing original model as usable or silently replace its identity',()=>{const f=fixture('WM0',['cloud','cid','buggy']);f.controller.pack=f.pack;f.controller.openCharacterExplorer();expect(f.node('explorer-model').options.find(n=>n.value==='tifa')!.disabled).toBe(true);expect(f.controller.selectVisual('tifa')).toBe(false);expect(f.node('explorer-model').value).toBe('cloud');expect(f.controller.profile).toBe('foot');});
 it.each([['WM2','submarine-native','submarine'],['WM3','glacier-native','cloud']])('retains the established native %s mode without inventing WM0 foot', (map,mode,model)=>{const f=fixture(map);f.controller.pack=f.pack;f.controller.openCharacterExplorer();expect(f.node('explorer-mode').options.map(n=>n.value)).toEqual([mode]);expect(f.node('explorer-model').value).toBe(model);expect(f.controller.profile).toBe(mode);});
 it('reopens an active Explorer without changing the chosen model, profile or walk state',()=>{const f=fixture();f.controller.pack=f.pack;f.controller.change('buggy');f.controller.armed=true;f.controller.state={airborne:false,explorerType:'buggy'} as ExplorerState;const state=f.controller.state;f.controller.openCharacterExplorer();expect(f.controller.state).toBe(state);expect(f.controller.profile).toBe('buggy');expect(f.node('explorer-model').value).toBe('buggy');expect(f.node('explorer-exit').disabled).toBe(false);});
 it('leaves title-screen direction/Escape keys and held-key frames to the title UI',()=>{const f=fixture();f.controller.state={airborne:false,heading:1} as ExplorerState;const state=f.controller.state,exit=vi.spyOn(f.controller,'exit');f.doc.body.classList.add('title-open');for(const value of ['ArrowUp','Escape']){const key=new Event('keydown',{cancelable:true});Object.defineProperty(key,'key',{value});f.doc.dispatchEvent(key);expect(key.defaultPrevented).toBe(false);}const held=(f.controller as unknown as {keys:Set<string>}).keys;held.add('w');f.controller.frame(.1);expect(held.size).toBe(0);expect(exit).not.toHaveBeenCalled();expect(f.controller.state).toBe(state);expect(state.heading).toBe(1);});
 it('lets the open feature navigation handle arrows/Escape while preserving an active walk',()=>{const f=fixture(),panel=f.doc.createElement('aside');panel.id='integrated-panel';panel.dataset.screen='navigation';panel.classList.add('open');f.doc.body.append(panel);f.controller.state={heading:2} as ExplorerState;const exit=vi.spyOn(f.controller,'exit'),key=new Event('keydown',{cancelable:true});Object.defineProperty(key,'key',{value:'Escape'});f.doc.dispatchEvent(key);const held=(f.controller as unknown as {keys:Set<string>}).keys;held.add('w');f.controller.frame(.1);expect(key.defaultPrevented).toBe(false);expect(exit).not.toHaveBeenCalled();expect(held.size).toBe(0);expect(f.controller.state.heading).toBe(2);});
});
