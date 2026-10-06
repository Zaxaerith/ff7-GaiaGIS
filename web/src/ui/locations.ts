import {appStore} from '../app/state';
import {registerNavigation,searchNavigation,setNavigationSelection} from '../app/navigation';
import type {NavigationEntry} from '../app/navigation';
import {workspaceLoader,loadedAsset} from '../app/assets';
import {t,formatNumber} from '../i18n';
// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMeta} from '../data/mesh';
import {loadOptionalPoi,readLocalPoi,searchLocations,validatePoiMesh} from '../data/poi';
import type {Entrance,Location,LocationFilter,PoiDataset} from '../data/poi';
import type {GaiaViewer} from '../viewer/GaiaViewer';

export function mountLocations(viewer:GaiaViewer,meta:GaiaMeta,isCurrent:()=>boolean){
  const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const input=element<HTMLInputElement>('location-search'),results=element('location-results'),status=element('location-status');
  const filter=element<HTMLSelectElement>('location-filter'),file=element<HTMLInputElement>('local-poi-file');
  let dataset:PoiDataset|null=null,matches:NavigationEntry[]=[],active=-1,loadRevision=0;
  const display=()=>viewer.setLocationsDisplay(element<HTMLInputElement>('locations-toggle').checked,element<HTMLInputElement>('location-labels').checked,filter.value as LocationFilter);
  const clear=()=>{setNavigationSelection(null);viewer.selectLocation(null);element('inspector-title').textContent=t('ui.triangleInspector');delete element('selection-details').dataset.location;delete element('selection-details').dataset.entrance;};
  const close=()=>{results.replaceChildren();input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  function inspect(location:Location,entrance?:Entrance){
    if(!dataset)return;
    const e=entrance??dataset.entrances.find(e=>e.id===location.primary_entrance)!;
    viewer.clearSelection();viewer.selectLocation(location.id,e);element('inspector-title').textContent=t('ui.locationInspector');
    element('selection-empty').hidden=true;const detail=element('selection-details');detail.hidden=false;detail.replaceChildren();
    delete detail.dataset.sourceTriangle;delete detail.dataset.origin;detail.dataset.location=location.id;if(entrance)detail.dataset.entrance=entrance.id;else delete detail.dataset.entrance;
    element('info-panel').classList.add('mobile-open');document.querySelector('.controls')!.classList.remove('mobile-open');element('mobile-display').setAttribute('aria-expanded','false');
    element<HTMLInputElement>('auto-rotate').checked=false;
    // Every displayed value is textContent; a local file never supplies HTML.
    const title=document.createElement('h3');title.textContent=location.display_name;detail.append(title);
    const list=document.createElement('dl');list.className='property-list';
    const rows:[string,string][]=[[t('inspect.category'),location.category],[t('inspect.lonlat'),`${formatNumber(e.longitude,5)}° / ${formatNumber(e.latitude,5)}°`],
      [t('inspect.raw'),`${formatNumber(e.game_x,2)} / ${formatNumber(e.game_north,2)} / ${formatNumber(e.game_height,2)}`],
      [t('inspect.v1Height'),`${formatNumber(e.height,2)} m · ${t('message.interpolated')}`],[t('inspect.field'),`${e.field_id} / ${e.field_name}`],
      [t('inspect.entrance'),`${e.entrance_table_id} / ${e.scenario}`],[t('inspect.region'),meta.region_names[e.region_id]??String(e.region_id)],
      [t('ui.source'),t('message.triggerSource',{file:e.source_file,section:e.section_id,mesh:e.mesh_id,triangle:e.triangle_id})],
      [t('inspect.scriptProvenance'),`wm0.ev · function ${e.source_script} · ${e.script_calls.map(c=>t('message.scriptCall',{call:c.call_table_record,word:c.instruction_word_offset})).join('; ')}`],
      [t('inspect.identity'),`field.tbl record ${e.field_table_record} · flevel.lgp / maplist`],[t('inspect.confidence'),t('inspect.verifiedTrigger')],
      [t('inspect.positionProvenance'),t('inspect.navPoint')],[t('inspect.nameProvenance'),location.name_source==='manual_verified_field_identity'?t('inspect.englishName'):t('inspect.maplist')],[t('inspect.availability'),t('inspect.notEvaluated')],[t('inspect.entranceCount'),String(location.entrance_ids.length)]];
    for(const [key,value]of rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;row.append(dt,dd);list.append(row);}detail.append(list);
    const note=document.createElement('p');note.className='control-note';note.textContent=e.notes;detail.append(note);
    const entrances=document.createElement('details');entrances.className='entrance-list';
    const summary=document.createElement('summary');summary.textContent=t('message.allEntrances',{count:location.entrance_ids.length});entrances.append(summary);
    for(const id of location.entrance_ids){const item=dataset.entrances.find(e=>e.id===id)!;const button=document.createElement('button');button.textContent=t('message.entrance',{field:item.field_name,entry:item.entrance_table_id,scenario:item.scenario});button.setAttribute('aria-pressed',String(id===e.id));button.addEventListener('click',()=>inspect(location,item));entrances.append(button);}detail.append(entrances);
    element('coordinates').textContent=`${formatNumber(e.longitude,2)}° / ${formatNumber(e.latitude,2)}°`;
    setNavigationSelection({location,entrance:e});appStore.dispatch({type:'select',selection:{kind:entrance?'entrance':'location',id:entrance?.id??location.id,mapId:'WM0',geographicPoint:[e.longitude,e.latitude,e.height]}});viewer.flyToLocation(e.longitude,e.latitude);close();document.dispatchEvent(new CustomEvent('gaiagis-location-inspect',{detail:location.id}));
    history.replaceState(null,'',`${window.location.pathname}${window.location.search}#location=${encodeURIComponent(location.id)}`);
  }
  // Use the browser's URL components, never values supplied by POI data.
  const select=(location:Location)=>inspect(location);
  const navigateLocation=(event:Event)=>{const id=(event as CustomEvent<string>).detail;const l=dataset?.locations.find(l=>l.id===id);if(l)inspect(l);};document.addEventListener('gaiagis-inspect-location',navigateLocation);
  function draw(){
    close();matches=searchNavigation(input.value);if(filter.value!=='all'&&dataset){const ids=new Set(searchLocations(dataset.locations,input.value,filter.value as LocationFilter).map(l=>l.id));matches=matches.filter(e=>e.kind==='location'&&ids.has(e.id));}
    const visible=matches.slice(0,60);
    for(const [index,l]of visible.entries()){
      const button=document.createElement('button');button.id=`location-result-${index}`;button.dataset.navigationId=l.id;button.className='location-result';button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.tabIndex=-1;button.textContent=l.name+(l.kind==='location'?'':' · '+t(l.kind==='entrance'?'ui.entrances':l.kind==='transition'?'map.transitions':l.kind==='atlas'?'atlas.title':'ui.events'));
      button.addEventListener('click',()=>l.navigate());results.append(button);
    }
    if(!visible.length){const message=document.createElement('p');message.textContent=t('ui.noMatches');results.append(message);}
    input.setAttribute('aria-expanded','true');
  }
  function adopt(data:PoiDataset|null){
    if(data)loadedAsset("locations");
    if(data)validatePoiMesh(data,viewer.mesh);
    viewer.clearSelection();
    dataset=data;registerNavigation('locations',data?[...data.locations.map(l=>({id:l.id,kind:'location' as const,name:l.display_name,anchor:[l.longitude,l.latitude,l.height] as [number,number,number],precision:'entrance_level' as const,group:'places' as const,canTour:true,target:{kind:'location' as const,id:l.id,mapId:'WM0' as const},aliases:[...l.aliases,...l.field_names],mapId:'WM0' as const,navigate:()=>inspect(l)})),...data.entrances.map(e=>{const l=data.locations.find(l=>l.id===e.location_id)!;return {id:e.id,kind:'entrance' as const,name:l.display_name+' · '+e.field_name,anchor:[e.longitude,e.latitude,e.height] as [number,number,number],precision:'entrance_level' as const,canTour:true,target:{kind:'entrance' as const,id:e.id,mapId:'WM0' as const},aliases:[e.field_name,l.display_name],mapId:'WM0' as const,navigate:()=>inspect(l,e)};})]:[]);document.dispatchEvent(new CustomEvent('gaiagis:poi',{detail:data}));viewer.setLocations(data?.locations??[]);display();input.disabled=!data;filter.disabled=!data;
    status.textContent=data?t('message.locations',{locations:data.locations.length,entrances:data.entrances.length}):t('ui.locationsUnavailable');
    if(data){const id=new URLSearchParams(window.location.hash.slice(1)).get('location');const target=data.locations.find(l=>l.id===id);if(target)select(target);}
  }
  input.disabled=true;filter.disabled=true;
  input.addEventListener('input',draw);input.addEventListener('focus',draw);
  input.addEventListener('keydown',e=>{
    if(!['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key))return;e.preventDefault();e.stopPropagation();
    if(e.key==='Escape'){close();return;}
    if(e.key==='Enter'){const match=matches[Math.max(0,active)];if(match)match.navigate();return;}
    if(input.getAttribute('aria-expanded')!=='true')draw();
    active=Math.max(0,Math.min(Math.min(matches.length,60)-1,active+(e.key==='ArrowDown'?1:-1)));
    for(const [i,b]of Array.from(results.querySelectorAll('button')).entries()){b.setAttribute('aria-selected',String(i===active));if(i===active){input.setAttribute('aria-activedescendant',b.id);b.scrollIntoView({block:'nearest'});}}
  });
  filter.addEventListener('change',()=>{display();if(document.activeElement===input)draw();else close();});
  for(const id of ['locations-toggle','location-labels'])element(id).addEventListener('change',display);
  element('load-locations').addEventListener('click',()=>file.click());
  file.addEventListener('change',async()=>{
    const selected=file.files?.[0];if(!selected)return;const revision=++loadRevision;status.textContent=t('load.locations');
    try{await loadFile(selected,revision);}
    catch(error){if(isCurrent()&&revision===loadRevision)status.textContent=t('error.dataset');status.title=error instanceof Error?error.message:String(error);}
    file.value='';
  });
  viewer.onLocation=select;
  const revision=loadRevision;
  void loadOptionalPoi(meta).then(data=>{if(isCurrent()&&revision===loadRevision)adopt(data);}).catch(error=>{if(isCurrent()&&revision===loadRevision)status.textContent=t('ui.locationsUnavailable');status.title=error.message;});
  async function loadFile(selected:File,revision=++loadRevision){const data=await readLocalPoi(selected,meta);if(isCurrent()&&revision===loadRevision)adopt(data);}
  workspaceLoader.register("locations",async files=>loadFile(files[0]));
  document.addEventListener('gaiagis-navigation',navigationChanged);
  function navigationChanged(){if(isCurrent()&&(document.activeElement===input||input.getAttribute('aria-expanded')==='true'))draw();}
  return {clear,loadFile,dataset:()=>dataset,dispose(){document.removeEventListener('gaiagis-navigation',navigationChanged);document.removeEventListener('gaiagis-inspect-location',navigateLocation);}};
}
