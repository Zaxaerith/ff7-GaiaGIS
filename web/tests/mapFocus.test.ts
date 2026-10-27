// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi} from 'vitest';
import {OrthographicCamera,PerspectiveCamera,Vector3} from 'three';
import {detailViewOffset} from '../src/viewer/flyTo';
import {GaiaViewer} from '../src/viewer/GaiaViewer';

describe('existing map camera frames anchored details',()=>{
 it.each([[1920,1080,430],[1366,768,410],[768,1024,380]])('keeps the selected point clear of a right inspector at %s × %s',(width,height,panel)=>{
  const view={left:0,top:64,width,height:height-100},detail={left:width-panel-8,top:72,right:width-8,bottom:height-44},offset=detailViewOffset(view,detail);
  for(const camera of [new PerspectiveCamera(45,width/view.height,.1,100),new OrthographicCamera(-2,2,1,-1,.1,100)]){
   camera.position.set(0,0,3);camera.lookAt(0,0,0);camera.updateMatrixWorld();camera.setViewOffset(width,view.height,offset.x,offset.y,width,view.height);
   const point=new Vector3().project(camera),x=(point.x+1)*width/2,y=(1-point.y)*view.height/2+view.top;
   expect(x).toBeGreaterThan(12);expect(x).toBeLessThan(detail.left-8);expect(y).toBeGreaterThan(view.top);expect(y).toBeLessThan(detail.bottom);
  }
 });
 it('leaves map space above a narrow detail sheet without changing projection or zoom',()=>{
  const view={left:0,top:60,width:390,height:748},detail={left:4,top:470,right:386,bottom:804},offset=detailViewOffset(view,detail),camera=new OrthographicCamera(-2,2,1,-1,.1,100);
  camera.zoom=2;camera.position.set(0,0,3);camera.lookAt(0,0,0);camera.updateMatrixWorld();camera.setViewOffset(view.width,view.height,offset.x,offset.y,view.width,view.height);
  const point=new Vector3().project(camera);expect((1-point.y)*view.height/2+view.top).toBeLessThan(detail.top-8);expect(camera.zoom).toBe(2);expect(offset.x).toBe(0);
 });
 it('does not reserve space for closed details or details outside this comparison viewport',()=>{
  const view={left:0,top:64,width:680,height:668};expect(detailViewOffset(view,null)).toEqual({x:0,y:0});expect(detailViewOffset(view,{left:900,top:70,right:1350,bottom:720})).toEqual({x:0,y:0});
 });
});

function flightViewer(){
 const viewer=Object.create(GaiaViewer.prototype) as any;
 Object.assign(viewer,{projectionId:'globe',context:{radius:6371008.8,mercatorLimit:85,centerLon:0,centerLat:0},perspective:new PerspectiveCamera(),globeControls:{enabled:true,update:vi.fn()},mapControls:{enabled:false,target:new Vector3()},captureExplorer:false,reducedMotion:false,morph:null,flight:null,queuedLocation:null,updateDetailFrame:vi.fn(),setAutoRotate:vi.fn(),focusLocation:vi.fn()});
 viewer.perspective.position.set(0,0,3);return viewer;
}
describe('one existing flight owner',()=>{
 it('latest user selection replaces the flight and queued projection destination',()=>{
  const viewer=flightViewer();viewer.flyToLocation(10,20);viewer.flyToLocation(30,40);expect(viewer.flight).toMatchObject({lon:30,lat:40});
  viewer.morph={};viewer.flyToLocation(50,20);viewer.flyToLocation(60,30);expect(viewer.queuedLocation).toEqual({lon:60,lat:30});
 });
 it('manual cancellation clears a flight and queued destination without a later restart',()=>{
  const viewer=flightViewer();viewer.flyToLocation(10,20);viewer.queuedLocation={lon:30,lat:40};viewer.cancelMotion();expect(viewer.flight).toBeNull();expect(viewer.queuedLocation).toBeNull();expect(viewer.globeControls.enabled).toBe(true);
 });
 it('reduced motion focuses immediately through the original focus operation',()=>{
  const viewer=flightViewer();viewer.reducedMotion=true;viewer.flyToLocation(10,20);expect(viewer.focusLocation).toHaveBeenCalledWith(10,20);expect(viewer.flight).toBeNull();
 });
});
