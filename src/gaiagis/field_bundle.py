"""Bounded readback of a Field CFG group, independent of optional text bodies."""
# SPDX-License-Identifier: GPL-3.0-only
import json
import struct
import zlib
from .field_provenance import context_decoder, validate_profile
from .field_transaction import digest

KINDS = {'gaia-field-interaction.bin': ('GAIAINT\0', 'field-interaction', 8_000_000),
         'gaia-field-script-evidence.bin': ('GAIASCR\0', 'field-script-evidence', 4_000_000),
         'gaia-field-dialogue.bin': ('GAIADLG\0', 'field-dialogue', 16_000_000)}


def read_pack(payload, name):
    magic, kind, limit = KINDS[name]
    if not 16 < len(payload) <= limit or payload[:8] != magic.encode():
        raise ValueError('CFG pack transport/budget')
    version, size = struct.unpack_from('<II', payload, 8)
    if version not in (1, 2) or not 0 < size <= 1_000_000 or 16+size > len(payload):
        raise ValueError('CFG pack metadata bounds')
    meta = json.loads(payload[16:16+size])
    keys={'schema','version','generator_revision','sources','scenes'}
    if kind=='field-interaction':keys.add('coordinateSpace')
    if kind!='field-interaction' or version==2:keys.add('contextSHA256')
    if version==2:keys.add('decoder')
    if kind=='field-dialogue':keys.update(('decoder','sourceLanguage','mode','coverage'))
    if set(meta)!=keys or meta['schema']!='gaiagis-'+kind or kind=='field-interaction' and meta['coordinateSpace']!='FieldLocal':
        raise ValueError('CFG metadata shape/schema')
    if meta['version'] != version:
        raise ValueError('CFG pack version mismatch')
    validate_profile(meta, kind)
    cursor = 0; scenes = {}; chunks = {}
    for span in meta['scenes']:
        fid = span['fieldId']
        if type(fid) is not int or not 0 <= fid <= 65535 or fid in scenes or span['offset'] != cursor or not 0 < span['bytes'] <= 2_000_000 or not 0 < span['rawBytes'] <= 2_000_000:
            raise ValueError('CFG compressed scene bounds/identity')
        chunk = payload[16+size+cursor:16+size+cursor+span['bytes']]
        d = zlib.decompressobj(); raw = d.decompress(chunk, span['rawBytes']+1)
        if len(raw) != span['rawBytes'] or not d.eof or d.unused_data or d.unconsumed_tail or digest(raw) != span['sha256']:
            raise ValueError('CFG scene compression/checksum')
        scene = json.loads(raw)
        if scene['fieldId'] != fid or scene['name'] != span['name']:
            raise ValueError('CFG scene Field identity')
        for key in ('section1SHA256', 'section5SHA256', 'section8SHA256', 'memberSHA256'):
            if key in span and span[key] != scene[key]:
                raise ValueError('CFG scene Section identity')
        scenes[fid] = scene; chunks[fid] = chunk; cursor += span['bytes']
    if 16+size+cursor != len(payload):
        raise ValueError('CFG pack trailing data')
    return meta, scenes, chunks


def validate_manifest_cfg(root, manifest):
    """Small server/pre-publication gate. Full scene readback belongs to staging."""
    from pathlib import Path
    root=Path(root);records={r['filename']:r for r in manifest['assets']}
    name='gaia-field-context.json'
    if name not in records:return
    raw=(root/name).read_bytes();context=json.loads(raw);context_decoder(context);sha=digest(raw)
    for name in (*KINDS,'gaia-gameplay.json'):
        record=records.get(name)
        if record is None:continue
        path=root/name
        if name.endswith('.json'):
            if path.stat().st_size>20_000_000:raise ValueError('Gameplay budget')
            meta=json.loads(path.read_bytes());kind='gameplay'
        else:
            with path.open('rb') as stream:
                prefix=stream.read(16)
                if len(prefix)!=16 or prefix[:8]!=KINDS[name][0].encode():raise ValueError('CFG header identity')
                version,size=struct.unpack_from('<II',prefix,8)
                if not 0<size<=1_000_000:raise ValueError('CFG header budget')
                meta=json.loads(stream.read(size))
                if meta['version']!=version:raise ValueError('CFG transport version')
            kind=KINDS[name][1]
        validate_profile(meta,kind,context)
        if record.get('generator_version')!=meta['generator_revision'] or any(context['sources'].get(k)!=meta['sources'].get(k) for k in (context['archive'],'maplist')):
            raise ValueError('CFG Manifest/source identity')
        if (meta['version']==2 or kind!='field-interaction') and meta.get('contextSHA256')!=sha:
            raise ValueError('CFG mixed Context checksum')


