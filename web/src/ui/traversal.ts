import {t,formatNumber} from '../i18n';
// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMeta,TriangleAttributes} from '../data/mesh';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import {evaluateTraversal,movementProfiles,profileById,traversalPalette,traversalProfile} from '../data/traversal';

export function renderTraversalInspector(parent:HTMLElement,a:TriangleAttributes,mode:string,meta:GaiaMeta){
  parent.querySelector('.traversal-inspector')?.remove();
  const result=evaluateTraversal(mode,a.terrain,a.script??0,a.origin),p=profileById(mode),section=document.createElement('section');
  section.className='traversal-inspector';section.dataset.state=result.state;section.dataset.mode=mode;
  const title=document.createElement('h3');title.textContent=t('inspect.traversal');section.append(title);
  const rows:[string,string][]=[[t('inspect.terrain'),a.origin?t('inspect.syntheticTerrain'):`${a.terrain} · ${meta.terrain_names[a.terrain!]??t('state.unknown')}`],[t('inspect.script'),a.script===null?t('inspect.noScript'):String(a.script)],
    [t('ui.movement'),t(`mode.${p.id}`)],[t('inspect.compatibility'),t(`state.${result.state}`)],[t('inspect.scope'),result.scope==='landing_initiation'?t('inspect.landing'):t('inspect.occupancy')],[t('inspect.reason'),t({'No WM0 source terrain':'reason.source','Normal static terrain mask; not reachability':'reason.mask','Northern Cave invokes script 9; not ordinary landing':'reason.cave','Grass permits initiation; script 7 blocks exit-state destination gate':'reason.grass'}[result.reason]!)],[t('inspect.profile'),traversalProfile.compatibility_profile],[t('inspect.evidence'),result.evidence],
    [t('inspect.collisions'),t('inspect.historyUnknown')],[t('inspect.departure'),mode==='foot'?t('inspect.notApplicable'):t(`state.${result.enter_exit_initiation}`)+' · '+t('message.currentPredicate')],[t('inspect.runtime'),t('ui.notSimulated')],
    [t('inspect.boarding'),t('inspect.candidateUnknown')],[t('inspect.runtimeEquivalence'),t('ui.notVerified')],[t('ui.tracks'),a.origin?'Unassigned':a.chocobo?t('inspect.yesIndependent'):t('inspect.noIndependent')]];
  if(p.bridge_sensitive)rows.push([t('inspect.bridge'),t('inspect.bridgeRule')]);
  if(p.tint!==null)rows.push([t('inspect.exitHeight'),t('inspect.heightRule')]);
  if(a.terrain===30)rows.push([t('inspect.backEntrance'),t('inspect.maskNotAccess')]);
  if(p.exit_mask)rows.push([t('inspect.exitGate'),`${p.exit_mask}${mode==='tiny-bronco'?'':' · script != 7'} · ${t('message.candidatePoint')}`]);
  const dl=document.createElement('dl');dl.className='property-list';for(const [key,value]of rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;row.append(dt,dd);dl.append(row);}section.append(dl);
  const details=document.createElement('details');details.className='traversal-matrix';const summary=document.createElement('summary');summary.textContent=t('inspect.compare');details.append(summary);
  const list=document.createElement('dl');list.className='property-list';
  for(const mode of movementProfiles){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');const r=evaluateTraversal(mode.id,a.terrain,a.script??0,a.origin);dt.textContent=t(`mode.${mode.id}`);dd.textContent=t(`state.${r.state}`);dd.dataset.mode=mode.id;dd.dataset.state=r.state;dd.style.color=traversalPalette[r.state];row.append(dt,dd);list.append(row);}
  details.append(list);section.append(details);
  const source=document.createElement('details'),sourceTitle=document.createElement('summary'),note=document.createElement('p');sourceTitle.textContent=t('inspect.traversalLimits');
  note.className='control-note';note.textContent='C_0074CECA / C_007666FF / C_0076667C · '+t('message.traversalEvidence',{mask:p.mask,model:p.model_id,tint:p.tint??'—'});
  source.append(sourceTitle,note);section.append(source);parent.append(section);
}

export function mountTraversal(viewer:GaiaViewer,meta:GaiaMeta){
  const select=document.getElementById('movement-mode') as HTMLSelectElement,layer=document.getElementById('color-layer') as HTMLSelectElement,controls=document.getElementById('traversal-controls')!;
  for(const p of movementProfiles){const option=document.createElement('option');option.value=p.id;option.textContent=t(`mode.${p.id}`);select.append(option);}
  const inspect=(source:number,parent:HTMLElement)=>renderTraversalInspector(parent,viewer.mesh.attributes(source),select.value,meta);
  function refresh(){
    controls.hidden=layer.value!=='traversal';
    if(layer.value==='traversal'){
      const legend=document.getElementById('terrain-legend')!;legend.replaceChildren();document.getElementById('legend-title')!.textContent=t('message.traversal',{mode:t(`mode.${select.value}`)});
      for(const [state,color]of Object.entries(traversalPalette)){const row=document.createElement('div');row.className='legend-row';const swatch=document.createElement('i'),text=document.createElement('span');swatch.style.background=color;text.textContent=t(`state.${state}`);row.append(swatch,text);legend.append(row);}
      const note=document.createElement('p');note.className='control-note';note.textContent=t('inspect.traversalNote');legend.append(note);
    }
    const parent=document.getElementById('selection-details')!;if(parent.dataset.sourceTriangle!==undefined)inspect(Number(parent.dataset.sourceTriangle),parent);
  }
  layer.addEventListener('change',refresh);select.addEventListener('change',()=>{viewer.setMovementMode(select.value);refresh();});refresh();
  return {inspect};
}
