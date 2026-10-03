// SPDX-License-Identifier: GPL-3.0-only
import {BufferAttribute,BufferGeometry,Color,DoubleSide,DynamicDrawUsage,LineBasicMaterial,LineSegments,
  Mesh,MeshBasicMaterial,MOUSE,OrthographicCamera,PerspectiveCamera,Raycaster,Scene,Sphere,TOUCH,
  Triangle,Vector2,Vector3,WebGLRenderer} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {GaiaMesh,GaiaMeta} from '../data/mesh';
import {prepareDisplay,projectDisplay} from '../data/display';
import type {DisplayMesh} from '../data/display';
import {projections} from '../projections';
import {fitProjectionToViewport,wrapLongitude} from '../projections/Projection';
import type {ProjectionId,ProjectionContext} from '../projections/Projection';
import {distinguishedCapColor,syntheticOceanColor,terrainPalette} from '../styles/terrainPalette';
import {addVisibilityMask} from './visibility';
import {easeInOutCubic,interpolateBuffers} from './morph';
import {graticulePoints,projectGraticule} from './graticule';
import {NavigationOverlay,geographicViewCenter} from './navigation';
import {regionColor} from '../data/regions';
import {LocationsOverlay} from './locations';
import {flyDirection,flyDuration,shortestLongitude} from './flyTo';
import type {Location,LocationFilter} from '../data/poi';
import {encounterColor,encounterPalette} from '../data/encounters';
import type {ColorLayer,EncounterDataset} from '../data/encounters';

