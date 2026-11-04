"""Incremental, source-gated EN CMUSC recovery. Never rebuilds GIS geometry."""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
from collections import Counter
import copy
import json
from pathlib import Path
import struct
import tempfile
import time
import zlib

from .field_provenance import LEGACY, CMUSC8, EN_ARCHIVE, MAPLIST, source_decoder
from .field_transaction import FILES, digest, workspace_lease, recover, commit, rollback
from .field_bundle import read_pack, validate_bundle
from .field_dialogue import encoded, scene_dialogue
from .field_script_evidence import scene_evidence
from .field_gameplay import scene_gameplay
from .field_context import field_sections, parse_script
from .field_interaction import atomic_write
from .safety import output_path

AFFECTED = frozenset((79,190,199,273,331,343,344,345,355,433,452,456,476,522,555,601,612,636,651,687,688,714,720,775))


def repack(payload, name, updates, context_sha):
    meta, old, chunks = read_pack(payload, name)
    meta.update(version=2, generator_revision=meta['generator_revision'][:-1]+'2', decoder=CMUSC8, contextSHA256=context_sha)
    pool = bytearray()
    for span in meta['scenes']:
        fid = span['fieldId']
        if fid in updates:
            raw = encoded(updates[fid]); chunk = zlib.compress(raw, 9)
            span.update(bytes=len(chunk), rawBytes=len(raw), sha256=digest(raw))
        else:
            chunk = chunks[fid]
        span['offset'] = len(pool); pool.extend(chunk)
    if name == 'gaia-field-dialogue.bin':
        counts = Counter()
        for fid, old_scene in old.items():
            s = updates.get(fid, old_scene)
            counts[s['status']] += 1; counts['fields'] += 1
            counts['validTables'] += s['textTable']['status'] == 'valid'
            counts['texts'] += len(s['textTable']['texts'])
            counts['textBodies'] += sum(t['body'] is not None for t in s['textTable']['texts'])
            counts['badTexts'] += sum(t['status'] == 'unavailable' for t in s['textTable']['texts'])
            for r in s['records']:
                if r['opcode'] in (64,72): counts[('MESSAGE' if r['opcode']==64 else 'ASK')+('' if r['entryReachable'] else '_unreachable')] += 1
        meta['coverage'] = dict(counts)
    header = encoded(meta)
    return payload[:8]+struct.pack('<II',2,len(header))+header+pool


