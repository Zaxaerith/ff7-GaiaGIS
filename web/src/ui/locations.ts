// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMeta} from '../data/mesh';
import {loadOptionalPoi,readLocalPoi,searchLocations,validatePoiMesh} from '../data/poi';
import type {Entrance,Location,LocationFilter,PoiDataset} from '../data/poi';
import type {GaiaViewer} from '../viewer/GaiaViewer';

export function mountLocations(viewer:GaiaViewer,meta:GaiaMeta,isCurrent:()=>boolean){
  const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const input=element<HTMLInputElement>('location-search'),results=element('location-results'),status=element('location-status');
  const filter=element<HTMLSelectElement>('location-filter'),file=element<HTMLInputElement>('local-poi-file');
  let dataset:PoiDataset|null=null,matches:Location[]=[],active=-1,loadRevision=0;
  const display=()=>viewer.setLocationsDisplay(element<HTMLInputElement>('locations-toggle').checked,element<HTMLInputElement>('location-labels').checked,filter.value as LocationFilter);
  const clear=()=>{viewer.selectLocation(null);element('inspector-title').textContent='Triangle inspector';delete element('selection-details').dataset.location;};
  const close=()=>{results.replaceChildren();input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  function inspect(location:Location,entrance?:Entrance){
    if(!dataset)return;
    const e=entrance??dataset.entrances.find(e=>e.id===location.primary_entrance)!;
    viewer.clearSelection();viewer.selectLocation(location.id,e);element('inspector-title').textContent='Location inspector';
    element('selection-empty').hidden=true;const detail=element('selection-details');detail.hidden=false;detail.replaceChildren();
    delete detail.dataset.sourceTriangle;delete detail.dataset.origin;detail.dataset.location=location.id;
    element('info-panel').classList.add('mobile-open');document.querySelector('.controls')!.classList.remove('mobile-open');element('mobile-display').setAttribute('aria-expanded','false');
    element<HTMLInputElement>('auto-rotate').checked=false;
    // Every displayed value is textContent; a local file never supplies HTML.
    const title=document.createElement('h3');title.textContent=location.display_name;detail.append(title);
    const list=document.createElement('dl');list.className='property-list';
    const rows:[string,string][]=[['Category',location.category],['Longitude / latitude',`${e.longitude.toFixed(5)}° / ${e.latitude.toFixed(5)}°`],
      ['Raw east / north / height',`${e.game_x.toFixed(2)} / ${e.game_north.toFixed(2)} / ${e.game_height.toFixed(2)}`],
      ['Height (V1 assumption)',`${e.height.toFixed(2)} m · surface interpolation`],['Field ID / name',`${e.field_id} / ${e.field_name}`],
      ['Entrance / scenario',`${e.entrance_table_id} / ${e.scenario}`],['FF7 region',meta.region_names[e.region_id]??String(e.region_id)],
      ['Source',`${e.source_file} · section ${e.section_id} · mesh ${e.mesh_id} · triangle ${e.triangle_id}`],
      ['Script provenance',`wm0.ev · function ${e.source_script} · ${e.script_calls.map(c=>`call ${c.call_table_record}, word ${c.instruction_word_offset}`).join('; ')}`],
      ['Field table / identity',`field.tbl record ${e.field_table_record} · flevel.lgp / maplist`],['Confidence','Verified trigger; derived position'],
      ['Position provenance','Navigation point inside source trigger triangle'],['Name provenance',location.name_source==='manual_verified_field_identity'?'Verified field identity; editorial English name':'Game maplist'],['Availability / heading / radius','Unknown · not evaluated'],['Entrances count',String(location.entrance_ids.length)]];
    for(const [key,value]of rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;row.append(dt,dd);list.append(row);}detail.append(list);
    const note=document.createElement('p');note.className='control-note';note.textContent=e.notes;detail.append(note);
    const entrances=document.createElement('details');entrances.className='entrance-list';
    const summary=document.createElement('summary');summary.textContent=`All entrances (${location.entrance_ids.length})`;entrances.append(summary);
    for(const id of location.entrance_ids){const item=dataset.entrances.find(e=>e.id===id)!;const button=document.createElement('button');button.textContent=`${item.field_name} · entry ${item.entrance_table_id} · scenario ${item.scenario}`;button.setAttribute('aria-pressed',String(id===e.id));button.addEventListener('click',()=>inspect(location,item));entrances.append(button);}detail.append(entrances);
    element('coordinates').textContent=`${e.longitude.toFixed(2)}° / ${e.latitude.toFixed(2)}°`;
    viewer.flyToLocation(e.longitude,e.latitude);close();
    history.replaceState(null,'',`${window.location.pathname}${window.location.search}#location=${encodeURIComponent(location.id)}`);
  }
  // Use the browser's URL components, never values supplied by POI data.
  const select=(location:Location)=>inspect(location);
  function draw(){
    close();if(!dataset)return;
    matches=searchLocations(dataset.locations,input.value,filter.value as LocationFilter);
    const visible=matches.slice(0,60);
    for(const [index,l]of visible.entries()){
      const button=document.createElement('button');button.id=`location-result-${index}`;button.className='location-result';button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.tabIndex=-1;button.textContent=l.display_name;
      button.addEventListener('click',()=>select(l));results.append(button);
    }
    if(!visible.length){const message=document.createElement('p');message.textContent='No matching locations';results.append(message);}
    input.setAttribute('aria-expanded','true');
  }
  function adopt(data:PoiDataset|null){
    if(data)validatePoiMesh(data,viewer.mesh);
    viewer.clearSelection();
    dataset=data;viewer.setLocations(data?.locations??[]);display();input.disabled=!data;filter.disabled=!data;
    status.textContent=data?`${data.locations.length} locations · ${data.entrances.length} entrances · local data`:'Locations unavailable · optional local file';
    if(data){const id=new URLSearchParams(window.location.hash.slice(1)).get('location');const target=data.locations.find(l=>l.id===id);if(target)select(target);}
  }
  input.disabled=true;filter.disabled=true;
  input.addEventListener('input',draw);input.addEventListener('focus',draw);
  input.addEventListener('keydown',e=>{
    if(!['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key))return;e.preventDefault();e.stopPropagation();
    if(e.key==='Escape'){close();return;}
    if(e.key==='Enter'){const match=matches[Math.max(0,active)];if(match)select(match);return;}
    if(input.getAttribute('aria-expanded')!=='true')draw();
    active=Math.max(0,Math.min(Math.min(matches.length,60)-1,active+(e.key==='ArrowDown'?1:-1)));
    for(const [i,b]of Array.from(results.querySelectorAll('button')).entries()){b.setAttribute('aria-selected',String(i===active));if(i===active){input.setAttribute('aria-activedescendant',b.id);b.scrollIntoView({block:'nearest'});}}
  });
  filter.addEventListener('change',()=>{display();if(document.activeElement===input)draw();else close();});
  for(const id of ['locations-toggle','location-labels'])element(id).addEventListener('change',display);
  element('load-locations').addEventListener('click',()=>file.click());
  file.addEventListener('change',async()=>{
    const selected=file.files?.[0];if(!selected)return;const revision=++loadRevision;status.textContent='Verifying local locations…';
    try{const data=await readLocalPoi(selected,meta);if(isCurrent()&&revision===loadRevision)adopt(data);}
    catch(error){if(isCurrent()&&revision===loadRevision)status.textContent=error instanceof Error?error.message:String(error);}
    file.value='';
  });
  viewer.onLocation=select;
  const revision=loadRevision;
  void loadOptionalPoi(meta).then(data=>{if(isCurrent()&&revision===loadRevision)adopt(data);}).catch(error=>{if(isCurrent()&&revision===loadRevision)status.textContent=`Locations unavailable: ${error.message}`;});
  return {clear};
}
