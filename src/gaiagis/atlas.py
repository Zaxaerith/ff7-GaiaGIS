"""Curated knowledge validation and identity-only local Atlas binding.

External reference prose cannot supply geometry. The binder never emits coordinates;
browser navigation resolves identities through the independently validated POI owner.
"""
# SPDX-License-Identifier: GPL-3.0-only
from copy import deepcopy
from datetime import date
import hashlib
from importlib.resources import files
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from .safety import output_path

LOCALES = ('en', 'zh-CN', 'zh-TW', 'ja', 'ko')
KINDS = ('city', 'town', 'village', 'settlement', 'dungeon', 'landmark',
         'materia_cave', 'world_map_site', 'chocobo_site', 'vehicle_site',
         'secret_area', 'collectible_site', 'treasure_group')
BINDINGS = ('location', 'parent_location', 'field_parent', 'field_identity', 'non_spatial', 'unresolved')
SPOILERS = ('none', 'minor', 'major')
FACT_KINDS = ('access', 'gameplay', 'reward', 'category', 'secret')
GENERATOR_VERSION = 'atlas-1'


def curated_bytes():
    return files('gaiagis').joinpath('atlas_data/content.json').read_bytes()


def curated_hash():
    return hashlib.sha256(curated_bytes()).hexdigest()


def _check(condition, message):
    if not condition:
        raise ValueError('Atlas: ' + message)


def _text(value, maximum=500):
    return isinstance(value, str) and 0 < len(value) <= maximum and not any(ord(c) < 32 for c in value)


def _id(value):
    return isinstance(value, str) and re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,99}', value) is not None


def _strings(value, maximum=100):
    return isinstance(value, list) and len(value) <= maximum and all(_text(v, 100) for v in value) and len(value) == len(set(value))


def _localized(value):
    return isinstance(value, dict) and set(value) == set(LOCALES) and all(_text(v) for v in value.values())


def validate_content(content):
    _check(isinstance(content, dict) and set(content) == {'schema', 'version', 'sources', 'entities', 'exclusions'}, 'content shape')
    _check(content['schema'] == 'gaiagis-atlas-content' and content['version'] == 1, 'unsupported schema')
    _check(isinstance(content['sources'], list) and 0 < len(content['sources']) <= 200, 'sources')
    sources = set()
    for source in content['sources']:
        _check(isinstance(source, dict) and set(source) == {'id', 'provider', 'title', 'url', 'reviewed', 'type', 'notes'}, 'source shape')
        _check(_id(source['id']) and source['id'] not in sources, 'duplicate/invalid source ID')
        _check(all(_text(source[k]) for k in ('provider', 'title', 'notes')), 'source text')
        url = urlparse(source['url'])
        _check(url.scheme == 'https' and url.hostname and not url.username and not url.password, 'unsafe source URL')
        _check(source['type'] in ('game_identity', 'reverse_engineering', 'wiki', 'reference'), 'source type')
        date.fromisoformat(source['reviewed'])
        sources.add(source['id'])

    def refs(value):
        return _strings(value) and bool(value) and set(value) <= sources

    _check(isinstance(content['entities'], list) and 0 < len(content['entities']) <= 2000, 'entities')
    ids, locations = set(), set()
    keys = {'id', 'kind', 'canonicalName', 'localizedNames', 'aliases', 'summary', 'region', 'tags',
            'spoilerLevel', 'spatialBinding', 'relatedLocations', 'relatedEntities', 'collectibles', 'secrets', 'sources', 'facts', 'notes'}
    for entity in content['entities']:
        _check(isinstance(entity, dict) and set(entity) == keys, 'entity shape (coordinates are forbidden)')
        _check(_id(entity['id']) and entity['id'] not in ids, 'duplicate/invalid entity ID')
        ids.add(entity['id'])
        _check(entity['kind'] in KINDS and entity['spoilerLevel'] in SPOILERS, 'kind/spoiler')
        _check(_text(entity['canonicalName'], 100) and _localized(entity['localizedNames']) and _localized(entity['summary']), 'five locales required')
        _check(entity['region'] in ('eastern', 'western', 'northern', 'wutai', 'islands', 'underwater', 'unknown'), 'region')
        _check(refs(entity['sources']), 'missing/broken source reference')
        for key in ('aliases', 'tags', 'relatedLocations', 'relatedEntities', 'collectibles', 'secrets', 'notes'):
            _check(_strings(entity[key]), key)
        binding = entity['spatialBinding']
        _check(isinstance(binding, dict) and binding.get('kind') in BINDINGS, 'binding kind')
        kind = binding['kind']
        expected = {'kind'} if kind in ('unresolved', 'non_spatial') else {'kind', 'locationId'}
        if kind == 'field_parent':
            expected.add('fieldNames')
        if kind == 'field_identity':
            expected = {'kind', 'fieldNames'}
        _check(set(binding) == expected, 'binding contains unsupported spatial data')
        if kind not in ('unresolved', 'non_spatial', 'field_identity'):
            _check(_id(binding['locationId']), 'location identity')
        if kind in ('field_parent', 'field_identity'):
            _check(_strings(binding['fieldNames']) and binding['fieldNames'] and all(re.fullmatch(r'[a-zA-Z0-9_-]{1,32}', name) for name in binding['fieldNames']), 'field names')
        _check(isinstance(entity['facts'], list) and len(entity['facts']) <= 30, 'facts')
        for fact in entity['facts']:
            _check(isinstance(fact, dict) and set(fact) == {'kind', 'text', 'spoilerLevel', 'sources'}, 'fact shape')
            _check(fact['kind'] in FACT_KINDS and _localized(fact['text']) and fact['spoilerLevel'] in SPOILERS and refs(fact['sources']), 'unsourced/invalid fact')
        if kind == 'location':
            _check(binding['locationId'] not in locations, 'duplicate named location coverage')
            locations.add(binding['locationId'])
    for entity in content['entities']:
        for key in ('relatedEntities', 'collectibles', 'secrets'):
            _check(set(entity[key]) <= ids and entity['id'] not in entity[key], 'broken/self relation')
        binding = entity['spatialBinding']
        if binding['kind'] in ('parent_location', 'field_parent'):
            _check(binding['locationId'] in locations, 'missing parent location entity')
        _check(set(entity['relatedLocations']) <= locations, 'invalid location relation')
    _check(isinstance(content['exclusions'], list), 'exclusions')
    excluded = set()
    for row in content['exclusions']:
        _check(isinstance(row, dict) and set(row) == {'locationId', 'reason'} and _id(row['locationId']) and _text(row['reason']) and row['locationId'] not in excluded | locations, 'invalid exclusion')
        excluded.add(row['locationId'])
    return content


