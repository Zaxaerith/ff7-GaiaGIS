// SPDX-License-Identifier: GPL-3.0-only
import {queryNative,transectNative} from '../analysis/native';
import type {NativeAnalysis,NativeSurfaceHit,NativeTrace} from '../analysis/native';
import type {NativeViewer} from '../viewer/NativeViewer';
import {appStore} from '../app/state';
import {t,formatNumber} from '../i18n';
import {surfaceCoordinate,sourceResultPager,drawSurfacePlot} from './surfaceQueries';

/** Query state belongs to the existing current Native map, never the display mesh. */
export function mountNativeQueries(parent:HTMLElement,getViewer:()=>NativeViewer|undefined,getAnalysis:()=>NativeAnalysis|undefined,select:(i:number)=>void,topdown:()=>void){
 const box=document.createElement('section');box.id='native-queries';
 const title=document.createElement('h4'),note=document.createElement('p'),position=document.createElement('fieldset'),legend=document.createElement('legend');
 const inputs=new Map<string,HTMLInputElement>();
 const coordinate=(id:string,label:string)=>{const {wrap,input}=surfaceCoordinate('native-'+id,label);inputs.set(id,input);return wrap;};
 const button=(id:string,fn:()=>void)=>{const b=document.createElement('button');b.id='native-'+id;b.type='button';b.onclick=fn;return b;};
 const query=button('query-run',runPoint),pick=button('query-pick',()=>arm('point'));
 position.append(legend,coordinate('query-x','X'),coordinate('query-z','Z'),query,pick);
 const transect=document.createElement('fieldset'),transectLegend=document.createElement('legend');
 const pickA=button('transect-pick-a',()=>arm('a')),pickB=button('transect-pick-b',()=>arm('b')),run=button('transect-run',runTransect),clearButton=button('query-clear',clear);
 transect.append(transectLegend,coordinate('a-x','A · X'),coordinate('a-z','A · Z'),pickA,coordinate('b-x','B · X'),coordinate('b-z','B · Z'),pickB,run);
 const status=document.createElement('p');status.id='native-query-status';status.setAttribute('role','status');
 const chart=document.createElement('div');chart.id='native-transect-chart';
 box.append(title,note,position,transect,clearButton,status,chart);parent.append(box);
 type Result=NativeSurfaceHit|NativeTrace;
 const pager=sourceResultPager<Result>(box,'native-query',r=>identify(r)+' · '+describe(r),r=>select(r.face),(b,r)=>{b.dataset.nativeResult=String(r.face);b.title=r.source.sourceSHA;});
 let rows:Result[]=[],pointResult:ReturnType<typeof queryNative>|null=null,traceResult:ReturnType<typeof transectNative>|null=null,armed:string|null=null,error=false,pickRequest=0;
 const fmt=(n:number)=>formatNumber(n,6),read=(prefix:string)=>[inputs.get(prefix+'-x')!.value,inputs.get(prefix+'-z')!.value] as [string,string];
 function cancelPick(){pickRequest++;const v=getViewer();if(v)v.onPositionPick=null;armed=null;}
 function clear(){cancelPick();rows=[];pointResult=traceResult=null;error=false;for(const input of inputs.values())input.value='';status.textContent='';pager.set(rows);chart.replaceChildren();for(const name of ['hits','heightCount','status','queryMs','transectMs','traces'])delete box.dataset[name];}
 function arm(target:string){cancelPick();topdown();if(innerWidth<1200){if(document.body.classList.contains('ux-rail'))document.dispatchEvent(new CustomEvent('gaiagis:map-capture',{detail:{toolId:target==='point'?'sourceQuery':'sourceTransect'}}));else{document.getElementById('integrated-close')?.click();document.getElementById('collapse-inspector')?.click();}}const v=getViewer();if(!v)return;const request=pickRequest;armed=target;status.textContent=t('native.queryClick',{target:target==='point'?'X/Z':target.toUpperCase()});v.onPositionPick=p=>{if(request!==pickRequest||armed!==target||v!==getViewer())return;cancelPick();const prefix=target==='point'?'query':target;inputs.get(prefix+'-x')!.value=String(p[0]);inputs.get(prefix+'-z')!.value=String(p[1]);if(target==='point')runPoint();else{status.textContent=t('native.endpointSet',{target:target.toUpperCase()});run.focus();}if(document.body.classList.contains('ux-rail'))document.dispatchEvent(new CustomEvent('gaiagis:open-tool',{detail:{toolId:target==='point'?'sourceQuery':'sourceTransect'}}));};v.renderer.domElement.focus();}
 function runPoint(){cancelPick();const v=getViewer(),a=getAnalysis();if(!v||!a)return;try{pointResult=queryNative(v.map,read('query'),a);traceResult=null;rows=pointResult.hits;error=false;box.dataset.hits=String(rows.length);box.dataset.heightCount=String(pointResult.heightCount);box.dataset.status=pointResult.status;box.dataset.queryMs=String(pointResult.milliseconds);delete box.dataset.traces;delete box.dataset.transectMs;chart.replaceChildren();render();}catch{invalid();}}
 function runTransect(){cancelPick();const v=getViewer(),a=getAnalysis();if(!v||!a)return;try{traceResult=transectNative(v.map,read('a'),read('b'),a);pointResult=null;rows=traceResult.traces;error=false;box.dataset.traces=String(rows.length);box.dataset.transectMs=String(traceResult.milliseconds);for(const key of ['hits','heightCount','status','queryMs'])delete box.dataset[key];render();}catch{invalid();}}
 function invalid(){const saved=[...inputs].map(([id,input])=>[id,input.value]);clear();for(const [id,value]of saved)inputs.get(id)!.value=value;error=true;status.textContent=t('native.queryInvalid');}
 function identify(r:Result){const s=r.source;return `${s.mapId} · ${s.section}/${s.mesh}/${s.triangle} · ${t('ui.terrain')} ${s.terrain}`;}
 function describe(r:Result){if('exactHeights'in r)return `${t('native.'+r.kind)} · raw Y ${r.exactHeights[0]}${r.kind==='surface'?'':(' … '+r.exactHeights[1])}`;return `${t('native.'+r.kind)} · ${fmt(r.t[0]*traceResult!.length)} … ${fmt(r.t[1]*traceResult!.length)} raw unit`;
 }
 function renderRows(){pager.set(rows);}
 function draw(){if(!traceResult){chart.replaceChildren();return;}drawSurfacePlot(chart,[{label:'',traces:traceResult.traces,gaps:traceResult.gaps}],traceResult.length,r=>identify(r)+' · '+describe(r),r=>select(r.face));}
 function render(){if(pointResult)status.textContent=`${t('native.query.'+pointResult.status)} · ${t('native.queryCount',{count:rows.length,heights:pointResult.heightCount})}`;else if(traceResult)status.textContent=t('native.transectCount',{count:rows.length,gaps:traceResult.gaps.length});else if(error)status.textContent=t('native.queryInvalid');renderRows();draw();}
 function translate(){title.textContent=t('native.queryTitle');note.textContent=t('native.queryNote');legend.textContent=t('native.position');transectLegend.textContent=t('native.transect');for(const [b,key]of [[query,'queryRun'],[pick,'queryPick'],[pickA,'pickA'],[pickB,'pickB'],[run,'transectRun'],[clearButton,'queryClear']] as const)b.textContent=t('native.'+key);render();if(armed)status.textContent=t('native.queryClick',{target:armed==='point'?'X/Z':armed.toUpperCase()});}
 let generation=appStore.state.data.generation,mapId=appStore.state.map.id;
 const stop=appStore.subscribe(()=>{const s=appStore.state;if(s.data.generation!==generation||s.map.id!==mapId||s.view.spatial!=='world'||s.explorer.phase!=='idle'){generation=s.data.generation;mapId=s.map.id;clear();}});
 const pauseCapture=(e:Event)=>{if(armed){e.preventDefault();cancelPick();status.textContent='';render();}};document.addEventListener('gaiagis:ui-pause-capture',pauseCapture);
 translate();clear();return {clear,cancelPick,translate,dispose(){clear();stop();document.removeEventListener('gaiagis:ui-pause-capture',pauseCapture);pager.dispose();box.remove();}};
}
