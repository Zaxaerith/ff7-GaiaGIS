// SPDX-License-Identifier: GPL-3.0-only
import {analyzeFieldConditionalSnapshot} from './fieldConditionalEvidence';
import type {ConditionalWorkerRequest,ConditionalWorkerResponse} from './fieldConditionalSession';
// This entry receives only the explicitly projected current-scene metadata. A cancelled job is
// terminated by its session owner; no global Gameplay, dialogue text or cache is retained here.
const scope=globalThis as unknown as {onmessage:((event:MessageEvent<ConditionalWorkerRequest>)=>void)|null;postMessage:(message:ConditionalWorkerResponse)=>void};
scope.onmessage=event=>{const request=event.data;if(request?.type!=='analyze')return;const result=analyzeFieldConditionalSnapshot(request.input);scope.postMessage({type:'result',job:request.job,identityKey:request.identityKey,result});};
