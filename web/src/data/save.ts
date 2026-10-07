// SPDX-License-Identifier: GPL-3.0-only
// Read-only PC savemap reader. Offset evidence and revision links: docs/v2.7/save-format.md.
import {sourceGeographic,WM0_EXTENT} from '../explorer/coordinates';
export const PC_SAVE_SIZE=65109,PC_SLOT_SIZE=4340,PC_SLOTS=15;
export const SAVE_CHARACTERS=['cloud','barret','tifa','aerith','red-xiii','yuffie','cait-sith','vincent','cid'] as const;
export type SaveStatus='valid'|'empty'|'checksum'|'invalid';
export interface SaveParty {id:number;character:string|null;level:number|null;hp:number;maxHp:number;mp:number;maxMp:number;}
export interface SaveWorld {x:number;z:number;height:number;model:number;heading:number;record:number;}
export interface SaveBinding {mapId:'WM0';coordinateSpace:'GaiaGame';game_east:number;game_north:number;geographic:[number,number,number];raw:SaveWorld;}
export interface SaveSlot {index:number;status:SaveStatus;storedChecksum:number;computedChecksum:number;party:SaveParty[];module:number;location:number;locationPreview:string|null;gil:number;seconds:number;progress:number;disc:number|null;worldMap:number;currentModel:number;world:SaveWorld[];binding:SaveBinding|null;vehiclesVisible:number;chocobosVisible:number;}
export interface SaveFile {format:'FF7-PC';slots:SaveSlot[];}
export class SaveError extends Error {constructor(readonly code:'size'|'format'){super(code);}}
export function saveChecksum(slot:Uint8Array){if(slot.length!==PC_SLOT_SIZE)throw new SaveError('size');let crc=0xffff;for(let i=4;i<slot.length;i++){crc^=slot[i]<<8;for(let bit=0;bit<8;bit++)crc=((crc<<1)^((crc&0x8000)?0x1021:0))&0xffff;}return crc^0xffff;}
// Only the well-attested Western single-byte printable range. Other glyphs are unknown,
// not silently decoded as UTF-8, Shift-JIS or guessed character names.
export function saveText(bytes:Uint8Array){const end=bytes.indexOf(255);if(end<0)return null;const text=bytes.subarray(0,end);return text.every(b=>b<=0x5e)?Array.from(text,b=>String.fromCharCode(b+0x20)).join(''):null;}
export function bindSaveWorld(slot:Pick<SaveSlot,'status'|'module'|'worldMap'|'currentModel'|'world'>):SaveBinding|null{
 if(slot.status!=='valid'||slot.module!==3||slot.worldMap!==0)return null;
 // Six records contain objects, not six simultaneous player positions. Current model
 // must uniquely match; otherwise refuse to turn a stale parked object into the player.
 const record=({0:0,1:0,2:0,3:3,4:1,5:2,6:3,10:5,11:5,13:4,19:2,29:5} as Record<number,number>)[slot.currentModel];
 const raw=slot.world[record];if(!raw||raw.model!==slot.currentModel)return null;
 if(raw.x<0||raw.x>=WM0_EXTENT[0]||raw.z<0||raw.z>=WM0_EXTENT[1])return null;
 return {mapId:'WM0',coordinateSpace:'GaiaGame',game_east:raw.x,game_north:WM0_EXTENT[1]-raw.z,geographic:sourceGeographic(raw.x,raw.z,0),raw};
}
export function parsePCSave(buffer:ArrayBuffer):SaveFile{
 if(buffer.byteLength!==PC_SAVE_SIZE)throw new SaveError('size');const bytes=new Uint8Array(buffer);
 if(![0x71,0x73,0x27,0x06].every((v,i)=>bytes[i]===v))throw new SaveError('format');
 const slots:SaveSlot[]=[];
 for(let index=0;index<PC_SLOTS;index++){
  const b=bytes.subarray(9+index*PC_SLOT_SIZE,9+(index+1)*PC_SLOT_SIZE),v=new DataView(b.buffer,b.byteOffset,b.byteLength),u16=(o:number)=>v.getUint16(o,true),u32=(o:number)=>v.getUint32(o,true);
  const storedChecksum=u16(0),computedChecksum=saveChecksum(b),empty=b.every(x=>x===0)||b.subarray(4).every(x=>x===0)&&(storedChecksum===0x4d1d)&&u16(2)===0;
  let status:SaveStatus=empty?'empty':storedChecksum!==computedChecksum?'checksum':u16(2)!==0?'invalid':'valid';
  const party:SaveParty[]=Array.from(b.subarray(0x4f8,0x4fb)).filter(id=>id!==255).map(id=>{const o=0x54+id*132,known=id<9;return {id,character:known?SAVE_CHARACTERS[id]:null,level:known&&b[o+1]>=1&&b[o+1]<=99?b[o+1]:null,hp:known?u16(o+0x2c):0,maxHp:known?u16(o+0x38):0,mp:known?u16(o+0x30):0,maxMp:known?u16(o+0x3a):0};});
  if(status==='valid'&&(![1,3].includes(u16(0xb94))||party.some(p=>p.character===null||p.level===null||p.hp>9999||p.maxHp>9999||p.mp>999||p.maxMp>999)||u32(0xb7c)>999999999))status='invalid';
  const world:SaveWorld[]=Array.from({length:6},(_,record)=>{const a=u32(0xf5c+record*8),c=u32(0xf60+record*8);return {x:a&0x7ffff,z:c&0x3ffff,height:c>>>18,model:(a>>>19)&31,heading:a>>>24,record};});
  const slot:SaveSlot={index:index+1,status,storedChecksum,computedChecksum,party,module:u16(0xb94),location:u16(0xb96),locationPreview:saveText(b.subarray(0x28,0x48)),gil:u32(0xb7c),seconds:u32(0xb80),progress:u16(0xba4),disc:[1,2,3].includes(b[0xea4])?b[0xea4]:null,worldMap:b[0xfa2],currentModel:b[0xfa1],world,binding:null,vehiclesVisible:b[0xc23],chocobosVisible:b[0xc22]};
  slot.binding=bindSaveWorld(slot);slots.push(slot);
 }
 return {format:'FF7-PC',slots};
}
