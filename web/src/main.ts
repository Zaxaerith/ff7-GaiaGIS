// SPDX-License-Identifier: GPL-3.0-only
import './styles/viewer.css';
import {mountLayout} from './ui/layout';
import {loadMesh} from './data/mesh';
import {GaiaViewer} from './viewer/GaiaViewer';
import {terrainPalette,distinguishedCapColor} from './styles/terrainPalette';
import {projections} from './projections';
import type {ProjectionId} from './projections/Projection';

const root=document.querySelector<HTMLElement>('#app')!;
mountLayout(root);
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
async function start(){
  try {
    const {mesh,meta}=await loadMesh(text=>element('loading-text').textContent=text);
    // Yield so the loading state remains readable during CPU preparation.
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const viewer=new GaiaViewer(element('viewport'),mesh,meta);
    element('loading').hidden=true;
    element('dataset-count').textContent=`${mesh.triangleCount.toLocaleString()} canonical triangles`;
    element('radius').textContent=`${meta.physical_reference_radius_m.toLocaleString('en-US',{maximumFractionDigits:1})} m`;
    const legend=element('terrain-legend');
    for(const id of [3,0,1,2,8,10,7,25]) {
      const row=document.createElement('div');row.className='legend-row';const swatch=document.createElement('i');swatch.style.background=terrainPalette[id];const label=document.createElement('span');label.textContent=meta.terrain_names[id];row.append(swatch,label);legend.append(row);
    }
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
      element('projection-name').textContent=projections[id].name;
      element('mode-label').textContent=id==='globe'?'SPHERICAL VIEW':id==='orthographic'?'INTERACTIVE HEMISPHERE':'PROJECTED MAP';
      element('interaction-hint').textContent=id==='globe'?'Drag to orbit · Scroll to zoom · Tap to inspect':id==='orthographic'?'Drag to change hemisphere · Scroll to zoom':'Drag to pan · Scroll to zoom · Tap to inspect';
      element('transition-label').hidden=!morphing;
      element<HTMLInputElement>('auto-rotate').disabled=id!=='globe';
      element<HTMLInputElement>('globe-depth').disabled=id!=='globe';
      element('view-status').textContent=morphing?'Morphing…':`${projections[id].name} · Rweb = 1`;
      root.dataset.projection=id;root.dataset.morphing=String(morphing);
    };
    viewer.onProjection('globe',false);
    viewer.onStats=stats=>{element('fps').textContent=`${stats.fps.toFixed(0)} FPS`;root.dataset.fps=stats.fps.toFixed(1);root.dataset.drawCalls=String(stats.drawCalls);root.dataset.renderTriangles=String(stats.renderTriangles);};
    viewer.onSelection=source=>{
      element('selection-empty').hidden=source!==null;element('selection-details').hidden=source===null;
      element('info-panel').classList.toggle('mobile-open',source!==null);
      if(source===null){element('coordinates').textContent='';return;}
      document.querySelector('.controls')!.classList.remove('mobile-open');mobileButton.setAttribute('aria-expanded','false');
      const a=mesh.attributes(source);const detail=element('selection-details');detail.replaceChildren();
      const terrain=document.createElement('div');terrain.className='selected-terrain';
      const swatch=document.createElement('i');swatch.style.background=a.origin?distinguishedCapColor:terrainPalette[a.terrain!];
      const name=document.createElement('span');name.textContent=a.origin?'Synthetic polar ocean':meta.terrain_names[a.terrain!]||`Terrain ${a.terrain}`;terrain.append(swatch,name);detail.append(terrain);
      const region=document.createElement('p');region.className='selected-region';region.textContent=a.origin?(a.origin===1?'North polar cap':'South polar cap'):meta.region_names[a.region!]||`Region ${a.region}`;detail.append(region);
      const origin=document.createElement('span');origin.className='origin-badge'+(a.origin?' synthetic':'');origin.textContent=a.origin?'Synthetic polar cap':'FF7 source geometry';detail.append(origin);
      const addProperties=(rows:[string,string][])=>{const list=document.createElement('dl');list.className='property-list';for(const [label,value]of rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);list.append(row);}detail.append(list);};
      if(!a.origin) addProperties([['Source',`WM${a.map}`],['Section',String(a.section)],['Mesh',String(a.mesh)],['Triangle',String(a.triangle)],['Terrain ID',String(a.terrain)],['Region ID',String(a.region)],['Script / Texture',`${a.script} / ${a.texture}`]]);
      else {const note=document.createElement('p');note.className='synthetic-note';note.textContent='Generated ocean geometry. No FF7 source, terrain or region IDs are assigned.';detail.append(note);addProperties([['Cap face',String(a.capTriangle)]]);}
      let sin=0,cos=0,lat=0,height=0;
      for(let j=0;j<3;j++){const i=mesh.indices[source*3+j]*3,l=mesh.geographic[i]*Math.PI/180,p=mesh.geographic[i+1]*Math.PI/180;sin+=Math.sin(l)*Math.cos(p);cos+=Math.cos(l)*Math.cos(p);lat+=mesh.geographic[i+1]/3;height+=mesh.geographic[i+2]/3;}
      const lon=Math.atan2(sin,cos)*180/Math.PI;
      const subtitle=document.createElement('p');subtitle.className='source-subtitle';subtitle.textContent='APPROXIMATE TRIANGLE CENTROID';detail.append(subtitle);
      addProperties([['Longitude',`${lon.toFixed(4)}°`],['Latitude',`${lat.toFixed(4)}°`],['Height (assumed)',`${height.toFixed(2)} m`]]);
      element('coordinates').textContent=`${lon.toFixed(2)}° / ${lat.toFixed(2)}°`;
      detail.dataset.sourceTriangle=String(source);detail.dataset.origin=String(a.origin);
    };
    window.addEventListener('pagehide',()=>viewer.dispose(),{once:true});
  } catch(error){element('loading').classList.add('error');element('loading-text').textContent=error instanceof Error?error.message:String(error);element('view-status').textContent='Viewer could not start';console.error(error);}
}
void start();
