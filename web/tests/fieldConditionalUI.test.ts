// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,describe,expect,it,vi} from 'vitest';
import {mountFieldConditionalEvidence} from '../src/ui/fieldConditionalEvidence';
import type {ConditionalResult} from '../src/analysis/fieldConditionalEvidence';
import type {FieldEventIndex,FieldEventInput,FieldEventRow} from '../src/analysis/fieldEventEvidence';
import {CMUSC8_CFG,EN_FIELD_SHA,EN_MAPLIST_SHA} from '../src/data/fieldProvenance';
import {fieldConditionalCatalog} from '../src/i18n/fieldConditionalCatalog';
import {dictionaries,locales,setLocale} from '../src/i18n';
import {syntheticDialogue} from './dialogueSynthetic';

const session=vi.hoisted(()=>({create:vi.fn(),setInput:vi.fn(),analyze:vi.fn(),cancel:vi.fn(),invalidate:vi.fn(),dispose:vi.fn()}));
vi.mock('../src/analysis/fieldConditionalSession',()=>({createFieldConditionalSession:()=>{
 session.create();return {...session,state:{status:'idle',result:null,error:null}};
}}));

/** Original minimal DOM: no browser, external assets, game bytes, or Viewer. */
class ElementStub extends EventTarget {
 children:ElementStub[]=[];parentElement:ElementStub|null=null;id='';className='';textContent='';value='';type='';open=false;hidden=false;disabled=false;
 dataset:Record<string,string>={};attributes=new Map<string,string>();
 onclick:(()=>void)|null=null;onchange:(()=>void)|null=null;oninput:(()=>void)|null=null;
 constructor(readonly tagName:string){super();}
 all():ElementStub[]{return this.children.flatMap(n=>[n,...n.all()]);}
 append(...nodes:ElementStub[]){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
 remove(){if(!this.parentElement)return;const children=this.parentElement.children;children.splice(children.indexOf(this),1);this.parentElement=null;}
 replaceChildren(...nodes:ElementStub[]){this.children.forEach(node=>node.parentElement=null);this.children=[];this.append(...nodes);}
 querySelector(selector:string){return this.all().find(node=>'#'+node.id===selector)??null;}
 setAttribute(name:string,value:string){this.attributes.set(name,value);}
 get childNodes(){return this.children;}
 get options(){return this.all().filter(node=>node.tagName==='OPTION');}
 click(){if(!this.disabled)this.onclick?.();}
}
class DocumentStub extends EventTarget {
 body=new ElementStub('BODY');documentElement={lang:'en'};
 createElement(tag:string){return new ElementStub(tag.toUpperCase());}
 getElementById(id:string){return this.body.all().find(node=>node.id===id)??null;}
}
const hash=(char:string)=>char.repeat(64);
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
let owner:ReturnType<typeof mountFieldConditionalEvidence>|undefined;
afterEach(()=>{owner?.dispose();owner=undefined;vi.unstubAllGlobals();vi.restoreAllMocks();for(const mock of Object.values(session))mock.mockReset();setLocale('en',false);});

function fixture(count=3) {
 const doc=new DocumentStub(),inspector=doc.createElement('aside');doc.body.append(inspector);
 vi.stubGlobal('document',doc);vi.stubGlobal('Element',class {});vi.stubGlobal('Node',class {static TEXT_NODE=3;});
 const scene=syntheticDialogue(),sources={'flevel.lgp':EN_FIELD_SHA,maplist:EN_MAPLIST_SHA};
 const input={fields:{pack:{version:6,scriptDecoder:CMUSC8_CFG,archive:'flevel.lgp',sources},nodes:new Map([[0,{id:0,name:'synth',status:'available'}]])},fieldId:0,generation:1,mesh:null,contextSHA256:hash('a'),walkmeshSHA256:hash('a'),meshSHA256:hash('a'),dialogue:{scene,sha256:hash('d'),generation:1,contextSHA256:hash('a'),sources,mode:'metadata-only'}} as unknown as FieldEventInput;
 const originalRows:FieldEventRow[]=scene.records.map(record=>({key:(record.opcode===64||record.opcode===72?'dialogue:':record.opcode<=3?'request:':'condition:')+record.offset,
  channel:record.opcode===64||record.opcode===72?'dialogue':record.opcode<=3?'request':'condition',kind:record.opcode===64?'MESSAGE':record.opcode===72?'ASK':record.opcode===3?'REQEW':'IFUB',
  offset:record.offset,section:1,owners:record.owners.map(i=>scene.entries[i]),geometry:'no_geometry',candidates:[],record}));
 const gameRows:FieldEventRow[]=Array.from({length:count},(_,n)=>({key:'gameplay:original-'+n,channel:'gameplay',kind:n%3===0?'item':n%3===1?'materia':'battle',offset:200+n,section:1,owners:[scene.entries[0],scene.entries[1]],geometry:'no_geometry',candidates:[],
  record:{id:'original-'+n,kind:n%3===0?'item':n%3===1?'materia':'battle',offset:200+n,opcode:n%3===0?88:n%3===1?91:112,raw:'',owners:[scene.entries[0],scene.entries[1]],operands:[],status:'static',position:null,flagLinks:[]}}));
 const line:FieldEventRow={key:'interaction:line',channel:'interaction',kind:'line',offset:900,section:1,owners:[scene.entries[0]],geometry:'surface',candidates:[12,13],record:{}} as unknown as FieldEventRow;
 const rows=[...originalRows,...gameRows,line];
 let current:FieldEventIndex={input,rows,problems:[],section1SHA256:hash('a'),section8SHA256:hash('a'),query:()=>rows,relations:()=>[{row:line,relation:'same_actor'}]};
 const select=vi.fn();session.analyze.mockImplementation(()=>Promise.resolve(makeResult(current)));
 owner=mountFieldConditionalEvidence({select,current:()=>current});doc.body.append(owner.element as unknown as ElementStub);
 const node=(id:string)=>{const found=doc.getElementById(id);if(!found)throw Error('Missing element '+id);return found;};
 return {doc,node,rows,gameRows,line,select,inspector,current:()=>current,
  result:()=>makeResult(current),
  async open(id='field-conditional-evidence'){node(id).open=true;node(id).dispatchEvent(new Event('toggle'));await tick();},
  close(id='field-conditional-evidence'){node(id).open=false;node(id).dispatchEvent(new Event('toggle'));},
  filter(name:string,value:string,prefix='field-conditional'){const control=node(prefix+'-'+name);control.value=value;(control.onchange??control.oninput)?.();},
  replace(partial:Partial<FieldEventInput>={}){current={...current,input:{...current.input,...partial}};owner!.refresh(current);},
  setCurrent(value:FieldEventIndex|null){current=value as FieldEventIndex;},
  inspect(row=gameRows[0]){owner!.inspect(inspector as unknown as HTMLElement,row);},
 };
}
function makeResult(index:FieldEventIndex):ConditionalResult {
 const scene=index.input.dialogue!.scene,events=index.rows.filter(row=>['dialogue','request','gameplay'].includes(row.channel)).map(row=>({key:row.key,offset:row.offset,opcode:row.record.opcode!,kind:(row.kind==='item'?'STITM':row.kind==='materia'?'SMTRA':row.kind==='battle'?'BATTLE':row.kind) as ConditionalResult['events'][number]['kind'],owners:[...row.owners],owningRoots:[...new Set(row.owners.map(o=>o.entry))],entryReachable:row.offset!==123}));
 const controls:ConditionalResult['controls']=events.filter(e=>e.entryReachable&&e.kind!=='ASK'&&e.kind!=='REQEW').map(event=>({root:106,ifOffset:113,successor:119,successors:[119,129],targetOffset:event.offset,standard:true,strong:true,core:event.owningRoots.length===1,basis:{targetPostdominatesSuccessor:true,targetPostdominatesIf:false,ifDominatesTarget:true}}));
 return {status:'complete',complete:true,identity:{analysisRevision:'synthetic-1',decoder:CMUSC8_CFG,generation:index.input.generation,fieldId:0,fieldName:'synth',contextSHA256:index.input.contextSHA256,dialogueSHA256:index.input.dialogue!.sha256,gameplaySHA256:null,memberSHA256:scene.memberSHA256,section1SHA256:scene.section1SHA256,section5SHA256:scene.section5SHA256,section8SHA256:scene.section8SHA256},problems:[],
  roots:[{entry:106,aliases:[scene.entries[0],scene.entries[1]],status:'accepted',reason:null,nodes:6,edges:5},{entry:119,aliases:[scene.entries[2]],status:'accepted',reason:null,nodes:2,edges:1},{entry:130,aliases:[scene.entries[3]],status:'rejected',reason:'cycle',nodes:2,edges:2},{entry:150,aliases:[{...scene.entries[0],actor:1,entry:150}],status:'rejected',reason:'root_node_limit',nodes:3,edges:3}],events,controls,
  askLinks:[{root:106,askOffset:106,ifOffset:113,bank:5,address:7,width:1,status:'local',reason:null,corridor:[]}],requestLinks:[{sourceOffset:130,opcode:3,priority:6,sourceOwners:[scene.entries[3]],targetActor:0,slot:1,targetEntry:106,status:'resolved',targetEventOffsets:[119,200]}],
  stats:{complete:true,nodes:12,edges:11,rawRoots:4,aliases:5,acceptedRoots:2,rejectedRoots:2,qualifiedRoots:2,cyclicRoots:1,rootVisits:12,maxRootNodes:6,peakBitsetBytes:20,operations:60,relations:controls.length,standardRelations:controls.length,strongRelations:controls.length,coreRelations:controls.filter(c=>c.core).length,coreEvents:controls.filter(c=>c.core).length,eventCounts:{},ifCounts:{},qualifiedIfs:1,askCandidates:1,askLocalPairs:1,requestCount:1,requestTargets:1,requestEventPairs:2}};
}
const combinedText=(node:ElementStub)=>[node,...node.all()].map(n=>n.textContent).join('\n');

describe('lazy Conditional Evidence UI',()=>{
 it('does no analysis until expanded and shares one session between panel and Inspector',async()=>{
  const f=fixture();expect(session.create).toHaveBeenCalledOnce();expect(session.analyze).not.toHaveBeenCalled();expect(f.node('field-conditional-evidence').open).toBe(false);
  f.inspect();expect(f.node('field-conditional-inspection').open).toBe(false);expect(session.analyze).not.toHaveBeenCalled();
  await f.open('field-conditional-inspection');expect(session.analyze).toHaveBeenCalledOnce();await f.open();expect(session.analyze).toHaveBeenCalledOnce();
  expect(f.node('field-conditional-evidence').dataset.rawRoots).toBe('4');expect(f.node('field-conditional-evidence').dataset.events).toBe('7');
 });
 it('paginates at 50 and filters IF, kind, Actor and raw Entry independently',async()=>{
  const f=fixture(113);await f.open();expect(f.node('field-conditional-results').children).toHaveLength(50);
  f.node('field-conditional-next').click();expect(f.node('field-conditional-results').children).toHaveLength(50);f.node('field-conditional-next').click();expect(f.node('field-conditional-results').children).toHaveLength(14);
  f.filter('targetKind','STITM');expect(f.node('field-conditional-results').children).toHaveLength(38);f.filter('ifOffset','0x71');expect(f.node('field-conditional-results').children).toHaveLength(38);
  f.filter('entry','106');f.filter('actor','0');expect(f.node('field-conditional-results').children).toHaveLength(38);f.filter('actor','1');expect(f.node('field-conditional-results').children).toHaveLength(0);
  f.filter('actor','0');f.filter('ifOffset','114');expect(f.node('field-conditional-results').children).toHaveLength(0);f.filter('ifOffset','-1');expect(f.node('field-conditional-status').textContent).toBe(dictionaries.en['conditional.invalid']);
 });
 it.each([['item','STITM'],['materia','SMTRA'],['battle','BATTLE']])('keeps %s Inspector mapped to the original %s event key',async(original,canonical)=>{
  const f=fixture(),row=f.gameRows.find(r=>r.kind===original)!;f.inspect(row);await f.open('field-conditional-inspection');
  expect(f.node('field-conditional-inspection-results').children).toHaveLength(1);expect(f.node('field-conditional-inspection-results').children[0].textContent).toContain(canonical);
  f.node('field-conditional-inspection-results').children[0].click();expect(f.select).toHaveBeenCalledWith(row);
  f.filter('level','direct','field-conditional-inspection');expect(f.node('field-conditional-inspection-results').children).toHaveLength(1);
 });
 it('retains exact original selection, two raw successors, Dom/Pdom, source SHA and all-owner roots',async()=>{
  const f=fixture();await f.open();f.filter('targetKind','MESSAGE');const before=JSON.stringify(f.rows);f.node('field-conditional-results').children[0].click();
  expect(f.select).toHaveBeenCalledWith(f.rows.find(r=>r.offset===119));const detail=combinedText(f.node('field-conditional-detail'));
  expect(detail).toContain('119 (0x77) / 129 (0x81)');expect(detail).toContain('Post-dominance');expect(detail).toContain('Dominance');expect(detail).toContain('"entry": 119');expect(detail).toContain('"section1SHA256"');expect(detail).toContain(hash('a'));
  expect(JSON.stringify(f.rows)).toBe(before);expect(f.line.candidates).toEqual([12,13]);expect(combinedText(f.node('field-conditional-evidence'))).not.toContain('900 (');
  expect(detail).not.toContain('"candidates"');expect(detail).not.toContain('"position"');
 });
 it('keeps direct, existing witness, strong, core, candidate, unknown and rejected semantics separate',async()=>{
  const f=fixture();await f.open();f.filter('targetKind','MESSAGE');f.filter('level','witness');expect(f.node('field-conditional-results').children).toHaveLength(1);f.node('field-conditional-results').children[0].click();
  expect(combinedText(f.node('field-conditional-detail'))).toContain(dictionaries.en['conditional.witnessNote']);
  f.filter('level','strong');expect(f.node('field-conditional-results').children).toHaveLength(1);f.filter('level','core');expect(f.node('field-conditional-results').children).toHaveLength(0);
  f.filter('level','direct');expect(f.node('field-conditional-results').children).toHaveLength(2);f.filter('level','candidate');expect(f.node('field-conditional-results').children).toHaveLength(1);
  f.filter('targetKind','');f.filter('level','unknown');expect(f.node('field-conditional-results').children).toHaveLength(1);expect(f.node('field-conditional-results').children[0].textContent).toContain('root_node_limit');
  f.filter('level','rejected');expect(f.node('field-conditional-results').children).toHaveLength(1);expect(f.node('field-conditional-results').children[0].textContent).toContain('cycle');
 });
 it('retains direct source and the unchanged dialogue witness when strict analysis is unavailable',async()=>{
  const f=fixture();session.analyze.mockResolvedValue({ ...f.result(),status:'unavailable',complete:false,identity:null,events:[],controls:[],roots:[],askLinks:[],requestLinks:[],problems:['legacy_decoder'] });await f.open();
  expect(f.node('field-conditional-status').textContent).toContain(dictionaries.en['conditional.unavailable']);f.filter('targetKind','MESSAGE');f.filter('level','direct');expect(f.node('field-conditional-results').children).toHaveLength(2);
  f.filter('level','witness');expect(f.node('field-conditional-results').children).toHaveLength(1);f.filter('level','strong');expect(f.node('field-conditional-results').children).toHaveLength(0);
 });
 it('keeps ASK and REQ in independent conservative partitions and opens original target events',async()=>{
  const f=fixture();await f.open();expect(f.node('field-conditional-ask-results').children).toHaveLength(1);expect(f.node('field-conditional-request-results').children).toHaveLength(1);
  f.node('field-conditional-ask-results').children[0].click();expect(combinedText(f.node('field-conditional-ask'))).toContain('"bank": 5');expect(combinedText(f.node('field-conditional-ask'))).toContain(dictionaries.en['conditional.askLimit']);
  f.node('field-conditional-request-results').children[0].click();expect(combinedText(f.node('field-conditional-request'))).toContain(dictionaries.en['conditional.requestLimit']);
  expect(combinedText(f.node('field-conditional-request'))).toContain(dictionaries.en['conditional.requestSourceEvidence']+' · '+dictionaries.en['conditional.empty']);
  expect(f.node('field-conditional-request').all().filter(n=>n.dataset.requestTargetEvidence).map(n=>n.dataset.requestTargetEvidence)).toEqual(['strong','core']);
  const target=f.node('field-conditional-request').all().find(n=>n.tagName==='BUTTON'&&n.textContent.endsWith('@ 200 (0xc8)'))!;target.click();expect(f.select).toHaveBeenCalledWith(f.gameRows[0]);
  expect(f.node('field-conditional-results').children.some(n=>n.textContent.includes('IF 130'))).toBe(false);
 });
 it('reuses equivalent resource wrappers but invalidates changed related SHA/scene and decoder metadata',async()=>{
  const f=fixture();await f.open();const old=f.current().input;
  f.replace({dialogue:{...old.dialogue!}});await tick();expect(session.analyze).toHaveBeenCalledOnce();
  f.replace({script:{scene:{},sha256:hash('b'),sources:{},decoder:CMUSC8_CFG,contextSHA256:hash('a')} as FieldEventInput['script']});await tick();expect(session.analyze).toHaveBeenCalledTimes(2);
  f.replace({script:{...f.current().input.script!,sha256:hash('c')}});await tick();expect(session.analyze).toHaveBeenCalledTimes(3);
  f.replace({interaction:{scene:{},sha256:hash('e'),sources:{}} as FieldEventInput['interaction']});await tick();expect(session.analyze).toHaveBeenCalledTimes(4);
  f.replace({fields:{...old.fields,pack:{...old.fields.pack,version:5}} as unknown as FieldEventInput['fields']});await tick();expect(session.analyze).toHaveBeenCalledTimes(5);expect(f.node('field-conditional-results').children).toHaveLength(0);expect(f.node('field-conditional-status').textContent).toBe(dictionaries.en['conditional.error']);
 });
 it('cancels only when the last open view closes and ignores its late result',async()=>{
  const f=fixture();let finish!:(r:ConditionalResult)=>void;session.analyze.mockImplementation(()=>new Promise(r=>finish=r));
  f.inspect();await f.open();await f.open('field-conditional-inspection');expect(session.analyze).toHaveBeenCalledOnce();f.close();expect(session.cancel).not.toHaveBeenCalled();
  f.close('field-conditional-inspection');expect(session.cancel).toHaveBeenCalledOnce();finish(f.result());await tick();expect(f.node('field-conditional-results').children).toHaveLength(0);
 });
 it('clears a detached Inspector without clearing completed current-Field evidence',async()=>{
  const f=fixture();f.inspect();await f.open('field-conditional-inspection');owner!.clearInspection();expect(f.doc.getElementById('field-conditional-inspection')).toBeNull();
  await f.open();expect(session.analyze).toHaveBeenCalledOnce();expect(f.node('field-conditional-results').children.length).toBeGreaterThan(0);
 });
 it('preserves an open same-row Inspector and shared pending analysis on a parent redraw',async()=>{
  const f=fixture();let finish!:(r:ConditionalResult)=>void;session.analyze.mockImplementation(()=>new Promise(r=>finish=r));f.inspect();await f.open('field-conditional-inspection');
  f.inspect();expect(f.node('field-conditional-inspection').open).toBe(true);expect(session.cancel).not.toHaveBeenCalled();expect(session.analyze).toHaveBeenCalledOnce();
  finish(f.result());await tick();expect(f.node('field-conditional-inspection-results').children).toHaveLength(1);
 });
 it('cancels an open pending Inspector when a different event replaces it with a collapsed view',async()=>{
  const f=fixture();let finish!:(r:ConditionalResult)=>void;session.analyze.mockImplementation(()=>new Promise(r=>finish=r));f.inspect();await f.open('field-conditional-inspection');
  f.inspect(f.gameRows[1]);expect(f.node('field-conditional-inspection').open).toBe(false);expect(session.cancel).toHaveBeenCalledOnce();finish(f.result());await tick();expect(f.node('field-conditional-inspection-results').children).toHaveLength(0);
 });
 it('keeps main-panel analysis running when a pending Inspector changes events',async()=>{
  const f=fixture();let finish!:(r:ConditionalResult)=>void;session.analyze.mockImplementation(()=>new Promise(r=>finish=r));f.inspect();await f.open();await f.open('field-conditional-inspection');
  f.inspect(f.gameRows[1]);expect(session.cancel).not.toHaveBeenCalled();expect(f.node('field-conditional-inspection').open).toBe(false);finish(f.result());await tick();expect(f.node('field-conditional-results').children.length).toBeGreaterThan(0);
 });
 it('cancels pending Inspector work on text-view cleanup and ignores its late completion',async()=>{
  const f=fixture();let finish!:(r:ConditionalResult)=>void;session.analyze.mockImplementation(()=>new Promise(r=>finish=r));f.inspect();await f.open('field-conditional-inspection');
  owner!.clearInspection();expect(session.cancel).toHaveBeenCalledOnce();finish(f.result());await tick();expect(f.node('field-conditional-results').children).toHaveLength(0);expect(f.doc.getElementById('field-conditional-inspection')).toBeNull();
 });
 it('does not publish a replaced generation or a different source identity',async()=>{
  const f=fixture();let finish!:(r:ConditionalResult)=>void;session.analyze.mockImplementationOnce(()=>new Promise(r=>finish=r));await f.open();const old=f.result();f.close();f.replace({generation:2});finish(old);await tick();expect(f.node('field-conditional-results').children).toHaveLength(0);
  session.analyze.mockResolvedValue({...f.result(),identity:{...f.result().identity!,section8SHA256:hash('f')}});await f.open();expect(f.node('field-conditional-status').textContent).toBe(dictionaries.en['conditional.error']);expect(f.node('field-conditional-results').children).toHaveLength(0);
 });
 it('reports worker failure instead of idle and allows explicit retry after collapse',async()=>{
  const f=fixture();session.analyze.mockResolvedValueOnce(null);await f.open();expect(f.node('field-conditional-status').textContent).toBe(dictionaries.en['conditional.error']);expect(f.node('field-conditional-evidence').dataset.state).toBe('error');
  f.close();await f.open();expect(session.analyze).toHaveBeenCalledTimes(2);expect(f.node('field-conditional-evidence').dataset.state).toBe('complete');
 });
 it('never invokes a stale original selection after its current source changes',async()=>{
  const f=fixture();await f.open();const stale=f.node('field-conditional-results').children[0];f.setCurrent({...f.current(),input:{...f.current().input,generation:8}});stale.click();expect(f.select).not.toHaveBeenCalled();
 });
 it('invalidates private DOM and stops pending work on unload/dispose',async()=>{
  const f=fixture();let finish!:(r:ConditionalResult)=>void;session.analyze.mockImplementation(()=>new Promise(r=>finish=r));await f.open();const old=f.result();f.inspect();owner!.invalidate();finish(old);await tick();
  expect(f.node('field-conditional-results').children).toHaveLength(0);expect(f.doc.getElementById('field-conditional-inspection')).toBeNull();expect(session.invalidate).toHaveBeenCalledOnce();owner!.dispose();expect(session.dispose).toHaveBeenCalledOnce();expect(f.doc.getElementById('field-conditional-evidence')).toBeNull();
 });
 it.each(locales)('localizes every tier and uncertainty boundary in %s',async language=>{
  const f=fixture();await f.open();setLocale(language,false);expect(f.node('field-conditional-evidence').children[0].textContent).toBe(dictionaries[language]['conditional.title']);
  for(const key of ['direct','witness','strong','core','candidate','unknown','rejected'])expect(f.node('field-conditional-level').options.find(o=>o.value===key)?.textContent).toBe(dictionaries[language]['conditional.'+key]);
  expect(combinedText(f.node('field-conditional-evidence'))).toContain(dictionaries[language]['conditional.limit']);expect(combinedText(f.node('field-conditional-request'))).toContain(dictionaries[language]['conditional.requestLimit']);
 });
 it('provides all five catalog columns with identical placeholders and no duplicate keys',()=>{
  expect(new Set(fieldConditionalCatalog.map(row=>row[0])).size).toBe(fieldConditionalCatalog.length);
  for(const row of fieldConditionalCatalog){expect(row).toHaveLength(6);for(const translation of row.slice(1)){expect(translation.trim()).not.toBe('');expect([...translation.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort()).toEqual([...row[1].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort());}}
 });
});