type Frame={positions:Float32Array;mask:Float32Array};
interface Morph {start:number;fromId:ProjectionId;from:Frame;to:Frame;gridFrom:Frame;gridTo:Frame;cameraFrom:Vector3;cameraTo:Vector3;targetFrom:Vector3;depthFrom:number;}
interface Flight {start:number;lon:number;lat:number;fromLon:number;fromLat:number;from:Vector3;to:Vector3;distance:number;}
export interface ViewerStats {fps:number;renderTriangles:number;drawCalls:number;morphing:boolean;projection:ProjectionId;}
export class GaiaViewer {
  readonly renderer:WebGLRenderer;
  readonly display:DisplayMesh;
  readonly context:ProjectionContext;
  projectionId:ProjectionId='globe';
  onSelection:(source:number|null)=>void=()=>{};
  onStats:(stats:ViewerStats)=>void=()=>{};
  onProjection:(id:ProjectionId,morphing:boolean)=>void=()=>{};
  onError:(message:string)=>void=()=>{};
  onLocation:(location:Location)=>void=()=>{};
  private locations:LocationsOverlay;
  private flight:Flight|null=null;
  private queuedLocation:{lon:number;lat:number}|null=null;
  private colorLayer:ColorLayer='terrain';
  private encounters:EncounterDataset|null=null;
  private chocoboTracks=false;
  private reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private scene=new Scene();
  private perspective=new PerspectiveCamera(45,1,0.005,100);
  private mapCamera=new OrthographicCamera(-1,1,1,-1,0.005,100);
  private globeControls:OrbitControls;
  private mapControls:OrbitControls;
  private surface:Mesh<BufferGeometry,MeshBasicMaterial>;
  private triangleGrid:LineSegments;
  private graticule:LineSegments;
  private highlight:Mesh<BufferGeometry,MeshBasicMaterial>;
  private frame:Frame;
  private gridFrame:Frame;
  private gridGeo=graticulePoints();
  private cache=new Map<ProjectionId,Frame>();
  private morph:Morph|null=null;
  private selected:number|null=null;
  private highlightRefs:number[]=[];
  private terrain=true;
  private distinguishCaps=false;
  private pointerDown:{x:number;y:number;lon:number;lat:number}|null=null;
  private pointers=new Set<number>();
  private moved=0;
  private statsLast=performance.now();
  private frameTimes:number[]=[];
  private previous=performance.now();
  private resizeObserver:ResizeObserver;
  private navigation:NavigationOverlay;
  private depthEnabled=true;
  private sphereDepth={value:1};
  constructor(private container:HTMLElement,readonly mesh:GaiaMesh,readonly meta:GaiaMeta) {
    this.context={radius:meta.physical_reference_radius_m,mercatorLimit:meta.mercator_max_latitude_deg,centerLon:0,centerLat:0};
    this.display=prepareDisplay(mesh);
    this.frame=projectDisplay(this.display,projections.globe,this.context);
    this.cache.set('globe',{positions:this.frame.positions.slice(),mask:this.frame.mask.slice()});
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(this.frame.positions,3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('gaiaMask',new BufferAttribute(this.frame.mask,1).setUsage(DynamicDrawUsage));
    geometry.setAttribute('color',new BufferAttribute(new Float32Array(this.frame.positions.length),3));
    geometry.boundingSphere=new Sphere(new Vector3(),6);
    const material=new MeshBasicMaterial({vertexColors:true,side:DoubleSide,transparent:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
    addVisibilityMask(material,this.sphereDepth);
    this.surface=new Mesh(geometry,material);
    this.surface.frustumCulled=false;
    this.scene.add(this.surface);
    const edges=new BufferGeometry();
    edges.setAttribute('position',geometry.getAttribute('position'));
    edges.setAttribute('gaiaMask',geometry.getAttribute('gaiaMask'));
    edges.setIndex(new BufferAttribute(this.display.edgeIndices,1));
    const edgeMaterial=new LineBasicMaterial({color:'#e2f0f1',transparent:true,opacity:0.24,depthWrite:false});
    addVisibilityMask(edgeMaterial);
    this.triangleGrid=new LineSegments(edges,edgeMaterial);
    this.triangleGrid.visible=false;this.triangleGrid.frustumCulled=false;
    this.scene.add(this.triangleGrid);
    this.gridFrame=projectGraticule(this.gridGeo,projections.globe,this.context);
    const gridGeometry=new BufferGeometry();
    gridGeometry.setAttribute('position',new BufferAttribute(this.gridFrame.positions,3).setUsage(DynamicDrawUsage));
    gridGeometry.setAttribute('gaiaMask',new BufferAttribute(this.gridFrame.mask,1).setUsage(DynamicDrawUsage));
    const gridColors=new Float32Array(this.gridGeo.length);
    for(let i=0;i<this.gridGeo.length;i+=6){
      const equator=this.gridGeo[i+1]===0&&this.gridGeo[i+4]===0;
      const zeroMeridian=this.gridGeo[i]===0&&this.gridGeo[i+3]===0;
      const color=new Color(equator?'#f2c879':zeroMeridian?'#8dd9de':'#d3dde2');
      for(const j of [i,i+3]){gridColors[j]=color.r;gridColors[j+1]=color.g;gridColors[j+2]=color.b;}
    }
    gridGeometry.setAttribute('color',new BufferAttribute(gridColors,3));
    const gridMaterial=new LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.6,depthWrite:false});
    addVisibilityMask(gridMaterial);
    this.graticule=new LineSegments(gridGeometry,gridMaterial);this.graticule.visible=true;this.graticule.frustumCulled=false;
    this.scene.add(this.graticule);
    const highlightMaterial=new MeshBasicMaterial({color:'#ffdf8f',side:DoubleSide,transparent:true,opacity:0.92,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
    addVisibilityMask(highlightMaterial);
    this.highlight=new Mesh(new BufferGeometry(),highlightMaterial);this.highlight.visible=false;this.highlight.frustumCulled=false;
    this.scene.add(this.highlight);
    this.renderer=new WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    this.renderer.setClearColor(0,0);
    this.renderer.domElement.setAttribute('aria-label','Interactive Gaia map. Drag to rotate or pan; scroll to zoom; tap a triangle to inspect.');
    this.renderer.domElement.tabIndex=0;
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.renderer.setAnimationLoop(null);this.onError('Graphics context interrupted. Retry the viewer to restore your local V1 dataset.');});
    this.renderer.domElement.addEventListener('keydown',e=>{
      const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home','n','N','Escape'];
      if(!keys.includes(e.key))return;e.preventDefault();
      if(e.key==='+'||e.key==='=')this.zoom(.83);
      else if(e.key==='-')this.zoom(1.2);
      else if(e.key==='Home')this.resetView();
      else if(e.key==='Escape')this.clearSelection();
      else if(e.key.toLowerCase()==='n'){this.setAutoRotate(false);this.northUp();}
      else if(!this.morph){
        this.setAutoRotate(false);
        if(this.projectionId==='globe'||this.projectionId==='orthographic'){
          const center=this.projectionId==='globe'?geographicViewCenter(this.perspective.position.x,this.perspective.position.y,this.perspective.position.z):{lon:this.context.centerLon,lat:this.context.centerLat};
          this.focusLocation((center.lon??0)+(e.key==='ArrowLeft'?-5:e.key==='ArrowRight'?5:0),center.lat+(e.key==='ArrowUp'?5:e.key==='ArrowDown'?-5:0));
        }else{
          const step=this.fit().halfHeight*.12/this.mapCamera.zoom,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0;
          this.mapCamera.position.x+=dx;this.mapCamera.position.y+=dy;this.mapControls.target.x+=dx;this.mapControls.target.y+=dy;this.mapControls.update();
        }
      }
    });
    container.append(this.renderer.domElement);
    this.globeControls=new OrbitControls(this.perspective,this.renderer.domElement);
    this.globeControls.enableDamping=true;this.globeControls.dampingFactor=0.08;this.globeControls.enablePan=false;
    this.globeControls.minDistance=1.08;this.globeControls.maxDistance=14;this.globeControls.autoRotateSpeed=0.4;
    this.mapControls=new OrbitControls(this.mapCamera,this.renderer.domElement);
    this.mapControls.enableRotate=false;this.mapControls.screenSpacePanning=true;this.mapControls.enableDamping=true;
    this.mapControls.mouseButtons={LEFT:MOUSE.PAN,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.PAN};
    this.mapControls.touches={ONE:TOUCH.PAN,TWO:TOUCH.DOLLY_PAN};
    this.mapControls.minZoom=0.5;this.mapControls.maxZoom=20;this.mapControls.enabled=false;
    this.renderer.domElement.addEventListener('pointerdown',e=>{
      this.cancelFlight();
      this.pointers.add(e.pointerId);this.moved=0;
      this.pointerDown={x:e.clientX,y:e.clientY,lon:this.context.centerLon,lat:this.context.centerLat};
    });
    this.renderer.domElement.addEventListener('pointermove',e=>{
      if(!this.pointerDown) return;
      const dx=e.clientX-this.pointerDown.x,dy=e.clientY-this.pointerDown.y;
      this.moved=Math.max(this.moved,Math.hypot(dx,dy));
      if(this.projectionId==='orthographic'&&!this.morph&&this.pointers.size===1&&e.buttons!==2) {
        this.context.centerLon=wrapLongitude(this.pointerDown.lon-dx*0.22);
        this.context.centerLat=Math.max(-89,Math.min(89,this.pointerDown.lat+dy*0.22));
        projectDisplay(this.display,projections.orthographic,this.context,this.frame.positions,this.frame.mask);
        const grid=projectGraticule(this.gridGeo,projections.orthographic,this.context);
        this.gridFrame.positions.set(grid.positions);this.gridFrame.mask.set(grid.mask);
        this.changed();
      }
    });
    this.renderer.domElement.addEventListener('pointerup',e=>{
      if(this.pointerDown&&this.moved<5&&this.pointers.size===1&&!this.morph&&e.button===0) this.pick(e.clientX,e.clientY);
      this.pointers.delete(e.pointerId);this.pointerDown=null;
    });
    this.renderer.domElement.addEventListener('pointercancel',e=>{this.pointers.delete(e.pointerId);this.pointerDown=null;});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.navigation=new NavigationOverlay(container);
    this.locations=new LocationsOverlay(container,location=>this.onLocation(location));
    this.colorSurface();this.resize();this.resetView();
    this.renderer.setAnimationLoop(t=>this.animate(t));
  }
  private get camera(){return this.morph||this.projectionId==='globe'?this.perspective:this.mapCamera;}
  private get aspect(){return Math.max(0.01,this.container.clientWidth/Math.max(1,this.container.clientHeight));}
  private fit(id=this.projectionId){return fitProjectionToViewport(projections[id].bounds(this.context),this.aspect);}
  private distance(id:ProjectionId){const fit=this.fit(id);return fit.halfHeight/Math.tan(this.perspective.fov*Math.PI/360)+(id==='globe'?0.45:0);}
  private resize(){
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<768?1.5:2));
    this.renderer.setSize(Math.max(1,this.container.clientWidth),Math.max(1,this.container.clientHeight));
    this.perspective.aspect=this.aspect;this.perspective.updateProjectionMatrix();
    const fit=this.fit();this.mapCamera.left=-fit.halfWidth;this.mapCamera.right=fit.halfWidth;this.mapCamera.top=fit.halfHeight;this.mapCamera.bottom=-fit.halfHeight;this.mapCamera.updateProjectionMatrix();
  }
  resetView(){
    if(this.morph) return;
    this.cancelFlight();
    this.context.centerLon=0;this.context.centerLat=0;
    this.globeControls.target.set(0,0,0);this.mapControls.target.set(0,0,0);
    this.perspective.position.set(0,0.16,this.distance('globe'));this.perspective.lookAt(0,0,0);
    this.mapCamera.position.set(0,0,8);this.mapCamera.zoom=1;this.mapCamera.lookAt(0,0,0);this.resize();
    if(this.projectionId==='orthographic') {projectDisplay(this.display,projections.orthographic,this.context,this.frame.positions,this.frame.mask);const grid=projectGraticule(this.gridGeo,projections.orthographic,this.context);this.gridFrame.positions.set(grid.positions);this.gridFrame.mask.set(grid.mask);this.changed();}
    this.globeControls.update();this.mapControls.update();
  }
  setProjection(id:ProjectionId){
    if(id===this.projectionId&&!this.morph) return;
    this.cancelFlight();
    this.locations.beginMorph(this.projectionId,id,this.context,!!this.morph);
    const oldCamera=this.camera;
    if(oldCamera===this.mapCamera) {
      const distance=(this.mapCamera.top-this.mapCamera.bottom)/(2*this.mapCamera.zoom*Math.tan(this.perspective.fov*Math.PI/360));
      this.perspective.position.set(this.mapCamera.position.x,this.mapCamera.position.y,distance);
      this.perspective.lookAt(this.mapControls.target);
    }
    const target=id==='orthographic'?projectDisplay(this.display,projections[id],this.context):this.cache.get(id)||projectDisplay(this.display,projections[id],this.context);
    if(id!=='orthographic') this.cache.set(id,target);
    const targetFrom=(oldCamera===this.mapCamera?this.mapControls.target:this.globeControls.target).clone();
    this.morph={start:performance.now(),fromId:this.projectionId,from:{positions:this.frame.positions.slice(),mask:this.frame.mask.slice()},to:target,
      gridFrom:{positions:this.gridFrame.positions.slice(),mask:this.gridFrame.mask.slice()},gridTo:projectGraticule(this.gridGeo,projections[id],this.context),
      cameraFrom:this.perspective.position.clone(),cameraTo:new Vector3(0,0,this.distance(id)),targetFrom,depthFrom:this.sphereDepth.value};
    this.projectionId=id;this.globeControls.enabled=false;this.mapControls.enabled=false;
    this.onProjection(id,true);
  }
  setTerrain(value:boolean){this.terrain=value;this.colorSurface();}
  setColorLayer(layer:ColorLayer){this.colorLayer=layer;this.colorSurface();}
  setEncounters(data:EncounterDataset|null){this.encounters=data;this.colorSurface();}
  setChocoboTracks(value:boolean){this.chocoboTracks=value;this.colorSurface();}
  focusLocation(lon:number,lat:number){
    if(this.morph||!Number.isFinite(lon)||!Number.isFinite(lat))return;
    this.cancelFlight();
    lon=wrapLongitude(lon);lat=Math.max(-89,Math.min(89,lat));this.setAutoRotate(false);
    if(this.projectionId==='globe'){
      this.globeControls.enableDamping=false;this.globeControls.update();this.globeControls.enableDamping=true;
      const p=projections.globe.project(lon,lat,0,this.context),distance=this.perspective.position.length();
      this.globeControls.target.set(0,0,0);this.perspective.up.set(0,1,0);this.perspective.position.set(...p).multiplyScalar(distance);this.perspective.lookAt(0,0,0);this.globeControls.update();
    }else if(this.projectionId==='orthographic'){
      this.context.centerLon=lon;this.context.centerLat=lat;
      projectDisplay(this.display,projections.orthographic,this.context,this.frame.positions,this.frame.mask);
      const grid=projectGraticule(this.gridGeo,projections.orthographic,this.context);this.gridFrame.positions.set(grid.positions);this.gridFrame.mask.set(grid.mask);this.changed();
    }else{
      const [x,y]=projections[this.projectionId].project(lon,lat,0,this.context);this.mapCamera.position.set(x,y,8);this.mapControls.target.set(x,y,0);this.mapCamera.lookAt(x,y,0);this.mapControls.update();
    }
  }
  setLocations(locations:Location[]){this.locations.setLocations(locations);if(this.morph)this.locations.beginMorph(this.morph.fromId,this.projectionId,this.context);}
  setLocationsDisplay(show:boolean,labels:boolean,filter:LocationFilter){this.locations.setDisplay(show,labels,filter);}
  selectLocation(id:string|null,position?:Pick<Location,'longitude'|'latitude'|'height'>){this.locations.select(id,position);if(this.morph)this.locations.beginMorph(this.morph.fromId,this.projectionId,this.context);}
  flyToLocation(lon:number,lat:number){
    if(!Number.isFinite(lon)||!Number.isFinite(lat))return;
    if(this.morph){this.queuedLocation={lon,lat};return;}
    this.cancelFlight();this.setAutoRotate(false);
    if(!flyDuration(this.reducedMotion)){this.focusLocation(lon,lat);return;}
    const center=this.projectionId==='globe'?geographicViewCenter(this.perspective.position.x,this.perspective.position.y,this.perspective.position.z):{lon:this.context.centerLon,lat:this.context.centerLat};
    const control=this.projectionId==='globe'?this.globeControls:this.mapControls;
    control.enableDamping=false;control.update();control.enableDamping=true;
    const from=this.projectionId==='globe'?this.perspective.position.clone():this.mapControls.target.clone();
    this.flight={start:performance.now(),lon,lat,fromLon:center.lon??lon,fromLat:center.lat,from,
      to:new Vector3(...projections[this.projectionId].project(lon,lat,0,this.context)),distance:this.perspective.position.length()};
    this.globeControls.enabled=false;this.mapControls.enabled=false;
  }
  private cancelFlight(){
    this.flight=null;this.queuedLocation=null;
    if(!this.morph){this.globeControls.enabled=this.projectionId==='globe';this.mapControls.enabled=!this.globeControls.enabled;}
  }
  setCapDistinction(value:boolean){this.distinguishCaps=value;this.colorSurface();}
  setTriangleGrid(value:boolean){this.triangleGrid.visible=value;}
  setGraticule(value:boolean){this.graticule.visible=value;}
  setGlobeDepth(value:boolean){this.depthEnabled=value;}
  northUp(){
    if(this.morph)return;
    if(this.projectionId==='globe'){
      this.globeControls.enableDamping=false;this.globeControls.update();this.globeControls.enableDamping=true;
      const lon=(geographicViewCenter(this.perspective.position.x,this.perspective.position.y,this.perspective.position.z).lon??0)*Math.PI/180;
      const distance=this.perspective.position.length();
      this.perspective.up.set(0,1,0);this.perspective.position.set(Math.sin(lon)*distance,0,Math.cos(lon)*distance);
      this.perspective.lookAt(0,0,0);this.globeControls.update();
    }else if(this.projectionId==='orthographic'){
      this.context.centerLat=0;
      projectDisplay(this.display,projections.orthographic,this.context,this.frame.positions,this.frame.mask);
      const grid=projectGraticule(this.gridGeo,projections.orthographic,this.context);this.gridFrame.positions.set(grid.positions);this.gridFrame.mask.set(grid.mask);this.changed();
    }
  }
  setAutoRotate(value:boolean){this.globeControls.autoRotate=value;}
  zoom(factor:number){
    if(this.morph) return;
    this.cancelFlight();
    if(this.projectionId==='globe') this.perspective.position.multiplyScalar(factor);
    else {this.mapCamera.zoom=Math.max(0.5,Math.min(20,this.mapCamera.zoom/factor));this.mapCamera.updateProjectionMatrix();}
  }
  clearSelection(){this.selected=null;this.highlight.visible=false;this.onSelection(null);}
  private colorSurface(){
    const colors=this.surface.geometry.getAttribute('color').array as Float32Array;
    const palette=new Map<number,Color>();for(let id=0;id<32;id++)palette.set(id,new Color(this.colorLayer==='region'?regionColor(id):terrainPalette[id]));
    const cap=new Color(this.distinguishCaps?distinguishedCapColor:syntheticOceanColor),neutral=new Color('#83939a');
    const gameplay=this.colorLayer==='encounter'||this.colorLayer==='encounter-rate',gameColors=new Map<string,Color>(),tracks=new Color(encounterPalette.tracks);
    let previous=-1,color=neutral;
    for(let t=0;t<this.display.renderToSource.length;t++) {
      const source=this.display.renderToSource[t];
      if(source!==previous){const a=this.mesh.attributes(source);const colored=this.colorLayer!=='terrain'||this.terrain;color=a.origin?this.distinguishCaps?cap:colored?cap:neutral:colored?palette.get(this.colorLayer==='region'?a.region!:a.terrain!)||neutral:neutral;
        if(!a.origin&&gameplay){const key=`${a.region}:${a.terrain}:${a.script===0}`;if(!gameColors.has(key))gameColors.set(key,new Color(encounterColor(this.encounters,a,this.colorLayer==='encounter-rate')));color=gameColors.get(key)!;}
        if(!a.origin&&this.chocoboTracks&&a.chocobo)color=tracks;previous=source;}
      for(let j=0;j<9;j+=3){const i=t*9+j;colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
    }
    this.surface.geometry.getAttribute('color').needsUpdate=true;
  }
  private pick(x:number,y:number){
    const rect=this.renderer.domElement.getBoundingClientRect(),ray=new Raycaster();
    this.camera.updateMatrixWorld();
    ray.setFromCamera(new Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),this.camera);
    const hits=ray.intersectObject(this.surface,false);
    const bary=new Vector3(),a=new Vector3(),b=new Vector3(),c=new Vector3();
    for(const hit of hits) {
      const face=hit.faceIndex;if(face==null) continue;
      const base=face*9;
      a.fromArray(this.frame.positions,base);b.fromArray(this.frame.positions,base+3);c.fromArray(this.frame.positions,base+6);
      Triangle.getBarycoord(hit.point,a,b,c,bary);
      const mask=this.frame.mask[face*3]*bary.x+this.frame.mask[face*3+1]*bary.y+this.frame.mask[face*3+2]*bary.z;
      if(mask<0.01) continue;
      this.selected=this.display.renderToSource[face];
      this.highlightRefs=[];
      for(let i=0;i<this.display.renderToSource.length;i++) if(this.display.renderToSource[i]===this.selected) for(let j=0;j<3;j++) this.highlightRefs.push(i*3+j);
      this.highlight.geometry.dispose();this.highlight.geometry=new BufferGeometry();
      this.highlight.geometry.setAttribute('position',new BufferAttribute(new Float32Array(this.highlightRefs.length*3),3));
      this.highlight.geometry.setAttribute('gaiaMask',new BufferAttribute(new Float32Array(this.highlightRefs.length),1));
      this.highlight.visible=true;this.updateHighlight();this.onSelection(this.selected);return;
    }
    this.clearSelection();
  }
  private updateHighlight(){
    if(this.selected===null) return;
    const positions=this.highlight.geometry.getAttribute('position').array as Float32Array,mask=this.highlight.geometry.getAttribute('gaiaMask').array as Float32Array;
    for(let i=0;i<this.highlightRefs.length;i++){const index=this.highlightRefs[i];positions[i*3]=this.frame.positions[index*3];positions[i*3+1]=this.frame.positions[index*3+1];positions[i*3+2]=this.frame.positions[index*3+2];mask[i]=this.frame.mask[index];}
    this.highlight.geometry.getAttribute('position').needsUpdate=true;this.highlight.geometry.getAttribute('gaiaMask').needsUpdate=true;
  }
  private changed(){
    this.surface.geometry.getAttribute('position').needsUpdate=true;this.surface.geometry.getAttribute('gaiaMask').needsUpdate=true;
    this.graticule.geometry.getAttribute('position').needsUpdate=true;this.graticule.geometry.getAttribute('gaiaMask').needsUpdate=true;
    this.updateHighlight();
  }
  private animate(time:number){
    const delta=Math.min(100,time-this.previous);this.previous=time;
    this.frameTimes.push(delta);if(this.frameTimes.length>120)this.frameTimes.shift();
    let markerMorph:{ease:number;fromId:ProjectionId}|undefined;
    if(this.morph){
      const t=this.reducedMotion?1:Math.min(1,Math.max(0,(time-this.morph.start)/1100)),ease=easeInOutCubic(t),m=this.morph;
      markerMorph={ease,fromId:m.fromId};
      this.sphereDepth.value=this.depthEnabled?m.depthFrom*(1-ease)+(this.projectionId==='globe'?ease:0):0;
      interpolateBuffers(m.from.positions,m.to.positions,this.frame.positions,ease);interpolateBuffers(m.from.mask,m.to.mask,this.frame.mask,ease);
      interpolateBuffers(m.gridFrom.positions,m.gridTo.positions,this.gridFrame.positions,ease);interpolateBuffers(m.gridFrom.mask,m.gridTo.mask,this.gridFrame.mask,ease);
      this.perspective.position.lerpVectors(m.cameraFrom,m.cameraTo,ease);
      this.perspective.lookAt(m.targetFrom.clone().multiplyScalar(1-ease));
      this.changed();
      if(t===1){
        this.morph=null;this.mapCamera.position.set(0,0,8);this.mapCamera.zoom=1;this.mapControls.target.set(0,0,0);this.mapCamera.lookAt(0,0,0);this.globeControls.target.set(0,0,0);
        this.resize();this.globeControls.enabled=this.projectionId==='globe';this.mapControls.enabled=!this.globeControls.enabled;
        this.mapControls.enablePan=this.projectionId!=='orthographic';this.onProjection(this.projectionId,false);
        if(this.queuedLocation){const location=this.queuedLocation;this.queuedLocation=null;this.flyToLocation(location.lon,location.lat);}
      }
    } else {
      this.sphereDepth.value=this.depthEnabled&&this.projectionId==='globe'?1:0;
      if(this.flight){
        const f=this.flight,t=Math.min(1,Math.max(0,(time-f.start)/flyDuration(this.reducedMotion))),ease=easeInOutCubic(t);
        if(this.projectionId==='globe'){
          this.perspective.position.copy(flyDirection(f.from,f.to,ease).multiplyScalar(f.distance));this.perspective.up.set(0,1,0);this.perspective.lookAt(0,0,0);
        }else if(this.projectionId==='orthographic'){
          this.context.centerLon=shortestLongitude(f.fromLon,f.lon,ease);this.context.centerLat=f.fromLat+(f.lat-f.fromLat)*ease;
          projectDisplay(this.display,projections.orthographic,this.context,this.frame.positions,this.frame.mask);
          const grid=projectGraticule(this.gridGeo,projections.orthographic,this.context);this.gridFrame.positions.set(grid.positions);this.gridFrame.mask.set(grid.mask);this.changed();
        }else{
          const target=new Vector3().lerpVectors(f.from,f.to,ease);target.z=0;
          this.mapCamera.position.set(target.x,target.y,8);this.mapControls.target.copy(target);this.mapCamera.lookAt(target);
        }
        if(t===1){this.flight=null;this.globeControls.enabled=this.projectionId==='globe';this.mapControls.enabled=!this.globeControls.enabled;}
      }else if(this.projectionId==='globe')this.globeControls.update(delta/1000);else this.mapControls.update(delta/1000);
    }
    this.camera.updateMatrixWorld();
    this.locations.update(this.projectionId,this.context,this.camera,markerMorph);
    this.renderer.render(this.scene,this.camera);
    this.navigation.update(time,this.projectionId,this.context,this.camera,!!this.morph,this.graticule.visible);
    if(time-this.statsLast>600){this.statsLast=time;const fps=1000/(this.frameTimes.reduce((a,b)=>a+b,0)/Math.max(1,this.frameTimes.length));this.onStats({fps,renderTriangles:this.display.renderToSource.length,drawCalls:this.renderer.info.render.calls,morphing:!!this.morph,projection:this.projectionId});}
  }
  dispose(){this.renderer.setAnimationLoop(null);this.locations.dispose();this.resizeObserver.disconnect();this.globeControls.dispose();this.mapControls.dispose();this.scene.traverse(object=>{if(object instanceof Mesh||object instanceof LineSegments){object.geometry.dispose();object.material.dispose();}});this.renderer.dispose();this.renderer.domElement.remove();}
}
