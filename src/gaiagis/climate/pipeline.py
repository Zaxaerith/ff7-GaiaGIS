# SPDX-License-Identifier: GPL-3.0-only
"""Reproducible V2-only search/refinement/sensitivity/export CLI."""
import argparse,copy,csv,hashlib,json,time
from pathlib import Path
import numpy as np
from .settings import ROOT,settings,evidence_settings
from .grid import Grid
from .latitude import candidates,LatitudeMapping
from .geography import load_source,rasterize_raw,remap_raw
from .climate_model import run_model
from .evidence import score_evidence
from .optimization import objective,shortlist,pareto
from .products import netcdf,raster_products,geopackage
from .gcm import prepare_gcm
from .plots import figures
OUT=ROOT/'output/climate_v2'

def provenance(config,weights):
    """Refuse stale numerical caches after code/config/source/runtime changes."""
    import scipy
    h=hashlib.sha256()
    for path in sorted(Path(__file__).parent.glob('*.py')):
        if path.name in ['pipeline.py','plots.py','products.py','gcm.py']:continue
        h.update(path.name.encode());h.update(path.read_bytes())
    sources={}
    for name in ['output/gis/gaia_geographic.gpkg','output/reconstruction/build_metadata.json']:
        digest=hashlib.sha256()
        with (ROOT/name).open('rb') as stream:
            for chunk in iter(lambda:stream.read(1048576),b''):digest.update(chunk)
        sources[name]=digest.hexdigest()
    state={'config':config,'evidence':weights,'physics_sha256':h.hexdigest(),
           'sources':sources,'numpy':np.__version__,'scipy':scipy.__version__}
    state['signature']=hashlib.sha256(json.dumps(state,sort_keys=True).encode()).hexdigest()
    return state
def write_json(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,indent=2,default=lambda x:x.item(),allow_nan=False)+'\n',encoding='utf-8')
def write_csv(path,records):
    if not records:return
    with path.open('w',newline='',encoding='utf-8') as stream:
        writer=csv.DictWriter(stream,fieldnames=list(records[0]));writer.writeheader();writer.writerows(records)
def evaluate(source,raw,mapping,grid,config,weights):
    land,height,remap=remap_raw(raw,mapping,grid,config);fields,diagnostics=run_model(grid,land,height,config)
    consistency,stats,scores=score_evidence(source,mapping,grid,fields,weights);metrics=mapping.metrics()
    record={'name':mapping.name,'climate_consistency':consistency,'objective':objective(consistency,metrics,config['search']),**metrics,**diagnostics}
    return record,fields,stats,scores,remap
def inputs(config):
    source=load_source(ROOT);cache=OUT/'raw_boundary_samples.npz'
    if cache.exists():
        with np.load(cache) as data:raw={name:data[name] for name in data.files}
    else:
        print('Rasterizing immutable V1 corners to raw boundary samples',flush=True)
        raw,diagnostic=rasterize_raw(source,config);np.savez_compressed(cache,**raw);write_json(OUT/'raw_rasterization.json',diagnostic)
    return source,raw
def search(config,weights):
    source,raw=inputs(config);mappings,proposals=candidates(source['height']/source['width'],config)
    write_json(OUT/'candidate_parameters.json',[m.document() for m in mappings]);write_json(OUT/'all_proposals.json',proposals)
    write_csv(OUT/'candidates.csv',[{'name':m.name,**{f'latitude_anchor_{i}':float(v) for i,v in enumerate(m.anchors)}} for m in mappings])
    records=[];grid=Grid(config['search']['grid_degrees'],config['planet']['radius_m'])
    signature=json.loads((OUT/'run-settings.json').read_text())['signature']
    for number,m in enumerate(mappings):
        path=OUT/'candidate_runs'/f'{m.name}.json'
        cached=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
        if cached.get('provenance_signature')==signature:record=cached['record']
        else:
            started=time.perf_counter();record,fields,stats,scores,remap=evaluate(source,raw,m,grid,config,weights)
            write_json(path,{'provenance_signature':signature,'record':record,'terrain_statistics':stats,'remap':remap,'seconds':time.perf_counter()-started})
        records.append(record);write_csv(OUT/'candidate_scores.csv',records)
        print(f'{number+1}/{len(mappings)} {m.name}: consistency={record["climate_consistency"]:.4f}, J={record["objective"]:.4f}',flush=True)
    chosen=shortlist(mappings,records,config['search']);write_json(OUT/'shortlist.json',{'candidates':[m.document() for m in chosen],'pareto_names':pareto(records),'criterion':'diverse low-objective, high-climate, low-distortion, symmetric/asymmetric trade-offs; includes geometric control'})
    return source,raw,mappings,records,chosen
