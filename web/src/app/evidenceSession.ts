// SPDX-License-Identifier: GPL-3.0-only

export interface EvidenceTicket {
 readonly generation:number;
 current():boolean;
}

let browsing=false;
export function browsingEvidence(){return browsing;}
export function beginEvidenceNavigation(){browsing=true;}
export function beginPublicNavigation(){browsing=false;}

export function evidenceStoryVisible(mode:string){return mode==='show-all';}
export function mayShowPrivateEvidence(){
 return !browsingEvidence()||evidenceStoryVisible((document.getElementById('atlas-spoilers') as HTMLSelectElement|null)?.value??'hide-major');
}