def prepare(source, root):
    from .dataset import discover
    from .lgp import inventory, read_entry
    from .poi import parse_maplist
    from .web_export import sha256
    from .gameplay import field_battle_links, input_profile
    from ._version import __version__
    began = time.perf_counter(); root = Path(root)
    manifest_bytes = (root/'gaia-workspace.json').read_bytes(); manifest = json.loads(manifest_bytes)
    records = {r['filename']: r for r in manifest['assets']}
    # Freeze all declared inputs. Unrelated assets are authenticated, never copied.
    for name, record in records.items():
        if sha256(root/name) != record['sha256'] or (root/name).stat().st_size != record['bytes']:
            raise ValueError('Workspace frozen inventory mismatch')
    names = [n for n in FILES[:-1] if n in records]
    required = set(FILES[:4])
    if not required.issubset(names): raise ValueError('Recovery requires Context/Interaction/Script Evidence/Gameplay')
    originals = {n: (root/n).read_bytes() for n in names}
    for n, raw in originals.items():
        if digest(raw) != records[n]['sha256'] or len(raw) != records[n]['bytes']: raise ValueError('CFG source snapshot checksum')
    old_context = json.loads(originals[FILES[0]])
    if old_context.get('version') not in (3,4,5) or old_context['archive'] != 'flevel.lgp' or source_decoder(old_context['sources']) != CMUSC8:
        raise ValueError('Recovery requires a verified legacy EN Context')
    validate_bundle(originals[FILES[0]], originals)
    ds = discover(source, 'en'); archive = ds.field_archive()
    archive_stat = archive.stat()
    if sha256(archive) != EN_ARCHIVE: raise ValueError('Unverified complete EN archive')
    entries = {}
    for row in inventory(archive)['entries']:
        key = row['filename'].casefold()
        if key in entries: raise ValueError('Duplicate Field member')
        entries[key] = row
    maplist = read_entry(archive, entries['maplist'])
    if digest(maplist) != MAPLIST: raise ValueError('Unverified EN maplist')
    mapnames = parse_maplist(maplist)
    packs = {n: read_pack(originals[n], n) for n in names if n.endswith('.bin')}
    gp = json.loads(originals['gaia-gameplay.json'])
    old_scenes = {s['fieldId']: s for s in gp['field']['scenes']}
    updates = {n: {} for n in packs}
    context = copy.deepcopy(old_context); context.update(version=6, scriptDecoder=CMUSC8, section1Recoveries=old_context.get('section1Recoveries', []))
    new_edges, new_exits, new_unknown = [], [], []
    audit = []; old_boundary = old_entry = cmusc = cmusc_reachable = old_stop = old_uncovered = 0
    for fid in sorted(AFFECTED):
        name = mapnames[fid]
        if next(n['name'] for n in context['nodes'] if n['id'] == fid) != name: raise ValueError('Recovery Field identity')
        raw = read_entry(archive, entries[name]); script,s8,s5 = field_sections(raw, walkmesh=True, archive='flevel.lgp', member=name)
        member_hash = digest(raw); s1hash = digest(script)
        if (old_scenes[fid]['memberSHA256'],old_scenes[fid]['section1SHA256']) != (member_hash,s1hash): raise ValueError('Recovery raw member/Section mismatch')
        old_parse = parse_script(script, evidence=True, decoder=LEGACY)
        new_parse = parse_script(script, evidence=True, decoder=CMUSC8)
        old_trace,new_trace = old_parse[3],new_parse[3]
        if old_trace['entries'] != new_trace['entries'] or old_parse[0] != new_parse[0]: raise ValueError('Recovery changed original Entry identity')
        new_instructions = {r['offset']: r for r in new_trace['instructions']}
        if any(any(new_instructions.get(r['offset'],{}).get(k)!=r[k] for k in ('offset','length','opcode')) for r in old_trace['instructions']): raise ValueError('Recovery changed original boundary')
        old_boundary += len(old_trace['instructions']); old_entry += len(old_trace['entries']); old_stop += len(old_parse[2])
        old_uncovered += old_trace['codeEnd']-old_trace['codeStart']-sum(r['length'] for r in old_trace['instructions'])
        if new_parse[2] or sum(r['length'] for r in new_trace['instructions']) != new_trace['codeEnd']-new_trace['codeStart']: raise ValueError('Recovery incomplete CFG')
        recovered = [r for r in new_trace['instructions'] if r['opcode'] == 253]
        cmusc += len(recovered); cmusc_reachable += sum(r['entryReachable'] for r in recovered)
        _, jumps, unknown = parse_script(script, decoder=CMUSC8)
        for r in jumps:
            record = dict(fromField=fid, **r)
            if mapnames[r['to']].startswith('wm') and mapnames[r['to']][2:].isdigit(): new_exits.append(dict(**record,name=mapnames[r['to']]))
            elif any(n['id']==r['to'] and n['status']=='available' for n in context['nodes']): new_edges.append(record)
            else: new_unknown.append(dict(fromField=fid,offset=r['offset'],reason='missing_destination'))
        if unknown: raise ValueError('Recovery unexpected stop')
        ip = copy.deepcopy(packs['gaia-field-interaction.bin'][1][fid])
        if (ip['section1SHA256'],ip['section8SHA256'],ip['section5SHA256']) != (s1hash,digest(s8),digest(s5)): raise ValueError('Interaction raw Section mismatch')
        # Reuse all exact geometry/trigger evidence. Only decoder stops change.
        _,_,stops,lines = parse_script(script,interactions=True,decoder=CMUSC8)
        if [{k:v for k,v in r.items() if k!='geometry'} for r in ip['scripts']] != lines: raise ValueError('Recovery changed Interaction records')
        ip['stops']=stops; updates['gaia-field-interaction.bin'][fid]=ip
        se = scene_evidence(script,s8,fid,name,decoder=CMUSC8)
        old_se=packs['gaia-field-script-evidence.bin'][1][fid]
        if se['records'] != old_se['records']: raise ValueError('Recovery changed existing Palette evidence')
        updates['gaia-field-script-evidence.bin'][fid]=se
        if 'gaia-field-dialogue.bin' in packs:
            with_text = packs['gaia-field-dialogue.bin'][0]['mode']=='with-text'
            dp=scene_dialogue(script,s8,s5,fid,name,member_hash,with_text=with_text,decoder=CMUSC8)
            old_dp=packs['gaia-field-dialogue.bin'][1][fid]; by={r['offset']:r for r in dp['records']}
            if any(by.get(r['offset'])!=r for r in old_dp['records']): raise ValueError('Recovery changed old dialogue ownership')
            updates['gaia-field-dialogue.bin'][fid]=dp
        new_gp=scene_gameplay(script,fid,name,member_sha256=member_hash,decoder=CMUSC8)
        by={r['offset']:r for r in new_gp['records']}
        for r in old_scenes[fid]['records']:
            if any(by[r['offset']][k]!=r[k] for k in ('raw','owners','offset','opcode','position','flagLinks')): raise ValueError('Recovery changed original Gameplay source')
        old_scenes[fid]=new_gp
        audit.append(dict(fieldId=fid,name=name,memberSHA256=member_hash,section1SHA256=s1hash,cmusc=[r['offset'] for r in recovered]))
    for key, new in (('scriptEdges',new_edges),('scriptExits',new_exits),('scriptUnresolved',new_unknown)):
        context[key] = sorted([r for r in context[key] if r['fromField'] not in AFFECTED]+new,key=lambda r:(r['fromField'],r['offset'] if r['offset'] is not None else -1))
    for key in ('nodes','edges','exits','gateways','entrances','bindings','nativeRelations','sources','unresolved'):
        if context[key] != old_context[key]: raise ValueError('Recovery altered spatial Context')
    ctx = encoded(context)+b'\n'; candidates={FILES[0]:ctx}
    for n in packs: candidates[n]=repack(originals[n],n,updates[n],digest(ctx))
    gp['field']['scenes']=[old_scenes[s['fieldId']] for s in gp['field']['scenes']]
    rows=[r for s in gp['field']['scenes'] for r in s['records']]; states=Counter(s['status'] for s in gp['field']['scenes']); kinds=Counter(r['kind'] for r in rows); static=Counter(r['kind'] for r in rows if r['status']=='static')
    coverage=gp['field']['coverage']; coverage.update({k:states[k] for k in ('indexed','empty','partial','unavailable')}); coverage.update(records=len(rows),**{k:kinds[k] for k in ('item','materia','battle','flag')},staticItem=static['item'],staticMateria=static['materia'],staticBattle=static['battle'],sceneOnly=kinds['item']+kinds['materia'])
    gp.update(version=2,generator_revision='gameplay-2',decoder=CMUSC8,contextSHA256=digest(ctx)); gp['links']['fieldBattles']=field_battle_links(gp['field'],gp['battle'])
    candidates['gaia-gameplay.json']=encoded(gp)
    validate_bundle(ctx,candidates)
    # Exact source regression gates; not public UI constants.
    if (old_stop,old_uncovered,cmusc,cmusc_reachable,len(rows),len(context['scriptEdges']),len(context['scriptExits'])) != (55,9480,32,31,13267,1741,43): raise ValueError('Recovery regression baseline differs')
    dp_meta = read_pack(candidates['gaia-field-dialogue.bin'],'gaia-field-dialogue.bin')[0] if 'gaia-field-dialogue.bin' in candidates else None
    if dp_meta and (dp_meta['coverage']['MESSAGE'],dp_meta['coverage']['ASK']) != (13126,904): raise ValueError('Recovery dialogue baseline differs')
    for n, data in candidates.items():
        records[n].update(bytes=len(data),sha256=digest(data),generator_version='field-context-9' if n==FILES[0] else json.loads(data)['generator_revision'] if n.endswith('.json') else read_pack(data,n)[0]['generator_revision'])
    records['gaia-field-walkmesh.bin']['generator_version']='field-walkmesh-1'
    manifest['tool_version']=__version__
    profile,_=input_profile(ds,root,manifest['sources'],context_sha256=digest(ctx))
    manifest['sources']['gameplay-inputs.json']=profile
    candidates['gaia-workspace.json']=encoded(manifest)+b'\n'
    snapshot={n:digest(originals[n]) for n in names}; snapshot['gaia-workspace.json']=digest(manifest_bytes)
    if (archive.stat().st_size,archive.stat().st_mtime_ns) != (archive_stat.st_size,archive_stat.st_mtime_ns): raise ValueError('Original archive changed during recovery')
    report=dict(fields=24,reusedScenes=678,oldStops=old_stop,oldUncoveredBytes=old_uncovered,cmusc=cmusc,reachableCMUSC=cmusc_reachable,preservedBoundaries=old_boundary,preservedEntries=old_entry,dialogue=None if dp_meta is None else dp_meta['coverage'],gameplay=coverage,scriptEdges=len(context['scriptEdges']),scriptExits=len(context['scriptExits']),scriptUnresolved=len(context['scriptUnresolved']),fieldsAudit=audit,assets={n:dict(before=snapshot[n],after=digest(v),bytes=len(v)) for n,v in candidates.items()},seconds=round(time.perf_counter()-began,3))
    return candidates,snapshot,report


