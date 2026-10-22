// SPDX-License-Identifier: GPL-3.0-only
import {createVariantComparison} from '../analysis/variantComparison';
import type {VariantComparisonQueries} from '../analysis/variantComparison';
import type {SurfaceHit,SurfaceTrace} from '../analysis/native';
import type {WorldVariants,VariantFace} from '../data/worldVariants';
import {t,formatNumber} from '../i18n';
import {surfaceCoordinate,sourceResultPager,drawSurfacePlot} from './surfaceQueries';

export function mountVariantComparison(parent:HTMLElement,select:(face:VariantFace,state:number)=>void,clearSelection:()=>void){
 const box=document.createElement('details');box.id='variant-comparison';box.className='surface-query-panel';box.hidden=true;
 const title=document.createElement('summary'),note=document.createElement('p'),leftLabel=document.createElement('label'),rightLabel=document.createElement('label');
 const left=document.createElement('select'),right=document.createElement('select');left.id='variant-compare-left';right.id='variant-compare-right';
 for(const input of [left,right])for(let s=0;s<5;s++){const option=document.createElement('option');option.value=option.textContent=String(s);input.append(option);}right.value='4';leftLabel.htmlFor=left.id;rightLabel.htmlFor=right.id;
 const inputs=new Map<string,HTMLInputElement>(),coordinate=(id:string,label:string)=>{const c=surfaceCoordinate('variant-compare-'+id,label);inputs.set(id,c.input);return c.wrap;};
 const position=document.createElement('fieldset'),positionTitle=document.createElement('legend'),transect=document.createElement('fieldset'),transectTitle=document.createElement('legend');
 const query=document.createElement('button'),run=document.createElement('button'),clearButton=document.createElement('button');for(const b of [query,run,clearButton])b.type='button';query.id='variant-compare-query';run.id='variant-compare-transect';clearButton.id='variant-compare-clear';
 position.append(positionTitle,coordinate('x','X'),coordinate('z','Z'),query);transect.append(transectTitle,coordinate('a-x','A · X'),coordinate('a-z','A · Z'),coordinate('b-x','B · X'),coordinate('b-z','B · Z'),run);
 const status=document.createElement('p'),delta=document.createElement('p'),chart=document.createElement('div');status.id='variant-compare-status';status.setAttribute('role','status');delta.id='variant-compare-delta';chart.id='variant-compare-chart';
 box.append(title,note,leftLabel,left,rightLabel,right,position,transect,clearButton,status,delta,chart);parent.append(box);
 type Hit=SurfaceHit<VariantFace>;type Trace=SurfaceTrace<VariantFace>;type Row={state:number;side:number;item:Hit|Trace};
 let data:WorldVariants|null=null,engine:VariantComparisonQueries|null=null,point:ReturnType<VariantComparisonQueries['point']>|null=null,profile:ReturnType<VariantComparisonQueries['transect']>|null=null,rows:Row[]=[],error=false;
 const sideLabel=(side:number,state:number)=>t(side===0?'variant.compare.left':'variant.compare.right')+' '+state;
 function identify(row:Row){return sideLabel(row.side,row.state)+' · '+row.item.source.id;}
 function describe(row:Row){const r=row.item,kind=t('native.'+r.kind);return 'exactHeights'in r?kind+' · raw Y '+r.exactHeights.join(r.kind==='surface'?' = ':' … '):kind+' · t '+r.exactT.join(' … ');}
 const pager=sourceResultPager<Row>(box,'variant-compare',r=>identify(r)+' · '+describe(r),r=>select(r.item.source,r.state),(b,r)=>{b.dataset.variantResult=r.item.source.id;b.dataset.queryState=String(r.state);b.dataset.side=String(r.side);b.title=data?.sourceHash??'';});
 const read=(prefix:string)=>[inputs.get(prefix?prefix+'-x':'x')!.value,inputs.get(prefix?prefix+'-z':'z')!.value] as [string,string];
 function clearResults(){point=profile=null;rows=[];error=false;pager.set(rows);chart.replaceChildren();status.textContent=delta.textContent='';for(const key of Object.keys(box.dataset))delete box.dataset[key];clearSelection();}
 function clear(){clearResults();for(const input of inputs.values())input.value='';}
 function render(){
  title.textContent=t('variant.compare.title');note.textContent=t('variant.compare.note');leftLabel.textContent=t('variant.compare.left');rightLabel.textContent=t('variant.compare.right');positionTitle.textContent=t('native.position');transectTitle.textContent=t('native.transect');query.textContent=t('native.queryRun');run.textContent=t('native.transectRun');clearButton.textContent=t('native.queryClear');
  if(point){status.textContent=t('variant.compare.'+point.coverage)+' · '+[point.left,point.right].map((r,i)=>sideLabel(i,r.state)+': '+t(r.status==='empty'?'variant.compare.empty':'native.query.'+r.status)+' · '+t('native.queryCount',{count:r.hits.length,heights:r.heightCount})).join(' / ');delta.textContent=point.delta?t('variant.compare.delta')+' '+point.delta.exact+' raw Y (≈ '+formatNumber(point.delta.value,6)+')':t('variant.compare.noDelta');}
  else if(profile){status.textContent=t('variant.compare.profileNote');delta.textContent=t('variant.compare.coverageNote');drawSurfacePlot(chart,[profile.left,profile.right].map((r,i)=>({label:sideLabel(i,r.state),state:r.state,traces:r.traces,coverage:r.coverage})),profile.left.length,(r,i)=>identify({side:i,state:(i===0?profile!.left:profile!.right).state,item:r})+' · '+t('native.'+r.kind),(r,i)=>select(r.source,(i===0?profile!.left:profile!.right).state),r=>r.source.id);}
  else if(error)status.textContent=t('native.queryInvalid');pager.set(rows);
 }
 query.onclick=()=>{if(!engine)return;clearResults();try{point=engine.point(Number(left.value),Number(right.value),read(''));rows=[point.left,point.right].flatMap((r,side)=>r.hits.map(item=>({state:r.state,side,item})));box.dataset.coverage=point.coverage;box.dataset.leftHits=String(point.left.hits.length);box.dataset.rightHits=String(point.right.hits.length);box.dataset.delta=point.delta?.exact??'';box.dataset.queryMs=String(point.left.milliseconds+point.right.milliseconds);}catch{error=true;}render();};
 run.onclick=()=>{if(!engine)return;clearResults();try{profile=engine.transect(Number(left.value),Number(right.value),read('a'),read('b'));rows=[profile.left,profile.right].flatMap((r,side)=>r.traces.map(item=>({state:r.state,side,item})));box.dataset.leftTraces=String(profile.left.traces.length);box.dataset.rightTraces=String(profile.right.traces.length);box.dataset.transectMs=String(profile.left.milliseconds+profile.right.milliseconds);}catch{error=true;}render();};
 clearButton.onclick=clear;left.onchange=right.onchange=clearResults;render();
 return {setResource(value:WorldVariants|null){if(value!==data){clear();data=value;engine=value?createVariantComparison(value):null;}box.hidden=!value;},translate:render,dispose(){clear();data=null;engine=null;pager.dispose();query.onclick=run.onclick=clearButton.onclick=left.onchange=right.onchange=null;box.remove();}};
}
