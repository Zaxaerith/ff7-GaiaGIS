// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMeta,TriangleAttributes} from '../data/mesh';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import {chocoboRating,encounterKinds,encounterPalette,loadOptionalEncounters,readLocalEncounters,resolveEncounter} from '../data/encounters';
import type {ColorLayer,EncounterDataset} from '../data/encounters';

export function renderEncounterInspector(parent:HTMLElement,a:TriangleAttributes,data:EncounterDataset|null,meta:GaiaMeta){
  parent.querySelector('.gameplay-inspector')?.remove();
  const section=document.createElement('section');section.className='gameplay-inspector';
  const title=document.createElement('h3');title.textContent='Gameplay / Encounter';section.append(title);
  const rows:[string,string][]=[['Chocobo tracks',a.origin?'No source attribute':a.chocobo?'Yes · WM0 triangle flag':'No · WM0 triangle flag']];
  const note=document.createElement('p');note.className='control-note';
  if(a.origin){rows.push(['Encounters','Unassigned · synthetic polar cap']);}
  else if(!data){rows.push(['Encounters','Encounter data unavailable']);}
  else {
    const r=resolveEncounter(data,a.region!,a.terrain!),s=r.set;
    section.dataset.encounterSet=s.id;section.dataset.tableActive=String(s.active);section.dataset.tracks=String(a.chocobo);
    const name=(id:number)=>meta.terrain_names[id]??`Terrain ${id}`;
    rows.push(['Region → table region',`${a.region} → ${r.effectiveRegion}${r.effectiveRegion!==a.region?' · clamped':''}`],
      ['Terrain → effective terrain',`${name(a.terrain!)} → ${name(r.effectiveTerrain)}`],
      ['Encounter table / slot',`${s.id}${r.fallback?' · unmatched terrain fallback':''}`],
      ['Table enabled',s.active?'Yes · active bit 0':'No'],['Raw game encounter rate',String(s.encounter_rate)],
      ['Triangle script gate',a.script===0?'Passes · script 0':`Blocks random movement check · script ${a.script}`],
      ['Chocobo table data',s.records.chocobo.some(e=>e.weight>0)?'Weighted records present':'No weighted records'],
      ['Runtime availability','Conditional / not simulated'],
      ['Mystery Ninja static context',s.active&&a.script===0&&r.yuffieTerrain&&r.yuffieThreshold>0?'Eligible terrain + region; runtime conditions required':'Static context does not qualify'],
      ['Mystery Ninja threshold',`${r.yuffieThreshold}/256 · conditional check only`],
      ['Mystery Ninja runtime gates','Forest/Jungle; save flag; Cloud level; random battle trigger'],
      ['Behavior evidence','Classic PC reference · 2026 runtime equivalence unverified']);
    for(const kind of encounterKinds){
      const details=document.createElement('details');details.className='encounter-group';
      const summary=document.createElement('summary');const records=s.records[kind];
      summary.textContent=`${kind.replaceAll('_',' ')} · ${records.filter(e=>e.weight>0).length} weighted / ${records.length} records`;details.append(summary);
      const list=document.createElement('ul');
      for(const e of records){const li=document.createElement('li'),rating=kind==='chocobo'?chocoboRating(data,e.scene_id):null;
        li.textContent=`Formation ID ${e.scene_id} · Weight ${e.weight} · Packed ${e.packed}${rating===null?'':` · Chocobo rating ${rating}`}`;list.append(li);}
      details.append(list);section.append(details);
    }
    const mystery=document.createElement('details');mystery.className='encounter-group';const summary=document.createElement('summary');summary.textContent='Mystery Ninja level → formation mapping';mystery.append(summary);
    const list=document.createElement('ul');for(const e of data.yuffie){const li=document.createElement('li');li.textContent=`First Cloud level bound ≥ level: ${e.level_max} → ${e.scene_id}${a.terrain===25?' + 1 for Jungle':''}`;list.append(li);}mystery.append(list);section.append(mystery);
    const provenance=document.createElement('details');provenance.className='encounter-group';const source=document.createElement('summary');source.textContent='Encounter source provenance';provenance.append(source);
    const p=document.createElement('p');p.textContent=`world_us.lgp / enc_w.bin · region ${s.region_id} · slot ${s.slot} · byte ${s.byte_offset} · archive payload ${data.source_record.archive_data_offset}`;provenance.append(p);section.append(provenance);
    note.textContent='Weights are raw game fields, not exact percentages. Raw rate is a danger-accumulation divisor. Movement, vehicle, Materia/Lure, story/save and RNG conditions are not simulated.';
  }
  const dl=document.createElement('dl');dl.className='property-list';for(const [key,value]of rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;row.append(dt,dd);dl.append(row);}section.insertBefore(dl,section.children[1]??null);section.append(note);parent.append(section);
}

