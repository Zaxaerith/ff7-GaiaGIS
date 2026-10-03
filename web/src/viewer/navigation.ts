// SPDX-License-Identifier: GPL-3.0-only
import {Camera,Vector3} from 'three';
import {projections} from '../projections';
import {wrapLongitude} from '../projections/Projection';
import type {ProjectionId,ProjectionContext} from '../projections/Projection';

export function geographicViewCenter(x:number,y:number,z:number) {
  const length=Math.hypot(x,y,z);
  if(!length)throw new Error('View direction must have nonzero length');
  return {lon:Math.hypot(x,z)/length<1e-8?null:wrapLongitude(Math.atan2(x,z)*180/Math.PI),
    lat:Math.asin(Math.max(-1,Math.min(1,y/length)))*180/Math.PI};
}
export const latitudeLabel=(lat:number,digits=0)=>Number(Math.abs(lat).toFixed(digits))===0?'赤道 0°':`${Math.abs(lat).toFixed(digits)}°${lat>0?'N':'S'}`;
export const longitudeLabel=(lon:number,digits=0)=>Number(Math.abs(lon).toFixed(digits))===0?'0° 经线':`${Math.abs(lon).toFixed(digits)}°${lon>0?'E':'W'}`;

// Only a few labels are placed on the visible side, with screen-space collision
// checks. Coordinates use Stage 1 reconstruction axes, not a new Gaia north.
export class NavigationOverlay {
  private labels:HTMLElement[]=[];
  private point=new Vector3();
  private last=-Infinity;
  constructor(private container:HTMLElement) {
    const host=container.querySelector('#graticule-labels')!;
    for(let i=0;i<11;i++){const label=document.createElement('span');label.className='coordinate-label';label.hidden=true;host.append(label);this.labels.push(label);}
  }
  update(time:number,id:ProjectionId,context:ProjectionContext,camera:Camera,morphing:boolean,grid:boolean) {
    if(time-this.last<100)return;
    this.last=time;
    const width=this.container.clientWidth,height=this.container.clientHeight;
    const center=id==='globe'?geographicViewCenter(camera.position.x,camera.position.y,camera.position.z):{lon:context.centerLon,lat:context.centerLat};
    const readout=this.container.querySelector<HTMLElement>('#view-center')!;
    readout.textContent=morphing?'视图切换中…':id==='globe'||id==='orthographic'
      ?`视图中心 · ${latitudeLabel(center.lat,1)} · ${center.lon===null?'极点经度不定':longitudeLabel(center.lon,1)}`:'北 ↑ · 西 ← 东 →';
    const compass=this.container.querySelector<HTMLButtonElement>('#north-up')!;
    compass.disabled=morphing;
    compass.title=id==='globe'||id==='orthographic'?'北向上 · 保留当前经度与缩放':'该地图投影已固定北向上';
    const north=this.point.set(0,1,0).transformDirection(camera.matrixWorldInverse);
    this.container.querySelector<HTMLElement>('#compass-needle')!.style.transform=`rotate(${Math.atan2(north.x,north.y)*180/Math.PI}deg)`;
    for(const label of this.labels)label.hidden=true;
    if(!grid||morphing)return;
    const anchor=wrapLongitude(Math.round((center.lon??0)/30)*30);
    const candidates:[number,number,string][]=[0,30,-30,60,-60].map(lat=>[anchor,lat,latitudeLabel(lat)]);
    for(let lon=-180;lon<180;lon+=60)if(Math.abs(wrapLongitude(lon-anchor))>15)candidates.push([lon,0,longitudeLabel(lon)]);
    const occupied:{x:number;y:number;width:number}[]=[];
    for(const [lon,lat,text]of candidates){
      if(projections[id].visibility(lon,lat,context)<0.12)continue;
      this.point.fromArray(projections[id].project(lon,lat,10000,context));
      if(id==='globe'&&this.point.dot(camera.position)-this.point.lengthSq()<0.07)continue;
      if(id!=='globe')this.point.z=0.0005;
      this.point.project(camera);
      if(this.point.z< -1||this.point.z>1)continue;
      const x=(this.point.x+1)*width/2,y=(1-this.point.y)*height/2,labelWidth=text.length*7+18;
      // Keep the caption, navigation buttons and edge margins unobstructed.
      if(x<labelWidth/2+12||x>width-labelWidth/2-12||y<135||y>height-82)continue;
      if(occupied.some(p=>Math.abs(x-p.x)<(p.width+labelWidth)/2+8&&Math.abs(y-p.y)<26))continue;
      const label=this.labels[occupied.length];if(!label)break;
      label.textContent=text;label.classList.toggle('equator-label',lat===0&&text.startsWith('赤道'));
      label.style.left=`${x}px`;label.style.top=`${y}px`;label.hidden=false;
      occupied.push({x,y,width:labelWidth});
    }
  }
}