def reconstruct(document):return LatitudeMapping(document['name'],document['latitude_anchors_deg'],document['aspect'],document['method']=='inverse_mercator_v1')
def refine_and_export(config,weights):
    source,raw=inputs(config);chosen=[reconstruct(d) for d in json.loads((OUT/'shortlist.json').read_text())['candidates']]
    grid=Grid(config['search']['refinement_degrees'],config['planet']['radius_m']);results=[]
    for m in chosen:
        print(f'Refining {m.name} at {180/grid.ny} degrees',flush=True)
        r,f,stats,scores,remap=evaluate(source,raw,m,grid,config,weights);results.append((r,m,f,stats,scores))
        directory=OUT/'shortlist'/m.name;directory.mkdir(parents=True,exist_ok=True)
        netcdf(directory/'fast_model.nc',grid,f,{'record':r,'mapping':m.document(),'remap':remap,'orbital_days':config['planet']['orbital_days']})
        write_json(directory/'diagnostics.json',{'record':r,'terrain_statistics':stats,'remap':remap})
        prepare_gcm(OUT/'gcm'/m.name,raw,m,config)
    write_csv(OUT/'shortlist_scores.csv',[x[0] for x in results])
    r,m,f,stats,scores=min(results,key=lambda x:x[0]['objective'])
    recommendation={'recommended':m.document(),'record':r,'terrain_statistics':stats,'classification':'Provisional physically constrained Level A reconstruction; GCM validation pending',
                    'alternatives':[x[1].document() for x in sorted(results,key=lambda x:x[0]['objective']) if x[1].name!=m.name][:3],
                    'selection':'minimum regularized objective among diverse refined candidates; not a canon or a GCM-confirmed optimum'}
    write_json(OUT/'latitude_mapping.json',recommendation);write_json(OUT/'distortion_metrics.json',m.metrics())
    netcdf(OUT/'best_fast_model.nc',grid,f,{'record':r,'mapping':m.document(),'config':config,'orbital_days':config['planet']['orbital_days']})
    raster_products(OUT,ROOT,grid,f)
    product=geopackage(OUT/'gaia_climate_v2.gpkg',ROOT,source,m,grid,f,scores);write_json(OUT/'gis_products.json',product)
    records=list(csv.DictReader((OUT/'candidate_scores.csv').open(encoding='utf-8')))
    records=[{key:float(value) if key!='name' else value for key,value in row.items()} for row in records]
    figures(OUT/'plots',source,m,grid,f,records)
    print('Recommended provisional mapping: '+m.name,flush=True)
    return recommendation
def sensitivity(config,weights):
    source,raw=inputs(config);chosen=[reconstruct(d) for d in json.loads((OUT/'shortlist.json').read_text())['candidates']]
    grid=Grid(config['search']['grid_degrees'],config['planet']['radius_m']);records=[];winners={}
    scenarios=[('baseline',None,None,None),('vertical_0_5','geometry','vertical_scale_m_per_raw_unit',.5),('vertical_2','geometry','vertical_scale_m_per_raw_unit',2.),
               ('obliquity_22','planet','obliquity_deg',22.),('obliquity_25','planet','obliquity_deg',25.),
               ('co2_280','planet','co2_ppm',280.),('co2_800','planet','co2_ppm',800.),('mixed_layer_20','energy','mixed_layer_m',20.),('mixed_layer_100','energy','mixed_layer_m',100.)]
    for name,section,key,value in scenarios:
        varied=copy.deepcopy(config)
        if section:varied[section][key]=value
        group=[]
        for m in chosen:
            print(f'Sensitivity {name}: {m.name}',flush=True)
            record,_,stats,_,_=evaluate(source,raw,m,grid,varied,weights)
            row={'scenario':name,**record};records.append(row);group.append(row)
        winners[name]=min(group,key=lambda r:r['objective'])['name'];write_csv(OUT/'sensitivity.csv',records)
    write_json(OUT/'sensitivity-summary.json',{'winners':winners,'rank_changes':len(set(winners.values()))>1,
                 'interpretation':'Level A ranking sensitivity only; candidate family/model structural uncertainty and GCM uncertainty remain, even if rank is stable.'})
def synthetic(config):
    grid=Grid(5,config['planet']['radius_m']);shape=(grid.ny,grid.nx);cases={}
    cases['aquaplanet']=(np.zeros(shape),np.zeros(shape))
    land=np.zeros(shape);land[:,24:48]=1;cases['flat_continent']=(land,np.zeros(shape))
    height=np.broadcast_to(3500*np.exp(-((np.arange(grid.nx)-32)/2)**2),shape).copy()*land;cases['mountain_barrier']=(land,height)
    results={}
    for name,(land,height) in cases.items():
        fields,diag=run_model(grid,land,height,config);directory=OUT/'synthetic';directory.mkdir(parents=True,exist_ok=True)
        netcdf(directory/f'{name}.nc',grid,fields,{'synthetic':name,'diagnostics':diag,'orbital_days':config['planet']['orbital_days']});results[name]=diag
    write_json(OUT/'synthetic-diagnostics.json',results);print(json.dumps(results,indent=2),flush=True)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['synthetic','search','export','sensitivity','all']);args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True);config=settings();weights=evidence_settings()
    state=provenance(config,weights);metadata=OUT/'run-settings.json'
    if metadata.exists():
        old=json.loads(metadata.read_text())
        if 'physics_sha256' in old and old['signature']!=state['signature']:
            raise RuntimeError('Existing V2 cache has different physics/config/source/runtime; preserve the run before recomputing')
        if 'physics_sha256' not in old and (old['config']!=config or old['evidence']!=weights):
            raise RuntimeError('Legacy V2 cache configuration differs; preserve it before recomputing')
    write_json(metadata,{**state,'input':'immutable V1 output/gis/gaia_geographic.gpkg','model':'Level A, not GCM'})
    if args.phase in ['synthetic','all']:synthetic(config)
    if args.phase in ['search','all']:search(config,weights)
    if args.phase in ['export','all']:refine_and_export(config,weights)
    if args.phase in ['sensitivity','all']:sensitivity(config,weights)
if __name__=='__main__':main()
