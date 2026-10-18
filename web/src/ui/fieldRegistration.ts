// SPDX-License-Identifier: GPL-3.0-only
import {ResourceScope} from '../app/resources';
import type {FieldCamera} from '../data/fieldCamera';
import {loadReferencePNG,REFERENCE_LIMITS,referencePixel,registrationRecord,registrationResiduals,unknownRegistrationMetadata,validMapping} from '../data/fieldRegistration';
import type {ReferenceFrame,RegistrationMapping,RegistrationMetadata,RegistrationPoint,RegistrationPreviewEvidence,RegistrationProvenance,RegistrationSource} from '../data/fieldRegistration';

export interface RegistrationOptions {
 owner:ResourceScope;t:(key:string,args?:Record<string,string|number>)=>string;fieldId:number;fieldName?:string;
 camera:FieldCamera|null;getSource:()=>RegistrationSource|null;
 getBackground?:()=>{canvas:HTMLCanvasElement;bounds:readonly number[]}|null;
 sourceSHA256?:string;
 provenance?:RegistrationProvenance;getPreviewEvidence?:()=>RegistrationPreviewEvidence|null;
}
/** A private, session-only laboratory. The parent Field owns its lifetime. */
export function mountFieldRegistration(host:HTMLElement,options:RegistrationOptions){
 const scope=new ResourceScope(),{t}=options;options.owner.own(()=>scope.dispose());
 const make=<K extends keyof HTMLElementTagNameMap>(tag:K,parent:HTMLElement,text?:string)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent.append(n);return n;};
 const details=make('details',host);details.className='field-registration-lab';details.dataset.testid='field-registration-lab';make('summary',details,t('registration.title'));
 const note=make('p',details,t('registration.private'));note.className='field-workspace-note';make('p',details,t('registration.pngProfile'));make('p',details,t('registration.unverified'));
 const status=make('p',details,t('registration.empty'));status.setAttribute('role','status');status.dataset.testid='registration-status';
 const fileLabel=make('label',details,t('registration.load')),file=make('input',fileLabel);file.type='file';file.accept='image/png';file.dataset.testid='registration-file';
 const release=make('button',details,t('registration.release'));release.type='button';release.disabled=true;release.dataset.testid='registration-release';
 const metadataDetails=make('details',details);metadataDetails.dataset.testid='registration-metadata';make('summary',metadataDetails,t('registration.metadata'));
 const cameraLabel=make('label',metadataDetails,t('registration.camera')),cameraSelect=make('select',cameraLabel);make('option',cameraSelect,t('registration.unknown')).value='';if(options.camera)make('option',cameraSelect,String(options.camera.id)).value=String(options.camera.id);
 cameraSelect.dataset.testid='registration-camera';
 const metadata=unknownRegistrationMetadata(),metadataInputs=new Map<keyof RegistrationMetadata,HTMLInputElement|HTMLSelectElement>();
 for(const key of Object.keys(metadata) as (keyof RegistrationMetadata)[]){const label=make('label',metadataDetails,t('registration.meta.'+key));let input:HTMLInputElement|HTMLSelectElement;
  if(key==='colorSpace'||key==='hdr'){input=make('select',label);make('option',input,t('registration.unknown')).value='';for(const value of key==='colorSpace'?['sRGB','other']:['off','on'])make('option',input,t('registration.value.'+value)).value=value;}
  else{input=make('input',label);input.type='text';input.maxLength=512;input.placeholder=t('registration.unknown');}input.dataset.testid='registration-meta-'+key;metadataInputs.set(key,input);scope.listen(input,'change',()=>{metadata[key]=input.value;if(frame)frame.metadata={...metadata};render();});}
 const mappingDetails=make('details',details);mappingDetails.dataset.testid='registration-mapping';make('summary',mappingDetails,t('registration.mapping'));make('p',mappingDetails,t('registration.mappingHint'));
 const mappingInputs:HTMLInputElement[]=[];
 for(const space of ['screen','reference']){const group=make('fieldset',mappingDetails);make('legend',group,t('registration.'+space));for(const key of ['x','y','width','height']){const label=make('label',group,t('registration.coordinate.'+key)),input=make('input',label);input.type='number';input.step='any';input.dataset.mapping=space+'.'+key;mappingInputs.push(input);}}
 const mappingApply=make('button',mappingDetails,t('registration.applyMapping'));mappingApply.type='button';mappingApply.dataset.testid='registration-apply-mapping';const mappingStatus=make('p',mappingDetails,t('registration.mappingMissing'));
 const marking=make('fieldset',details);make('legend',marking,t('registration.points'));const sourceLabel=make('p',marking,t('registration.noSource'));sourceLabel.dataset.testid='registration-source';
 const visualLabel=make('label',marking),visualOnly=make('input',visualLabel);visualOnly.type='checkbox';visualOnly.dataset.testid='registration-visual-only';visualLabel.append(document.createTextNode(t('registration.visualOnly')));
 const observed:HTMLInputElement[]=[];for(const axis of ['x','y']){const label=make('label',marking,t('registration.observed.'+axis)),input=make('input',label);input.type='number';input.step='any';input.dataset.testid='registration-observed-'+axis;observed.push(input);}
 const uncertaintyLabel=make('label',marking,t('registration.uncertainty')),uncertainty=make('input',uncertaintyLabel);uncertainty.type='number';uncertainty.min='0';uncertainty.step='any';uncertainty.dataset.testid='registration-uncertainty';
 const add=make('button',marking,t('registration.addPoint'));add.type='button';add.dataset.testid='registration-add-point';add.disabled=true;
 const canvasGrid=make('div',details);canvasGrid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:8px;max-width:100%;';
 const refArea=make('div',canvasGrid);make('p',refArea,t('registration.reference'));const reference=make('canvas',refArea);reference.tabIndex=0;reference.setAttribute('aria-label',t('registration.reference'));reference.dataset.testid='registration-reference';
 const compareArea=make('div',canvasGrid);make('p',compareArea,t('registration.preview'));const comparison=make('canvas',compareArea);comparison.dataset.testid='registration-comparison';
 for(const canvas of [reference,comparison]){canvas.width=canvas.height=0;canvas.style.cssText='display:block;max-width:100%;height:auto;touch-action:manipulation;border:1px solid var(--border,#626979);';}
 const modeLabel=make('label',details,t('registration.comparison')),mode=make('select',modeLabel);mode.dataset.testid='registration-mode';for(const value of ['side','overlay','difference'])make('option',mode,t('registration.mode.'+value)).value=value;
 const comparisonAcknowledged=make('label',details),ack=make('input',comparisonAcknowledged);ack.type='checkbox';ack.dataset.testid='registration-comparison-confirm';comparisonAcknowledged.append(document.createTextNode(t('registration.compareConfirm')));
 const summary=make('p',details,t('registration.noResidual'));summary.dataset.testid='registration-summary';const pointsHost=make('div',details);pointsHost.dataset.testid='registration-points';pointsHost.style.cssText='max-width:100%;overflow:auto;';
 const exportButton=make('button',details,t('registration.export'));exportButton.type='button';exportButton.disabled=true;exportButton.dataset.testid='registration-export';
 let frame:ReferenceFrame|null=null,bitmap:ImageBitmap|null=null,mapping:RegistrationMapping|null=null,points:RegistrationPoint[]=[],counter=0,request=0,cancel:AbortController|null=null,ended=false;
 const numeric=(input:HTMLInputElement)=>input.value.trim()===''?NaN:Number(input.value);
 function clear(){request++;cancel?.abort();cancel=null;bitmap?.close();bitmap=null;frame=null;mapping=null;points=[];counter=0;file.value='';cameraSelect.value='';for(const key of Object.keys(metadata) as (keyof RegistrationMetadata)[]){metadata[key]='';metadataInputs.get(key)!.value='';}for(const input of mappingInputs)input.value='';for(const input of observed)input.value='';uncertainty.value='';ack.checked=false;mode.value='side';for(const canvas of [reference,comparison])canvas.width=canvas.height=0;release.disabled=add.disabled=exportButton.disabled=true;status.textContent=t('registration.empty');render();}
 scope.own(()=>{ended=true;clear();details.remove();});
 function snapshotSource(){const s=options.getSource();return s?{...s,xyz:s.xyz?[...s.xyz]:undefined}:null;}
 function render(){
  if(ended)return;const source=options.getSource();sourceLabel.textContent=source?`${t('registration.selectedSource')}: ${source.kind} ${source.id} · Field ${source.fieldId}${source.xyz?' · XYZ ['+source.xyz.join(', ')+']':''}`:t('registration.noSource');
  release.disabled=!frame;add.disabled=exportButton.disabled=!frame;
  mappingStatus.textContent=frame&&validMapping(mapping,frame.width,frame.height)?t('registration.mappingApplied'):t('registration.mappingMissing');
  if(!frame){summary.textContent=t('registration.noResidual');pointsHost.replaceChildren();return;}
  const result=registrationResiduals(frame,options.camera,mapping,points,options.sourceSHA256??source?.sourceSHA256);
  summary.textContent=result.valid?t('registration.statistics',{valid:result.valid,excluded:result.excluded,rms:result.rms!,median:result.median!,maximum:result.maximum!})+(result.valid<3?' '+t('registration.smallSample'):''):t('registration.noResidual')+` (${result.excluded})`;
  pointsHost.replaceChildren();for(const item of result.records){const point=points.find(p=>p.id===item.id)!,row=make('div',pointsHost);row.style.cssText='overflow-wrap:anywhere;';make('span',row,`#${item.id} · ${point.source?.id??t('registration.visualOnly')} · [${point.observed.join(', ')}] · `+(item.excluded?t('registration.excluded.'+item.excluded):`ΔX ${item.delta![0].toFixed(4)} · ΔY ${item.delta![1].toFixed(4)} · ${item.distance!.toFixed(4)} px`));const remove=make('button',row,t('registration.removePoint'));remove.type='button';remove.onclick=()=>{points=points.filter(p=>p.id!==item.id);render();};}
  draw(result);
 }
 // Both images are repeatedly read in difference mode; keep their readback profiles consistent.
 function draw(result:ReturnType<typeof registrationResiduals>){
  if(!frame||!bitmap)return;reference.width=comparison.width=frame.width;reference.height=comparison.height=frame.height;const r=reference.getContext('2d',{willReadFrequently:true})!,c=comparison.getContext('2d',{willReadFrequently:true})!;r.drawImage(bitmap,0,0);
  const b=options.getBackground?.(),ready=validMapping(mapping,frame.width,frame.height),strict=ready&&ack.checked&&metadata.colorSpace==='sRGB'&&metadata.hdr==='off'&&!!metadata.crop.trim()&&!!metadata.scaling.trim()&&!!metadata.filters.trim();
  mode.querySelectorAll('option').forEach(o=>o.disabled=o.value!=='side'&&!strict);if(mode.value!=='side'&&!strict)mode.value='side';
  if(b&&ready){const start=referencePixel([b.bounds[0],b.bounds[1]],mapping!);c.imageSmoothingEnabled=false;c.drawImage(b.canvas,start[0],start[1],b.canvas.width*mapping!.reference.width/mapping!.screen.width,b.canvas.height*mapping!.reference.height/mapping!.screen.height);
   if(mode.value==='overlay'&&strict){c.globalAlpha=.5;c.drawImage(bitmap,0,0);c.globalAlpha=1;}
   if(mode.value==='difference'&&strict){const a=c.getImageData(0,0,frame.width,frame.height),original=r.getImageData(0,0,frame.width,frame.height);for(let i=0;i<a.data.length;i+=4){for(let k=0;k<3;k++)a.data[i+k]=Math.abs(a.data[i+k]-original.data[i+k]);a.data[i+3]=255;}c.putImageData(a,0,0);}
  }
  for(const item of result.records){r.beginPath();r.arc(item.observed[0],item.observed[1],3,0,Math.PI*2);r.strokeStyle='#ffdf55';r.lineWidth=1;r.stroke();if(!item.excluded&&item.predicted){r.beginPath();r.moveTo(...item.predicted);r.lineTo(...item.observed);r.strokeStyle='#fc5d78';r.stroke();r.fillStyle='#4de2ff';r.fillRect(item.predicted[0]-1,item.predicted[1]-1,3,3);}}
 }
 scope.listen(file,'change',()=>{const f=file.files?.[0];if(!f)return;clear();const ticket=++request;cancel=new AbortController();const signal=cancel.signal;status.textContent=t('registration.loading');void loadReferencePNG(f,signal).then(loaded=>{if(scope.disposed||ticket!==request){loaded.bitmap.close();return;}bitmap=loaded.bitmap;frame={id:loaded.sha256,sha256:loaded.sha256,width:loaded.width,height:loaded.height,fieldId:options.fieldId,cameraId:null,metadata:{...metadata}};status.textContent=`${loaded.width} × ${loaded.height} · SHA256 ${loaded.sha256}`;mappingInputs[4].value='0';mappingInputs[5].value='0';mappingInputs[6].value=String(loaded.width);mappingInputs[7].value=String(loaded.height);render();}).catch(error=>{if(scope.disposed||ticket!==request||signal.aborted)return;status.textContent=t('registration.rejected');console.warn('Reference frame rejected:',error instanceof Error?error.message:'invalid');});});
 scope.listen(release,'click',clear);scope.listen(cameraSelect,'change',()=>{if(frame)frame.cameraId=cameraSelect.value===''?null:Number(cameraSelect.value);render();});
 scope.listen(mappingApply,'click',()=>{const n=mappingInputs.map(numeric),candidate={screen:{x:n[0],y:n[1],width:n[2],height:n[3]},reference:{x:n[4],y:n[5],width:n[6],height:n[7]}};mapping=frame&&validMapping(candidate,frame.width,frame.height)?candidate:null;render();});
 scope.listen(reference,'pointerdown',((event:PointerEvent)=>{if(!frame||event.button!==0)return;const box=reference.getBoundingClientRect();observed[0].value=String((event.clientX-box.left)*frame.width/box.width);observed[1].value=String((event.clientY-box.top)*frame.height/box.height);}) as EventListener);
 scope.listen(add,'click',()=>{if(!frame)return;const p=observed.map(numeric),u=uncertainty.value.trim()===''?null:numeric(uncertainty),source=visualOnly.checked?null:snapshotSource();if(points.length>=REFERENCE_LIMITS.points||p.some((n,i)=>!Number.isFinite(n)||n<0||n>=[frame!.width,frame!.height][i])||u!==null&&(!Number.isFinite(u)||u<0)||!visualOnly.checked&&(!source?.xyz||source.fieldId!==options.fieldId)){status.textContent=t('registration.invalidPoint');return;}points.push({id:++counter,frameId:frame.id,cameraId:options.camera?.id??null,source,observed:[p[0],p[1]],uncertainty:u,grade:visualOnly.checked?'visual':'manual'});render();});
 scope.listen(mode,'change',render);scope.listen(ack,'change',render);
 scope.listen(exportButton,'click',()=>{if(!frame)return;const sourceSHA256=options.sourceSHA256??options.getSource()?.sourceSHA256,data=registrationRecord(frame,mapping,points,registrationResiduals(frame,options.camera,mapping,points,sourceSHA256),{camera:options.camera,provenance:options.provenance,sourceSHA256,previewEvidence:options.getPreviewEvidence?.()}),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gaiagis-registration-research.json';a.click();URL.revokeObjectURL(url);});
 render();return {refresh:render,dispose:()=>scope.dispose()};
}
