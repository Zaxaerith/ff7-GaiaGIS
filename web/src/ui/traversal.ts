// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMeta,TriangleAttributes} from '../data/mesh';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import {evaluateTraversal,movementProfiles,profileById,traversalPalette,traversalProfile} from '../data/traversal';

export function renderTraversalInspector(parent:HTMLElement,a:TriangleAttributes,mode:string,meta:GaiaMeta){
  parent.querySelector('.traversal-inspector')?.remove();
  const result=evaluateTraversal(mode,a.terrain,a.script??0,a.origin),p=profileById(mode),section=document.createElement('section');
  section.className='traversal-inspector';section.dataset.state=result.state;section.dataset.mode=mode;
  const title=document.createElement('h3');title.textContent='Traversal';section.append(title);
  const rows:[string,string][]=[['Terrain',a.origin?'Synthetic cap · unassigned':`${a.terrain} · ${meta.terrain_names[a.terrain!]??'Unknown'}`],['Script',a.script===null?'No source script':String(a.script)],
    ['Movement mode',p.name],['Static compatibility',result.state],['Scope',result.scope==='landing_initiation'?'Landing initiation · not air travel':'Ordinary terrain occupancy'],['Reason',result.reason],['Profile',traversalProfile.compatibility_profile],['Evidence',result.evidence],
    ['Movement / collisions','Unknown · history, surface selection and local state required'],['Departure initiation',mode==='foot'?'Not applicable':`${result.enter_exit_initiation} · current terrain predicate only`],['Runtime availability','Not simulated'],
    ['Completed boarding / exit','Unknown · candidate points and runtime state required'],['2026 runtime equivalence','Not verified'],['Chocobo Tracks',a.origin?'Unassigned':a.chocobo?'Yes · independent encounter flag':'No · independent encounter flag']];
  if(p.bridge_sensitive)rows.push(['Bridge context','Normal mask shown; current terrain 13/14 can restrict destination to 13/14/29']);
  if(p.tint!==null)rows.push(['Exit height constraint','Each candidate sample needs |Δheight| < 200 raw units; not evaluated from a single triangle']);
  if(a.terrain===30)rows.push(['Back Entrance','Mask occupancy does not establish script/field access']);
  if(p.exit_mask)rows.push(['Exit candidate gate',`${p.exit_mask}${mode==='tiny-bronco'?'':' · script != 7'} · candidate point differs from current point`]);
  const dl=document.createElement('dl');dl.className='property-list';for(const [key,value]of rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;row.append(dt,dd);dl.append(row);}section.append(dl);
  const details=document.createElement('details');details.className='traversal-matrix';const summary=document.createElement('summary');summary.textContent='Compare all movement modes';details.append(summary);
  const list=document.createElement('dl');list.className='property-list';
  for(const mode of movementProfiles){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');const r=evaluateTraversal(mode.id,a.terrain,a.script??0,a.origin);dt.textContent=mode.name;dd.textContent=r.state;dd.dataset.mode=mode.id;dd.dataset.state=r.state;dd.style.color=traversalPalette[r.state];row.append(dt,dd);list.append(row);}
  details.append(list);section.append(details);
  const source=document.createElement('details'),sourceTitle=document.createElement('summary'),note=document.createElement('p');sourceTitle.textContent='Traversal evidence / limits';
  note.className='control-note';note.textContent=`Classic PC C_0074CECA / C_007666FF / C_0076667C. Model ${p.model_id}${p.tint===null?'':` · tint ${p.tint} (cross_checked_reference)`}. Normal mask ${p.mask}. Allowed means static terrain compatibility, not reachable or available now. No slope threshold is asserted; boarding, candidate displacement, bridge history and scripts are not simulated.`;
  source.append(sourceTitle,note);section.append(source);parent.append(section);
}

export function mountTraversal(viewer:GaiaViewer,meta:GaiaMeta){
  const select=document.getElementById('movement-mode') as HTMLSelectElement,layer=document.getElementById('color-layer') as HTMLSelectElement,controls=document.getElementById('traversal-controls')!;
  for(const p of movementProfiles){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);}
  const inspect=(source:number,parent:HTMLElement)=>renderTraversalInspector(parent,viewer.mesh.attributes(source),select.value,meta);
  function refresh(){
    controls.hidden=layer.value!=='traversal';
    if(layer.value==='traversal'){
      const legend=document.getElementById('terrain-legend')!;legend.replaceChildren();document.getElementById('legend-title')!.textContent=`Traversal · ${profileById(select.value).name}`;
      for(const [state,color]of Object.entries(traversalPalette)){const row=document.createElement('div');row.className='legend-row';const swatch=document.createElement('i'),text=document.createElement('span');swatch.style.background=color;text.textContent=state[0].toUpperCase()+state.slice(1);row.append(swatch,text);legend.append(row);}
      const note=document.createElement('p');note.className='control-note';note.textContent='Allowed = static classic-PC terrain compatibility, not guaranteed story/runtime reachability. Highwind: landing initiation only. Unknown: no source attribute. Normal masks exclude bridge-history overrides.';legend.append(note);
    }
    const parent=document.getElementById('selection-details')!;if(parent.dataset.sourceTriangle!==undefined)inspect(Number(parent.dataset.sourceTriangle),parent);
  }
  layer.addEventListener('change',refresh);select.addEventListener('change',()=>{viewer.setMovementMode(select.value);refresh();});refresh();
  return {inspect};
}
