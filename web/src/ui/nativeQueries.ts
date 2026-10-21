// SPDX-License-Identifier: GPL-3.0-only
import {queryNative,transectNative} from '../analysis/native';
import type {NativeAnalysis,NativeSurfaceHit,NativeTrace} from '../analysis/native';
import type {NativeViewer} from '../viewer/NativeViewer';
import {appStore} from '../app/state';
import {t,formatNumber} from '../i18n';

/** Query state belongs to the existing current Native map, never the display mesh. */
export function mountNativeQueries(parent:HTMLElement,getViewer:()=>NativeViewer|undefined,getAnalysis:()=>NativeAnalysis|undefined,select:(i:number)=>void,topdown:()=>void){
 const box=document.createElement('section');box.id='native-queries';
 const title=document.createElement('h4'),note=document.createElement('p'),position=document.createElement('fieldset'),legend=document.createElement('legend');
 const inputs=new Map<string,HTMLInputElement>();
 const coordinate=(id:string,label:string)=>{const wrap=document.createElement('label'),input=document.createElement('input');wrap.textContent=label;input.id='native-'+id;input.type='text';input.placeholder='0';input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label',label);wrap.append(input);inputs.set(id,input);return wrap;};
 const button=(id:string,fn:()=>void)=>{const b=document.createElement('button');b.id='native-'+id;b.type='button';b.onclick=fn;return b;};
 const query=button('query-run',runPoint),pick=button('query-pick',()=>arm('point'));
 position.append(legend,coordinate('query-x','X'),coordinate('query-z','Z'),query,pick);
 const transect=document.createElement('fieldset'),transectLegend=document.createElement('legend');
 const pickA=button('transect-pick-a',()=>arm('a')),pickB=button('transect-pick-b',()=>arm('b')),run=button('transect-run',runTransect),clearButton=button('query-clear',clear);
 transect.append(transectLegend,coordinate('a-x','A · X'),coordinate('a-z','A · Z'),pickA,coordinate('b-x','B · X'),coordinate('b-z','B · Z'),pickB,run);
 const status=document.createElement('p');status.id='native-query-status';status.setAttribute('role','status');
 const chart=document.createElement('div');chart.id='native-transect-chart';
 const results=document.createElement('div');results.id='native-query-results';
 const pages=document.createElement('div'),previous=button('query-previous',()=>{page--;renderRows();}),next=button('query-next',()=>{page++;renderRows();});pages.append(previous,next);
 box.append(title,note,position,transect,clearButton,status,chart,results,pages);parent.append(box);
 type Result=NativeSurfaceHit|NativeTrace;
 let rows:Result[]=[],page=0,pointResult:ReturnType<typeof queryNative>|null=null,traceResult:ReturnType<typeof transectNative>|null=null,armed:string|null=null,error=false;
 const fmt=(n:number)=>formatNumber(n,6),read=(prefix:string)=>[inputs.get(prefix+'-x')!.value,inputs.get(prefix+'-z')!.value] as [string,string];
 function cancelPick(){const v=getViewer();if(v)v.onPositionPick=null;armed=null;}
 function clear(){cancelPick();rows=[];pointResult=traceResult=null;page=0;error=false;for(const input of inputs.values())input.value='';status.textContent='';results.replaceChildren();chart.replaceChildren();pages.hidden=true;for(const name of ['hits','heightCount','status','queryMs','transectMs','traces'])delete box.dataset[name];}
 function arm(target:string){cancelPick();topdown();if(innerWidth<1100){document.getElementById('integrated-close')?.click();document.getElementById('collapse-inspector')?.click();}const v=getViewer();if(!v)return;armed=target;status.textContent=t('native.queryClick',{target:target==='point'?'X/Z':target.toUpperCase()});v.onPositionPick=p=>{armed=null;const prefix=target==='point'?'query':target;inputs.get(prefix+'-x')!.value=String(p[0]);inputs.get(prefix+'-z')!.value=String(p[1]);if(target==='point')runPoint();else{status.textContent=t('native.endpointSet',{target:target.toUpperCase()});run.focus();}};v.renderer.domElement.focus();}
 function runPoint(){cancelPick();const v=getViewer(),a=getAnalysis();if(!v||!a)return;try{pointResult=queryNative(v.map,read('query'),a);traceResult=null;rows=pointResult.hits;page=0;error=false;box.dataset.hits=String(rows.length);box.dataset.heightCount=String(pointResult.heightCount);box.dataset.status=pointResult.status;box.dataset.queryMs=String(pointResult.milliseconds);delete box.dataset.traces;delete box.dataset.transectMs;chart.replaceChildren();render();}catch{invalid();}}
 function runTransect(){cancelPick();const v=getViewer(),a=getAnalysis();if(!v||!a)return;try{traceResult=transectNative(v.map,read('a'),read('b'),a);pointResult=null;rows=traceResult.traces;page=0;error=false;box.dataset.traces=String(rows.length);box.dataset.transectMs=String(traceResult.milliseconds);for(const key of ['hits','heightCount','status','queryMs'])delete box.dataset[key];render();}catch{invalid();}}
 function invalid(){const saved=[...inputs].map(([id,input])=>[id,input.value]);clear();for(const [id,value]of saved)inputs.get(id)!.value=value;error=true;status.textContent=t('native.queryInvalid');}
 function identify(r:Result){const s=r.source;return `${s.mapId} · ${s.section}/${s.mesh}/${s.triangle} · ${t('ui.terrain')} ${s.terrain}`;}
 function describe(r:Result){if('exactHeights'in r)return `${t('native.'+r.kind)} · raw Y ${r.exactHeights[0]}${r.kind==='surface'?'':(' … '+r.exactHeights[1])}`;return `${t('native.'+r.kind)} · ${fmt(r.t[0]*traceResult!.length)} … ${fmt(r.t[1]*traceResult!.length)} raw unit`;
 }
 function renderRows(){results.replaceChildren();pages.hidden=rows.length<=50;previous.disabled=page===0;next.disabled=(page+1)*50>=rows.length;for(const r of rows.slice(page*50,(page+1)*50)){const b=document.createElement('button');b.type='button';b.dataset.nativeResult=String(r.face);b.textContent=identify(r)+' · '+describe(r);b.title=r.source.sourceSHA;b.onclick=()=>select(r.face);results.append(b);}}
 const svgNS='http://www.w3.org/2000/svg';
 function draw(){chart.replaceChildren();const result=traceResult;if(!result)return;const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 600 260');svg.setAttribute('aria-label',t('native.transect'));svg.setAttribute('role','group');const all=result.traces.flatMap(r=>r.path.map(p=>p[1]));let low=all.length?all.reduce((a,b)=>Math.min(a,b)):0,high=all.length?all.reduce((a,b)=>Math.max(a,b)):1;if(low===high){low-=1;high+=1;}const y=(h:number)=>220-(h-low)/(high-low)*190,x=(t:number)=>45+t*540;
  const text=(atX:number,atY:number,value:string)=>{const node=document.createElementNS(svgNS,'text');node.setAttribute('x',String(atX));node.setAttribute('y',String(atY));node.textContent=value;svg.append(node);};
  for(const [a,b]of result.gaps){const rect=document.createElementNS(svgNS,'rect');rect.setAttribute('x',String(x(a)));rect.setAttribute('y','25');rect.setAttribute('width',String(x(b)-x(a)));rect.setAttribute('height','195');rect.setAttribute('class','native-transect-gap');svg.append(rect);}
  const axis=document.createElementNS(svgNS,'path');axis.setAttribute('d','M45 25 V220 H585');axis.setAttribute('class','native-transect-axis');svg.append(axis);
  for(const r of result.traces){const path=document.createElementNS(svgNS,'path'),poly=r.path;path.setAttribute('d',poly.map(([t,h],i)=>`${i?'L':'M'}${x(t)} ${y(h)}`).join(' ')+(r.kind.endsWith('band')?' Z':''));if(poly.every(p=>p[0]===poly[0][0]&&p[1]===poly[0][1]))path.setAttribute('d',`M${x(poly[0][0])-2} ${y(poly[0][1])} h4`);path.setAttribute('class','native-transect-'+r.kind);path.dataset.face=String(r.face);path.setAttribute('role','button');path.setAttribute('tabindex','0');path.setAttribute('aria-label',identify(r)+' · '+describe(r));const tooltip=document.createElementNS(svgNS,'title');tooltip.textContent=identify(r)+' · '+r.exactPath.map(p=>p.join(', ')).join(' / ');path.append(tooltip);svg.append(path);}
  svg.onclick=e=>{const el=(e.target as Element).closest<SVGElement>('[data-face]');if(el)select(Number(el.dataset.face));};svg.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){const el=(e.target as Element).closest<SVGElement>('[data-face]');if(el){e.preventDefault();select(Number(el.dataset.face));}}};
  text(45,242,'0');text(360,242,fmt(result.length)+' raw unit');text(45,16,'raw Y · '+fmt(low)+' … '+fmt(high));chart.append(svg);
 }
 function render(){if(pointResult)status.textContent=`${t('native.query.'+pointResult.status)} · ${t('native.queryCount',{count:rows.length,heights:pointResult.heightCount})}`;else if(traceResult)status.textContent=t('native.transectCount',{count:rows.length,gaps:traceResult.gaps.length});else if(error)status.textContent=t('native.queryInvalid');renderRows();draw();}
 function translate(){title.textContent=t('native.queryTitle');note.textContent=t('native.queryNote');legend.textContent=t('native.position');transectLegend.textContent=t('native.transect');for(const [b,key]of [[query,'queryRun'],[pick,'queryPick'],[pickA,'pickA'],[pickB,'pickB'],[run,'transectRun'],[clearButton,'queryClear'],[previous,'pagePrevious'],[next,'pageNext']] as const)b.textContent=t('native.'+key);render();if(armed)status.textContent=t('native.queryClick',{target:armed==='point'?'X/Z':armed.toUpperCase()});}
 let generation=appStore.state.data.generation,mapId=appStore.state.map.id;
 const stop=appStore.subscribe(()=>{const s=appStore.state;if(s.data.generation!==generation||s.map.id!==mapId||s.view.spatial!=='world'||s.explorer.phase!=='idle'){generation=s.data.generation;mapId=s.map.id;clear();}});
 translate();clear();return {clear,cancelPick,translate,dispose(){clear();stop();box.remove();}};
}
