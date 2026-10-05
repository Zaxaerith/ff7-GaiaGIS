import {configureOutput} from '../explorer/lighting';
// SPDX-License-Identifier: GPL-3.0-only
import {BufferAttribute,BufferGeometry,Color,DoubleSide,DynamicDrawUsage,LineBasicMaterial,LineSegments,
  Mesh,MeshBasicMaterial,MOUSE,OrthographicCamera,PerspectiveCamera,Raycaster,Scene,Sphere,TOUCH,
  Triangle,Vector2,Vector3,WebGLRenderer} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {GaiaMesh,GaiaMeta} from '../data/mesh';
import {prepareDisplay,projectDisplay} from '../data/display';
import type {DisplayMesh} from '../data/display';
import {projections} from '../projections';
import {rotatesCenter} from '../projections/registry';
import {fitProjectionToViewport,wrapLongitude} from '../projections/Projection';
import type {ProjectionId,ProjectionContext} from '../projections/Projection';
import {distinguishedCapColor,syntheticOceanColor,terrainPalette} from '../styles/terrainPalette';
import {addVisibilityMask} from './visibility';
import {easeInOutCubic,interpolateBuffers} from './morph';
import {graticulePoints,projectGraticule} from './graticule';
import {NavigationOverlay,geographicViewCenter} from './navigation';
import {t} from '../i18n';
import {regionColor} from '../data/regions';
import {LocationsOverlay} from './locations';
import {eventLocation,filterEvent} from '../data/events';
import type {WorldEvent,EventFilter} from '../data/events';
import {flyDirection,flyDuration,shortestLongitude} from './flyTo';
import type {Location,LocationFilter} from '../data/poi';
import {encounterColor,encounterPalette} from '../data/encounters';
import type {ColorLayer,EncounterDataset} from '../data/encounters';
import {profileById,traversalColor} from '../data/traversal';
import {orderSurfaceHits} from './surfacePicking';
import {RouteOverlay} from './route';
import {corridorPoints,routeSegments} from './route';
import {createSurfaceMaterial} from './surfaceMaterial';
import {TexturedSurface} from './texturedSurface';
import {applyRelief,validateExaggeration} from './relief';
import {displayTextureAttributes,textureAlpha} from '../data/textures';
import type {DecodedTextures} from '../data/textures';
import {CartographicLine} from './cartographicLines';
import {ComparisonView} from './comparisonView';
import type {LinkedView} from './comparisonView';
import type {GeoPoint} from '../projections/Projection';
import {geographicSource,sourceGeographic} from '../explorer/coordinates';
import {inverseDisplay} from '../analysis/distortion';
import {measurementSegments} from '../analysis/sphere';
import {adaptiveGrid,chooseInterval,minorInterval,visibleGridBounds} from '../analysis/adaptive';
import type {GridMode} from '../analysis/adaptive';
import {comparisonPalette} from '../analysis/comparison';
import {screenGridPolicy} from './gridPolicy';

