// SPDX-License-Identifier: GPL-3.0-only
import {parsePCSave,PC_SAVE_SIZE,SaveError} from '../data/save';
import type {SaveFile,SaveSlot} from '../data/save';
/** Session memory only. Neither raw bytes nor summary enters AppState/UserState/URLs. */
export class SaveSession {
 private file:SaveFile|null=null;private selected=0;private revision=0;private listeners=new Set<()=>void>();
 get slots(){return this.file?.slots??[];} get slot():SaveSlot|null{return this.file?.slots[this.selected]??null;}
 subscribe(fn:()=>void){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 private emit(){for(const fn of this.listeners)fn();}
 async import(file:Pick<File,'size'|'arrayBuffer'>){const ticket=++this.revision;if(file.size!==PC_SAVE_SIZE)throw new SaveError('size');const next=parsePCSave(await file.arrayBuffer());if(ticket!==this.revision)return;this.file=next;this.selected=Math.max(0,next.slots.findIndex(s=>s.status==='valid'));this.emit();}
 select(index:number){if(!Number.isInteger(index)||index<0||index>=this.slots.length)return;this.selected=index;this.emit();}
 clear(){++this.revision;this.file=null;this.selected=0;this.emit();}
}
export const saveSession=new SaveSession();
