// SPDX-License-Identifier: GPL-3.0-only
/** Integer PC indexed-color blend profile. Fractional modes and PC16 blending
 * remain unsupported. See the independently derived equations in the format
 * reference; these operations run before Canvas receives the final RGBA. */
export function blendChannel(back:number,front:number,mode:number):number{
 if(mode===1)return Math.min(255,back+front);
 if(mode===2)return Math.max(0,back-front);
 throw Error('Unverified PC blend mode');
}
/** Section-relative byte span, not an absolute LGP address. */
export function sourceSpan(offset:unknown,length:unknown,total:unknown=8_000_000):boolean{
 return typeof offset==='number'&&typeof length==='number'&&typeof total==='number'&&Number.isSafeInteger(offset)&&Number.isSafeInteger(length)&&Number.isSafeInteger(total)&&total>=0&&total<=8_000_000&&offset>=0&&offset<=total&&length>=0&&length<=total-offset;
}
