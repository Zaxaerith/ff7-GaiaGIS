// SPDX-License-Identifier: GPL-3.0-only
/** Scoped, idempotent cleanup. Owners register resources; borrowers never dispose. */
export class ResourceScope {
 private cleanup:(()=>void)[]=[];private ended=false;
 own(cleanup:()=>void){if(this.ended){cleanup();return;}this.cleanup.push(cleanup);}
 listen(target:EventTarget,event:string,listener:EventListener,options?:AddEventListenerOptions){target.addEventListener(event,listener,options);this.own(()=>target.removeEventListener(event,listener,options));}
 dispose(){if(this.ended)return;this.ended=true;for(const cleanup of this.cleanup.splice(0).reverse())cleanup();}
 get disposed(){return this.ended;}
}
