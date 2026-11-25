// SPDX-License-Identifier: GPL-3.0-only
import {appStore} from '../app/state';
import {navigationEntries} from '../app/navigation';
import type {NavigationEntry} from '../app/navigation';
import {beginEvidenceNavigation,beginPublicNavigation,browsingEvidence,evidenceStoryVisible} from '../app/evidenceSession';
import {ResourceScope} from '../app/resources';
import {encounterDiscovery,evidenceCategories,evidencePageSize,evidenceRank,evidenceResultLimit,evidenceTerms,findFieldEvidence,gameplayDiscovery,parseEvidenceQuery,verifiedFieldOwners} from '../analysis/evidenceDiscovery';
import type {EvidenceCategory,EvidenceQuery,EvidenceTarget} from '../analysis/evidenceDiscovery';
import type {GeographyTarget} from '../analysis/encounterGeography';
import type {FieldEventRow} from '../analysis/fieldEventEvidence';
import {dialogueOperand,requestDialogues} from '../data/fieldDialogue';
import {fieldAliases} from '../data/fieldContext';
import {filterLocation} from '../data/poi';
import type {LocationFilter} from '../data/poi';
import type {EncounterResource} from '../data/encounters';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import type {mountAtlas} from './atlas';
import type {mountFieldContext} from './fieldContext';
import type {mountLocations} from './locations';
import {locale,onLocaleChange,t} from '../i18n';

type FieldOwner=ReturnType<typeof mountFieldContext>;
type SceneRead=NonNullable<Awaited<ReturnType<FieldOwner['readEvidence']>>>;
interface RouteEvidence {
 match(target:GeographyTarget):{pieces:number;intervals:number;leg:number|null;range:string;family:string;open():boolean}|null;
 exploration?:{fields:readonly number[];entranceId:string;open(current?:()=>boolean):Promise<boolean>};
}
interface Ports {
 atlas:ReturnType<typeof mountAtlas>;
 fields:FieldOwner;
 locations?:ReturnType<typeof mountLocations>;
 viewer?:GaiaViewer;
 encounter():EncounterResource|null;
 route():RouteEvidence;
}
interface Row {
 key:string;
 target:EvidenceTarget;
 name:string;
 category:Exclude<EvidenceCategory,'all'>;
 grade:'world'|'context'|'table'|'field'|'script';
 terms?:string[];
 internal?:string;
 note?:string;
 origin?:FieldEventRow;
 navigation?:NavigationEntry;
}

function row(target:EvidenceTarget,name:string,category:Row['category'],grade:Row['grade'],note?:string):Row{
 const key=target.kind==='field'?JSON.stringify(target):target.kind==='navigation'?target.key:target.kind+':'+target.id;
 return {key,target,name,category,grade,note};
}

