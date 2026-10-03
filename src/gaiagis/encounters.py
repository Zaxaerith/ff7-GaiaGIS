"""Independent read-only enc_w.bin decoder. Behavioral evidence: docs/v1.2/.

No game execution, battle simulator, asset rewriting or projection mathematics.
"""
# SPDX-License-Identifier: GPL-3.0-only
import hashlib
import json
from pathlib import Path
import struct

from .dataset import discover
from .lgp import inventory, read_entry
from .lzss import FormatError
from .safety import output_path

YUFFIE_COUNT = 8
RATING_COUNT = 32
REGION_COUNT = 16
SETS_PER_REGION = 4
SET_BYTES = 32
TABLE_OFFSET = YUFFIE_COUNT * 4 + RATING_COUNT * 4
ENC_W_BYTES = TABLE_OFFSET + REGION_COUNT * SETS_PER_REGION * SET_BYTES
FORMATION_MASK = 0x3ff
WEIGHT_SHIFT = 10
GROUPS = (('normal', 6), ('back_attack', 2), ('side_attack', 1),
          ('both_sides', 1), ('chocobo', 4))

# Format facts independently transcribed from the classic PC lookup, not source code.
# First match wins; repeated zero entries are unreachable for Grass.
TERRAIN_LOOKUP = (
    (0,9,0,17), (0,0,0,17), (0,9,1,17), (0,20,0,17),
    (0,9,8,17), (0,0,25,17), (0,9,19,17), (0,0,1,17),
    (0,0,1,17), (0,9,14,17), (0,9,25,17), (0,10,9,17),
    (0,9,25,17), (0,0,8,11), (0,0,8,0), (0,0,1,0),
)
YUFFIE_THRESHOLDS = (0,0,32,0,0,64,0,64,255,0,128,0,128,0,0,128)
TERRAIN_ALIASES = {16:0, 24:8}

def decode_record(packed: int, kind: str, offset: int) -> dict:
    return dict(scene_id=packed & FORMATION_MASK, weight=packed >> WEIGHT_SHIFT,
                packed=packed, encounter_type=kind, byte_offset=offset)

def parse_encounters(data: bytes) -> dict:
    if len(data) != ENC_W_BYTES:
        raise FormatError(f'enc_w.bin requires {ENC_W_BYTES} bytes, got {len(data)}')
    yuffie = []
    for i in range(YUFFIE_COUNT):
        level, scene = struct.unpack_from('<HH', data, i*4)
        if i and level < yuffie[-1]['level_max']:
            raise FormatError('Yuffie level upper bounds must be nondecreasing')
        yuffie.append(dict(level_max=level, scene_id=scene & FORMATION_MASK,
                           raw_scene_id=scene, byte_offset=i*4))
    ratings = []
    for i in range(RATING_COUNT):
        offset = 32+i*4
        scene, rating = struct.unpack_from('<HH', data, offset)
        ratings.append(dict(scene_id=scene, rating=rating, valid=scene<=FORMATION_MASK,
                            byte_offset=offset))
    sets = []
    for region in range(REGION_COUNT):
        for slot in range(SETS_PER_REGION):
            offset = TABLE_OFFSET+(region*SETS_PER_REGION+slot)*SET_BYTES
            records = {}; pos = offset+2
            for kind, count in GROUPS:
                records[kind] = []
                for _ in range(count):
                    records[kind].append(decode_record(struct.unpack_from('<H',data,pos)[0],kind,pos))
                    pos += 2
            sets.append(dict(id=f'{region}:{slot}',region_id=region,slot=slot,
                byte_offset=offset,active_raw=data[offset],active=bool(data[offset]&1),
                encounter_rate=data[offset+1],padding_hex=data[offset+30:offset+32].hex(),
                records=records))
    return dict(yuffie=yuffie,chocobo_ratings=ratings,encounter_sets=sets)

def resolve_encounter(asset: dict, region_id: int, terrain_id: int) -> dict:
    if not isinstance(region_id,int) or not isinstance(terrain_id,int) or not 0<=terrain_id<=31:
        raise ValueError('Integer region and terrain 0..31 required')
    region = min(15,max(0,region_id))
    effective = TERRAIN_ALIASES.get(terrain_id,terrain_id)
    row = TERRAIN_LOOKUP[region]
    matched = effective in row
    slot = row.index(effective) if matched else 0
    table = asset['encounter_sets'][region*4+slot]
    return dict(source_region=region_id,effective_region=region,source_terrain=terrain_id,
        effective_terrain=effective,slot=slot,fallback=not matched,encounter_set=table,
        yuffie_threshold=YUFFIE_THRESHOLDS[region],yuffie_terrain=terrain_id in (1,25))

def yuffie_scene(asset: dict, cloud_level: int, terrain_id: int) -> int:
    """Conditional identity only. Does not evaluate eligibility or random chance."""
    if not isinstance(cloud_level,int) or cloud_level<0 or terrain_id not in (1,25):
        raise ValueError('Nonnegative Cloud level and Forest/Jungle required')
    row = next((r for r in asset['yuffie'] if cloud_level<=r['level_max']),asset['yuffie'][-1])
    return row['scene_id']+(terrain_id==25)

def chocobo_rating(asset: dict, scene_id: int) -> int|None:
    return next((r['rating'] for r in asset['chocobo_ratings'] if r['valid'] and r['scene_id']==scene_id),None)

def build_encounters(source: Path, destination: Path) -> dict:
    destination = output_path(destination)
    ds = discover(source)
    if destination.is_relative_to(ds.wm_directory):
        raise ValueError('Output cannot be in the selected WM source directory')
    archive = ds.files['world_us.lgp']
    matches = [e for e in inventory(archive)['entries'] if e['filename'].casefold()=='enc_w.bin']
    if len(matches)!=1:
        raise FormatError('Expected exactly one enc_w.bin in world_us.lgp')
    entry = matches[0]; payload = read_entry(archive,entry)
    asset = dict(schema='gaiagis-encounters',version=1,reconstruction='v1-geometric-gaia',
        lookup_profile='classic-pc-reference',runtime_equivalence='not-verified-steam2026',
        sources={'wm0.map':hashlib.sha256(ds.files['wm0.map'].read_bytes()).hexdigest(),
                 'world_us.lgp':hashlib.sha256(archive.read_bytes()).hexdigest(),
                 'enc_w.bin':hashlib.sha256(payload).hexdigest()},
        source_record=dict(filename='enc_w.bin',size=len(payload),toc_index=entry['toc_index'],
                           archive_data_offset=entry['data_offset']),
        regions=[dict(id=i,terrain_slots=list(TERRAIN_LOOKUP[i]),yuffie_threshold=YUFFIE_THRESHOLDS[i]) for i in range(16)],
        terrain_aliases=[dict(source=k,effective=v) for k,v in sorted(TERRAIN_ALIASES.items())],
        **parse_encounters(payload))
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(asset,sort_keys=True,separators=(',',':'),ensure_ascii=False)+'\n',encoding='utf-8')
    return asset
