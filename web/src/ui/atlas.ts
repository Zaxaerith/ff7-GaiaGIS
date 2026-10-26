// SPDX-License-Identifier: GPL-3.0-only
import curated from '../../../src/gaiagis/atlas_data/content.json';
import {appStore} from '../app/state';
import {registerNavigation,clearNavigation,searchNavigation,setNavigationSelection} from '../app/navigation';
import {workspaceLoader} from '../app/assets';
import {ResourceScope} from '../app/resources';
import {locale,onLocaleChange,t} from '../i18n';
import {atlasKinds,guideCategories,guideCategory,guidePrecision,parseAtlasContent,parseAtlasPack,validateAtlasPoi,resolveBinding,atlasAnchor,spoilerVisible,searchAtlas,atlasFactTerms} from '../data/atlas';
import type {AtlasContent,AtlasEntity,AtlasPack,AtlasBinding,AtlasCategory,GuideCategory,Spoiler} from '../data/atlas';
import {resolveFieldAtlas,atlasEvidence,spatialStatus} from '../data/fieldContext';
import type {FieldIndex} from '../data/fieldContext';
import {renderSpatialEvidence} from './fieldContext';
import {mountGameplay} from './gameplay';
import type {PoiDataset,Location} from '../data/poi';
import type {GaiaViewer} from '../viewer/GaiaViewer';

