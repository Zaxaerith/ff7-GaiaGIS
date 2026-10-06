// SPDX-License-Identifier: GPL-3.0-only
import type {TourStop} from '../app/userState';
export type PlaybackPhase='idle'|'playing'|'paused'|'finished';
export class TourPlayback {
 phase:PlaybackPhase='idle';index=-1;elapsed=0;private captured=false;
 constructor(readonly stops:TourStop[],private visit:(stop:TourStop,reduced:boolean)=>boolean,private capture:()=>void,private restore:()=>void,readonly reducedMotion=false){}
 play(){if(!this.stops.length)return false;if(this.phase==='paused'){this.phase='playing';return true;}if(this.phase==='playing')return true;if(!this.captured){this.capture();this.captured=true;}this.phase='playing';this.index=-1;this.elapsed=0;return this.next();}
 pause(){if(this.phase==='playing')this.phase='paused';}
 next(){if(!this.captured)return false;this.elapsed=0;for(let i=this.index+1;i<this.stops.length;i++){this.index=i;if(this.visit(this.stops[i],this.reducedMotion))return true;}this.phase='finished';this.restoreOnce();return false;}
 previous(){if(!this.captured)return false;this.elapsed=0;for(let i=this.index-1;i>=0;i--){this.index=i;if(this.visit(this.stops[i],this.reducedMotion))return true;}return false;}
 tick(seconds:number){if(this.phase!=='playing'||this.index<0||!Number.isFinite(seconds)||seconds<0)return;this.elapsed+=Math.min(seconds,1);if(this.elapsed>=this.stops[this.index].duration)this.next();}
 stop(){this.phase='idle';this.index=-1;this.elapsed=0;this.restoreOnce();}
 private restoreOnce(){if(this.captured){this.captured=false;this.restore();}}
}
export class RoutePlayback {
 phase:PlaybackPhase='idle';progress=0;speed=1;follow=false;private count=0;
 setRoute(points:number){this.stop();this.count=Math.max(0,Math.floor(points));}
 play(){if(this.count<2)return false;if(this.phase==='finished')this.progress=0;this.phase='playing';return true;}
 pause(){if(this.phase==='playing')this.phase='paused';}
 restart(){this.progress=0;this.phase=this.count>=2?'playing':'idle';}
 stop(){this.phase='idle';this.progress=0;}
 tick(seconds:number){if(this.phase!=='playing'||!Number.isFinite(seconds)||seconds<0)return this.progress;this.progress=Math.min(1,this.progress+Math.min(seconds,1)*this.speed/Math.max(8,this.count*.025));if(this.progress===1)this.phase='finished';return this.progress;}
 get available(){return this.count>=2;}
}