export function mountEncounters(viewer:GaiaViewer,meta:GaiaMeta,isCurrent:()=>boolean){
  const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const file=element<HTMLInputElement>('local-encounters-file'),status=element('encounter-status'),select=element<HTMLSelectElement>('color-layer');
  let dataset:EncounterDataset|null=null,revision=0;
  const inspect=(source:number,parent:HTMLElement)=>renderEncounterInspector(parent,viewer.mesh.attributes(source),dataset,meta);
  function legend(){
    if(!['encounter','encounter-rate'].includes(select.value))return;
    const rate=select.value==='encounter-rate',area=element('terrain-legend');area.replaceChildren();element('legend-title').textContent=rate?'Raw game encounter rate':'Encounter Zones · static context';
    const items=rate?[['#37cdd7','0 · zero-rate special path'],['#96938e','128 · raw divisor'],['#f55a46','255 · raw divisor'],[encounterPalette.inactive,'Table inactive'],[encounterPalette.script,'Nonzero script gate']]:[[encounterPalette.active,'Active table + script 0'],[encounterPalette.inactive,'Table inactive'],[encounterPalette.script,'Nonzero script gate']];
    for(const [color,label]of items){const row=document.createElement('div');row.className='legend-row';const swatch=document.createElement('i');swatch.style.background=color;const text=document.createElement('span');text.textContent=label;row.append(swatch,text);area.append(row);}
    const note=document.createElement('p');note.className='control-note';note.textContent=rate?'Raw game rate is a divisor, not battles/time or area. Greater values do not imply greater frequency.':'Table lookup does not establish traversal or runtime battle availability.';area.append(note);
  }
  function adopt(data:EncounterDataset|null){
    dataset=data;viewer.setEncounters(data);
    status.textContent=data?'Encounters loaded · 16 region groups · local data':'Encounter data unavailable · optional local file';
    for(const id of ['encounter','encounter-rate'])select.querySelector<HTMLOptionElement>(`option[value="${id}"]`)!.disabled=!data;
    if(!data&&['encounter','encounter-rate'].includes(select.value)){select.value='terrain';select.dispatchEvent(new Event('change'));}
    const detail=element('selection-details'),source=Number(detail.dataset.sourceTriangle);
    if(detail.dataset.sourceTriangle!==undefined)inspect(source,detail);legend();
  }
  element('load-encounters').addEventListener('click',()=>file.click());
  file.addEventListener('change',async()=>{
    const chosen=file.files?.[0];if(!chosen)return;const request=++revision;status.textContent='Verifying local encounters…';
    try{const data=await readLocalEncounters(chosen,meta);if(isCurrent()&&request===revision)adopt(data);}
    catch(error){if(isCurrent()&&request===revision)status.textContent=error instanceof Error?error.message:String(error);}
    file.value='';
  });
  select.addEventListener('change',()=>{viewer.setColorLayer(select.value as ColorLayer);legend();});
  element<HTMLInputElement>('chocobo-tracks').addEventListener('change',e=>{const show=(e.target as HTMLInputElement).checked;viewer.setChocoboTracks(show);element('tracks-legend').hidden=!show;});
  const request=revision;void loadOptionalEncounters(meta).then(data=>{if(isCurrent()&&request===revision)adopt(data);}).catch(error=>{if(isCurrent()&&request===revision)status.textContent=`Encounter data unavailable: ${error.message}`;});
  return {inspect};
}
