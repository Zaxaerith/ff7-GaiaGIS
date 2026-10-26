"""Optional private gameplay evidence; update only this asset and its Manifest record.

Original scripts are indexed, never executed. Scene/Formation links describe
static operand identities, not a playable encounter or a reward position.
"""
# SPDX-License-Identifier: GPL-3.0-only
import argparse
import hashlib
import json
from pathlib import Path

from .dataset import archive_key, child_ci, discover
from .safety import output_path, protect_input
from .web_export import sha256

FILENAME = 'gaia-gameplay.json'
GENERATOR_VERSION = 'gameplay-1'
MAX_BYTES = 20_000_000
DEPENDENCIES = ['gaia-field-context.json']


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf8')


def digest(value):
    return hashlib.sha256(value).hexdigest()


def atlas_content_hash():
    """Portable public text identity; original binary sources stay byte-exact."""
    from .atlas import curated_bytes
    return digest(curated_bytes().replace(b'\r\n', b'\n'))


def boss_content_hash():
    from importlib.resources import files
    return digest(files('gaiagis').joinpath('atlas_data/boss-evidence.json').read_bytes().replace(b'\r\n', b'\n'))


def resource_paths(dataset):
    """Prefer the selected Steam language; classic/shared files are fallback only."""
    data = dataset.wm_directory.parent
    language = child_ci(data, 'lang-' + dataset.language)
    result = {}
    for role, folder, name in (('scene', 'battle', 'scene.bin'), ('kernel', 'kernel', 'kernel.bin'), ('kernel2', 'kernel', 'kernel2.bin')):
        result[role] = None
        for base in (language, data):
            directory = child_ci(base, folder) if base else None
            path = child_ci(directory, name) if directory else None
            if path and path.is_file():
                protect_input(path)
                result[role] = path
                break
    return result


def input_profile(dataset, directory, source_hashes=None):
    """Small cache token includes absent optional files, not None-equality aliases."""
    directory = Path(directory)
    sources = dict(source_hashes or {})
    for path in resource_paths(dataset).values():
        if path and path.name.lower() not in sources:
            sources[path.name.lower()] = sha256(path)
    profile = dict(language=dataset.language, atlasContent=atlas_content_hash(), bossEvidence=boss_content_hash(),
                   archives={key: sources.get(key) for key in (dataset.world_name, dataset.field_name)},
                   optional={name: sources.get(name) for name in ('scene.bin', 'kernel.bin', 'kernel2.bin')},
                   workspace={name: sha256(directory/name) if (directory/name).is_file() else None
                              for name in ('gaia-field-context.json', 'gaia-events.json', 'gaia-encounters.json')})
    return digest(encoded(profile)), sources


def _formation_map(battle):
    return {row['battleId']: row for row in battle['formations'] if row['status'] == 'parsed'}


def field_battle_links(field, battle):
    formations = _formation_map(battle)
    result = []
    for scene in field['scenes']:
        for record in scene['records']:
            if record['kind'] != 'battle':
                continue
            operand = next((o for o in record['operands'] if o['name'] == 'formation'), None)
            literal = operand['value'] if operand and operand['kind'] == 'literal' and record['status'] == 'static' else None
            target = formations.get(literal)
            result.append(dict(sourceKind='field_script', recordId=record['id'], fieldId=scene['fieldId'],
                               battleId=literal, formationId=target['id'] if target else None,
                               status='matched' if target else 'unknown',
                               reason=None if target else 'incomplete_or_variable' if literal is None else 'formation_unavailable'))
    return result


