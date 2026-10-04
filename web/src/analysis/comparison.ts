// SPDX-License-Identifier: GPL-3.0-only
export const comparisonPalette=['#3d5363','#68cbb9','#f2a978','#bda6f4'] as const;
export function classifyComparison(a:ArrayLike<number>,b:ArrayLike<number>){if(a.length!==b.length)throw new Error('Comparison scopes differ');const flags=new Uint8Array(a.length),counts=[0,0,0,0];for(let i=0;i<a.length;i++){const value=(a[i]?1:0)|(b[i]?2:0);flags[i]=value;counts[value]++;}return {flags,counts};}
