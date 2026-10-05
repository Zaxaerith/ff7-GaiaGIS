// SPDX-License-Identifier: GPL-3.0-only
/** One edit only, for short misspellings; never a spatial identity resolver. */
export function nearName(query:string,value:string){
 if(query.length<4||Math.abs(query.length-value.length)>1)return false;
 let i=0,j=0,edits=0;
 while(i<query.length&&j<value.length){if(query[i]===value[j]){i++;j++;continue;}if(++edits>1)return false;if(query.length>=value.length)i++;if(value.length>=query.length)j++;}
 return edits+(i<query.length||j<value.length?1:0)<=1;
}
