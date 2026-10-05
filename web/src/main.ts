import {legendRow} from './ui/legend';
import {appStore} from './app/state';
import {workspaceLoader,loadedAsset} from './app/assets';
import {mountShell} from './app/shell';
import {mountTextures} from './ui/textures';
import {mountMultimap} from './ui/multimap';
import type {ExplorerController} from './explorer/controller';
// SPDX-License-Identifier: GPL-3.0-only
import './styles/viewer.css';
import {mountLayout} from './ui/layout';
import {loadMesh,readLocalDataset,MissingDatasetError} from './data/mesh';
import type {GaiaMesh,GaiaMeta} from './data/mesh';
import {summarizeRegions,regionColor} from './data/regions';
import type {GaiaViewer} from './viewer/GaiaViewer';
import {terrainPalette,distinguishedCapColor} from './styles/terrainPalette';
import {projections} from './projections';
import {rotatesCenter} from './projections/registry';
import type {ProjectionId} from './projections/Projection';
import {mountLocations} from './ui/locations';
import {mountEncounters} from './ui/encounters';
import {mountTraversal} from './ui/traversal';
import {mountEvents} from './ui/events';
import type {ColorLayer} from './data/encounters';
import {t,formatNumber,onLocaleChange,initializeLocale,observeTranslations} from './i18n';
import {mountProjectionGallery} from './ui/projections';
import {mountAnalysis} from './ui/analysis';

