// SPDX-License-Identifier: GPL-3.0-only
import {projectionDiagnostic,screenAssociations} from '../data/fieldProjection';
import type {SpatialSource,CanvasProjection} from '../data/fieldProjection';
import type {FieldCamera,FieldBackground} from '../data/fieldCamera';
import type {FieldWalkmesh} from '../data/fieldContext';
import type {ResourceScope} from '../app/resources';

export function mountFieldProjection(parent:HTMLElement,o:{owner:ResourceScope;t:(key:string,args?:Record<string,string|number>)=>string;fieldId:number;camera:FieldCamera|null;mesh:FieldWalkmesh;meshSHA256?:string;background?:FieldBackground;getTriangle:()=>number;getAnchor:()=>SpatialSource|null;getView:()=>CanvasProjection|null;onSource?:(s:SpatialSource|null)=>void;onInspect?:(text:string)=>void}){
 const {t}=o,box=document.createElement('details');box.id='field-projection-diagnostics';box.className='field-anchor-controls';parent.append(box);
 const add=(tag:string,text='',host:HTMLElement=box)=>{const e=document.createElement(tag);e.textContent=text;host.append(e);return e;};add('summary',t('projection.title'));
 const label=add('label',t('projection.vertex')),vertex=add('select','',label) as HTMLSelectElement;vertex.id='field-projection-vertex';for(let k=0;k<3;k++){const op=add('option',String(k),vertex) as HTMLOptionElement;op.value=String(k);}
 const useLabel=add('label',t('projection.source')),useAnchor=add('input','',useLabel) as HTMLInputElement;useAnchor.type='checkbox';useAnchor.id='field-projection-anchor';
 const status=add('p'),raw=add('pre');raw.id='field-projection-result';raw.style.whiteSpace='pre-wrap';let source:SpatialSource|null=null;let visualSource:SpatialSource|null=null,sourceKey='';
 const publish=()=>{const key=JSON.stringify(source);if(key!==sourceKey){sourceKey=key;o.onSource?.(source);}};
 function refresh(){if(o.owner.disposed)return;if(visualSource){source=visualSource;publish();return;}const tri=o.getTriangle(),at=tri*12+Number(vertex.value)*4;
  source=useAnchor.checked?o.getAnchor():Number.isInteger(tri)&&tri>=0&&tri<o.mesh.triangles?{kind:'vertex',id:`triangle:${tri}/vertex:${vertex.value}`,fieldId:o.fieldId,xyz:Array.from(o.mesh.vertices.subarray(at,at+3)),sourceSHA256:o.meshSHA256}:null;
  if(!source?.xyz||!o.camera){const missing=t('projection.missing');status.textContent=missing;raw.textContent='';box.dataset.projectionStatus=o.camera?'invalid_source':'missing_camera';publish();o.onInspect?.(missing);return;}
  const d=projectionDiagnostic(o.camera,source.xyz,o.background?.bounds,o.getView()??undefined);status.textContent=t('projection.'+d.reason)+(d.outsideBackground?' · '+t('projection.outsideBackground'):'')+(d.outsideCanvas?' · '+t('projection.outsideCanvas'):'');
  const text=`Field ${o.fieldId} / ${source.id}\nSource SHA256 ${source.sourceSHA256??'UNKNOWN'}\nXYZ [${source.xyz.join(', ')}]\nCamera ${o.camera.id}\nR [${o.camera.matrix.join(', ')}]\nT [${o.camera.translation.join(', ')}] · Zoom ${o.camera.zoom}\nq ${JSON.stringify(d.q)}\nscreen XY ${JSON.stringify(d.screen)} (background Y down)\nCanvas CSS XY ${JSON.stringify(d.canvas)}\nOcclusion UNKNOWN`;
  raw.textContent=text;box.dataset.projectionStatus=d.reason;publish();o.onInspect?.(text);
 }
 const refreshButton=add('button',t('projection.refresh')) as HTMLButtonElement;refreshButton.type='button';refreshButton.id='field-projection-refresh';refreshButton.onclick=()=>{visualSource=null;refresh();};vertex.onchange=()=>{visualSource=null;refresh();};useAnchor.onchange=()=>{visualSource=null;refresh();};
 const inputs=add('div');inputs.className='field-canvas-controls';const coordinates=['X','Y'].map(axis=>{const l=add('label',`Screen ${axis}`,inputs),i=add('input','',l) as HTMLInputElement;i.type='number';i.step='any';i.value='0';i.id='field-projection-screen-'+axis.toLowerCase();return i;});
 const result=add('p'),tileLabel=add('label','Tile'),tileChoice=add('select','',tileLabel) as HTMLSelectElement,candidates=add('pre');tileChoice.id='field-projection-tile-candidate';tileChoice.style.maxWidth='100%';candidates.id='field-projection-candidates';candidates.style.whiteSpace='pre-wrap';
 function pick(x:number,y:number){if(o.owner.disposed||!o.camera)return;visualSource=null;refresh();coordinates[0].value=String(x);coordinates[1].value=String(y);if(!Number.isFinite(x)||!Number.isFinite(y))return;
  const a=screenAssociations(o.camera,o.mesh,[x,y],o.background);result.textContent=t('projection.candidates',{triangles:a.triangles.length,tiles:a.tiles.length,invalid:a.invalidTriangles,degenerate:a.degenerateTriangles});
  tileChoice.replaceChildren();const empty=add('option',t('projection.query'),tileChoice) as HTMLOptionElement;empty.value='';for(const tile of a.tiles){const op=add('option',`L${tile.layer??0} / Tile ${tile.id} @ ${tile.sourceOffset}`,tileChoice) as HTMLOptionElement;op.value=String(tile.sourceOffset);}
  tileChoice.onchange=()=>{const tile=a.tiles.find(v=>String(v.sourceOffset)===tileChoice.value);if(!tile)return;source=visualSource={kind:'visual',id:`L${tile.layer??0}/tile:${tile.id}@${tile.sourceOffset}`,fieldId:o.fieldId,sourceSHA256:o.background?.section9SHA256};publish();const text=`Field ${o.fieldId} / ${source.id}\nSection 9 SHA256 ${source.sourceSHA256??'UNKNOWN'}\nXY [${tile.x}, ${tile.y}] / size ${tile.size??16}\n2D background evidence; XYZ UNKNOWN; occlusion UNKNOWN`;raw.textContent=text;status.textContent=t('projection.limit');box.dataset.projectionStatus='visual_only';o.onInspect?.(text);};
  candidates.textContent=`Triangle IDs [${a.triangles.join(', ')}]\n`+a.tiles.map(v=>`L${v.layer??0} / Tile ${v.id} @ ${v.sourceOffset} · Group ${v.group??0} / mask ${v.mask??0} · support ${v.supportCode??0}`).join('\n');
  box.dataset.candidateTriangles=String(a.triangles.length);box.dataset.candidateTiles=String(a.tiles.length);
 }
 const query=add('button',t('projection.query')) as HTMLButtonElement;query.type='button';query.id='field-projection-query';query.disabled=!o.camera;query.onclick=()=>pick(Number(coordinates[0].value),Number(coordinates[1].value));
 const tapLabel=add('label',t('projection.pick')),tap=add('input','',tapLabel) as HTMLInputElement;tap.type='checkbox';tap.id='field-projection-pick';tap.disabled=!o.camera;add('p',t('projection.limit'));
 o.owner.own(()=>{source=visualSource=null;sourceKey='';raw.textContent=candidates.textContent='';box.remove();});refresh();
 return {refresh,pick,source:()=>source,tapEnabled:()=>tap.checked};
}
