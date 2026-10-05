// SPDX-License-Identifier: GPL-3.0-only
import {Camera,Vector3} from 'three';
import {projections} from '../projections';
import type {ProjectionContext,ProjectionId,Position} from '../projections/Projection';
import type {Location,LocationFilter} from '../data/poi';
import {filterLocation} from '../data/poi';

export function markerPosition(l:Pick<Location,'longitude'|'latitude'|'height'>,id:ProjectionId,c:ProjectionContext):Position {
  return projections[id].project(l.longitude,l.latitude,l.height+1000,c);
}
export function markerVisible(l:Pick<Location,'longitude'|'latitude'>,id:ProjectionId,c:ProjectionContext){return projections[id].visibility(l.longitude,l.latitude,c)>0.02;}
interface Marker {location:Location;button:HTMLButtonElement;point:Vector3;from:Position;to:Position;current:Position;}
export class LocationsOverlay {
  relief=1;
  private host=document.createElement('div');private markers:Marker[]=[];
  private show=true;private labels=true;private filter:LocationFilter='all';private selected:string|null=null;
  private analysisStart:string|null=null;private analysisTarget:string|null=null;private reachable:Set<string>|null=null;
  private selectedPosition:Pick<Location,'longitude'|'latitude'|'height'>|null=null;
  constructor(private container:HTMLElement,private onSelect:(location:Location)=>void,private kind:'location'|'event'|'atlas'='location'){
    this.host.className=`location-markers ${kind}-overlay`;container.append(this.host);
    this.host.addEventListener('pointermove',e=>{const nearest=this.nearest(e.clientX,e.clientY);for(const m of this.markers)m.button.classList.toggle('hovered',m===nearest);});
    this.host.addEventListener('pointerleave',()=>{for(const m of this.markers)m.button.classList.remove('hovered');});
  }
  private nearest(x:number,y:number){
    const rect=this.container.getBoundingClientRect();let closest:Marker|undefined,distance=Infinity;
    for(const m of this.markers){if(m.button.hidden)continue;const d=Math.hypot(x-rect.left-parseFloat(m.button.style.left),y-rect.top-parseFloat(m.button.style.top));if(d<distance){distance=d;closest=m;}}
    return distance<=32?closest:undefined;
  }
  setLocations(locations:Location[]){
    this.host.replaceChildren();this.markers=locations.map(location=>{
      const button=document.createElement('button');button.className=`location-marker ${this.kind}-marker`;button.dataset[this.kind]=location.id;button.setAttribute('aria-label',location.display_name);button.title=location.display_name;
      const dot=document.createElement('i'),label=document.createElement('span');dot.setAttribute('aria-hidden','true');label.textContent=location.display_name;button.append(dot,label);button.hidden=true;
      if(this.kind==='event')button.dataset.eventType=(location as Location&{eventType?:string}).eventType;
      // Overlapping touch targets still select the closest visible dot. Keyboard
      // activation uses its own named button rather than pointer coordinates.
      button.addEventListener('click',e=>{e.stopPropagation();this.onSelect(e.detail?this.nearest(e.clientX,e.clientY)?.location??location:location);});this.host.append(button);
      return {location,button,point:new Vector3(),from:[0,0,0] as Position,to:[0,0,0] as Position,current:[0,0,0] as Position};
    });
  }
  setDisplay(show:boolean,labels:boolean,filter:LocationFilter){this.show=show;this.labels=labels;this.filter=filter;}
  setAnalysis(start:string|null,target:string|null,reachable:Set<string>|null){this.analysisStart=start;this.analysisTarget=target;this.reachable=reachable;}
  select(id:string|null,position?:Pick<Location,'longitude'|'latitude'|'height'>){this.selected=id;this.selectedPosition=position??null;}
  private target(m:Marker){return m.location.id===this.selected&&this.selectedPosition?{...m.location,...this.selectedPosition}:m.location;}
  beginMorph(fromId:ProjectionId,toId:ProjectionId,c:ProjectionContext,interrupted=false){for(const m of this.markers){m.from=interrupted?m.current:markerPosition({...this.target(m),height:fromId==='globe'?this.target(m).height*this.relief:this.target(m).height},fromId,c);m.to=markerPosition({...this.target(m),height:toId==='globe'?this.target(m).height*this.relief:this.target(m).height},toId,c);}}
  update(id:ProjectionId,c:ProjectionContext,camera:Camera,morph?:{ease:number;fromId:ProjectionId}){
    const w=this.container.clientWidth,h=this.container.clientHeight,occupied:{x:number;y:number;width:number}[]=[];
    // Selected label wins, followed by major settlements and then remaining names.
    const ordered=[...this.markers].sort((a,b)=>Number(b.location.id===this.selected)-Number(a.location.id===this.selected)||Number(['city','town','village'].includes(b.location.category))-Number(['city','town','village'].includes(a.location.category)));
    for(const m of ordered){
      const selected=m.location.id===this.selected;m.button.classList.toggle('selected',selected);m.button.classList.toggle('analysis-start',m.location.id===this.analysisStart);m.button.classList.toggle('analysis-target',m.location.id===this.analysisTarget);m.button.classList.toggle('analysis-unreachable',!!this.reachable&&!this.reachable.has(m.location.id));
      if(!this.show||!filterLocation(m.location,this.filter)){m.button.hidden=true;continue;}
      const location=this.target(m),p=markerPosition({...location,height:id==='globe'?location.height*this.relief:location.height},id,c);
      if(morph)m.point.set(...m.from).lerp(new Vector3(...m.to),morph.ease);else m.point.set(...p);
      m.current=m.point.toArray() as Position;
      const visibility=morph?(1-morph.ease)*projections[morph.fromId].visibility(location.longitude,location.latitude,c)+morph.ease*projections[id].visibility(location.longitude,location.latitude,c):projections[id].visibility(location.longitude,location.latitude,c);
      const globeSide=morph?(morph.fromId==='globe'&&morph.ease<.45||id==='globe'&&morph.ease>.55):id==='globe';
      if(visibility<=.02||globeSide&&m.point.dot(camera.position)-m.point.lengthSq()<.005){m.button.hidden=true;continue;}
      m.point.project(camera);const x=(m.point.x+1)*w/2,y=(1-m.point.y)*h/2;
      if(m.point.z< -1||m.point.z>1||x<12||x>w-12||y<12||y>h-12){m.button.hidden=true;continue;}
      if(this.kind==='atlas'&&occupied.some(o=>Math.hypot(x-o.x,y-o.y)<32)){m.button.hidden=true;continue;}
      m.button.hidden=false;m.button.style.left=`${x}px`;m.button.style.top=`${y}px`;
      const labelWidth=m.location.display_name.length*6.5+14;
      const major=['city','town','village','settlement'].includes(m.location.category);
      const fits=x+labelWidth<w-14&&y>112&&y<h-75&&!occupied.some(o=>Math.abs(y-o.y)<25&&Math.abs(x-o.x)<(labelWidth+o.width)/2+12);
      const visible=selected||this.labels&&major&&fits;m.button.classList.toggle('show-label',visible);
      if(visible||this.kind==='atlas')occupied.push({x,y,width:labelWidth});
    }
  }
  dispose(){this.host.remove();}
  private mirroredSource:Marker[]|null=null;
  mirrorTo(target:LocationsOverlay){if(target.mirroredSource!==this.markers){target.setLocations(this.markers.map(m=>m.location));target.mirroredSource=this.markers;}target.setDisplay(this.show,this.labels,this.filter);target.select(this.selected,this.selectedPosition??undefined);target.setAnalysis(this.analysisStart,this.analysisTarget,this.reachable);}
}