def migrate(source, root):
    root=Path(root)
    with workspace_lease(root):
        recover(root)
        candidates,snapshot,report=prepare(source,root)
        with tempfile.TemporaryDirectory(prefix='field-cfg-',dir=root/'.build') as folder:
            stage=Path(folder)
            for n,data in candidates.items(): atomic_write(stage/n,data)
            staged={n:(stage/n).read_bytes() for n in candidates}
            validate_bundle(staged[FILES[0]],staged)
            validate_geometry(root,staged)
            report['transaction']=commit(root,staged,snapshot)
        return report


def stage_only(source, root):
    """Generate once; allow formal Web readback before the short offline commit."""
    with workspace_lease(root):
        recover(root)
        stage=output_path(Path(root)/'.build/field-cfg-candidate')
        if stage.exists(): raise ValueError('Candidate already exists; inspect it before regenerating')
        candidates,snapshot,report=prepare(source,root)
        stage.mkdir(parents=True)
        for name,data in candidates.items(): atomic_write(stage/name,data)
        atomic_write(stage/'plan.json',encoded(dict(snapshot=snapshot,report=report)))
        return report


def apply_staged(root):
    from .web_export import sha256
    with workspace_lease(root):
        recover(root)
        stage=output_path(Path(root)/'.build/field-cfg-candidate')
        plan=json.loads((stage/'plan.json').read_bytes())
        candidates={name:(stage/name).read_bytes() for name in plan['snapshot']}
        for name,data in candidates.items():
            if digest(data)!=plan['report']['assets'][name]['after']:raise ValueError('Staged CFG checksum changed')
        validate_bundle(candidates[FILES[0]],candidates)
        manifest=json.loads(candidates['gaia-workspace.json'])
        from ._version import __version__
        if manifest['tool_version']!=__version__:raise ValueError('Candidate tool version differs; finalize it before commit')
        for r in manifest['assets']:
            data=candidates.get(r['filename'])
            actual=digest(data) if data is not None else sha256(Path(root)/r['filename'])
            if actual!=r['sha256']:raise ValueError('Staged Manifest/source mismatch')
        validate_geometry(root,candidates)
        plan['report']['transaction']=commit(root,candidates,plan['snapshot'])
        return plan['report']


