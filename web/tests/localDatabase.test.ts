// SPDX-License-Identifier: GPL-3.0-only
import {describe,expect,it,vi} from 'vitest';
import {databaseAssetsAdopted,databaseRequestPath,databaseSourceToken,databaseWorkspace,fetchLocalDatabase,parseDatabaseResponse} from '../src/app/localDatabase';
import type {DatabaseAvailable,DatabaseRequest} from '../src/app/localDatabase';
import {initialState,reduce} from '../src/app/state';
import {dictionaries,locales} from '../src/i18n';

const advertised={querySelector:()=>({getAttribute:()=> 'true'})} as unknown as Document;
const staticPage={querySelector:()=>null} as unknown as Document;
const page:DatabaseRequest={type:'events',instructionOffset:0,limit:20,offset:0};
const query={status:'complete',queryType:'events',fieldId:0,total:1,offset:0,limit:20,hasMore:false,coverage:'complete',
 rows:[{instructionOffset:0,kind:'MESSAGE',reachable:1,gameplayKind:null,gameplayStatus:null,textId:0,textStatus:'valid'}]};
const status:DatabaseAvailable={available:true,status:'available',schema:'gaiagis-fieldlocal-gpkg',version:3,fieldId:0,
 fieldName:'synthetic',coordinateSpace:'FieldLocal',readOnly:true,sourceMatched:true,tableCount:37,spatialLayerCount:7,
 requiredAssets:['field-context','field-walkmesh'],channels:{context:'available',walkmesh:'available',interaction:'unavailable',
 dialogue:'available',gameplay:'unavailable',script:'available',conditional:'limited'}};
const notConfigured={available:false,status:'not_configured',readOnly:true,sourceMatched:false};

describe('same-origin local database requests',()=>{
 it('uses a fixed relative GET, a custom header and the current cancellation signal',async()=>{
  const controller=new AbortController(),fetcher=vi.fn(async()=>Response.json(query));
  const result=await fetchLocalDatabase(page,controller.signal,fetcher,advertised);
  expect(result.trace).toMatchObject({path:'/__gaiagis_local__/db/events?instruction_offset=0&limit=20&offset=0',http:200,rows:1});
  expect(fetcher).toHaveBeenCalledWith(result.trace.path,{method:'GET',headers:{'X-GaiaGIS-DB':'1'},cache:'no-store',credentials:'same-origin',redirect:'error',signal:controller.signal});
  expect(result.result).toEqual(query);
  expect(databaseRequestPath({type:'controls',ifOffset:0,grade:'core',offset:20,limit:20})).toBe('/__gaiagis_local__/db/controls?if_offset=0&grade=core&limit=20&offset=20');
 });
 it('makes no request in unadvertised static mode',async()=>{
  const fetcher=vi.fn();
  await expect(fetchLocalDatabase(page,new AbortController().signal,fetcher,staticPage)).rejects.toThrow('not advertised');
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('returns the actual HTTP status for an error and rejects an oversized payload',async()=>{
  const result=await fetchLocalDatabase(page,new AbortController().signal,async()=>Response.json(notConfigured,{status:409}),advertised);
  expect(result.trace).toMatchObject({http:409,rows:null});
  expect(result.result).toEqual(notConfigured);
  const large=await fetchLocalDatabase(page,new AbortController().signal,async()=>new Response('x'.repeat(256*1024+1),{headers:{'Content-Type':'application/json'}}),advertised);
  expect(large.result).toBeNull();
 });
});

describe('database response and Workspace contracts',()=>{
 it('preserves ID and Text 0, and keeps null join columns distinct from zero',()=>{
  expect(parseDatabaseResponse(query,page)).toEqual(query);
  expect(parseDatabaseResponse(status,{type:'status'})).toEqual(status);
 });
 it('rejects inconsistent paging, non-optional NULLs, and mismatched identities',()=>{
  expect(()=>parseDatabaseResponse({...query,total:0},page)).toThrow();
  expect(()=>parseDatabaseResponse({...query,rows:[{...query.rows[0],instructionOffset:1}]},page)).toThrow();
  expect(()=>parseDatabaseResponse({...query,rows:[{...query.rows[0],textId:null}]},page)).toThrow();
  expect(()=>parseDatabaseResponse({...status,requiredAssets:['invalid']},{type:'status'})).toThrow();
 });
 it('requires an automatically adopted, loaded Workspace and its current assets',()=>{
  let state=reduce(initialState(),{type:'local-workspace',phase:'loaded'});
  const connection={source:'auto',manifest:'valid',loading:false} as const;
  expect(databaseWorkspace(connection,state)).toBe(true);
  expect(databaseWorkspace({...connection,source:'manual'},state)).toBe(false);
  expect(databaseAssetsAdopted(state,status)).toBe(false);
  for(const id of status.requiredAssets)state=reduce(state,{type:'asset',id,asset:{status:'loaded',bytes:10}});
  expect(databaseAssetsAdopted(state,status)).toBe(true);
  const token=databaseSourceToken(state);
  state=reduce(state,{type:'asset',id:'field-context',asset:{status:'loaded',bytes:10}});
  expect(databaseSourceToken(state)[2]).not.toBe(token[2]);
  const oldGeneration=state.data.generation;
  expect(databaseSourceToken(reduce(state,{type:'reset-data'}))[0]).toBe(oldGeneration+1);
 });
 it('provides the same panel and network status keys in all five locales',()=>{
  for(const locale of locales)for(const key of ['localdb.title','localdb.trace','localdb.database_changed','localdb.empty'])expect(dictionaries[locale][key]).toBeTruthy();
 });
});