def load_content():
    return validate_content(json.loads(curated_bytes()))


def bind_content(content, poi, transitions=None):
    """Bind only established identity; never nearest-match, interpolate or map Wiki text."""
    validate_content(content)
    _check(poi.get('schema') == 'gaiagis-poi' and poi.get('version') == 1, 'POI schema')
    locations = {row['id']: row for row in poi['locations']}
    entrances = {row['id']: row for row in poi['entrances']}
    covered = {e['spatialBinding'].get('locationId') for e in content['entities'] if e['spatialBinding']['kind'] == 'location'}
    excluded = {e['locationId'] for e in content['exclusions']}
    named = {l['id'] for l in poi['locations'] if l['name_source'] == 'manual_verified_field_identity'}
    _check(named <= covered | excluded, 'uncovered named locations: ' + ', '.join(sorted(named - covered - excluded)))
    bindings = {}
    for entity in content['entities']:
        request = entity['spatialBinding']
        kind, location = request['kind'], locations.get(request.get('locationId'))
        result = {'kind': kind, 'precision': 'unresolved', 'evidence': 'unresolved', 'locationId': None,
                  'entranceId': None, 'fieldNames': [], 'relatedEntrances': [], 'relatedTransitions': [], 'marker': False}
        if kind == 'non_spatial':
            result.update(precision='non_spatial', evidence='non_spatial')
        elif location:
            entrance = entrances.get(location['primary_entrance'])
            _check(entrance and entrance['location_id'] == location['id'] and entrance['source_kind'] == 'derived_from_entry_trigger', 'unverified POI anchor')
            _check(entrance['triangle_id'] in entrance['trigger_triangle_ids'] and entrance['script_calls'], 'missing binding evidence')
            result.update(locationId=location['id'], relatedEntrances=location['entrance_ids'])
            if kind == 'location':
                result.update(precision='entrance_level', evidence='existing_entrance', entranceId=entrance['id'], marker=True)
            elif kind == 'parent_location':
                result.update(precision='parent_place', evidence='parent_only')
            else:
                _check(set(request['fieldNames']) <= set(location['field_names']), 'field-parent identity mismatch')
                result.update(precision='field_only', evidence='field_link', fieldNames=request['fieldNames'])
            if transitions:
                result['relatedTransitions'] = sorted(t['id'] for t in transitions['transitions'] if t.get('from_map') == 'WM0' and t.get('field_name') in location['field_names'])
        bindings[entity['id']] = result
    return bindings


def build_atlas(directory: Path):
    directory = Path(directory)
    content = load_content()
    poi = json.loads((directory / 'gaia-poi.json').read_text(encoding='utf8'))
    transition_path = directory / 'gaia-transitions.json'
    transitions = json.loads(transition_path.read_text(encoding='utf8')) if transition_path.is_file() else None
    pack = {'schema': 'gaiagis-atlas', 'version': 1, 'curated_sha256': curated_hash(), 'content': content,
            'sources': poi['sources'], 'bindings': bind_content(content, poi, transitions)}
    # JSON contains identities, evidence and precision, never geographic numbers.
    target = output_path(directory / 'gaia-atlas.json')
    target.write_text(json.dumps(pack, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n', encoding='utf8')
    return pack