def validate_geometry(root, candidates):
    """Read only the 24 existing Section-5 slices; never regenerate geometry."""
    from .field_context import parse_walkmesh
    from .field_interaction import validate_interaction_scene
    payload=(Path(root)/'gaia-field-walkmesh.bin').read_bytes()
    size=struct.unpack_from('<I',payload,12)[0]
    header=json.loads(payload[16:16+size]);spans={s['fieldId']:s for s in header['scenes']}
    interaction, scenes, _=read_pack(candidates['gaia-field-interaction.bin'],'gaia-field-interaction.bin')
    ip_spans={s['fieldId']:s for s in interaction['scenes']}
    for fid in AFFECTED:
        span=spans[fid];raw=payload[16+size+span['offset']:16+size+span['offset']+span['bytes']]
        stats,points=parse_walkmesh(raw,geometry=True)
        validate_interaction_scene(scenes[fid],ip_spans[fid],dict(raw=raw,stats=stats,points=points))


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--rollback');p.add_argument('--recover',action='store_true');p.add_argument('--report',type=Path);p.add_argument('--stage-only',action='store_true');p.add_argument('--apply-staged',action='store_true')
    a=p.parse_args(argv)
    if a.rollback or a.recover:
        with workspace_lease(a.workspace): result=rollback(a.workspace,a.rollback) if a.rollback else recover(a.workspace)
        print(result);return 0
    if a.source is None and not a.apply_staged:p.error('--source required for migration')
    result=apply_staged(a.workspace) if a.apply_staged else stage_only(a.source,a.workspace) if a.stage_only else migrate(a.source,a.workspace)
    if a.report: atomic_write(output_path(a.report),encoded(result)+b'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ('fieldsAudit','assets')},indent=2));return 0


if __name__=='__main__':raise SystemExit(main())
