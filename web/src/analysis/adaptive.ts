// SPDX-License-Identifier: GPL-3.0-only
export const GRID_CANDIDATES=[90,60,45,30,20,15,10,5,2,1,.5,.25,.1] as const;
export const GRID_FIXED=[90,45,30,15,10,5,2,1,.5] as const;
export type GridMode='auto'|'off'|number;
export const GRID_TARGET=120,GRID_KEEP_MIN=60,GRID_KEEP_MAX=190;
export function chooseInterval(spacing:(degrees:number)=>number,current=30){const px=spacing(current);if(Number.isFinite(px)&&px>=GRID_KEEP_MIN&&px<=GRID_KEEP_MAX)return current;let chosen:number=30,score=Infinity;for(const step of GRID_CANDIDATES){const p=spacing(step),cost=p>0&&Number.isFinite(p)?Math.abs(Math.log(p/GRID_TARGET)):Infinity;if(cost<score){chosen=step;score=cost;}}return chosen;}
export function minorInterval(major:number,spacing:(degrees:number)=>number){return [...GRID_CANDIDATES].find(s=>s<major&&major/s>=3&&Math.abs(major/s-Math.round(major/s))<1e-8&&spacing(s)>=28&&spacing(s)<=60)??null;}
export interface GridBounds {west:number;east:number;south:number;north:number;}
export function visibleGridBounds(lon:number,lat:number,pxPerDegree:number,width:number,height:number,step:number):GridBounds{const spanX=Math.min(180,width/Math.max(.1,pxPerDegree)*.8+step),spanY=Math.min(90,height/Math.max(.1,pxPerDegree)*.8+step);const snap=(v:number,up=false)=>(up?Math.ceil(v/step):Math.floor(v/step))*step;return {west:spanX===180?-180:snap(lon-spanX),east:spanX===180?180:snap(lon+spanX,true),south:Math.max(-90,snap(lat-spanY)),north:Math.min(90,snap(lat+spanY,true))};}
export function adaptiveGrid(major:number,bounds:GridBounds,minor:number|null=null){if(!(major>0)||major>90||major<.1)throw new Error('Unsupported graticule interval');const step=minor??major,geo:number[]=[],kind:number[]=[],isMajor=(v:number)=>Math.abs(v/major-Math.round(v/major))<1e-6;
 const estimated=(bounds.east-bounds.west+bounds.north-bounds.south)/step*180,sample=Math.max(1,estimated/70000);const add=(a:number,b:number,c:number,d:number,level:number)=>{const shift=360*Math.floor(((a+c)/2+180)/360);geo.push(a-shift,b,10000,c-shift,d,10000);kind.push(level,level);};
 for(let y=Math.ceil(bounds.south/step)*step;y<=bounds.north+1e-8;y+=step){if(Math.abs(y)>89.999)continue;const level=Math.abs(y)<1e-7?2:isMajor(y)?0:1;for(let x=bounds.west;x<bounds.east;x+=sample){const end=Math.min(bounds.east,x+sample),seam=180+360*Math.floor((x+180)/360);if(end>seam&&x<seam){add(x,y,seam,y,level);add(seam,y,end,y,level);}else add(x,y,end,y,level);}}
 for(let x=Math.ceil(bounds.west/step)*step;x<bounds.east-1e-8;x+=step){const wrapped=((x+180)%360+360)%360-180,level=Math.abs(wrapped)<1e-7?3:isMajor(x)?0:1;for(let y=bounds.south;y<bounds.north;y+=sample)add(x,y,x,Math.min(bounds.north,y+sample),level);}
 return {geo:new Float32Array(geo),kind:new Uint8Array(kind),major,minor};
}
