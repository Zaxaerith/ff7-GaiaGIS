// SPDX-License-Identifier: GPL-3.0-only
import {Camera,Vector3} from 'three';
import {projections} from '../projections';
import {wrapLongitude} from '../projections/Projection';
import type {ProjectionId,ProjectionContext} from '../projections/Projection';
import {t,formatNumber} from '../i18n';
import {rotatesCenter} from '../projections/registry';

export function geographicViewCenter(x:number,y:number,z:number) {
  const length=Math.hypot(x,y,z);
  if(!length)throw new Error('View direction must have nonzero length');
  return {lon:Math.hypot(x,z)/length<1e-8?null:wrapLongitude(Math.atan2(x,z)*180/Math.PI),
    lat:Math.asin(Math.max(-1,Math.min(1,y/length)))*180/Math.PI};
}
export const latitudeLabel=(lat:number,digits=0)=>Number(Math.abs(lat).toFixed(digits))===0?t('nav.equator'):`${formatNumber(Math.abs(lat),digits)}°${lat>0?'N':'S'}`;
export const longitudeLabel=(lon:number,digits=0)=>Number(Math.abs(lon).toFixed(digits))===0?t('nav.meridian'):`${formatNumber(Math.abs(lon),digits)}°${lon>0?'E':'W'}`;

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
  update(time:number,id:ProjectionId,context:ProjectionContext,camera:Camera,morphing:boolean,grid:boolean,interval=30,viewCenter?:[number,number,number]) {
    if(time-this.last<100)return;
    this.last=time;
    const width=this.container.clientWidth,height=this.container.clientHeight;
    const center=viewCenter?{lon:viewCenter[0],lat:viewCenter[1]}:id==='globe'?geographicViewCenter(camera.position.x,camera.position.y,camera.position.z):{lon:context.centerLon,lat:context.centerLat};
    const readout=this.container.querySelector<HTMLElement>('#view-center')!;
    readout.textContent=morphing?t('ui.morphing'):id==='globe'||rotatesCenter(id)
      ?t('nav.center',{latitude:latitudeLabel(center.lat,1),longitude:center.lon===null?t('nav.pole'):longitudeLabel(center.lon,1)}):t('nav.cardinal');
    const compass=this.container.querySelector<HTMLButtonElement>('#north-up')!;
    compass.disabled=morphing;
    compass.title=id==='globe'||rotatesCenter(id)?t('ui.northUp'):t('nav.fixedNorth');
    const north=this.point.set(0,1,0).transformDirection(camera.matrixWorldInverse);
    this.container.querySelector<HTMLElement>('#compass-needle')!.style.transform=`rotate(${Math.atan2(north.x,north.y)*180/Math.PI}deg)`;
    for(const label of this.labels)label.hidden=true;
    if(!grid||morphing)return;
    const anchor=wrapLongitude(Math.round((center.lon??0)/interval)*interval),digits=interval<.5?2:interval<1?1:0,latitudeAnchor=Math.round(center.lat/interval)*interval;
    const candidates:[number,number,string][]=[0,1,-1,2,-2].map(n=>latitudeAnchor+n*interval).filter(lat=>Math.abs(lat)<90).map(lat=>[anchor,lat,latitudeLabel(lat,digits)]);
    for(let n=-3;n<=3;n++){const lon=wrapLongitude(anchor+n*interval);if(n!==0)candidates.push([lon,latitudeAnchor,longitudeLabel(lon,digits)]);}
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
      label.textContent=text;label.classList.toggle('equator-label',text===latitudeLabel(0));
      label.style.left=`${x}px`;label.style.top=`${y}px`;label.hidden=false;
      occupied.push({x,y,width:labelWidth});
    }
  }
}
