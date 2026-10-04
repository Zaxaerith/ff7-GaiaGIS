// SPDX-License-Identifier: GPL-3.0-only
import {BufferAttribute,BufferGeometry,LineBasicMaterial,LineSegments} from 'three';
import {projectGraticule} from './graticule';
import {projections} from '../projections';
import {tissotFrame} from '../analysis/distortion';
import {addVisibilityMask} from './visibility';
import type {ProjectionId,ProjectionContext} from '../projections/Projection';
type Frame={positions:Float32Array;mask:Float32Array};
export class CartographicLine {
 relief=1;
 private elevated(id:ProjectionId){if(id!=='globe'||this.relief===1)return this.geo;const geo=this.geo.slice();for(let i=2;i<geo.length;i+=3)geo[i]=(geo[i]-1500)*this.relief+1500;return geo;}
 readonly line:LineSegments<BufferGeometry,LineBasicMaterial>;geo:Float32Array=new Float32Array();private key='';private cached?:Frame;private from?:Frame;private to?:Frame;generationMs=0;
 constructor(color:string,private indicatrix=false){const material=new LineBasicMaterial({color,transparent:true,opacity:.86,depthWrite:false,depthTest:false});addVisibilityMask(material);this.line=new LineSegments(new BufferGeometry(),material);this.line.frustumCulled=false;this.line.renderOrder=10;this.line.visible=false;}
 set(geo:Float32Array){this.geo=geo;this.key='';this.cached=undefined;this.from=this.to=undefined;this.line.geometry.dispose();this.line.geometry=new BufferGeometry();this.line.visible=geo.length>0;}
 private project(id:ProjectionId,c:ProjectionContext){const begin=performance.now(),f=this.indicatrix?tissotFrame(id,c):projectGraticule(this.elevated(id),projections[id],c);this.generationMs=performance.now()-begin;return f;}
 begin(from:ProjectionId,to:ProjectionId,c:ProjectionContext){if(!this.line.visible)return;const position=this.line.geometry.getAttribute('position'),mask=this.line.geometry.getAttribute('gaiaMask');this.from=position?{positions:new Float32Array(position.array),mask:new Float32Array(mask.array)}:this.project(from,c);this.to=this.project(to,c);}
 update(id:ProjectionId,c:ProjectionContext,ease?:number,camera?:{x:number;y:number;z:number}){if(!this.line.visible)return;const key=`${id}:${c.centerLon.toFixed(5)}:${c.centerLat.toFixed(5)}`;if(this.key!==key||!this.cached){this.cached=this.project(id,c);this.key=key;}const f=this.cached,g=this.line.geometry;if(g.getAttribute('position')?.array.length!==f.positions.length){g.setAttribute('position',new BufferAttribute(new Float32Array(f.positions.length),3));g.setAttribute('gaiaMask',new BufferAttribute(new Float32Array(f.mask.length),1));}const p=g.getAttribute('position'),m=g.getAttribute('gaiaMask');for(let i=0;i<f.positions.length;i++)p.array[i]=ease!==undefined&&this.from&&this.to&&this.from.positions.length===f.positions.length?this.from.positions[i]+(this.to.positions[i]-this.from.positions[i])*ease:f.positions[i];for(let i=0;i<f.mask.length;i++)m.array[i]=ease!==undefined&&this.from&&this.to&&this.from.mask.length===f.mask.length?this.from.mask[i]+(this.to.mask[i]-this.from.mask[i])*ease:f.mask[i];if(id==='globe'&&ease===undefined&&camera)for(let i=0;i<m.count;i++){const x=p.array[i*3],y=p.array[i*3+1],z=p.array[i*3+2];if(x*camera.x+y*camera.y+z*camera.z-(x*x+y*y+z*z)<=0)m.array[i]=-1;}p.needsUpdate=m.needsUpdate=true;}
 dispose(){this.line.geometry.dispose();this.line.material.dispose();}
}