def atlas_links(context, field):
    """Use authored scene identities or verified entrance bindings, never item names."""
    from .atlas import load_content
    content = load_content()
    by_name = {row['name']: row['fieldId'] for row in field['scenes']}
    place_fields = {}
    for binding in context.get('bindings', []):
        if binding.get('status') == 'verified_direct':
            place_fields.setdefault(binding['locationId'], set()).add(binding['fieldId'])
    result = []
    for entity in content['entities']:
        request = entity['spatialBinding']
        names = request.get('fieldNames', [])
        fields = {by_name[name] for name in names if name in by_name}
        relation = 'authored_scene'
        if not names and request.get('locationId'):
            fields = place_fields.get(request['locationId'], set())
            relation = 'verified_entrance_field'
        if fields:
            result.append(dict(entityId=entity['id'], fieldIds=sorted(fields), relation=relation))
    return result


def reviewed_boss_mappings(field, battle):
    """Two reviewed EN source profiles, not a name/HP/number heuristic.

    The authored guide supplies semantics; exact original Field instruction,
    Actor entry and complete Scene fingerprints supply the static chain.
    Missing/changed evidence produces no mapping, never a substitute match.
    """
    from importlib.resources import files
    from .atlas import load_content
    profiles = json.loads(files('gaiagis').joinpath('atlas_data/boss-evidence.json').read_text(encoding='utf8'))
    content = load_content()
    entities = {e['id']: e for e in content['entities']}
    source_ids = {s['id'] for s in content['sources']}
    fields = {s['fieldId']: s for s in field.get('scenes', [])}
    scenes = {s['id']: s for s in battle.get('scenes', [])}
    formations = {f['id']: f for f in battle.get('formations', [])}
    enemies = {(e['sceneId'], e['id']): e for e in battle.get('enemies', [])}
    result = []
    for profile in profiles:
        entity = entities.get(profile['entityId'])
        source_refs = set(entity['sources']) | {s for f in entity['facts'] for s in f['sources']} if entity else set()
        if not entity or not set(profile['sources']) <= source_refs & source_ids:
            continue
        scene = fields.get(profile['fieldId'])
        battle_scene = scenes.get(profile['sceneId'])
        formation = formations.get(profile['formationId'])
        enemy = enemies.get((profile['sceneId'], profile['enemyId']))
        if (not scene or scene.get('name') != profile['fieldName'] or scene.get('status') != 'indexed' or scene.get('stops') or
                scene.get('memberSHA256') != profile['memberSHA256'] or scene.get('section1SHA256') != profile['section1SHA256'] or
                not battle_scene or battle_scene.get('sha256') != profile['sceneSHA256'] or
                not formation or formation.get('status') != 'parsed' or formation.get('battleId') != profile['formationId'] or
                formation.get('sceneId') != profile['sceneId'] or formation.get('slot') != profile['formationId'] % 4 or
                formation.get('enemyIds') != [profile['enemyId']] or not enemy or enemy.get('nameStatus') != 'decoded' or
                enemy.get('name') != profile['enemyName']):
            continue
        record = next((r for r in scene['records'] if r['id'] == profile['recordId']), None)
        operands = [dict(name='formation', kind='literal', bank=0, value=profile['formationId'])]
        raw = (bytes([0x70, 0])+profile['formationId'].to_bytes(2, 'little')).hex()
        if (not record or record.get('kind') != 'battle' or record.get('opcode') != 0x70 or record.get('status') != 'static' or
                record.get('offset') != int(profile['recordId'].split(':')[1]) or record.get('raw') != raw or
                record.get('owners') != [profile['owner']] or record.get('operands') != operands):
            continue
        result.append({**{k:profile[k] for k in ('entityId', 'fieldId', 'fieldName', 'recordId', 'formationId', 'sceneId',
            'enemyId', 'memberSHA256', 'section1SHA256', 'sceneSHA256', 'sources')}, 'evidence':'reviewed_static_profile'})
    return result


