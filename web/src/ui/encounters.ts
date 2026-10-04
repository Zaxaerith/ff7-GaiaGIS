import {t,formatNumber} from '../i18n';
// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMeta,TriangleAttributes} from '../data/mesh';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import {chocoboRating,encounterKinds,encounterPalette,loadOptionalEncounters,readLocalEncounters,resolveEncounter} from '../data/encounters';
import type {ColorLayer,EncounterDataset} from '../data/encounters';

export function renderEncounterInspector(parent:HTMLElement,a:TriangleAttributes,data:EncounterDataset|null,meta:GaiaMeta){
  parent.querySelector('.gameplay-inspector')?.remove();
  const section=document.createElement('section');section.className='gameplay-inspector';
  const title=document.createElement('h3');title.textContent=t('inspect.gameplay');section.append(title);
  const rows:[string,string][]=[[t('inspect.tracks'),a.origin?t('inspect.noSource'):a.chocobo?t('inspect.yesWM'):t('inspect.noWM')]];
  const note=document.createElement('p');note.className='control-note';
  if(a.origin){rows.push([t('inspect.encounters'),t('inspect.unassigned')]);}
  else if(!data){rows.push([t('inspect.encounters'),t('inspect.encUnavailable')]);}
  else {
    const r=resolveEncounter(data,a.region!,a.terrain!),s=r.set;
    section.dataset.encounterSet=s.id;section.dataset.tableActive=String(s.active);section.dataset.tracks=String(a.chocobo);
    const name=(id:number)=>meta.terrain_names[id]??`Terrain ${id}`;
    rows.push([t('inspect.regionTable'),`${a.region} → ${r.effectiveRegion}${r.effectiveRegion!==a.region?' · '+t('message.clamped'):''}`],
      [t('inspect.effectiveTerrain'),`${name(a.terrain!)} → ${name(r.effectiveTerrain)}`],
      [t('inspect.encSlot'),`${s.id}${r.fallback?' · '+t('message.terrainFallback'):''}`],
      [t('inspect.enabled'),s.active?t('inspect.yesActive'):t('inspect.no')],[t('inspect.rawRate'),String(s.encounter_rate)],
      [t('inspect.scriptGate'),a.script===0?t('inspect.scriptPass'):t('message.scriptBlocks',{script:a.script!})],
      [t('inspect.chocoboTable'),s.records.chocobo.some(e=>e.weight>0)?t('inspect.weighted'):t('inspect.noWeighted')],
      [t('inspect.runtime'),t('inspect.conditionalRuntime')],
      [t('inspect.ninja'),s.active&&a.script===0&&r.yuffieTerrain&&r.yuffieThreshold>0?t('inspect.qualifies'):t('inspect.notQualify')],
      [t('inspect.ninjaThreshold'),t('message.threshold',{value:r.yuffieThreshold})],
      [t('inspect.ninjaGates'),t('inspect.ninjaRequirements')],
      [t('inspect.behaviorEvidence'),t('inspect.classic')]);
    for(const kind of encounterKinds){
      const details=document.createElement('details');details.className='encounter-group';
      const summary=document.createElement('summary');const records=s.records[kind];
      summary.textContent=t('message.recordGroup',{kind:t(`kind.${kind}`),weighted:records.filter(e=>e.weight>0).length,count:records.length});details.append(summary);
      const list=document.createElement('ul');
      for(const e of records){const li=document.createElement('li'),rating=kind==='chocobo'?chocoboRating(data,e.scene_id):null;
        li.textContent=t('message.record',{scene:e.scene_id,weight:e.weight,packed:e.packed})+(rating===null?'':' · '+t('message.rating',{rating}));list.append(li);}
      details.append(list);section.append(details);
    }
    const mystery=document.createElement('details');mystery.className='encounter-group';const summary=document.createElement('summary');summary.textContent=t('inspect.ninjaMapping');mystery.append(summary);
    const list=document.createElement('ul');for(const e of data.yuffie){const li=document.createElement('li');li.textContent=t('message.level',{level:e.level_max,scene:e.scene_id})+(a.terrain===25?' '+t('message.jungleExtra'):'');list.append(li);}mystery.append(list);section.append(mystery);
    const provenance=document.createElement('details');provenance.className='encounter-group';const source=document.createElement('summary');source.textContent=t('inspect.encProvenance');provenance.append(source);
    const p=document.createElement('p');p.textContent=t('message.encSource',{region:s.region_id,slot:s.slot,byte:s.byte_offset,offset:data.source_record.archive_data_offset});provenance.append(p);section.append(provenance);
    note.textContent=t('inspect.weightsNote');
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
    const rate=select.value==='encounter-rate',area=element('terrain-legend');area.replaceChildren();element('legend-title').textContent=rate?t('inspect.rawRate'):t('inspect.encStatic');
    const items=rate?[['#37cdd7',t('message.zeroRate')],['#96938e',t('message.rawDivisor',{value:128})],['#f55a46',t('message.rawDivisor',{value:255})],[encounterPalette.inactive,t('inspect.inactive')],[encounterPalette.script,t('inspect.nonzeroScript')]]:[[encounterPalette.active,t('inspect.activeScript')],[encounterPalette.inactive,t('inspect.inactive')],[encounterPalette.script,t('inspect.nonzeroScript')]];
    for(const [color,label]of items){const row=document.createElement('div');row.className='legend-row';const swatch=document.createElement('i');swatch.style.background=color;const text=document.createElement('span');text.textContent=label;row.append(swatch,text);area.append(row);}
    const note=document.createElement('p');note.className='control-note';note.textContent=rate?t('inspect.rateNote'):t('inspect.lookupNote');area.append(note);
  }
  function adopt(data:EncounterDataset|null){
    dataset=data;viewer.setEncounters(data);
    status.textContent=data?t('load.encountersLoaded'):t('ui.encountersUnavailable');
    for(const id of ['encounter','encounter-rate'])select.querySelector<HTMLOptionElement>(`option[value="${id}"]`)!.disabled=!data;
    if(!data&&['encounter','encounter-rate'].includes(select.value)){select.value='terrain';select.dispatchEvent(new Event('change'));}
    const detail=element('selection-details'),source=Number(detail.dataset.sourceTriangle);
    if(detail.dataset.sourceTriangle!==undefined)inspect(source,detail);legend();
  }
  element('load-encounters').addEventListener('click',()=>file.click());
  file.addEventListener('change',async()=>{
    const chosen=file.files?.[0];if(!chosen)return;const request=++revision;status.textContent=t('load.encounters');
    try{const data=await readLocalEncounters(chosen,meta);if(isCurrent()&&request===revision)adopt(data);}
    catch(error){if(isCurrent()&&request===revision)status.textContent=t('error.dataset');status.title=error instanceof Error?error.message:String(error);}
    file.value='';
  });
  select.addEventListener('change',()=>{viewer.setColorLayer(select.value as ColorLayer);legend();});
  element<HTMLInputElement>('chocobo-tracks').addEventListener('change',e=>{const show=(e.target as HTMLInputElement).checked;viewer.setChocoboTracks(show);element('tracks-legend').hidden=!show;});
  const request=revision;void loadOptionalEncounters(meta).then(data=>{if(isCurrent()&&request===revision)adopt(data);}).catch(error=>{if(isCurrent()&&request===revision)status.textContent=t('ui.encountersUnavailable');status.title=error.message;});
  return {inspect};
}
