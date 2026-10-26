// SPDX-License-Identifier: GPL-3.0-only
import {createRegionalTerrain,releaseRegionalTerrain,regionalDistribution,contributionPercent,regionalSlopeBins,regionalDirections} from '../analysis/regionalTerrain';
import type {RegionalTerrainStatistics,RegionalAxis,RegionalSort,RegionalMetrics} from '../analysis/regionalTerrain';
import type {WM0Source} from '../analysis/wm0Source';
import type {GaiaMeta} from '../data/mesh';
import type {GaiaViewer} from '../viewer/GaiaViewer';
import {ResourceScope} from '../app/resources';
import {appStore} from '../app/state';
import {sourceGeographic} from '../explorer/coordinates';
import {t,onLocaleChange,formatNumber} from '../i18n';
import {sourceResultPager} from './surfaceQueries';

/** One current WM0 source owner; no new renderer, resource or persistent state. */
export function mountRegionalTerrain(viewer:GaiaViewer,meta:GaiaMeta,getSource:()=>WM0Source,usable:()=>boolean,selectFace:(face:number)=>void){
 const scope=new ResourceScope(),box=document.createElement('details');box.id='regional-terrain-statistics';box.className='analysis-group surface-query-panel';
 const make=<K extends keyof HTMLElementTagNameMap>(tag:K,parent:HTMLElement,text='')=>{const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;};
 const title=make('summary',box),note=make('p',box),build=make('button',box),clear=make('button',box),status=make('p',box);
 const selector=(id:string,options:string[])=>{const label=make('label',box),text=make('span',label),select=make('select',label);select.id=id;for(const value of options){const o=make('option',select);o.value=value;}return {label,text,select};};
 const view=selector('regional-view',['global','region','terrain']),group=selector('regional-group',[]),sorting=selector('regional-sort',['area','count','id']);
 const content=make('section',box),facesTitle=make('h4',box),faceNote=make('p',box);content.className='spatial-card';status.setAttribute('role','status');build.type=clear.type='button';build.id='regional-compute';clear.id='regional-clear';
 note.className=status.className=faceNote.className='control-note';document.getElementById('analysis-panel')!.prepend(box);
 let source:WM0Source|undefined,stats:RegionalTerrainStatistics|undefined,mode:'global'|RegionalAxis='global',regionId:number|null=null,terrainId:number|null=null,sort:RegionalSort='area',cellKey:string|null=null;
 let frame=0,ticket=0,busy=false,failed=false;
 const name=(axis:RegionalAxis,id:number)=>`${id} · ${(axis==='region'?meta.region_names:meta.terrain_names)[id]||t('ui.unknown')}`;
 const number=(n:number|null,digits=3)=>n===null?t('regional.na'):formatNumber(n,digits);
 const percentage=(value:number,total:number)=>{const p=contributionPercent(value,total);return p===null?t('regional.na'):formatNumber(p,4)+'%';};
 const pager=sourceResultPager<number>(box,'regional-faces',face=>{const a=source!.source(face);return `${a.section}/${a.mesh}/${a.triangle}`;},face=>{
  if(!source||!usable())return;const points=source.corners(face),center=[0,1,2].map(j=>points.reduce((sum,p)=>sum+p[j]/3,0)),geo=sourceGeographic(...center as [number,number,number]);selectFace(face);viewer.flyToLocation(geo[0],geo[1]);
 },(b,face)=>{b.dataset.regionalFace=String(face);});
 function properties(host:HTMLElement,rows:[string,string][]){const dl=make('dl',host);dl.className='property-list';for(const [key,value]of rows){const row=make('div',dl);make('dt',row,key);make('dd',row,value);}}
 function table(host:HTMLElement,headers:string[]){const wrap=make('div',host);wrap.className='variant-table-scroll';const table=make('table',wrap),head=make('tr',make('thead',table));for(const h of headers)make('th',head,h).scope='col';return make('tbody',table);}
 function metrics(m:RegionalMetrics){
  properties(content,([
   ['faces',number(m.faces)],['area',number(m.area)],['height',`${number(m.yMin)} … ${number(m.yMax)} raw Y`],['zero',number(m.zeroXZ)],['duplicates',number(m.duplicateMembers)],
   ['slopeMean',number(m.slopeMean,6)],['slopeDenominator',number(m.slopeArea)],['slopeUndefined',number(m.faces-m.slopeFaces)],['aspectCoverage',percentage(m.aspectArea,m.area)],['aspectDenominator',number(m.aspectArea)],['flatArea',number(m.flatArea)],['aspectUndefinedArea',number(m.area-m.aspectArea)]
  ] as [string,string][]).map(([key,value])=>[t('regional.'+key),value]));
  const detail=make('details',content);make('summary',detail,t('regional.distributions'));make('p',detail,t('regional.slopeNote'));
  const slope=table(detail,[t('regional.slopeBin'),t('regional.area'),t('regional.areaPercent')]);
  regionalSlopeBins.forEach(([start,end],i)=>{const row=make('tr',slope);for(const value of [`[${start},${end})`,number(m.slopeAreas[i]),percentage(m.slopeAreas[i],m.slopeArea)])make('td',row,value);});
  make('p',detail,t('regional.aspectNote'));const aspect=table(detail,[t('regional.direction'),t('regional.area'),t('regional.areaPercent')]);
  regionalDirections.forEach((direction,i)=>{const row=make('tr',aspect);for(const value of [t('regional.dir.'+direction),number(m.aspectAreas[i]),percentage(m.aspectAreas[i],m.aspectArea)])make('td',row,value);});
 }
 function render(){
  box.hidden=appStore.state.map.id!=='WM0'||appStore.state.view.spatial!=='world';
  title.textContent=t('regional.title');note.textContent=t('regional.scope');build.textContent=t('regional.compute');clear.textContent=t('regional.clear');status.textContent=t(!usable()?'regional.unavailable':busy?'regional.busy':failed?'regional.unavailable':stats?'regional.ready':'regional.lazy');
  for(const [control,key]of [[view,'view'],[group,mode==='region'?'region':'terrain'],[sorting,'sort']] as const){control.text.textContent=t('regional.'+key);control.select.setAttribute('aria-label',t('regional.'+key));}
  for(const o of view.select.options)o.textContent=t(o.value==='global'?'regional.global':o.value==='region'?'regional.byRegion':'regional.byTerrain');for(const o of sorting.select.options)o.textContent=t('regional.sort.'+o.value);view.select.value=mode;sorting.select.value=sort;
  group.label.hidden=sorting.label.hidden=mode==='global';group.select.replaceChildren();
  if(stats&&mode!=='global'){const groups=mode==='region'?stats.regions:stats.terrains;for(const id of groups.keys()){const o=make('option',group.select,name(mode,id));o.value=String(id);}group.select.value=String(mode==='region'?regionId:terrainId);}
  for(const c of [view.select,group.select,sorting.select])c.disabled=!stats||!usable();build.disabled=!usable()||busy;clear.disabled=!stats&&!busy;
  content.replaceChildren();
  if(stats){
   if(mode==='global'){
    properties(content,[[t('regional.regions'),number(stats.regions.size)],[t('regional.terrains'),number(stats.terrains.size)],[t('regional.cells'),number(stats.cells.size)]]);metrics(stats.global);
    const check=make('details',content);make('summary',check,t('regional.marginals'));make('p',check,t(stats.marginals.consistent?'regional.agree':'regional.disagree'));make('p',check,t('regional.marginalOrder'));
    properties(check,[[t('regional.faces'),stats.marginals.faces.map(n=>number(n)).join(' / ')],[t('regional.area'),stats.marginals.areas.map(n=>number(n)).join(' / ')]]);
   }else{
    const id=(mode==='region'?regionId:terrainId)!,selected=(mode==='region'?stats.regions:stats.terrains).get(id);
    if(selected){make('h4',content,name(mode,id));metrics(selected.summary);make('p',content,t('regional.denominator',{group:t('regional.'+mode),count:number(selected.summary.faces),area:number(selected.summary.area)}));
     const other=mode==='region'?'terrain':'region',body=table(content,[t('regional.'+other),t('regional.faces'),t('regional.countPercent'),t('regional.area'),t('regional.areaPercent')]);
     for(const row of regionalDistribution(stats,mode,id,sort)){const tr=make('tr',body),b=make('button',make('td',tr),name(other,row.id));b.type='button';b.dataset.regionalCell=row.cell.key;b.setAttribute('aria-pressed',String(cellKey===row.cell.key));b.onclick=()=>{cellKey=row.cell.key;for(const button of content.querySelectorAll<HTMLButtonElement>('[data-regional-cell]'))button.setAttribute('aria-pressed',String(button.dataset.regionalCell===cellKey));renderFaces();};
      for(const value of [number(row.cell.count),row.countPercent===null?t('regional.na'):number(row.countPercent,4)+'%',number(row.cell.area),row.areaPercent===null?t('regional.na'):number(row.areaPercent,4)+'%'])make('td',tr,value);
     }
    }
   }
  }
  renderFaces();
 }
 function renderFaces(){const cell=cellKey?stats?.cells.get(cellKey):undefined;facesTitle.textContent=t('regional.sourceFaces');faceNote.textContent=cell?t('regional.cellFaces',{region:name('region',cell.region),terrain:name('terrain',cell.terrain),count:cell.count}):t('regional.pickCell');pager.set(cell?.faces??[]);}
 async function prepare(){
  if(!usable()||scope.disposed||busy)return;if(stats){render();return;}const request=++ticket;busy=true;failed=false;render();
  await new Promise<void>(resolve=>{frame=requestAnimationFrame(()=>{frame=0;resolve();});});if(scope.disposed||request!==ticket||!usable())return;
  try{source=getSource();stats=createRegionalTerrain(source);regionId=stats.regions.keys().next().value??null;terrainId=stats.terrains.keys().next().value??null;box.dataset.faces=String(stats.global.faces);box.dataset.prepareMs=String(stats.milliseconds);}catch(e){failed=true;status.title=String(e);}
  if(scope.disposed||request!==ticket||!usable())return;busy=false;render();
 }
 function reset(){ticket++;if(frame)cancelAnimationFrame(frame);frame=0;busy=failed=false;if(source)releaseRegionalTerrain(source);source=undefined;stats=undefined;mode='global';regionId=terrainId=null;sort='area';cellKey=null;delete box.dataset.faces;delete box.dataset.prepareMs;status.removeAttribute('title');pager.set([]);render();}
 build.onclick=()=>void prepare();clear.onclick=reset;view.select.onchange=()=>{mode=view.select.value as typeof mode;cellKey=null;render();};group.select.onchange=()=>{if(mode==='region')regionId=Number(group.select.value);else terrainId=Number(group.select.value);cellKey=null;render();};sorting.select.onchange=()=>{sort=sorting.select.value as RegionalSort;render();};
 scope.listen(box,'toggle',()=>{if(box.open)void prepare();});scope.listen(document,'gaiagis-map-changing',reset);let available=usable();
 scope.own(appStore.subscribe(()=>{const next=usable();box.hidden=appStore.state.map.id!=='WM0'||appStore.state.view.spatial!=='world';if(available&&!next)reset();if(available!==next){available=next;render();}}));scope.own(onLocaleChange(render));render();
 return {dispose(){reset();scope.dispose();pager.dispose();box.remove();}};
}
