// SPDX-License-Identifier: GPL-3.0-only
export function legendRow(parent:HTMLElement,color:string,label:string){const row=document.createElement('div'),swatch=document.createElement('i'),text=document.createElement('span');row.className='legend-row';swatch.style.background=color;text.textContent=label;row.append(swatch,text);parent.append(row);return row;}