const root=document.querySelector<HTMLElement>('#app')!;
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let activeViewer:GaiaViewer|undefined,loaded:{mesh:GaiaMesh;meta:GaiaMeta}|undefined,operation=0;
let applicationShell:ReturnType<typeof mountShell>|undefined;
let projectionLocale:(()=>void)|undefined;
let galleryControls:ReturnType<typeof mountProjectionGallery>|undefined;
let analysisControls:ReturnType<typeof mountAnalysis>|undefined;
initializeLocale();const stopTranslations=observeTranslations();
function setBusy(busy:boolean){
  root.dataset.ready=String(!busy);
  for(const control of root.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('.controls input,.controls select,.controls button,.projection-control select,.navigation-tools button,.zoom-controls button'))control.disabled=busy;
}
function fail(message:string,expected=false){
  const technical=message;message=expected?t('help.local'):t('error.dataset');
  element('loading').hidden=false;element('loading').classList.toggle('error',!expected);element('loading').classList.add('needs-data');
  element('loading-text').textContent=message;element('loading-text').title=technical;element('loading-title').textContent=expected?t('load.open'):t('load.attention');
  root.querySelector<HTMLElement>('.loading-actions')!.hidden=false;element('view-status').textContent=expected?t('load.required'):t('load.failed');setBusy(true);
}
function bindCommon(){
  const about=element<HTMLDialogElement>('about-dialog');
  for(const id of ['about-button','loading-help'])element(id).addEventListener('click',()=>about.showModal());
  element('close-about').addEventListener('click',()=>about.close());
  for(const id of ['open-local-data','choose-local-data'])element(id).addEventListener('click',()=>element<HTMLInputElement>('local-dataset-files').click());
  element('retry-viewer').addEventListener('click',()=>void (loaded?adoptGeometry(loaded):start()));
  element<HTMLInputElement>('local-dataset-files').addEventListener('change',async e=>{
    const input=e.target as HTMLInputElement;if(!input.files?.length)return;
    const request=operation;element('local-data-status').textContent=t('load.verify');
    try{const data=await readLocalDataset(input.files);if(request===operation)void adoptGeometry(data);}
    catch(error){const message=error instanceof Error?error.message:String(error);element('local-data-status').textContent=t('error.dataset');element('local-data-status').title=message;if(!activeViewer)fail(message);}
    input.value='';
  });
}
async function start(provided?:{mesh:GaiaMesh;meta:GaiaMeta}){
  applicationShell?.dispose();applicationShell=undefined;document.dispatchEvent(new Event('gaiagis-map-changing'));const request=++operation;projectionLocale?.();galleryControls?.dispose();analysisControls?.dispose();activeViewer?.dispose();activeViewer=undefined;mountLayout(root);galleryControls=mountProjectionGallery();bindCommon();setBusy(true);
  try {
    if(!provided&&import.meta.env.VITE_GAIA_SOURCE_ONLY==='true')throw new MissingDatasetError();
    const {mesh,meta}=provided||await loadMesh(text=>{if(request===operation)element('loading-text').textContent=text;});
    if(request!==operation)return;loaded={mesh,meta};loadedAsset("geometry",meta.byte_length,meta.version);
    // Yield so the loading state remains readable during CPU preparation.
    await new Promise(resolve=>requestAnimationFrame(resolve));
    if(request!==operation)return;
    const {GaiaViewer}=await import('./viewer/GaiaViewer');if(request!==operation)return;const viewer=new GaiaViewer(element('viewport'),mesh,meta);
    const textureControls=mountTextures(viewer,()=>request===operation);
    activeViewer=viewer;viewer.onError=message=>fail(message);setBusy(false);viewer.setSuspended((document.getElementById('map-selector') as HTMLSelectElement|null)?.value!=='WM0');
    const locationControls=mountLocations(viewer,meta,()=>request===operation);
    const encounterControls=mountEncounters(viewer,meta,()=>request===operation);
    const traversalControls=mountTraversal(viewer,meta);
    const eventControls=mountEvents(viewer,meta,()=>request===operation);
    analysisControls=mountAnalysis(viewer,meta,()=>request===operation);
    viewer.renderer.domElement.addEventListener('keydown',e=>{if(['n','N','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))element<HTMLInputElement>('auto-rotate').checked=false;});
    element('loading').hidden=true;
    element('dataset-count').textContent=t('message.triangles',{count:mesh.triangleCount});
    element('radius').textContent=`${formatNumber(meta.physical_reference_radius_m,1)} m`;
    const legend=element('terrain-legend');
    const regions=summarizeRegions(mesh,meta),terrainIds=new Set<number>();
    for(let t=0;t<mesh.triangleCount;t++){const a=mesh.attributes(t);if(!a.origin&&a.terrain!==null)terrainIds.add(a.terrain);}
    const drawLegend=(layer:'terrain'|'region')=>{
      legend.replaceChildren();element('legend-title').textContent=layer==='region'?t('ui.regions'):t('ui.terrain');
      const ids=layer==='region'?regions.map(r=>r.id):[...terrainIds].sort((a,b)=>a-b);
      for(const id of ids)legendRow(legend,layer==='region'?regionColor(id):terrainPalette[id],`${id} · ${(layer==='region'?meta.region_names:meta.terrain_names)[id]||t('state.unknown')}`);
    };drawLegend('terrain');
    for(const region of regions){const option=document.createElement('option');option.value=String(region.id);option.textContent=`${region.name} (${formatNumber(region.triangles,0)})`;element<HTMLSelectElement>('region-focus').append(option);}
    element<HTMLSelectElement>('region-focus').addEventListener('change',e=>{
      const value=(e.target as HTMLSelectElement).value;if(value==='')return;
      const region=regions.find(r=>r.id===Number(value))!;viewer.focusLocation(region.lon,region.lat);element<HTMLInputElement>('auto-rotate').checked=false;
      element('region-note').textContent=t('message.regionCenter',{name:region.name,lat:formatNumber(region.lat,1),lon:formatNumber(region.lon,1)})+(region.concentration<.3?' · '+t('message.diffuse'):'');
    });
    element<HTMLSelectElement>('color-layer').addEventListener('change',e=>{
      const layer=(e.target as HTMLSelectElement).value as ColorLayer;if(layer==='terrain'||layer==='region')drawLegend(layer);element<HTMLInputElement>('terrain').disabled=layer!=='terrain';
    });
    const bind=(id:string,action:(checked:boolean)=>void)=>element<HTMLInputElement>(id).addEventListener('change',e=>action((e.target as HTMLInputElement).checked));
    const setGraticule=(value:boolean)=>{viewer.setGraticule(value);element<HTMLInputElement>('graticule').checked=value;element('toggle-graticule').setAttribute('aria-pressed',String(value));};
    bind('terrain',v=>viewer.setTerrain(v));bind('triangle-grid',v=>viewer.setTriangleGrid(v));bind('graticule',setGraticule);
    bind('globe-depth',v=>viewer.setGlobeDepth(v));
    element('toggle-graticule').addEventListener('click',()=>setGraticule(!element<HTMLInputElement>('graticule').checked));
    element('north-up').addEventListener('click',()=>{viewer.setAutoRotate(false);element<HTMLInputElement>('auto-rotate').checked=false;viewer.northUp();});
    bind('cap-distinction',v=>viewer.setCapDistinction(v));bind('auto-rotate',v=>viewer.setAutoRotate(v));
    element('reset-view').addEventListener('click',()=>viewer.resetView());element('zoom-in').addEventListener('click',()=>viewer.zoom(0.83));element('zoom-out').addEventListener('click',()=>viewer.zoom(1.2));
    element<HTMLSelectElement>('projection').addEventListener('change',e=>viewer.setProjection((e.target as HTMLSelectElement).value as ProjectionId));
    const mobileButton=element('mobile-display');
    mobileButton.addEventListener('click',()=>{const open=document.querySelector('.controls')!.classList.toggle('mobile-open');mobileButton.setAttribute('aria-expanded',String(open));element('info-panel').classList.remove('mobile-open');});
    element('clear-selection').addEventListener('click',()=>viewer.clearSelection());
    viewer.onProjection=(id,morphing)=>{
      element('projection-name').textContent=t(`projection.${id}`);
      element('mode-label').textContent=id==='globe'?t('ui.spherical'):rotatesCenter(id)?t('ui.hemisphere'):t('ui.projected');
      element('interaction-hint').textContent=id==='globe'?t('ui.orbitHint'):rotatesCenter(id)?t('ui.centerHint'):t('ui.panHint');
      element('transition-label').hidden=!morphing;
      element<HTMLInputElement>('auto-rotate').disabled=id!=='globe';
      element<HTMLInputElement>('globe-depth').disabled=id!=='globe';
      element<HTMLSelectElement>('region-focus').disabled=morphing;
      element('view-status').textContent=morphing?t('ui.morphing'):`${t(`projection.${id}`)} · Rweb = 1`;
      root.dataset.projection=id;root.dataset.morphing=String(morphing);
    };
    viewer.onProjection('globe',false);
    projectionLocale?.();projectionLocale=onLocaleChange(()=>{if(request===operation)viewer.onProjection?.(root.dataset.projection as ProjectionId,root.dataset.morphing==='true');});
    viewer.onStats=stats=>{element('fps').textContent=`${formatNumber(stats.fps,0)} FPS`;root.dataset.fps=formatNumber(stats.fps,1);root.dataset.drawCalls=String(stats.drawCalls);root.dataset.renderTriangles=String(stats.renderTriangles);};
    viewer.onSelection=source=>{
      locationControls.clear();
      eventControls.clear();
      element('selection-empty').hidden=source!==null;element('selection-details').hidden=source===null;
      element('info-panel').classList.toggle('mobile-open',source!==null);
      if(source===null){appStore.dispatch({type:'select',selection:null});element('coordinates').textContent='';return;}
      document.querySelector('.controls')!.classList.remove('mobile-open');mobileButton.setAttribute('aria-expanded','false');
      const a=mesh.attributes(source);const detail=element('selection-details');detail.replaceChildren();
      const terrain=document.createElement('div');terrain.className='selected-terrain';
      const swatch=document.createElement('i');swatch.style.background=a.origin?distinguishedCapColor:terrainPalette[a.terrain!];
      const name=document.createElement('span');name.textContent=a.origin?t('inspect.ocean'):meta.terrain_names[a.terrain!]||`Terrain ${a.terrain}`;terrain.append(swatch,name);detail.append(terrain);
      const region=document.createElement('p');region.className='selected-region';region.textContent=a.origin?(a.origin===1?t('inspect.northCap'):t('inspect.southCap')):meta.region_names[a.region!]||`Region ${a.region}`;detail.append(region);
      const origin=document.createElement('span');origin.className='origin-badge'+(a.origin?' synthetic':'');origin.textContent=a.origin?t('inspect.cap'):t('inspect.geometry');detail.append(origin);
      const addProperties=(rows:[string,string][])=>{const list=document.createElement('dl');list.className='property-list';for(const [label,value]of rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);list.append(row);}detail.append(list);};
      if(!a.origin) addProperties([[t('ui.source'),`WM${a.map}`],[t('map.space'),'WM0Native → GaiaGeographic (V1)'],[t('ui.section'),String(a.section)],[t('ui.mesh'),String(a.mesh)],[t('ui.triangle'),String(a.triangle)],[t('ui.terrainID'),String(a.terrain)],[t('ui.regionID'),String(a.region)],[t('ui.scriptTexture'),`${a.script} / ${a.texture}`]]);
      else {const note=document.createElement('p');note.className='synthetic-note';note.textContent=t('inspect.synthetic');detail.append(note);addProperties([[t('inspect.capFace'),String(a.capTriangle)]]);}
      let sin=0,cos=0,lat=0,height=0;
      for(let j=0;j<3;j++){const i=mesh.indices[source*3+j]*3,l=mesh.geographic[i]*Math.PI/180,p=mesh.geographic[i+1]*Math.PI/180;sin+=Math.sin(l)*Math.cos(p);cos+=Math.cos(l)*Math.cos(p);lat+=mesh.geographic[i+1]/3;height+=mesh.geographic[i+2]/3;}
      const lon=Math.atan2(sin,cos)*180/Math.PI;
      const subtitle=document.createElement('p');subtitle.className='source-subtitle';subtitle.textContent=t('inspect.centroid');detail.append(subtitle);
      addProperties([[t('ui.longitude'),`${formatNumber(lon,4)}°`],[t('ui.latitude'),`${formatNumber(lat,4)}°`],[t('inspect.heightAssumed'),`${formatNumber(height,2)} m`]]);
      element('coordinates').textContent=`${formatNumber(lon,2)}° / ${formatNumber(lat,2)}°`;
      detail.dataset.sourceTriangle=String(source);detail.dataset.origin=String(a.origin);
      detail.dataset.longitude=String(lon);detail.dataset.latitude=String(lat);detail.dataset.height=String(height);
      encounterControls.inspect(source,detail);
      traversalControls.inspect(source,detail);
      textureControls.inspect(source,detail);
      appStore.dispatch({type:'select',selection:{kind:'triangle',id:String(source),mapId:'WM0',geographicPoint:[lon,lat,height]}});
      if(!a.origin&&appStore.state.data.assets.encounters?.status==='loaded'){const zone=document.createElement('button');zone.id='select-encounter-context';zone.textContent=t('ui.encounters');zone.onclick=()=>appStore.dispatch({type:'select',selection:{kind:'encounter',id:String(source),mapId:'WM0',geographicPoint:[lon,lat,height]}});detail.querySelector('.gameplay-inspector')?.prepend(zone);}
    };
    applicationShell=mountShell();
  } catch(error){if(request!==operation)return;activeViewer?.dispose();activeViewer=undefined;fail(error instanceof Error?error.message:String(error),error instanceof MissingDatasetError);applicationShell=mountShell();}
}
window.addEventListener('pagehide',()=>{operation++;workspaceLoader.cancel();explorer?.dispose();applicationShell?.dispose();multimaps.dispose();projectionLocale?.();galleryControls?.dispose();analysisControls?.dispose();activeViewer?.dispose();stopTranslations();},{once:true});
async function adoptGeometry(data:{mesh:GaiaMesh;meta:GaiaMeta}){await multimaps.resetData();explorer?.resetData();appStore.dispatch({type:'reset-data'});await start(data);if(!activeViewer)throw Error('Geometry adoption failed');}
workspaceLoader.register('geometry',async files=>adoptGeometry(await readLocalDataset(files)));
const multimaps=mountMultimap(root,()=>activeViewer);
let explorer:ExplorerController|undefined,explorerPromise:Promise<ExplorerController>|undefined;
const ensureExplorer=()=>explorerPromise??=import('./explorer/controller').then(({ExplorerController})=>{explorer=new ExplorerController(()=>activeViewer,()=>multimaps.viewer);document.getElementById('explorer-launch')?.remove();document.getElementById('app-group-explore')?.append(document.getElementById('explorer-panel')!);return explorer;});
const launch=document.createElement('details');launch.id='explorer-launch';const summary=document.createElement('summary');summary.textContent=t('explore.title');launch.append(summary);document.querySelector('.multimap-bar')!.append(launch);launch.addEventListener('toggle',()=>{if(launch.open)void ensureExplorer().then(()=>{(document.getElementById('explorer-panel') as HTMLDetailsElement).open=true;});});
workspaceLoader.register('explorer',async files=>(await ensureExplorer()).loadFile(files[0]));

document.addEventListener('gaiagis-explore-entrance',e=>{const entrance=(e as CustomEvent<import('./data/poi').Entrance>).detail;void ensureExplorer().then(controller=>controller.fromEntrance(entrance));});
void start();