def validate_bundle(context_bytes, assets):
    """Verify group source/profile and cross-asset Field/Section identity.

    Per-scene semantic validators are also invoked; geometry itself stays owned
    by the unchanged Walkmesh reader. No arbitrary text is included in errors.
    """
    from .field_dialogue import validate_scene as dialogue_scene
    from .field_script_evidence import validate_evidence
    from .field_gameplay import decode_gameplay_operands
    context = json.loads(context_bytes); context_decoder(context)
    sha = digest(context_bytes)
    nodes = {n['id']: n for n in context['nodes'] if n['status'] == 'available'}
    all_scenes = {}; headers = {}
    for name, payload in assets.items():
        if name not in KINDS:
            continue
        meta, scenes, _ = read_pack(payload, name)
        validate_profile(meta, KINDS[name][1], context)
        if any(context['sources'].get(k) != v for k, v in meta['sources'].items()):
            raise ValueError('CFG archive/maplist source mismatch')
        if meta['version'] == 2 or name != 'gaia-field-interaction.bin':
            if meta.get('contextSHA256') != sha:
                raise ValueError('CFG Context checksum mismatch')
        if set(scenes) != set(nodes) or any(s['name'] != nodes[fid]['name'] for fid, s in scenes.items()):
            raise ValueError('CFG missing/conflicting scene')
        if name == 'gaia-field-script-evidence.bin':
            validate_evidence(payload, context['sources'], context_sha256=sha, context=context)
        if name == 'gaia-field-dialogue.bin':
            for scene in scenes.values(): dialogue_scene(scene,decoder=context_decoder(context))
        all_scenes[name] = scenes; headers[name] = meta
    gameplay = assets.get('gaia-gameplay.json')
    if gameplay is not None:
        if len(gameplay) > 20_000_000: raise ValueError('Gameplay budget')
        gp = json.loads(gameplay); validate_profile(gp, 'gameplay', context)
        if gp['contextSHA256'] != sha or any(context['sources'][k] != v for k, v in gp['sources'].items() if k in context['sources']):
            raise ValueError('Gameplay CFG source mismatch')
        scenes = {s['fieldId']: s for s in gp['field']['scenes']}
        if len(scenes) != len(gp['field']['scenes']) or set(scenes) != {n['id'] for n in context['nodes']}:
            raise ValueError('Gameplay Field identity')
        for fid, s in scenes.items():
            if s['name'] != next(n['name'] for n in context['nodes'] if n['id'] == fid): raise ValueError('Gameplay Field name')
            offsets = set()
            for r in s['records']:
                if r['id'] != f"{fid}:{r['offset']}" or r['offset'] in offsets or decode_gameplay_operands(bytes.fromhex(r['raw'])) != r['operands'] or r['position'] is not None or r['flagLinks']:
                    raise ValueError('Gameplay instruction evidence')
                offsets.add(r['offset'])
        all_scenes['gaia-gameplay.json'] = scenes
    for fid in nodes:
        identity = {}
        for scenes in all_scenes.values():
            s = scenes[fid]
            for key in ('section1SHA256', 'section5SHA256', 'section8SHA256', 'memberSHA256'):
                value = s.get(key)
                if value is None: continue
                if key in identity and identity[key] != value: raise ValueError('CFG cross-asset Section/member mismatch')
                identity[key] = value
    return headers