export function mountAtlas(viewer?:GaiaViewer,getPoi?:()=>PoiDataset|null){
 const scope=new ResourceScope(),started=performance.now();let content:AtlasContent=parseAtlasContent(curated),pack:AtlasPack|null=null,poi=getPoi?.()??null,active:string|null=null,embedded=false,revision=0;
 let fields:FieldIndex|null=null;
 const input=document.getElementById('location-search') as HTMLInputElement,results=document.getElementById('location-results')!;
 const locations=document.querySelector('.locations-controls')!;
 const header=document.createElement('header'),heading=document.createElement('h2'),intro=document.createElement('p');header.className='guide-heading';intro.className='control-note';header.append(heading,intro);locations.prepend(header);scope.own(()=>header.remove());
 const guide=document.createElement('section');guide.id='game-guide';guide.setAttribute('aria-labelledby','guide-title');heading.id='guide-title';const shortcuts=document.createElement('div');shortcuts.className='guide-categories';const count=document.createElement('p'),guideList=document.createElement('div'),pages=document.createElement('div');count.id='guide-count';count.setAttribute('role','status');guideList.id='guide-results';pages.className='guide-pages';guide.append(shortcuts,count,guideList,pages);results.after(guide);scope.own(()=>guide.remove());
 let guideFilter:GuideCategory='all',page=0;const pageSize=10;
 for(const name of guideCategories){const button=document.createElement('button');button.type='button';button.dataset.guideCategory=name;button.onclick=()=>{guideFilter=name;page=0;category.value=region.value=kind.value=spatialFilter.value='all';refresh();document.dispatchEvent(new CustomEvent('gaiagis:gameplay-category',{detail:name}));};shortcuts.append(button);}
 const battleNote=document.createElement('p'),eventsButton=document.createElement('button');battleNote.className='control-note';eventsButton.id='guide-static-battles';eventsButton.onclick=()=>document.dispatchEvent(new Event('gaiagis:guide-battles'));guide.append(battleNote,eventsButton);
 const controls=document.createElement('details');controls.id='atlas-filters';const controlsTitle=document.createElement('summary');controlsTitle.textContent=t('guide.filters');controls.append(controlsTitle);guide.insertBefore(controls,count);scope.own(()=>controls.remove());
 const select=(id:string,key:string,values:string[])=>{const label=document.createElement('label'),field=document.createElement('select');field.id=id;field.dataset.labelKey=key;label.htmlFor=id;label.textContent=t(key);for(const value of values){const o=document.createElement('option');o.value=value;o.textContent=t('atlas.'+(value==='unknown'?'unknownRegion':value));field.append(o);}controls.append(label,field);field.onchange=refresh;return field;};
 const category=select('atlas-category','atlas.category',['all','places','secrets','collectibles']);const region=select('atlas-region','atlas.region',['all','eastern','western','northern','wutai','islands','underwater','unknown']);const kind=select('atlas-kind','atlas.kind',['all',...atlasKinds]);const spoilers=select('atlas-spoilers','atlas.spoilers',['hide-major','show-all','hide-all']);
 const spatialFilter=select('atlas-spatial-status','atlas.spatialStatus',['all','resolved','field_only','parent_place','unresolved']);
 const note=document.createElement('p');note.className='control-note';note.textContent=t('atlas.offline');controls.append(note);
 const layers=document.createElement('details');layers.id='atlas-layers';const layersTitle=document.createElement('summary');layersTitle.textContent=t('atlas.title');layers.append(layersTitle);document.querySelector('.controls')!.append(layers);scope.own(()=>layers.remove());
 const toggles=new Map<string,HTMLInputElement>();for(const name of ['places','secrets','collectibles']){const label=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='atlas-'+name;label.htmlFor=checkbox.id;label.append(checkbox,document.createTextNode(t('atlas.'+name)));layers.append(label);checkbox.onchange=refresh;toggles.set(name,checkbox);}
 const mode=()=>spoilers.value as 'hide-major'|'show-all'|'hide-all';const visible=(level:Spoiler)=>spoilerVisible(level,mode());
 const entity=(id:string)=>content.entities.find(e=>e.id===id);
 const binding=(e:AtlasEntity):AtlasBinding=>resolveFieldAtlas(e,(pack&&JSON.stringify(pack.content.entities.find(row=>row.id===e.id)?.spatialBinding)===JSON.stringify(e.spatialBinding)?pack.bindings[e.id]:null)??resolveBinding(e,poi),fields);
 function section(target:HTMLElement,key:string,open=false){const detail=document.createElement('details'),summary=document.createElement('summary');detail.open=open;summary.textContent=t(key);detail.append(summary);target.append(detail);return detail;}
 const paragraph=(parent:HTMLElement,text:string)=>{const node=document.createElement('p');node.textContent=text;parent.append(node);return node;};
 function card(e:AtlasEntity,target:HTMLElement){
  const old=document.getElementById('atlas-card');old?.remove();const card=document.createElement('section');card.id='atlas-card';card.className='atlas-card';card.dataset.entity=e.id;target.insertBefore(card,target.querySelector('.location-technical'));
  if(!visible(e.spoilerLevel)){paragraph(card,t('atlas.hidden'));return;}
  const title=document.createElement('h3');title.textContent=e.localizedNames[locale()];title.tabIndex=-1;card.append(title);
  const lang=locale(),facts=e.facts.filter(f=>visible(f.spoilerLevel));
  const cite=(host:HTMLElement,ids:string[])=>{const refs=document.createElement('span');refs.className='atlas-fact-sources';host.append(refs);for(const id of ids){const source=content.sources.find(s=>s.id===id)!;const link=document.createElement('a');link.textContent=source.provider+' · '+source.title;link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';link.dataset.sourceId=id;refs.append(link);}};
  const type=paragraph(card,t('atlas.'+e.kind)+' · '+t('atlas.'+(e.region==='unknown'?'unknownRegion':e.region)));type.className='control-note';
  paragraph(card,e.summary[lang]);
  if(guideCategory(e,'battles')){const note=paragraph(card,t('guide.battles')+' · '+t('guide.battleNote'));note.className='control-note';}
  for(const key of ['access','gameplay','discoveries'] as const){const rows=facts.filter(f=>f.text[lang]!==e.summary[lang]).filter(f=>key==='discoveries'?['reward','secret'].includes(f.kind):key==='gameplay'?['gameplay','category'].includes(f.kind):f.kind==='access');
   const children=key==='discoveries'?[...new Set([...e.secrets,...e.collectibles])].map(entity).filter((child):child is AtlasEntity=>!!child&&visible(child.spoilerLevel)):[];
   if(!rows.length&&!children.length)continue;const group=section(card,key==='access'?'guide.access':key==='gameplay'?'guide.gameplay':'guide.rewards',true);group.dataset.atlasSection=key;
   for(const f of rows)paragraph(group,f.text[lang]);
   for(const child of children){const button=document.createElement('button');button.textContent=child.localizedNames[lang];button.dataset.atlasEntity=child.id;button.onclick=()=>inspect(child);group.append(button);}
  }
  const relatedEntities=e.relatedEntities.map(entity).filter((child):child is AtlasEntity=>!!child&&visible(child.spoilerLevel));
  if(relatedEntities.length){const related=section(card,'atlas.related',true);related.dataset.atlasSection='related';for(const child of relatedEntities){const button=document.createElement('button');button.textContent=child.localizedNames[lang];button.dataset.atlasEntity=child.id;button.onclick=()=>inspect(child);related.append(button);}}
  const b=binding(e),map=document.createElement('section');map.className='guide-map';map.dataset.atlasSection='map';card.append(map);const mapTitle=document.createElement('h4');mapTitle.textContent=t('guide.map');map.append(mapTitle);
  // Authored parent/scene associations remain useful offline; only a validated
  // entrance binding can claim a verified map entrance or supply a marker.
  const precision=guidePrecision(e,b);
  paragraph(map,t('guide.'+precision));
  if(precision==='parent'||e.spatialBinding.kind==='field_parent')paragraph(map,t('guide.parentNote'));
  if(precision==='field'||e.spatialBinding.kind==='field_parent')paragraph(map,t('guide.fieldNote'));
  const anchor=atlasAnchor(b,poi),parent=atlasAnchor(b,poi,true);
  if(viewer&&(anchor||parent)){const button=document.createElement('button');button.id='atlas-fly';button.textContent=t(anchor?'guide.fly':'guide.flyParent');button.onclick=()=>{const context=anchor??parent!;viewer.flyToLocation(context.entrance.longitude,context.entrance.latitude);if(innerWidth<1100)document.getElementById('collapse-inspector')?.click();};map.append(button);if(!anchor)paragraph(map,t('atlas.parentLocation')+' · '+parent!.location.display_name);}
  else paragraph(map,t('guide.noMap'));
  const fieldHost=document.createElement('section');fieldHost.dataset.atlasSection='field';card.append(fieldHost);
  const requestedNames=e.spatialBinding.fieldNames??b.fieldNames;
  if(requestedNames.length){const names=paragraph(fieldHost,t('guide.field')+' · '+requestedNames.join(', '));names.className='control-note';}
  document.dispatchEvent(new CustomEvent('gaiagis:field-context',{detail:{host:fieldHost,locationId:b.locationId??e.spatialBinding.locationId??null,names:requestedNames}}));
  const fieldDetail=fieldHost.querySelector('details');if(fieldDetail){const label=fieldDetail.querySelector('summary');if(label)label.textContent=t('guide.relatedField');}
  document.dispatchEvent(new CustomEvent('gaiagis:gameplay-context',{detail:{host:card,entityId:e.id}}));
  const spatial=section(card,'guide.technical');spatial.dataset.atlasSection='technical';
  paragraph(spatial,t('atlas.precision')+': '+t('atlas.'+b.precision));paragraph(spatial,t('atlas.evidence')+': '+t('atlas.'+b.evidence));if(b.fieldNames.length)paragraph(spatial,b.fieldNames.join(', '));paragraph(spatial,t(b.marker?'atlas.anchorNote':b.locationId?'atlas.parentNote':'atlas.unresolvedNote'));
  renderSpatialEvidence(spatial,atlasEvidence(e,b,fields,poi),fields?.pack.sources??poi?.sources);
  const refs=new Set([...e.sources,...facts.flatMap(f=>f.sources)]);
  if(refs.size){const provenance=section(spatial,'atlas.sources');provenance.dataset.atlasSection='sources';paragraph(provenance,t('atlas.sourceNote'));for(const fact of facts){const row=paragraph(provenance,fact.text[lang]);cite(row,fact.sources);}cite(provenance,[...refs]);}

 }
 function inspect(e:AtlasEntity){
  if(!visible(e.spoilerLevel)||appStore.state.map.id!=='WM0'||appStore.state.explorer.phase!=='idle')return;viewer?.clearSelection();active=e.id;embedded=false;const b=binding(e),anchor=atlasAnchor(b,poi);setNavigationSelection(anchor);viewer?.selectLocation(null);if(anchor)viewer?.selectLocation(anchor.location.id,anchor.entrance);
  const detail=document.getElementById('selection-details')!;detail.hidden=false;detail.replaceChildren();delete detail.dataset.location;delete detail.dataset.entrance;delete detail.dataset.sourceTriangle;delete detail.dataset.origin;detail.dataset.atlas=e.id;document.getElementById('selection-empty')!.hidden=true;document.getElementById('inspector-title')!.textContent=t('atlas.title');
  appStore.dispatch({type:'select',selection:{kind:'atlas',id:e.id,mapId:'WM0',...(anchor?{geographicPoint:[anchor.entrance.longitude,anchor.entrance.latitude,anchor.entrance.height] as [number,number,number]}:{})}});card(e,detail);results.replaceChildren();input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');if(!document.getElementById('integrated-inspector')?.classList.contains('open'))document.getElementById('toggle-inspector')?.click();if(innerWidth<1100){document.getElementById('integrated-panel')?.classList.remove('open');document.getElementById('app-menu')?.setAttribute('aria-expanded','false');}detail.querySelector<HTMLElement>('#atlas-card h3')?.focus({preventScroll:true});
 }
 function drawGuide(){
  heading.textContent=t('guide.title');intro.textContent=t('guide.intro');controlsTitle.textContent=t('guide.filters');
  for(const button of shortcuts.querySelectorAll<HTMLButtonElement>('button')){const name=button.dataset.guideCategory!;button.textContent=t('guide.'+name);button.setAttribute('aria-pressed',String(name===guideFilter));}
  const matches=searchAtlas(content,input.value,locale(),mode(),category.value as AtlasCategory,region.value,kind.value).filter(e=>guideCategory(e,guideFilter)&&(spatialFilter.value==='all'||spatialStatus(binding(e).precision)===spatialFilter.value));
  const totalPages=Math.max(1,Math.ceil(matches.length/pageSize));page=Math.min(page,totalPages-1);count.textContent=t('guide.count',{count:matches.length,total:content.entities.length});guideList.replaceChildren();
  for(const e of matches.slice(page*pageSize,(page+1)*pageSize)){const button=document.createElement('button');button.type='button';button.dataset.guideEntity=e.id;button.className='guide-result';const name=document.createElement('strong'),kind=document.createElement('span');name.textContent=e.localizedNames[locale()];kind.textContent=t('guide.open')+' · '+t('atlas.'+e.kind);button.append(name,kind);button.onclick=()=>inspect(e);guideList.append(button);}
  if(!matches.length){const note=document.createElement('p');note.textContent=t('guide.noMatches');guideList.append(note);}
  pages.replaceChildren();if(totalPages>1){const previous=document.createElement('button'),next=document.createElement('button'),position=document.createElement('span');previous.textContent=t('guide.previous');next.textContent=t('guide.next');position.textContent=t('guide.page',{page:page+1,pages:totalPages});previous.disabled=page===0;next.disabled=page===totalPages-1;previous.onclick=()=>{page--;drawGuide();};next.onclick=()=>{page++;drawGuide();};pages.append(previous,position,next);}
  battleNote.hidden=eventsButton.hidden=guideFilter!=='battles';battleNote.textContent=t('guide.battleNote');eventsButton.textContent=t('guide.events');eventsButton.disabled=!viewer;
 }
 function refresh(){
  for(const field of controls.querySelectorAll('select')){if(field.previousElementSibling)field.previousElementSibling.textContent=t(field.dataset.labelKey!);for(const option of field.options)option.textContent=t('atlas.'+(option.value==='unknown'?'unknownRegion':option.value));}
  const entities=searchAtlas(content,'',locale(),mode(),category.value as AtlasCategory,region.value,kind.value).filter(e=>spatialFilter.value==='all'||spatialStatus(binding(e).precision)===spatialFilter.value);const visibleIds=new Set(entities.map(e=>e.id));
  registerNavigation('atlas',entities.map(e=>({id:'atlas:'+e.id,kind:'atlas',name:e.localizedNames[locale()],target:{kind:'atlas',id:e.id,mapId:'WM0'},anchor:atlasAnchor(binding(e),poi)?[atlasAnchor(binding(e),poi)!.entrance.longitude,atlasAnchor(binding(e),poi)!.entrance.latitude,atlasAnchor(binding(e),poi)!.entrance.height]:undefined,precision:binding(e).marker?'entrance_level':undefined,group:e.tags.includes('secret')?'secrets':'places',canTour:e.tags.includes('place'),aliases:[e.canonicalName,...Object.values(e.localizedNames),...e.aliases,...atlasFactTerms(e,mode()),e.kind,e.region,...e.tags,t('atlas.'+e.kind),t('atlas.'+(e.region==='unknown'?'unknownRegion':e.region)),...e.collectibles.map(entity).filter((e):e is AtlasEntity=>!!e&&visible(e.spoilerLevel)).flatMap(e=>[e.canonicalName,...Object.values(e.localizedNames),...e.aliases])],mapId:'WM0',navigate:()=>inspect(e)})));
  input.disabled=false;const searchLabel=document.querySelector('label[for="location-search"]');if(searchLabel)searchLabel.textContent=t('atlas.search');input.placeholder=t('atlas.search');input.setAttribute('aria-label',t('atlas.search'));
  const markers:Location[]=[];for(const e of entities){const b=binding(e),anchor=atlasAnchor(b,poi);if(!anchor)continue;const show=toggles.get('places')!.checked&&e.tags.includes('place')||toggles.get('secrets')!.checked&&e.tags.includes('secret')||toggles.get('collectibles')!.checked&&e.collectibles.some(id=>{const child=entity(id);return child&&visible(child.spoilerLevel);});if(!show)continue;markers.push({...anchor.location,id:e.id,display_name:e.localizedNames[locale()],name:e.canonicalName});}
  viewer?.setAtlasLocations(markers);viewer?.setAtlasDisplay(appStore.state.map.id==='WM0'&&appStore.state.explorer.phase==='idle');layers.hidden=!viewer||!poi;
  if(active){const e=entity(active);if(e&&document.getElementById('atlas-card'))card(e,document.getElementById('selection-details')!);if(e&&!visible(e.spoilerLevel)&&appStore.state.selection?.kind==='atlas'){setNavigationSelection(null);appStore.dispatch({type:'select',selection:null});active=null;}}
  controls.dataset.entityCount=String(visibleIds.size);drawGuide();if(!viewer)drawStandalone();
 }
 scope.listen(input,'input',()=>{page=0;drawGuide();});
 scope.listen(document,'gaiagis:guide',((event:CustomEvent<{category:GuideCategory;query?:string;entity?:string}>)=>{if(!guideCategories.includes(event.detail.category))return;guideFilter=event.detail.category;page=0;category.value=region.value=kind.value=spatialFilter.value='all';input.value=event.detail.query??'';refresh();input.dispatchEvent(new Event('input'));const e=event.detail.entity&&entity(event.detail.entity);if(e)inspect(e);else input.focus();}) as EventListener);
 let standaloneMatches:ReturnType<typeof searchNavigation>=[],standaloneIndex=-1;
 function drawStandalone(){standaloneMatches=input.value.trim()?searchNavigation(input.value).filter(e=>e.kind==='atlas'||e.kind==='user-feature'||e.kind==='field'||e.kind==='gameplay'):[];results.replaceChildren();standaloneIndex=-1;for(const [i,e] of standaloneMatches.slice(0,60).entries()){const button=document.createElement('button');button.id='atlas-result-'+i;button.dataset.navigationId=e.id;button.className='location-result';button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.textContent=e.name+' · '+t(e.kind==='gameplay'?'gameplay.title':e.kind==='field'?'field.scene':e.kind==='user-feature'?'user26.created':'atlas.title');button.onclick=e.navigate;results.append(button);}input.setAttribute('aria-expanded',String(standaloneMatches.length>0));}
 if(!viewer){scope.listen(input,'input',drawStandalone);scope.listen(input,'focus',drawStandalone);scope.listen(input,'keydown',((event:KeyboardEvent)=>{if(!['ArrowDown','ArrowUp','Enter','Escape'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(event.key==='Escape'){results.replaceChildren();input.setAttribute('aria-expanded','false');return;}if(event.key==='Enter'){standaloneMatches[Math.max(0,standaloneIndex)]?.navigate();return;}standaloneIndex=Math.max(0,Math.min(Math.min(60,standaloneMatches.length)-1,standaloneIndex+(event.key==='ArrowDown'?1:-1)));for(const [i,b]of [...results.querySelectorAll('button')].entries()){b.setAttribute('aria-selected',String(i===standaloneIndex));if(i===standaloneIndex){input.setAttribute('aria-activedescendant',b.id);b.scrollIntoView({block:'nearest'});}}}) as EventListener);}
 scope.listen(document,'gaiagis:fields',((event:CustomEvent<FieldIndex|null>)=>{fields=event.detail;refresh();}) as EventListener);
 scope.listen(document,'gaiagis:field-ready',refresh);
 scope.listen(document,'gaiagis:gameplay-ready',refresh);
 scope.listen(document,'gaiagis:poi',((event:CustomEvent<PoiDataset|null>)=>{poi=event.detail;pack=null;refresh();}) as EventListener);
 scope.listen(document,'gaiagis-location-inspect',((event:CustomEvent<string>)=>{const e=content.entities.find(e=>e.spatialBinding.kind==='location'&&e.spatialBinding.locationId===event.detail);if(e){active=e.id;embedded=true;card(e,document.getElementById('selection-details')!);}}) as EventListener);
 scope.own(workspaceLoader.register('atlas',async files=>{const attempt=++revision,file=files[0],begin=performance.now();if(file.name!=='gaia-atlas.json'||file.size>2_000_000)throw Error('Atlas size/name');const next=parseAtlasPack(JSON.parse(await file.text()));if(!poi)throw Error('Atlas requires matching POI identity');validateAtlasPoi(next,poi);if(attempt!==revision)return;pack=next;refresh();controls.dataset.loadMs=String(performance.now()-begin);}));
 scope.own(appStore.subscribe(s=>{viewer?.setAtlasDisplay(s.map.id==='WM0'&&s.explorer.phase==='idle');if(s.selection?.kind!=='atlas'&&!['location','entrance'].includes(s.selection?.kind??'')){active=null;document.getElementById('atlas-card')?.remove();}if(!embedded&&s.selection?.kind==='atlas'&&active!==s.selection.id)active=null;}));
 scope.own(mountGameplay(viewer,()=>content,e=>visible(e.spoilerLevel)).dispose);
 scope.own(onLocaleChange(refresh));if(viewer)viewer.onAtlas=id=>{const e=entity(id);if(e)inspect(e);};refresh();controls.dataset.initMs=String(performance.now()-started);
 return {evidence:()=>content,dispose(){revision++;clearNavigation('atlas');viewer?.setAtlasLocations([]);if(viewer)viewer.onAtlas=()=>{};scope.dispose();document.getElementById('atlas-card')?.remove();}};
}