export function mountEvidenceDiscovery(ports:Ports){
 const scope=new ResourceScope();
 const input=document.getElementById('location-search') as HTMLInputElement,list=document.getElementById('location-results')!;
 const inspector=document.getElementById('integrated-inspector')!;
 const make=<K extends keyof HTMLElementTagNameMap>(tag:K,host:HTMLElement,text='')=>{const e=document.createElement(tag);e.textContent=text;host.append(e);return e;};
 const button=(host:HTMLElement,text:string,activate:()=>void)=>{const b=make('button',host,text);b.type='button';b.onclick=activate;return b;};
 const controls=document.createElement('div');controls.className='evidence-search-controls';input.after(controls);
 const label=make('label',controls),caption=make('span',label),category=make('select',label);
 category.id='evidence-search-category';
 for(const value of evidenceCategories){const option=make('option',category);option.value=value;}
 const status=make('p',controls);status.setAttribute('role','status');status.id='evidence-search-status';
 const paging=document.createElement('div');paging.className='guide-pages';list.after(paging);
 const detail=make('section',inspector);detail.id='evidence-discovery-inspector';detail.hidden=true;
 scope.own(()=>{controls.remove();paging.remove();detail.remove();});
 input.disabled=false;
 input.setAttribute('aria-describedby',status.id);
 input.maxLength=256;
 let results:Row[]=[],page=0,active=-1,shown=false,selected:string|null=null,detailsRow:Row|null=null;
 let revision=0,navigationTicket=0,timer:ReturnType<typeof setTimeout>|undefined,request=new AbortController();
 let scene:SceneRead|null=null,sceneId=-1;
 let catalog:Row[]=[],catalogRefs:unknown[]=[],stamp:unknown[]=[],gameplayLookup:ReturnType<typeof gameplayDiscovery>|null=null;
 let gameplayOwner:ReturnType<Ports['atlas']['gameplayEvidence']>=null;
 let encounterOwners:readonly unknown[]=[];
 let encounterLookup:ReturnType<typeof encounterDiscovery>|null=null;
 let catalogMs=0,queryMs=0;
 const storeFilter=document.getElementById('location-filter') as HTMLSelectElement;
 const story=()=>evidenceStoryVisible(ports.atlas.policy());
 const same=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((value,i)=>value===b[i]);
 const sources=()=>[ports.locations?.dataset(),ports.encounter(),...ports.fields.evidenceIdentity(),...ports.atlas.searchIdentity()];
 const world=()=>appStore.state.map.id==='WM0'&&appStore.state.view.spatial==='world'&&appStore.state.explorer.phase==='idle'&&!appStore.state.view.variantResearch;
 const clearDetail=()=>{navigationTicket++;detail.hidden=true;detail.replaceChildren();delete detail.dataset.evidenceKey;detailsRow=null;};
 const fieldNode=(id:number)=>ports.fields.evidenceDirectory()?.nodes.get(id);
 const closeList=()=>{list.replaceChildren();paging.replaceChildren();shown=false;active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
 function report(key:string){status.textContent=t('discovery.'+key);}

 function globalEntries(){
  const data=ports.atlas.gameplayEvidence(),fields=ports.fields.evidenceDirectory(),encounter=ports.encounter(),poi=ports.locations?.dataset();
  const refs=[data,fields,encounter,poi,locale(),ports.atlas.policy(),...ports.atlas.searchIdentity()];
  if(same(refs,catalogRefs))return catalog;
  const began=performance.now();catalogRefs=refs;
  if(data!==gameplayOwner){gameplayOwner=data;gameplayLookup=data?gameplayDiscovery(data):null;}
  if(!same(encounterOwners,[encounter,data])){encounterOwners=[encounter,data];encounterLookup=encounter?encounterDiscovery(encounter,data):null;}
  const rows:Row[]=[];
  const add=(entry:Row,aliases:string[]=[],internal='')=>{entry.terms=evidenceTerms([entry.name,...aliases]);entry.internal=internal;rows.push(entry);};
  const places=new Map(poi?.locations.map(p=>[p.id,p]));
  for(const p of places.values())add(row({kind:'location',id:p.id},p.display_name,'places','world'),[...p.aliases,...p.field_names]);
  for(const e of poi?.entrances??[]){
   const place=places.get(e.location_id)!;
   add(row({kind:'entrance',id:e.id},place.display_name+' · '+e.field_name,'places','world',e.id),[place.display_name,e.field_name,...place.aliases],e.id);
  }
  for(const e of ports.atlas.searchCatalog())add(row({kind:'atlas',id:e.id},e.name,'places',e.precision==='entrance'?'world':'context',t('guide.'+e.precision)),e.aliases,e.id);
  for(const f of fields?.nodes.values()??[]){
   const parents=poi?.entrances.filter(e=>e.field_id===f.id).flatMap(e=>{const p=places.get(e.location_id);return p?[p.display_name,...p.aliases]:[];})??[];
   add(row({kind:'field',id:f.id},f.name+' / '+f.id,'fields','context',t('field.'+f.status)),[...fieldAliases(f,fields!.pack),...parents],f.name);
  }
  if(data){
   for(const kind of ['item','materia'] as const)for(const [id,name]of (kind==='item'?data.items:data.materia)){
    add(row({kind,id},story()?name+' · '+id:t('gameplay.'+kind)+' '+id,'gameplay','script'));
   }
   for(const f of data.formations.values()){
    const names=story()?f.enemyIds.flatMap(id=>{const e=data.enemies.get(f.sceneId+'/'+id);return e?[e.name]:[];}):[];
    add(row({kind:'formation',id:f.id},t('neoContent.formation',{id:f.id}),'gameplay','table',t('neoContent.scene',{id:f.sceneId})+' / '+f.slot),names);
   }
   for(const [id,e]of data.enemies)add(row({kind:'enemy',id},story()?e.name+' · '+id:t('encgeo.enemy')+' '+id,'gameplay','table'));
  }
  for(const set of encounterLookup?.sets.values()??[])add(row({kind:'set',id:set.id},t('encgeo.set')+' '+set.id,'encounters','table'));
  catalog=rows;catalogMs=performance.now()-began;return rows;
 }
 function registryEntries(){
  return navigationEntries().filter(e=>!['location','entrance','atlas','field','gameplay'].includes(e.kind)).map(entry=>{
   const value=row({kind:'navigation',key:entry.kind+':'+entry.id},entry.name,'places',entry.precision==='verified_anchor'||entry.precision==='exact_source'?'world':'context');
   value.navigation=entry;value.terms=evidenceTerms([entry.name,...entry.aliases]);return value;
  });
 }
 function allowed(row:Row){
  const filter=category.value as EvidenceCategory;
  if(filter!=='all'&&row.category!==filter&&(filter!=='encounters'||!['formation','enemy'].includes(row.target.kind)))return false;
  if(storeFilter.value==='all'||row.target.kind!=='location')return true;
  const id=row.target.id,location=ports.locations?.dataset()?.locations.find(l=>l.id===id);
  return !!location&&filterLocation(location,storeFilter.value as LocationFilter);
 }
 function fieldRow(fieldId:number,r:FieldEventRow){
  const original=r.owners.map(o=>'A'+o.actor+'/S'+o.slot+'/'+o.kind+'@'+o.entry).join(' · ');
  const text=r.channel==='dialogue'?dialogueOperand(r.record as Parameters<typeof dialogueOperand>[0]).textId:undefined;
  const value=row({kind:'field',id:fieldId,record:{kind:'row',key:r.key}},r.kind+' @ '+r.offset+(text===undefined?'':' · Text '+text),'scripts',r.geometry==='surface'?'field':'script',
   'Section '+r.section+(original?' · '+original:'')+(r.geometry==='no_geometry'?'':' · '+t('evgeo.'+r.geometry)));
  value.origin=r;
  return value;
 }
 function localRows(data:SceneRead,q:Extract<EvidenceQuery,{type:'field'}>){
  const i=data.index,id=i.input.fieldId,k=q.key,filter=q.aliases,f=fieldNode(id)!;
  const out:Row[]=[];
  if(k?.kind==='triangle'&&i.input.mesh&&k.id<i.input.mesh.triangles)out.push(row({kind:'field',id,record:{kind:'triangle',id:k.id}},t('nav39.triangle',{id:k.id}),'fields','field'));
  if(k?.kind==='gateway'){
   const g=i.input.fields.pack.gateways?.find(g=>g.fromField===id&&g.gateway===k.id);
   if(g)out.push(row({kind:'field',id,record:{kind:'gateway',id:g.gateway}},'G'+g.gateway+' → '+g.to+'/'+g.targetTriangle,'fields',i.input.mesh?'field':'context',
    'Section 8 @ '+g.offset+' · '+t('anchors.'+g.sourceRelation)+' · '+g.destination.status));
   return out;
  }
  if(!k&&Object.keys(filter).length){
   const owners=verifiedFieldOwners(i).filter(o=>(filter.actor===undefined||filter.actor===o.actor)&&(filter.slot===undefined||filter.slot===o.slot)&&(filter.entry===undefined||filter.entry===o.entry)&&(filter.ownerKind===undefined||filter.ownerKind===o.kind));
   if(filter.entry!==undefined&&filter.actor===undefined&&filter.slot===undefined&&filter.ownerKind===undefined&&owners.length)out.push(row({kind:'field',id,record:{kind:'owner',entry:filter.entry}},t('discovery.root')+' '+filter.entry,'scripts','script'));
   for(const o of owners)out.push(row({kind:'field',id,record:{kind:'owner',actor:o.actor,slot:o.slot,ownerKind:o.kind,entry:o.entry}},'A'+o.actor+' / S'+o.slot+' / '+o.kind+' @ '+o.entry,'scripts','script',f.name));
  }
  const rows=findFieldEvidence(i,q);
  for(const r of rows)out.push(fieldRow(id,r));
  if(k?.kind==='instruction'&&!rows.length&&!Object.keys(filter).length&&!i.problems.includes('dialogue')){
   const boundary=i.input.dialogue?.scene.cfg.find(r=>r[0]===k.id);
   if(boundary)out.push(row({kind:'field',id,record:{kind:'instruction',offset:k.id,opcode:boundary[1]}},'0x'+boundary[1].toString(16)+' @ '+k.id,'scripts','script',t('dlg.noOwner')));
  }
  return out;
 }
 function channels(data:SceneRead,q:Extract<EvidenceQuery,{type:'field'}>){
  const i=data.index,k=q.key?.kind,missing=new Set<string>();
  if(!i.input.mesh&&['triangle','gateway','line','trigger'].includes(k??''))missing.add('walkmesh');
  if(!i.input.interaction&&['line','trigger','triangle'].includes(k??''))missing.add('interaction');
  if(!i.input.dialogue&&['text','req','if','ask','dialogue','instruction'].includes(k??''))missing.add('dialogue');
  if(!i.input.gameplay&&k==='event')missing.add('gameplay');
  if(!k||k==='instruction'){
   for(const channel of ['dialogue','interaction','script','gameplay'] as const)if(!i.input[channel])missing.add(channel);
  }
  return [...new Set([...data.rejected,...i.problems])].map(channel=>t('discovery.conflict')+' · '+channel)
   .concat([...missing].filter(c=>!data.rejected.includes(c)).map(channel=>t('discovery.unavailable')+' · '+channel));
 }
 function renew(){
  revision++;request.abort();request=new AbortController();clearTimeout(timer);
 }
 async function search(){
  const started=performance.now(),attempt=revision,signal=request.signal,identity=sources();
  const current=()=>!scope.disposed&&!signal.aborted&&attempt===revision&&same(identity,sources());
  const query=parseEvidenceQuery(input.value);
  results=[];active=-1;render();
  if(query.type==='error'){report(query.reason==='category'?'chooseType':query.reason);return;}
  let candidates:Row[]=[],statusText='',complete=true;
  const all=globalEntries();
  try{
   if(query.type==='name'){
    const ranked=[...all,...registryEntries()].filter(allowed).map(r=>({r,rank:evidenceRank(query.name,r.internal??'',r.terms??[])}));
    candidates=ranked.filter(r=>Number.isFinite(r.rank)).sort((a,b)=>a.rank-b.rank||a.r.name.localeCompare(b.r.name,locale())||a.r.key.localeCompare(b.r.key)).map(r=>r.r);
    statusText=t(ports.locations?.dataset()?'discovery.directory':'discovery.public');
   }else if(query.type==='global'){
    if(query.kind==='face'){
     const mesh=ports.viewer?.mesh,n=Number(query.id);
     if(mesh&&n<mesh.sourceTriangleCount)candidates=[row({kind:'face',id:n},t('discovery.face')+' '+n,'places','world')];
     else if(!mesh){complete=false;statusText=t('discovery.unavailable');}
    }else{
     candidates=all.filter(r=>r.key===query.kind+':'+query.id);
     const noSource=query.kind==='set'?!ports.encounter():['location','entrance','atlas'].includes(query.kind)?query.kind!=='atlas'&&!ports.locations?.dataset():!ports.atlas.gameplayEvidence();
     if(noSource){complete=false;statusText=t('discovery.unavailable');}
    }
   }else{
    const fields=ports.fields.evidenceDirectory(),id=/^\d+$/.test(query.field)?Number(query.field):undefined;
    const node=id===undefined?[...fields?.nodes.values()??[]].find(f=>f.name.toLowerCase()===query.field):fields?.nodes.get(id);
    if(!fields){complete=false;statusText=t('discovery.unavailable');}
    if(node){
     const scoped=!!query.key||Object.keys(query.aliases).length>0||category.value==='scripts';
     if(!scoped)candidates=[row({kind:'field',id:node.id},node.name+' / '+node.id,'fields','context',t('field.'+node.status))];
     else{
      report('loading');
      if(sceneId!==node.id||!scene?.current()){
       const next=await ports.fields.readEvidence(node.id,signal);
       if(!current())return;
       const ownBytes=next?next.index.rows.reduce((sum,row)=>sum+128+row.key.length*2+row.owners.length*24+row.candidates.length*4,0):0;
       status.dataset.sceneIndexBytes=String(ownBytes);
       if(ownBytes>8*1024*1024){scene=null;sceneId=-1;report('limit');return;}
       scene=next;sceneId=node.id;
      }
      if(scene){
       candidates=localRows(scene,query);
       const diagnostics=channels(scene,query);
       complete=!diagnostics.length;
       statusText=[node.name+' / '+node.id,...diagnostics].join(' · ');
       status.dataset.decodeMs=String(scene.milliseconds);
      }else{complete=false;statusText=t('discovery.unavailable');}
     }
    }
   }
  }catch{
   if(current())report('conflict');return;
  }
  if(!current())return;
  const unique=new Map<string,Row>();
  for(const r of candidates)if(allowed(r)&&!unique.has(r.key))unique.set(r.key,r);
  results=[...unique.values()].slice(0,evidenceResultLimit);queryMs=performance.now()-started;
  status.dataset.catalogMs=String(catalogMs);status.dataset.queryMs=String(queryMs);status.dataset.candidates=String(unique.size);
  status.textContent=[statusText,unique.size>evidenceResultLimit?t('discovery.limited'):results.length?t('discovery.matches',{count:results.length}):complete?t('ui.noMatches'):''].filter(Boolean).join(' · ');
  render();
 }
 function schedule(reset=true){
  renew();if(reset)page=0;
  if(!shown)return;
  if(!input.value.trim()){results=[];status.dataset.candidates='0';report('hint');render();return;}
  const immediate=input.value.includes(':');
  if(immediate)void search();else timer=setTimeout(()=>void search(),150);
 }
 function render(){
  if(!shown)return;
  list.replaceChildren();paging.replaceChildren();input.setAttribute('aria-expanded',String(results.length>0));input.removeAttribute('aria-activedescendant');
  const pages=Math.max(1,Math.ceil(results.length/evidencePageSize));
  page=Math.min(page,pages-1);const slice=results.slice(page*evidencePageSize,(page+1)*evidencePageSize);
  for(const [i,r]of slice.entries()){
   const b=button(list,r.name+' · '+t('discovery.'+r.category),()=>choose(r));
   b.className='location-result';b.id='location-result-'+i;b.dataset.navigationId=r.target.kind==='atlas'?'atlas:'+r.target.id:r.key;
   b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===active||r.key===selected));b.tabIndex=-1;
  }
  if(pages>1){
   button(paging,t('guide.previous'),()=>{page--;active=-1;render();}).disabled=page===0;
   make('span',paging,t('guide.page',{page:page+1,pages}));
   button(paging,t('guide.next'),()=>{page++;active=-1;render();}).disabled=page===pages-1;
  }
 }
 function returnToSearch(){
  clearDetail();shown=true;
  document.dispatchEvent(new CustomEvent('gaiagis:open-area',{detail:{area:'world'}}));
  input.focus({preventScroll:true});input.scrollIntoView({block:'nearest'});
  if(results.length)render();else schedule(false);
  const pos=results.findIndex(r=>r.key===selected);
  if(pos>=0){page=Math.floor(pos/evidencePageSize);active=pos%evidencePageSize;render();highlight();}
 }
 function changeNavigation(privateResult:boolean){
  if(privateResult)beginEvidenceNavigation();
  else{
   if(browsingEvidence())appStore.dispatch({type:'select',selection:null});
   beginPublicNavigation();
  }
  document.dispatchEvent(new Event('gaiagis:evidence-navigation'));
 }
 function ownerBack(host:HTMLElement|null){
  if(!host)return;
  host.querySelector(':scope > .evidence-owner-back')?.remove();
  const back=button(host,t('discovery.back'),returnToSearch);back.className='evidence-owner-back';host.prepend(back);
 }
 function choose(entry:Row){
  if(!same(stamp,sources())){invalidate();return;}
  selected=entry.key;
  const {target}=entry;
  if(target.kind==='location'&&world()||target.kind==='atlas'&&ports.atlas.searchCatalog().some(e=>e.id===target.id)||entry.navigation){
   changeNavigation(false);
   if(target.kind==='location')ports.locations?.openEvidence('location',target.id);
   if(target.kind==='atlas')ports.atlas.openEvidence(target.id);
   if(entry.navigation)entry.navigation.navigate();
   closeList();return;
  }
  changeNavigation(true);showDetails(entry);
 }
 function action(host:HTMLElement,label:string,run:(current:()=>boolean)=>void|boolean|Promise<boolean>){
  const bound=stamp,attempt=revision,generation=appStore.state.data.generation;
  return button(host,label,()=>{
   const ticket=++navigationTicket;
   const current=()=>!scope.disposed&&browsingEvidence()&&navigationTicket===ticket&&revision===attempt&&generation===appStore.state.data.generation&&same(bound,sources());
   if(!current()){report('conflict');return;}
   Promise.resolve(run(current)).then(ok=>{if(ok===false&&current())make('p',host,t('discovery.unavailable'));},()=>{if(current())make('p',host,t('discovery.conflict'));});
  });
 }
 function rowLink(host:HTMLElement,item:Row,label=item.name){
  action(host,label,()=>showDetails(item));
 }
 function showDetails(entry:Row){
  navigationTicket++;
  const {target}=entry;detailsRow=entry;
  detail.replaceChildren();detail.hidden=false;detail.dataset.evidenceKey=entry.key;
  const title=make('h3',detail,entry.name);title.tabIndex=-1;
  button(detail,t('discovery.back'),returnToSearch);
  make('p',detail,t('discovery.grade.'+entry.grade)+(entry.note?' · '+entry.note:''));
  if(target.kind==='atlas'){
   action(detail,t('guide.open'),()=>{if(!ports.atlas.openEvidence(target.id))return false;clearDetail();ownerBack(document.getElementById('selection-details'));return true;});
  }else if(target.kind==='location'||target.kind==='entrance'){
   action(detail,t('guide.fly'),()=>{const opened=ports.locations?.openEvidence(target.kind,target.id)??false;if(opened){clearDetail();ownerBack(document.getElementById('selection-details'));}return opened;}).disabled=!world();
   for(const e of ports.locations?.dataset()?.entrances??[])if(e.id===target.id||e.location_id===target.id){
    make('p',detail,e.id+' · FIELD.TBL '+e.field_table_record+' → '+e.field_id+'/'+e.field_triangle);
    const context=ports.fields.evidenceDirectory()?.pack.bindings.some(binding=>binding.entranceId===e.id&&binding.fieldId===e.field_id&&binding.status==='verified_direct');
    if(context)action(detail,t('nav39.openEntrance'),async current=>{
     if(!world()||!await ports.fields.openEvidenceEntrance(e.id,current))return false;
     if(current())clearDetail();return true;
    }).disabled=!world();
   }
  }else if(target.kind==='face'){
   action(detail,t('encRoute.source'),()=>{if(!world()||!ports.viewer||target.id>=ports.viewer.mesh.sourceTriangleCount)return false;ports.viewer.selectSource(target.id);clearDetail();ownerBack(document.getElementById('selection-details'));return true;}).disabled=!world();
  }else if(target.kind==='field'){
   action(detail,t(target.record?'discovery.openRecord':'field.openWorkspace'),async current=>{
    const opened=await ports.fields.openEvidence(target.id,target.record,{generation:appStore.state.data.generation,current},request.signal);
    if(opened&&current())clearDetail();
    return opened;
   });
   if(!target.record){
    action(detail,t('discovery.scopeField'),()=>{input.value='field:'+target.id;category.value='scripts';returnToSearch();schedule();});
    for(const g of ports.fields.evidenceDirectory()?.pack.gateways?.filter(g=>g.fromField===target.id).slice(0,12)??[]){
     const related=row({kind:'field',id:target.id,record:{kind:'gateway',id:g.gateway}},'G'+g.gateway+' @ '+g.offset+' → '+g.to+'/'+g.targetTriangle,'fields','context',t('anchors.'+g.sourceRelation));
     rowLink(detail,related);
    }
   }else if(entry.origin&&sceneId===target.id&&scene?.current()){
    const i=scene.index,r=entry.origin;
    make('p',detail,'Context SHA-256 '+i.input.contextSHA256+' · '+(r.section===8?i.section8SHA256:i.section1SHA256));
    if(r.channel==='condition'){make('p',detail,t('discovery.condition'));if(!i.problems.includes('dialogue'))make('p',detail,'CFG → '+(i.input.dialogue?.scene.cfg.find(x=>x[0]===r.offset)?.slice(4).join(' / ')??'—'));}
    for(const triangle of r.candidates.slice(0,12))rowLink(detail,row({kind:'field',id:target.id,record:{kind:'triangle',id:triangle}},t('nav39.triangle',{id:triangle}),'fields','field'));
    if(r.channel==='request'&&i.input.dialogue){
     const request=requestDialogues(i.input.dialogue.scene,r.record as Parameters<typeof requestDialogues>[1]);
    const dest=request.target;if(dest)make('p',detail,'A'+dest.actor+'/S'+dest.slot+' @ '+dest.entry+' · priority '+dialogueOperand(r.record as Parameters<typeof dialogueOperand>[0]).priority);
     for(const candidate of request.records.slice(0,12)){const result=i.rows.find(row=>row.key==='dialogue:'+candidate.offset);if(result)rowLink(detail,fieldRow(target.id,result),'REQ → '+result.kind+' @ '+result.offset);}
    }
    const relations=i.relations(r).sort((a,b)=>Number(b.row.geometry==='surface')-Number(a.row.geometry==='surface'));
    for(const related of relations.slice(0,12))rowLink(detail,fieldRow(target.id,related.row),t('evgeo.'+related.relation)+' · '+related.row.kind+' @ '+related.row.offset);
   }
   if(target.record?.kind==='triangle'&&sceneId===target.id&&scene?.current()){
    for(const contact of scene.index.query({triangle:target.record.id}).slice(0,12))rowLink(detail,fieldRow(target.id,contact));
   }
  }else if(target.kind==='item'||target.kind==='materia'){
   if(!story())make('p',detail,t('discovery.hidden'));
   else{
    const data=ports.atlas.gameplayEvidence(),ids=gameplayLookup?.acquisitions.get(target.kind+':'+target.id)??[];
    make('p',detail,t('discovery.matches',{count:ids.length}));
    for(const id of ids.slice(0,50)){
     const found=data?.records.get(id);if(!found)continue;
     rowLink(detail,row({kind:'field',id:found.scene.fieldId,record:{kind:'row',key:'gameplay:'+id}},found.scene.name+' · '+id,'scripts','script'));
    }
    const guides=data?.guideIds(ids.flatMap(id=>{const found=data.records.get(id);return found?[found.scene.fieldId]:[];}))??[];
    for(const guide of ports.atlas.searchCatalog().filter(e=>guides.includes(e.id)).slice(0,12))
     rowLink(detail,row({kind:'atlas',id:guide.id},guide.name,'places','context',t('guide.'+guide.precision)));
   }
  }else if(target.kind==='formation'||target.kind==='enemy'||target.kind==='set'){
   const query:GeographyTarget=target.kind==='enemy'?{kind:'enemy',sceneId:Number(target.id.split('/')[0]),enemyId:Number(target.id.split('/')[1])}:target;
   const relation=encounterLookup?.relations;
   if(target.kind==='set'||story()){
    const data=ports.atlas.gameplayEvidence();
    if(target.kind==='formation'){
     const formation=data?.formations.get(target.id);
     if(formation)for(const id of new Set(formation.enemyIds)){
      const key=formation.sceneId+'/'+id,enemy=data!.enemies.get(key);
      if(enemy)rowLink(detail,row({kind:'enemy',id:key},enemy.name+' · '+key,'gameplay','table'));
     }
    }
    if(target.kind==='enemy'){
     const scene=Number(target.id.split('/')[0]),enemy=Number(target.id.split('/')[1]);
     for(const f of [...data?.formations.values()??[]].filter(f=>f.sceneId===scene&&f.enemyIds.includes(enemy)).slice(0,16))
      rowLink(detail,row({kind:'formation',id:f.id},t('neoContent.formation',{id:f.id}),'gameplay','table'));
    }
    if(relation&&(target.kind==='set'||relation.status==='available')){
     const formations=target.kind==='enemy'?[...relation.enemies.get(target.id)??[]]:target.kind==='formation'?[target.id]:[];
     const refs=target.kind==='set'?relation.records.filter(r=>r.setId===target.id):formations.flatMap(id=>relation.formations.get(id)??[]);
     make('p',detail,t('discovery.tableRefs',{count:refs.length}));
     for(const ref of refs.slice(0,50))make('p',detail,ref.setId+' @ '+ref.record.byte_offset+' · '+ref.kind+' · weight '+ref.record.weight);
     action(detail,t('encgeo.viewMap'),()=>{if(!world()||target.kind!=='set'&&!story())return false;document.dispatchEvent(new CustomEvent('gaiagis:encounter-geography',{detail:query}));clearDetail();ownerBack(document.getElementById('encounter-geography'));return true;}).disabled=!world();
     if(target.kind!=='set'){
      const ids=[...new Set(formations.flatMap(id=>gameplayLookup?.battles.get(id)??[]))];
      make('p',detail,t('discovery.fieldBattles',{count:ids.length}));
      for(const id of ids.slice(0,12)){
       const found=ports.atlas.gameplayEvidence()?.records.get(id);
       if(found)rowLink(detail,row({kind:'field',id:found.scene.fieldId,record:{kind:'row',key:'gameplay:'+id}},found.scene.name+' · '+id,'scripts','script'));
      }
     }
    }else make('p',detail,relation?t('encgeo.'+relation.status):t('discovery.unavailable'));
    if(target.kind!=='set')action(detail,t('gameplay.title'),()=>{if(!story()||!ports.atlas.openGameplay(query))return false;clearDetail();ownerBack(document.getElementById('selection-details'));return true;}).disabled=!world();
    const match=ports.route().match(query);
    if(match){
     make('p',detail,[t('encgeo.'+match.range),t('encgeo.'+match.family),match.leg===null?t('encRoute.whole'):t('encRoute.leg')+' '+(match.leg+1)].join(' · '));
     action(detail,t('discovery.routeMatch',{pieces:match.pieces,intervals:match.intervals}),()=>{
      if(!ports.route().match(query)?.open())return false;
      clearDetail();ownerBack(document.getElementById('encounter-analysis'));return true;
     });
    }
    else make('p',detail,t('discovery.noRoute'));
   }else make('p',detail,t('discovery.hidden'));
  }
 const exploration=ports.route().exploration;
  if(exploration&&(target.kind==='field'&&exploration.fields.includes(target.id)||target.kind==='entrance'&&exploration.entranceId===target.id))
   action(detail,t('worldField.title'),async current=>{
    const result=ports.route().exploration;
    if(!result||result.open!==exploration.open||!await result.open(current))return false;
    if(current()){clearDetail();ownerBack(document.getElementById('selection-details'));}
    return true;
   });
  document.dispatchEvent(new Event('gaiagis:evidence-inspect'));
  title.focus({preventScroll:true});
 }
 function highlight(){
  const options=[...list.querySelectorAll<HTMLButtonElement>('button')];
  for(const [i,b]of options.entries()){
   b.setAttribute('aria-selected',String(i===active));
   if(i===active){input.setAttribute('aria-activedescendant',b.id);b.scrollIntoView({block:'nearest'});}
  }
 }
 function invalidate(){
  stamp=sources();scene=null;sceneId=-1;catalogRefs=[];catalog=[];gameplayOwner=null;encounterOwners=[];gameplayLookup=null;encounterLookup=null;results=[];selected=null;clearDetail();
  list.replaceChildren();paging.replaceChildren();
  schedule();
 }
 function sourceChanged(){
  if(!same(stamp,sources()))invalidate();
 }
 function translate(){
  caption.textContent=t('discovery.category');input.setAttribute('aria-label',t('discovery.title'));input.placeholder=t('discovery.placeholder');
  for(const option of category.options)option.textContent=t('discovery.'+option.value);
  schedule(false);
 }
 scope.listen(input,'input',()=>{shown=true;selected=null;clearDetail();schedule();});
 scope.listen(input,'focus',()=>{if(shown&&results.length){render();return;}shown=true;schedule(false);});
 scope.listen(input,'keydown',((event:KeyboardEvent)=>{
  if(!['ArrowDown','ArrowUp','Enter','Escape'].includes(event.key))return;
  if(event.key==='Escape'&&!shown)return;
  event.preventDefault();event.stopPropagation();
  if(event.key==='Escape'){renew();closeList();report('cancelled');return;}
  if(event.key==='Enter'){
   const selected=results[page*evidencePageSize+Math.max(active,0)];
   if(selected)choose(selected);
   else{shown=true;renew();void search();}
   return;
  }
  if(!shown){shown=true;render();}
  active=Math.max(0,Math.min(Math.min(results.length-page*evidencePageSize,evidencePageSize)-1,active+(event.key==='ArrowDown'?1:-1)));
  highlight();
 }) as EventListener);
 scope.listen(category,'change',()=>{shown=true;clearDetail();schedule();});
 scope.listen(storeFilter,'change',()=>schedule());
 scope.listen(document,'gaiagis:evidence-return',returnToSearch);
 scope.listen(document,'gaiagis:evidence-policy',()=>{catalogRefs=[];catalog=[];clearDetail();selected=null;results=[];render();schedule(false);});
 scope.listen(document,'gaiagis:navigation',()=>{sourceChanged();if(shown&&parseEvidenceQuery(input.value).type==='name')schedule(false);});
 for(const event of ['gaiagis:gameplay-ready','gaiagis:encounters','gaiagis:field-ready','gaiagis:journey-targets-change'])scope.listen(document,event,sourceChanged);
 scope.own(appStore.subscribe(sourceChanged));scope.own(onLocaleChange(translate));
 scope.own(()=>{renew();closeList();});
 stamp=sources();translate();report('hint');
 return {dispose(){scope.dispose();}};
}