type Frame={positions:Float32Array;mask:Float32Array};
interface Morph {start:number;fromId:ProjectionId;from:Frame;to:Frame;gridFrom:Frame;gridTo:Frame;cameraFrom:Vector3;cameraTo:Vector3;targetFrom:Vector3;depthFrom:number;}
interface Flight {start:number;lon:number;lat:number;fromLon:number;fromLat:number;from:Vector3;to:Vector3;distance:number;}
export interface ViewerStats {fps:number;renderTriangles:number;drawCalls:number;morphing:boolean;projection:ProjectionId;}
export class GaiaViewer {
  captureExplorer=false;
  onExplorerFrame:(seconds:number)=>void=()=>{};
  onExplorerPick:(source:number,point:GeoPoint)=>void=()=>{};
  get overviewBridge(){return {camera:this.camera,controls:this.projectionId==='globe'?this.globeControls:this.mapControls};}
  get explorerBridge(){return {scene:this.scene,camera:this.perspective,controls:this.globeControls,container:this.container};}
  readonly renderer:WebGLRenderer;
  readonly display:DisplayMesh;
  readonly context:ProjectionContext;
  projectionId:ProjectionId='globe';
  private route=new RouteOverlay();
  readonly measurement=new CartographicLine('#73e4ed');
  readonly tissot=new CartographicLine('#dfb4ff',true);
  readonly comparedRoutes=[new CartographicLine('#6de0d0'),new CartographicLine('#ffab82'),new CartographicLine('#c5acff')];
  private comparison:ComparisonView|null=null;
  private comparisonId:ProjectionId='equal-earth';
  private compareLayout:HTMLElement|null=null;
  private pendingLinked:LinkedView|null=null;
  private comparisonFlags:Uint8Array|null=null;
  captureMeasurement=false;
  onGeographicPick:(point:GeoPoint)=>void=()=>{};
  onViewChange:(view:LinkedView)=>void=()=>{};
  readonly diagnostics={mapId:0,gridInterval:30,gridSpacingPx:0,gridRegenerations:0,gridGenerationMs:0,tissotGenerationMs:0,comparisonDrawCalls:0,reliefUpdateMs:0,textureUVPreparationMs:0,textureUploadSubmissionMs:0};
  private gridMode:GridMode='auto';private gridMinor=true;private gridLast=-Infinity;private gridKey='';private gridCameraKey='';
  private centerCache:GeoPoint=[0,0,0];private centerKey='';
  private centerResolved=true;
  private reachable:Uint8Array|null=null;
  private corridor=new Set<number>();
  private analysisPath:number[]=[];
  onSelection:(source:number|null)=>void=()=>{};
  onStats:(stats:ViewerStats)=>void=()=>{};
  onProjection:(id:ProjectionId,morphing:boolean)=>void=()=>{};
  onError:(message:string)=>void=()=>{};
  onLocation:(location:Location)=>void=()=>{};
  private locations:LocationsOverlay;
  private events:LocationsOverlay;
  private eventRecords:WorldEvent[]=[];
  private eventTriggers=new Set<string>();
  private showTriggers=false;
  onEvent:(event:WorldEvent)=>void=()=>{};
  private flight:Flight|null=null;
  private queuedLocation:{lon:number;lat:number}|null=null;
  private colorLayer:ColorLayer='terrain';
  private movementMode='foot';
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
  relief=1; shading=false; originalTexture=false; texturePack:DecodedTextures|null=null;
  private textured!:TexturedSurface;
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
    const material=createSurfaceMaterial(this.sphereDepth);
    this.surface=new Mesh(geometry,material);
    this.textured=new TexturedSurface(material,geometry);
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
    this.scene.add(this.graticule);this.scene.add(this.route.line);
    for(const o of [this.measurement,this.tissot,...this.comparedRoutes])this.scene.add(o.line);
    this.diagnostics.mapId=mesh.attributes(0).map??0;
    const highlightMaterial=new MeshBasicMaterial({color:'#ffdf8f',side:DoubleSide,transparent:true,opacity:0.92,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
    addVisibilityMask(highlightMaterial);
    this.highlight=new Mesh(new BufferGeometry(),highlightMaterial);this.highlight.visible=false;this.highlight.frustumCulled=false;
    this.scene.add(this.highlight);
    this.renderer=new WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    configureOutput(this.renderer);this.renderer.setClearColor(0,0);
    this.renderer.domElement.setAttribute('aria-label',t('ui.canvasAria'));
    this.renderer.domElement.tabIndex=0;
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.renderer.setAnimationLoop(null);this.onError('Graphics context interrupted. Retry the viewer to restore your local V1 dataset.');});
    this.renderer.domElement.addEventListener('keydown',e=>{
      if(this.captureExplorer)return;
      const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home','n','N','Escape'];
      if(!keys.includes(e.key))return;e.preventDefault();
      if(e.key==='+'||e.key==='=')this.zoom(.83);
      else if(e.key==='-')this.zoom(1.2);
      else if(e.key==='Home')this.resetView();
      else if(e.key==='Escape')this.clearSelection();
      else if(e.key.toLowerCase()==='n'){this.setAutoRotate(false);this.northUp();}
      else if(!this.morph){
        this.setAutoRotate(false);
        if(this.projectionId==='globe'||rotatesCenter(this.projectionId)){
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
      if(rotatesCenter(this.projectionId)&&!this.morph&&this.pointers.size===1&&e.buttons!==2) {
        this.context.centerLon=wrapLongitude(this.pointerDown.lon-dx*0.22);
        this.context.centerLat=Math.max(-89,Math.min(89,this.pointerDown.lat+dy*0.22));
        projectDisplay(this.display,projections[this.projectionId],this.context,this.frame.positions,this.frame.mask);
        const grid=projectGraticule(this.gridGeo,projections[this.projectionId],this.context);
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
    this.locations=new LocationsOverlay(container,location=>{this.onGeographicPick([location.longitude,location.latitude,location.height]);if(!this.captureMeasurement)this.onLocation(location);});
    this.events=new LocationsOverlay(container,location=>{this.onGeographicPick([location.longitude,location.latitude,location.height]);const e=this.eventRecords.find(e=>e.id===location.id);if(e&&!this.captureMeasurement)this.onEvent(e);},'event');
    this.events.setDisplay(false,false,'all');
    this.colorSurface();this.resize();this.resetView();
    this.renderer.setAnimationLoop(t=>this.animate(t));
  }
  loadTextures(pack:DecodedTextures){const start=performance.now(),attrs=displayTextureAttributes(pack,this.mesh,this.display);this.diagnostics.textureUVPreparationMs=performance.now()-start;this.textured.load(pack,this.surface.geometry,attrs);const upload=performance.now();this.renderer.initTexture(this.textured.texture!);this.diagnostics.textureUploadSubmissionMs=performance.now()-upload;const old=this.texturePack;this.texturePack=pack;old?.image.close();this.syncTexture();}
  setSurfaceStyle(style:'terrain'|'region'|'texture'){this.originalTexture=style==='texture';if(style!=='texture')this.setColorLayer(style);else this.setColorLayer('terrain');this.syncTexture();}
  setTextureFiltering(linear:boolean){this.textured.filtering(linear);}
  setReliefShading(value:boolean){this.shading=value;this.syncTexture();}
  private syncTexture(){this.textured.uniforms.gaiaTextureEnabled.value=this.originalTexture&&!!this.texturePack?1:0;this.textured.uniforms.gaiaShading.value=this.shading&&this.projectionId==='globe'?1:0;}
  setRelief(value:number){this.relief=validateExaggeration(value);this.cache.delete('globe');const start=performance.now();if(this.morph){if(this.projectionId==='globe')applyRelief(this.display,this.morph.to.positions,this.context.radius,value);}else if(this.projectionId==='globe'){applyRelief(this.display,this.frame.positions,this.context.radius,value);this.changed();}this.locations.relief=this.events.relief=value;this.route.relief=value;for(const o of [this.measurement,this.tissot,...this.comparedRoutes])o.relief=value;this.diagnostics.reliefUpdateMs=performance.now()-start;}
  private get camera(){return this.morph||this.projectionId==='globe'?this.perspective:this.mapCamera;}
  viewState():LinkedView{const key=`${this.projectionId}:${this.camera.position.toArray().map(x=>x.toFixed(5))}:${this.mapCamera.zoom.toFixed(4)}:${this.context.centerLon.toFixed(4)}:${this.context.centerLat.toFixed(4)}`;if(key!==this.centerKey&&!this.morph){this.centerResolved=true;if(this.projectionId==='globe'){const c=geographicViewCenter(this.perspective.position.x,this.perspective.position.y,this.perspective.position.z);this.centerCache=[c.lon??0,c.lat,0];}else if(rotatesCenter(this.projectionId))this.centerCache=[this.context.centerLon,this.context.centerLat,0];else{const center=inverseDisplay(this.projectionId,this.mapControls.target.x,this.mapControls.target.y,this.context,this.centerCache);this.centerResolved=!!center;if(center)this.centerCache=center;}this.centerKey=key;}return {center:this.centerCache,centerResolved:this.centerResolved,zoom:this.projectionId==='globe'?this.distance('globe')/this.perspective.position.length():this.mapCamera.zoom};}
  setGridMode(mode:GridMode){this.gridMode=mode;this.graticule.visible=mode!=='off';this.gridKey=this.gridCameraKey='';this.gridLast=-Infinity;}
  setGridMinor(value:boolean){this.gridMinor=value;this.gridKey=this.gridCameraKey='';this.gridLast=-Infinity;}
  private updateAdaptiveGrid(time:number){if(this.morph||!this.graticule.visible||time-this.gridLast<180)return;this.gridLast=time;const view=this.viewState(),w=this.container.clientWidth,h=this.container.clientHeight,cameraKey=`${this.projectionId}:${Math.round(Math.log(view.zoom)*40)}:${Math.round(view.center[0]*2)}:${Math.round(view.center[1]*2)}:${w}:${h}`;if(cameraKey===this.gridCameraKey)return;this.gridCameraKey=cameraKey;
    const policy=screenGridPolicy(this.projectionId,this.context,this.camera,w,h,view.center,this.gridMode,this.diagnostics.gridInterval,this.gridMinor),{interval,minor,bounds}=policy,key=`${interval}:${minor}:${JSON.stringify(bounds)}`;this.diagnostics.gridInterval=interval;this.diagnostics.gridSpacingPx=policy.pixels;if(key===this.gridKey)return;const begin=performance.now(),grid=adaptiveGrid(interval,bounds,minor);this.gridKey=key;this.gridGeo=grid.geo;this.gridFrame=projectGraticule(this.gridGeo,projections[this.projectionId],this.context);this.graticule.geometry.dispose();const geometry=new BufferGeometry();this.graticule.geometry=geometry;geometry.setAttribute('position',new BufferAttribute(this.gridFrame.positions,3).setUsage(DynamicDrawUsage));geometry.setAttribute('gaiaMask',new BufferAttribute(this.gridFrame.mask,1).setUsage(DynamicDrawUsage));const colors=new Float32Array(this.gridGeo.length);for(let i=0;i<grid.kind.length;i++){const kind=grid.kind[i],color=new Color(kind===2?'#f2c879':kind===3?'#8dd9de':'#d3dde2');if(kind===1)color.multiplyScalar(.4);colors.set([color.r,color.g,color.b],i*3);}geometry.setAttribute('color',new BufferAttribute(colors,3));this.diagnostics.gridRegenerations++;this.diagnostics.gridGenerationMs=performance.now()-begin;}
  setMeasurement(points:GeoPoint[],closed=false){let line=measurementSegments(points,closed);if(points.length===1){const p=points[0];line=[[p[0]-.1,p[1],1500],[p[0]+.1,p[1],1500]];}this.measurement.set(routeSegments(line));if(this.comparison)this.comparison.measurement.set(this.measurement.geo);}
  setTissot(value:boolean){this.tissot.line.visible=value;this.tissot.update(this.projectionId,this.context);if(this.comparison)this.comparison.tissot.line.visible=value;}
  setComparisonFlags(flags:Uint8Array|null){if(flags&&flags.length!==this.mesh.sourceTriangleCount)throw new Error('Comparison map scope differs');this.comparisonFlags=flags;this.colorSurface();}
  setComparedRoutes(paths:number[][]){if(paths.length>3)throw new Error('Maximum three route overlays');this.comparedRoutes.forEach((o,i)=>o.set(routeSegments(corridorPoints(this.mesh,paths[i]??[]))));if(this.comparison)this.comparison.comparedRoutes.forEach((o,i)=>o.set(this.comparedRoutes[i].geo));}
  setProjectionComparison(id:ProjectionId|null){if(id===null){this.comparison?.dispose();this.comparison=null;if(this.compareLayout){this.compareLayout.before(this.container);this.compareLayout.remove();this.compareLayout=null;}this.diagnostics.comparisonDrawCalls=0;this.resize();return;}this.comparisonId=id;if(!this.comparison){const layout=document.createElement('div');layout.className='comparison-layout';this.container.before(layout);layout.append(this.container);this.compareLayout=layout;this.comparison=new ComparisonView(layout,this.display,this.surface.geometry.getAttribute('color') as BufferAttribute,l=>{this.onGeographicPick([l.longitude,l.latitude,l.height]);if(!this.captureMeasurement){this.flyToLocation(l.longitude,l.latitude);this.onLocation(l);}},l=>{const event=this.eventRecords.find(e=>e.id===l.id);if(event){this.onGeographicPick([event.longitude,event.latitude,event.height??0]);if(!this.captureMeasurement){this.flyToLocation(event.longitude,event.latitude);this.onEvent(event);}}});this.comparison.route.set(routeSegments(corridorPoints(this.mesh,this.analysisPath)));this.comparison.measurement.set(this.measurement.geo);this.comparison.tissot.line.visible=this.tissot.line.visible;this.comparison.comparedRoutes.forEach((o,i)=>o.set(this.comparedRoutes[i].geo));this.resize();}}
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
    if(rotatesCenter(this.projectionId)) {projectDisplay(this.display,projections[this.projectionId],this.context,this.frame.positions,this.frame.mask);const grid=projectGraticule(this.gridGeo,projections[this.projectionId],this.context);this.gridFrame.positions.set(grid.positions);this.gridFrame.mask.set(grid.mask);this.changed();}
    this.globeControls.update();this.mapControls.update();
  }
  setProjection(id:ProjectionId){
    if(id===this.projectionId&&!this.morph) return;
    if(this.comparison)this.pendingLinked=this.viewState();
    this.cancelFlight();
    for(const o of [this.measurement,this.tissot,...this.comparedRoutes])o.begin(this.projectionId,id,this.context);
    this.locations.beginMorph(this.projectionId,id,this.context,!!this.morph);
    this.events.beginMorph(this.projectionId,id,this.context,!!this.morph);this.route.begin(this.projectionId,id,this.context,!!this.morph);
    const oldCamera=this.camera;
    if(oldCamera===this.mapCamera) {
      const distance=(this.mapCamera.top-this.mapCamera.bottom)/(2*this.mapCamera.zoom*Math.tan(this.perspective.fov*Math.PI/360));
      this.perspective.position.set(this.mapCamera.position.x,this.mapCamera.position.y,distance);
      this.perspective.lookAt(this.mapControls.target);
    }
    const target=rotatesCenter(id)?projectDisplay(this.display,projections[id],this.context):this.cache.get(id)||projectDisplay(this.display,projections[id],this.context);
    if(id==='globe')applyRelief(this.display,target.positions,this.context.radius,this.relief);
    if(!rotatesCenter(id)) this.cache.set(id,target);
    const targetFrom=(oldCamera===this.mapCamera?this.mapControls.target:this.globeControls.target).clone();
    this.morph={start:performance.now(),fromId:this.projectionId,from:{positions:this.frame.positions.slice(),mask:this.frame.mask.slice()},to:target,
      gridFrom:{positions:this.gridFrame.positions.slice(),mask:this.gridFrame.mask.slice()},gridTo:projectGraticule(this.gridGeo,projections[id],this.context),
      cameraFrom:this.perspective.position.clone(),cameraTo:new Vector3(0,0,this.distance(id)),targetFrom,depthFrom:this.sphereDepth.value};
    this.projectionId=id;this.globeControls.enabled=false;this.mapControls.enabled=false;
    this.onProjection(id,true);
  }
  setAnalysis(reachable:Uint8Array|null,path:number[],start:string|null,target:string|null,locations:Set<string>|null){this.analysisPath=path;this.reachable=reachable;this.corridor=new Set(path);this.route.set(this.mesh,path);if(this.comparison)this.comparison.route.set(routeSegments(corridorPoints(this.mesh,path)));this.locations.setAnalysis(start,target,locations);this.colorSurface();if(this.morph)this.route.begin(this.morph.fromId,this.projectionId,this.context);}
  setTerrain(value:boolean){this.terrain=value;this.colorSurface();}
  setColorLayer(layer:ColorLayer){this.colorLayer=layer;this.colorSurface();}
  setEvents(events:WorldEvent[]){this.eventRecords=events;this.events.setLocations(events.map(eventLocation));if(this.morph)this.events.beginMorph(this.morph.fromId,this.projectionId,this.context);}
  setEventsDisplay(show:boolean,filter:EventFilter){this.events.setLocations(this.eventRecords.filter(e=>filterEvent(e,filter)).map(eventLocation));this.events.setDisplay(show,false,'all');if(this.morph)this.events.beginMorph(this.morph.fromId,this.projectionId,this.context);}
  selectEvent(event:WorldEvent|null){this.events.select(event?.id??null);this.eventTriggers=new Set(event?.trigger_triangle_ids.map(id=>`${event.section_id}/${event.mesh_id}/${id}`)??[]);this.colorSurface();}
  setScriptTriggers(show:boolean){this.showTriggers=show;this.colorSurface();}
  setMovementMode(id:string){profileById(id);this.movementMode=id;if(this.colorLayer==='traversal')this.colorSurface();}
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
    }else if(rotatesCenter(this.projectionId)){
      this.context.centerLon=lon;this.context.centerLat=lat;
      projectDisplay(this.display,projections[this.projectionId],this.context,this.frame.positions,this.frame.mask);
      const grid=projectGraticule(this.gridGeo,projections[this.projectionId],this.context);this.gridFrame.positions.set(grid.positions);this.gridFrame.mask.set(grid.mask);this.changed();
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
    if(!this.morph){this.globeControls.enabled=!this.captureExplorer&&this.projectionId==='globe';this.mapControls.enabled=!this.captureExplorer&&this.projectionId!=='globe';}
  }
  setCapDistinction(value:boolean){this.distinguishCaps=value;this.colorSurface();}
  setTriangleGrid(value:boolean){this.triangleGrid.visible=value;}
  setGraticule(value:boolean){this.graticule.visible=value;if(value&&this.gridMode==='off')this.gridMode='auto';this.gridCameraKey='';}
  setGlobeDepth(value:boolean){this.depthEnabled=value;}
  northUp(){
    if(this.morph)return;
    if(this.projectionId==='globe'){
      this.globeControls.enableDamping=false;this.globeControls.update();this.globeControls.enableDamping=true;
      const lon=(geographicViewCenter(this.perspective.position.x,this.perspective.position.y,this.perspective.position.z).lon??0)*Math.PI/180;
      const distance=this.perspective.position.length();
      this.perspective.up.set(0,1,0);this.perspective.position.set(Math.sin(lon)*distance,0,Math.cos(lon)*distance);
      this.perspective.lookAt(0,0,0);this.globeControls.update();
    }else if(rotatesCenter(this.projectionId)){
      this.context.centerLat=0;
      projectDisplay(this.display,projections[this.projectionId],this.context,this.frame.positions,this.frame.mask);
      const grid=projectGraticule(this.gridGeo,projections[this.projectionId],this.context);this.gridFrame.positions.set(grid.positions);this.gridFrame.mask.set(grid.mask);this.changed();
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
    const tint=this.surface.geometry.getAttribute('gaiaTint').array as Float32Array;
    const palette=new Map<number,Color>();for(let id=0;id<32;id++)palette.set(id,new Color(this.colorLayer==='region'?regionColor(id):terrainPalette[id]));
    const cap=new Color(this.distinguishCaps?distinguishedCapColor:syntheticOceanColor),neutral=new Color('#83939a');
    const gameplay=this.colorLayer==='encounter'||this.colorLayer==='encounter-rate',gameColors=new Map<string,Color>(),tracks=new Color(encounterPalette.tracks);
    let previous=-1,color=neutral,mix=0;
    for(let t=0;t<this.display.renderToSource.length;t++) {
      const source=this.display.renderToSource[t];
      if(source!==previous){const a=this.mesh.attributes(source);const colored=this.colorLayer!=='terrain'||this.terrain;color=a.origin?this.distinguishCaps?cap:colored?cap:neutral:colored?palette.get(this.colorLayer==='region'?a.region!:a.terrain!)||neutral:neutral;
        if(!a.origin&&gameplay){const key=`${a.region}:${a.terrain}:${a.script===0}`;if(!gameColors.has(key))gameColors.set(key,new Color(encounterColor(this.encounters,a,this.colorLayer==='encounter-rate')));color=gameColors.get(key)!;}
        if(this.colorLayer==='traversal'){const key=`traversal:${a.terrain}:${a.script}:${a.origin}`;if(!gameColors.has(key))gameColors.set(key,new Color(traversalColor(this.movementMode,a)));color=gameColors.get(key)!;}
        if(this.reachable&&!a.origin&&!this.reachable[source])color=color.clone().multiplyScalar(.25);
        if(this.comparisonFlags&&!a.origin)color=new Color(comparisonPalette[this.comparisonFlags[source]]);
        if(!a.origin&&this.chocoboTracks&&a.chocobo)color=tracks;
        if(this.showTriggers&&!a.origin&&(a.script!>=3||this.eventTriggers.has(`${a.section}/${a.mesh}/${a.triangle}`)))color=new Color(this.eventTriggers.has(`${a.section}/${a.mesh}/${a.triangle}`)?'#ff9bd6':'#9c7ee9');
        if(this.corridor.has(source))color=new Color('#ffe18c');
        mix=(this.colorLayer!=='terrain'||!!this.reachable||!!this.comparisonFlags||this.chocoboTracks&&!!a.chocobo||this.showTriggers&&a.script!==null&&a.script>=3||this.corridor.has(source)) ? .65 : 0;
        previous=source;}
      for(let j=0;j<9;j+=3){const i=t*9+j;colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;tint[t*3+j/3]=mix;}
    }
    this.surface.geometry.getAttribute('color').needsUpdate=true;this.surface.geometry.getAttribute('gaiaTint').needsUpdate=true;
  }
  private pick(x:number,y:number){
    const rect=this.renderer.domElement.getBoundingClientRect(),ray=new Raycaster();
    this.camera.updateMatrixWorld();
    ray.setFromCamera(new Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),this.camera);
    const hits=ray.intersectObject(this.surface,false);
    const bary=new Vector3(),a=new Vector3(),b=new Vector3(),c=new Vector3();
    for(const hit of orderSurfaceHits(hits)) {
      const face=hit.faceIndex;if(face==null) continue;
      const base=face*9;
      a.fromArray(this.frame.positions,base);b.fromArray(this.frame.positions,base+3);c.fromArray(this.frame.positions,base+6);
      Triangle.getBarycoord(hit.point,a,b,c,bary);
      const mask=this.frame.mask[face*3]*bary.x+this.frame.mask[face*3+1]*bary.y+this.frame.mask[face*3+2]*bary.z;
      if(mask<0.01) continue;
      if(this.originalTexture&&this.texturePack){const texture=this.mesh.attributes(this.display.renderToSource[face]).texture;if(texture!==null){const uv=this.surface.geometry.getAttribute('gaiaUV').array,offset=face*6,u=uv[offset]*bary.x+uv[offset+2]*bary.y+uv[offset+4]*bary.z,v=uv[offset+1]*bary.x+uv[offset+3]*bary.y+uv[offset+5]*bary.z;if(textureAlpha(this.texturePack,texture,u,v,this.textured.texture?.magFilter===1006)<.005)continue;}}

      let geographic:GeoPoint|null=null;
      if(this.projectionId==='globe'){const p=geographicViewCenter(hit.point.x,hit.point.y,hit.point.z);geographic=[p.lon??0,p.lat,0];}else geographic=inverseDisplay(this.projectionId,hit.point.x,hit.point.y,this.context);
      if(this.captureExplorer){
        // Invert each display corner, then interpolate in source X/Z. Inverting
        // the curved sphere hit itself would drift off the source triangle.
        const source=this.display.renderToSource[face];if(source<this.mesh.sourceTriangleCount){
          const corners=[0,1,2].map(j=>geographicSource(this.display.geographic[base+j*3],this.display.geographic[base+j*3+1]));
          const width=294912,center=corners[0][0],w=[bary.x,bary.y,bary.z];let x=0,z=0;
          for(let j=0;j<3;j++){x+=(corners[j][0]+Math.round((center-corners[j][0])/width)*width)*w[j];z+=corners[j][1]*w[j];}
          this.onExplorerPick(source,sourceGeographic(x,z,0));
        }return;
      }
      if(geographic){this.onGeographicPick(geographic);if(this.captureMeasurement)return;}
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
        this.resize();this.globeControls.enabled=!this.captureExplorer&&this.projectionId==='globe';this.mapControls.enabled=!this.captureExplorer&&this.projectionId!=='globe';
        this.mapControls.enablePan=!rotatesCenter(this.projectionId);this.onProjection(this.projectionId,false);
        if(this.pendingLinked&&this.comparison){const v=this.pendingLinked;this.pendingLinked=null;this.focusLocation(v.center[0],v.center[1]);if(this.projectionId==='globe')this.perspective.position.multiplyScalar((this.distance('globe')/this.perspective.position.length())/v.zoom);else{this.mapCamera.zoom=v.zoom;this.mapCamera.updateProjectionMatrix();}}
        if(this.queuedLocation){const location=this.queuedLocation;this.queuedLocation=null;this.flyToLocation(location.lon,location.lat);}
      }
    } else {
      this.sphereDepth.value=this.depthEnabled&&this.projectionId==='globe'?1:0;
      if(this.flight){
        const f=this.flight,t=Math.min(1,Math.max(0,(time-f.start)/flyDuration(this.reducedMotion))),ease=easeInOutCubic(t);
        if(this.projectionId==='globe'){
          this.perspective.position.copy(flyDirection(f.from,f.to,ease).multiplyScalar(f.distance));this.perspective.up.set(0,1,0);this.perspective.lookAt(0,0,0);
        }else if(rotatesCenter(this.projectionId)){
          this.context.centerLon=shortestLongitude(f.fromLon,f.lon,ease);this.context.centerLat=f.fromLat+(f.lat-f.fromLat)*ease;
          projectDisplay(this.display,projections[this.projectionId],this.context,this.frame.positions,this.frame.mask);
          const grid=projectGraticule(this.gridGeo,projections[this.projectionId],this.context);this.gridFrame.positions.set(grid.positions);this.gridFrame.mask.set(grid.mask);this.changed();
        }else{
          const target=new Vector3().lerpVectors(f.from,f.to,ease);target.z=0;
          this.mapCamera.position.set(target.x,target.y,8);this.mapControls.target.copy(target);this.mapCamera.lookAt(target);
        }
        if(t===1){this.flight=null;this.globeControls.enabled=!this.captureExplorer&&this.projectionId==='globe';this.mapControls.enabled=!this.captureExplorer&&this.projectionId!=='globe';}
      }else if(!this.captureExplorer){if(this.projectionId==='globe')this.globeControls.update(delta/1000);else this.mapControls.update(delta/1000);}
    }
    if(this.captureExplorer&&!this.morph)this.onExplorerFrame(delta/1000);
    this.camera.updateMatrixWorld();
    this.updateAdaptiveGrid(time);
    this.locations.update(this.projectionId,this.context,this.camera,markerMorph);
    this.events.update(this.projectionId,this.context,this.camera,markerMorph);
    this.route.update(this.projectionId,this.context,markerMorph?.ease);
    for(const o of [this.measurement,this.tissot,...this.comparedRoutes])o.update(this.projectionId,this.context,markerMorph?.ease,this.camera.position);
    this.diagnostics.tissotGenerationMs=this.tissot.generationMs;
    this.syncTexture();if(this.originalTexture||this.shading)this.sphereDepth.value=0;
    this.renderer.render(this.scene,this.camera);
    const view=this.viewState();this.onViewChange(view);
    if(this.comparison){this.locations.mirrorTo(this.comparison.locations);this.events.mirrorTo(this.comparison.events);this.comparison.setSurface(this.surface.geometry,this.textured.uniforms,this.relief,this.shading);this.comparison.update(this.comparisonId,this.context,view,this.gridMode,this.gridMinor,this.graticule.visible);this.diagnostics.comparisonDrawCalls=this.comparison.drawCalls;}
    this.navigation.update(time,this.projectionId,this.context,this.camera,!!this.morph,this.graticule.visible,this.diagnostics.gridInterval,view.center);
    if(time-this.statsLast>600){this.statsLast=time;const fps=1000/(this.frameTimes.reduce((a,b)=>a+b,0)/Math.max(1,this.frameTimes.length));this.onStats({fps,renderTriangles:this.display.renderToSource.length,drawCalls:this.renderer.info.render.calls,morphing:!!this.morph,projection:this.projectionId});}
  }
  setSuspended(value:boolean){this.renderer.setAnimationLoop(value?null:t=>this.animate(t));if(value)this.comparison?.renderer.setAnimationLoop(null);}
  dispose(){this.textured.dispose();this.texturePack?.image.close();this.renderer.setAnimationLoop(null);this.setProjectionComparison(null);this.locations.dispose();this.events.dispose();this.resizeObserver.disconnect();this.globeControls.dispose();this.mapControls.dispose();this.scene.traverse(object=>{if(object instanceof Mesh||object instanceof LineSegments){object.geometry.dispose();object.material.dispose();}});this.renderer.dispose();this.renderer.domElement.remove();}
}