def _workspace_links(directory, sources, context, battle):
    """Existing spatial products retain their own source identity and file hash."""
    formations = _formation_map(battle)
    known = {**context['sources'], **sources}
    links = dict(worldBattles=[], fieldBattles=[], encounters=[], assets={})
    for name in ('gaia-events.json', 'gaia-encounters.json'):
        path = directory/name
        if not path.is_file():
            continue
        value = json.loads(path.read_text(encoding='utf8'))
        identity = value.get('sources', {})
        if not identity or any(known.get(key) != val for key, val in identity.items()):
            links['assets'][name] = dict(sha256=sha256(path), status='source_mismatch')
            continue
        links['assets'][name] = dict(sha256=sha256(path), status='matched')
        if name == 'gaia-events.json':
            for event in value.get('events', []):
                if event.get('event_type') != 'scripted_battle':
                    continue
                target = formations.get(event.get('battle_id'))
                links['worldBattles'].append(dict(sourceKind='world_event', eventId=event['id'],
                    battleId=event.get('battle_id'), formationId=target['id'] if target else None,
                    status='matched' if target else 'unknown'))
        else:
            for group in value.get('encounter_sets', []):
                for kind, rows in group['records'].items():
                    for row in rows:
                        if row['weight'] <= 0:
                            continue
                        target = formations.get(row['scene_id'])
                        links['encounters'].append(dict(sourceKind='world_encounter', setId=group['id'],
                            encounterType=kind, byteOffset=row['byte_offset'], weight=row['weight'],
                            battleId=row['scene_id'], formationId=target['id'] if target else None,
                            status='matched' if target else 'unknown'))
    return links


def _world_script_links(dataset, context, sources, battle):
    from .lgp import inventory, read_entry
    from .world_events import analyze_ev
    name = archive_key(context['sources'], 'world')
    if name != dataset.world_name or sha256(dataset.world_archive) != context['sources'][name]:
        raise ValueError('World archive differs from current Field Context')
    sources[name] = context['sources'][name]
    members = inventory(dataset.world_archive)['entries']
    entries = [entry for entry in members if entry['filename'].lower() == 'wm0.ev']
    if len(entries) != 1:
        raise ValueError('World script missing or ambiguous')
    raw = read_entry(dataset.world_archive, entries[0])
    member_sha = digest(raw)
    if member_sha != context['sources'].get('wm0.ev'):
        raise ValueError('World script differs from current Field Context')
    sources['wm0.ev'] = member_sha
    encounters = [entry for entry in members if entry['filename'].lower() == 'enc_w.bin']
    if len(encounters) > 1:
        raise ValueError('World encounter member ambiguous')
    if encounters:
        sources['enc_w.bin'] = digest(read_entry(dataset.world_archive, encounters[0]))
    formations = _formation_map(battle)
    analysis = analyze_ev(raw)
    result = []
    for row in analysis['observations']:
        if row['event_type'] != 'scripted_battle':
            continue
        literal = row['raw_arguments'][0] if len(row['raw_arguments']) == 1 else None
        target = formations.get(literal)
        result.append(dict(sourceKind='world_script', eventId=None, member='wm0.ev', memberSHA256=member_sha,
            functionId=row['function_id'], callTableRecord=row['call_table_record'],
            instructionOffset=row['instruction_offset'], battleId=literal,
            formationId=target['id'] if target else None, status='matched' if target else 'unknown',
            conditions=row['condition_kind'], position=None, runtime='unknown'))
    return result


def encode_gameplay(source, directory):
    from .field_gameplay import index_field_gameplay
    from .battle_scene import parse_battle_resources
    dataset = discover(source)
    directory = output_path(Path(directory))
    if directory.is_relative_to(dataset.selected_path):
        raise ValueError('Gameplay output overlaps original source')
    context_path = directory/'gaia-field-context.json'
    context_bytes = context_path.read_bytes()
    context = json.loads(context_bytes)
    archive = dataset.field_archive()
    if not archive or archive_key(context['sources'], 'field') != dataset.field_name:
        raise ValueError('Missing/mismatched paired Field archive')
    field = index_field_gameplay(archive, context)
    paths = resource_paths(dataset)
    battle = parse_battle_resources(paths['scene'], paths['kernel'], paths['kernel2'])
    sources = {**field.pop('sources'), **battle.pop('sources')}
    world_scripts = _world_script_links(dataset, context, sources, battle)
    links = _workspace_links(directory, sources, context, battle)
    links['worldBattles'].extend(world_scripts)
    links['fieldBattles'] = field_battle_links(field, battle)
    value = dict(schema='gaiagis-gameplay', version=1, generator_revision=GENERATOR_VERSION,
                 sourceLanguage=dataset.language, sources=sources, contextSHA256=digest(context_bytes),
                 atlasContentSHA256=atlas_content_hash(), field=field, battle=battle, links=links,
                 atlasLinks=atlas_links(context, field),
                 bossMappings=reviewed_boss_mappings(field, battle) if dataset.language == 'en' else [])
    payload = encoded(value)
    if len(payload) > MAX_BYTES:
        raise ValueError('Gameplay evidence exceeds bounded JSON budget')
    return payload, value


