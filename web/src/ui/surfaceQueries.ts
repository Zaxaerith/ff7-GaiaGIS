// SPDX-License-Identifier: GPL-3.0-only
import {t,formatNumber} from '../i18n';
import type {NativeTraceKind} from '../analysis/native';

export function surfaceCoordinate(id:string,label:string){const wrap=document.createElement('label'),input=document.createElement('input');wrap.textContent=label;input.id=id;input.type='text';input.placeholder='0';input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label',label);wrap.append(input);return {wrap,input};}

/** Shared bounded result list; callbacks retain only this owner's current rows. */
export function sourceResultPager<T>(parent:HTMLElement,prefix:string,caption:(row:T)=>string,select:(row:T)=>void,decorate?:(button:HTMLButtonElement,row:T)=>void){
 const list=document.createElement('div'),pages=document.createElement('div'),previous=document.createElement('button'),next=document.createElement('button');list.id=prefix+'-results';list.className='surface-query-results';previous.type=next.type='button';previous.id=prefix+'-previous';next.id=prefix+'-next';pages.append(previous,next);parent.append(list,pages);let rows:T[]=[],page=0;
 function render(){list.replaceChildren();pages.hidden=rows.length<=50;previous.disabled=page===0;next.disabled=(page+1)*50>=rows.length;previous.textContent=t('native.pagePrevious');next.textContent=t('native.pageNext');for(const row of rows.slice(page*50,(page+1)*50)){const b=document.createElement('button');b.type='button';b.textContent=caption(row);b.onclick=()=>select(row);decorate?.(b,row);list.append(b);}}
 previous.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};
 return {set(value:T[]){if(value!==rows)page=0;rows=value;render();},dispose(){rows=[];list.replaceChildren();previous.onclick=next.onclick=null;list.remove();pages.remove();}};
}
interface PlotTrace {face:number;kind:NativeTraceKind;path:[number,number][];exactPath:[string,string][];}
interface PlotInterval {t:[number,number];exactT:[string,string];}
export interface SurfaceSeries<T>{label:string;state?:number;traces:T[];gaps?:[number,number][];coverage?:{uncovered:PlotInterval[];noSurface:PlotInterval[]}|null;}

/** One distance/Y frame, separate source paths, no stitching or cross-state pairs. */
export function drawSurfacePlot<T extends PlotTrace>(target:HTMLElement,series:SurfaceSeries<T>[],distance:number,identify:(r:T,side:number)=>string,select:(r:T,side:number)=>void,sourceId:(r:T)=>string=r=>String(r.face)){
 target.replaceChildren();if(!series.length)return;
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),coverage=series.some(s=>s.coverage);svg.setAttribute('viewBox',`0 0 600 ${coverage?330:275}`);svg.classList.add('surface-transect');svg.setAttribute('aria-label',t('native.transect'));svg.setAttribute('role','group');
 const all=series.flatMap(s=>s.traces.flatMap(r=>r.path.map(p=>p[1])));let low=all.length?all.reduce((a,b)=>Math.min(a,b)):0,high=all.length?all.reduce((a,b)=>Math.max(a,b)):1;if(low===high){low--;high++;}
 const x=(v:number)=>45+v*540,y=(h:number)=>225-(h-low)/(high-low)*175,fmt=(v:number)=>formatNumber(v,6);
 function text(atX:number,atY:number,value:string,cls=''){const e=document.createElementNS(ns,'text');e.setAttribute('x',String(atX));e.setAttribute('y',String(atY));e.textContent=value;if(cls)e.setAttribute('class',cls);svg.append(e);}
 function rect(a:number,b:number,y:number,height:number,cls:string,label?:string){const e=document.createElementNS(ns,'rect');e.setAttribute('x',String(x(a)));e.setAttribute('y',String(y));e.setAttribute('width',String(x(b)-x(a)));e.setAttribute('height',String(height));e.setAttribute('class',cls);if(label){const title=document.createElementNS(ns,'title');title.textContent=label;e.append(title);}svg.append(e);return e;}
 series.forEach((s,side)=>{text(45+side*270,14,s.label,`surface-series-${side}`);if(!s.coverage)for(const [a,b]of s.gaps??[])rect(a,b,50,175,'native-transect-gap');});
 const axis=document.createElementNS(ns,'path');axis.setAttribute('d','M45 50 V225 H585');axis.setAttribute('class','native-transect-axis');svg.append(axis);
 series.forEach((s,side)=>s.traces.forEach((r,index)=>{const path=document.createElementNS(ns,'path'),poly=r.path;path.setAttribute('d',poly.map(([t,h],i)=>`${i?'L':'M'}${x(t)} ${y(h)}`).join(' ')+(r.kind.endsWith('band')?' Z':''));if(poly.every(p=>p[0]===poly[0][0]&&p[1]===poly[0][1]))path.setAttribute('d',`M${x(poly[0][0])-2} ${y(poly[0][1])} h4`);path.setAttribute('class',`native-transect-${r.kind}${series.length>1?' surface-series-'+side:''}`);path.dataset.face=String(r.face);path.dataset.trace=String(index);path.dataset.series=String(side);path.dataset.sourceId=sourceId(r);if(s.state!==undefined)path.dataset.queryState=String(s.state);path.setAttribute('role','button');path.setAttribute('tabindex','0');path.setAttribute('aria-label',identify(r,side));const title=document.createElementNS(ns,'title');title.textContent=identify(r,side)+' · '+r.exactPath.map(p=>p.join(', ')).join(' / ');path.append(title);svg.append(path);}));
 svg.onclick=e=>activate(e.target);svg.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e.target);}};
 function activate(target:EventTarget|null){const el=(target as Element)?.closest<SVGElement>('[data-trace]');if(el){const side=Number(el.dataset.series);select(series[side].traces[Number(el.dataset.trace)],side);}}
 text(45,247,'0');text(350,247,fmt(distance)+' raw unit');text(45,35,'raw Y · '+fmt(low)+' … '+fmt(high));
 if(coverage)series.forEach((s,side)=>{const atY=267+side*26;text(45,atY,s.label,`surface-series-${side}`);rect(0,1,atY+3,10,'surface-coverage');for(const [kind,rows]of [['outside',s.coverage?.uncovered],['noSurface',s.coverage?.noSurface]] as const)for(const r of rows??[]){const node=rect(...r.t,atY+3,10,'surface-coverage-'+kind,t('variant.compare.'+kind)+' · t '+r.exactT.join(' … '));node.dataset.coverage=kind;if(s.state!==undefined)node.dataset.queryState=String(s.state);}});
 target.append(svg);
}