def build_gameplay(source, directory):
    from .field_interaction import atomic_write
    payload, value = encode_gameplay(source, directory)
    atomic_write(output_path(Path(directory)/FILENAME), payload)
    return value


def update_workspace(source, directory, *, game_language=None):
    """Publish one asset atomically; preserve every unrelated Manifest record."""
    from .field_interaction import atomic_write
    from ._version import __version__
    dataset = discover(source, game_language)
    directory = output_path(Path(directory))
    manifest_path = output_path(directory/'gaia-workspace.json')
    old_manifest = manifest_path.read_bytes()
    manifest = json.loads(old_manifest)
    if manifest.get('schema') != 'gaiagis-workspace' or manifest.get('version') != 1:
        raise ValueError('Gameplay incremental update requires an existing Workspace Manifest')
    context = next((row for row in manifest['assets'] if row['filename'] == DEPENDENCIES[0]), None)
    if not context or sha256(directory/DEPENDENCIES[0]) != context['sha256']:
        raise ValueError('Current Field Context must match its Manifest')
    payload, value = encode_gameplay(dataset, directory)
    if value['contextSHA256'] != context['sha256']:
        raise ValueError('Field Context changed during gameplay indexing')
    for key, sha in value['sources'].items():
        if key in manifest['sources'] and manifest['sources'][key] != sha:
            raise ValueError('Gameplay source differs from existing Workspace: '+key)
    profile, _ = input_profile(dataset, directory, value['sources'])
    manifest['sources'].update(value['sources'])
    manifest['sources']['gameplay-inputs.json'] = profile
    manifest['tool_version'] = __version__
    manifest['assets'] = [row for row in manifest['assets'] if row['filename'] != FILENAME]
    manifest['assets'].append(dict(filename=FILENAME, type='gameplay', mapId='shared', bytes=len(payload),
                                   sha256=digest(payload), dependencies=DEPENDENCIES, generator_version=GENERATOR_VERSION))
    target = output_path(directory/FILENAME)
    previous = target.read_bytes() if target.is_file() and target.stat().st_size <= MAX_BYTES else None
    if target.is_file() and previous is None:
        raise ValueError('Existing gameplay asset exceeds rollback budget')
    try:
        atomic_write(target, payload)
        atomic_write(manifest_path, (json.dumps(manifest, sort_keys=True, indent=2)+'\n').encode('utf8'))
    except BaseException:
        if previous is None:
            target.unlink(missing_ok=True)
        else:
            atomic_write(target, previous)
        atomic_write(manifest_path, old_manifest)
        raise
    return dict(assetBytes=len(payload), totalAssetBytes=sum(row['bytes'] for row in manifest['assets']),
                assets=len(manifest['assets']), field=value['field']['coverage'], battle=value['battle']['coverage'],
                links={key:len(value['links'][key]) for key in ('worldBattles','fieldBattles','encounters')},
                originalDataModified=False)


def refresh_links(source, directory, *, game_language=None):
    """Refresh small World-member links without decoding Field or Battle again.

    The existing indexed snapshot, Context, selected roles, optional raw files
    and small Workspace link products must still match the saved input token.
    Field/Battle records are retained byte-for-byte as JSON values.
    """
    from .field_interaction import atomic_write
    dataset = discover(source, game_language)
    directory = output_path(Path(directory))
    target = output_path(directory/FILENAME)
    manifest_path = output_path(directory/'gaia-workspace.json')
    old_manifest = manifest_path.read_bytes()
    manifest = json.loads(old_manifest)
    record = next((row for row in manifest['assets'] if row['filename'] == FILENAME), None)
    if not record or record.get('generator_version') != GENERATOR_VERSION or not 0 < target.stat().st_size <= MAX_BYTES:
        raise ValueError('Gameplay snapshot missing or unsupported')
    previous = target.read_bytes()
    if digest(previous) != record['sha256'] or len(previous) != record['bytes']:
        raise ValueError('Gameplay snapshot differs from its Manifest')
    value = json.loads(previous)
    context_bytes = (directory/DEPENDENCIES[0]).read_bytes()
    context = json.loads(context_bytes)
    context_record = next((row for row in manifest['assets'] if row['filename'] == DEPENDENCIES[0]), None)
    if (value.get('schema') != 'gaiagis-gameplay' or value.get('version') != 1 or
            value.get('generator_revision') != GENERATOR_VERSION or value['sourceLanguage'] != dataset.language or
            not context_record or digest(context_bytes) != context_record['sha256'] or
            digest(context_bytes) != value['contextSHA256'] or
            archive_key(value['sources'], 'field') != dataset.field_name or
            value['sources'][dataset.field_name] != context['sources'][dataset.field_name]):
        raise ValueError('Gameplay snapshot/Context/source identity mismatch')
    # Hash only the small optional inputs; never re-read the Field archive or
    # decode Scene data merely to refresh an encounter-member relationship.
    current = {key:sha for key,sha in value['sources'].items() if key not in ('scene.bin','kernel.bin','kernel2.bin')}
    profile, current = input_profile(dataset, directory, current)
    if profile != manifest['sources'].get('gameplay-inputs.json'):
        raise ValueError('Gameplay input token changed; fresh indexing is required')
    sources = dict(value['sources'])
    world_scripts = _world_script_links(dataset, context, sources, value['battle'])
    links = _workspace_links(directory, sources, context, value['battle'])
    links['worldBattles'].extend(world_scripts)
    links['fieldBattles'] = value['links']['fieldBattles']
    value['sources'], value['links'] = sources, links
    value['atlasContentSHA256'] = atlas_content_hash()
    value['bossMappings'] = reviewed_boss_mappings(value['field'], value['battle']) if dataset.language == 'en' else []
    payload = encoded(value)
    if len(payload) > MAX_BYTES:
        raise ValueError('Gameplay evidence exceeds bounded JSON budget')
    manifest['sources'].update(sources)
    record.update(bytes=len(payload), sha256=digest(payload))
    try:
        atomic_write(target, payload)
        atomic_write(manifest_path, (json.dumps(manifest, sort_keys=True, indent=2)+'\n').encode('utf8'))
    except BaseException:
        atomic_write(target, previous)
        atomic_write(manifest_path, old_manifest)
        raise
    return dict(assetBytes=len(payload), totalAssetBytes=sum(row['bytes'] for row in manifest['assets']),
                assets=len(manifest['assets']),
                links={key:dict(records=len(links[key]), matched=sum(row['status']=='matched' for row in links[key]))
                       for key in ('worldBattles','fieldBattles','encounters')},
                originalDataModified=False)


def main(argv=None):
    from .constants import GAME_DATA_LANGUAGES
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--workspace', required=True, type=Path)
    parser.add_argument('--game-language', choices=GAME_DATA_LANGUAGES, default='en')
    args = parser.parse_args(argv)
    print(json.dumps(update_workspace(args.source, args.workspace, game_language=args.game_language), indent=2))


if __name__ == '__main__':
    main()
