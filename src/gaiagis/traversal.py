# SPDX-License-Identifier: GPL-3.0-only
"""Independent static classic-PC rules; not a runtime or reachability simulator.

The tiny JSON profile is shared with the Web evaluator. See v1.3 research for
the reference evidence, context overrides and current-executable limitation.
"""
from importlib.resources import files
import json

PROFILE = json.loads(files('gaiagis').joinpath('traversal_profiles.json').read_text())
PROFILES = {p['id']: p for p in PROFILE['profiles']}
STATES = ('allowed', 'conditional', 'blocked', 'unknown')


def _integer(value, maximum, name):
    if type(value) is not int or not 0 <= value <= maximum:
        raise ValueError(f'{name} must be an integer in 0..{maximum}')


def mask_allows(mask, terrain):
    _integer(terrain, 31, 'terrain')
    return bool(int(mask, 16) & (1 << terrain))


def chocobo_exit_height_compatible(current_height, candidate_height):
    """C_00752D02 local raw-unit sample gate; not a terrain slope filter."""
    if type(current_height) is not int or type(candidate_height) is not int:
        raise ValueError('Raw game heights must be integers')
    return abs(candidate_height - current_height) < 200


def evaluate(profile_id, terrain, script=0, *, origin=0):
    """Ordinary terrain occupancy; Highwind is an initiation diagnostic instead.

    Bridge history and movement/collision are deliberately not inferred here.
    Use reference_gate with explicit context for a local predicate diagnostic.
    """
    if profile_id not in PROFILES:
        raise ValueError(f'Unknown movement profile: {profile_id}')
    _integer(script, 7, 'script')
    if terrain is not None:
        _integer(terrain, 31, 'terrain')
    p = PROFILES[profile_id]
    state, reason, evidence = 'unknown', 'No WM0 source terrain', 'runtime_unknown'
    if not origin and terrain is not None:
        state = 'allowed' if mask_allows(p['mask'], terrain) else 'blocked'
        reason, evidence = 'Normal static terrain mask; not reachability', PROFILE['evidence']
        if profile_id == 'highwind-landing':
            if terrain == 27:
                state, reason, evidence = 'conditional', 'Northern Cave invokes script 9; not ordinary landing', 'script_dependent'
            elif terrain == 0 and script == 7:
                state, reason = 'conditional', 'Grass permits initiation; script 7 blocks exit-state destination gate'
    departure = 'unknown' if origin or terrain is None or p['departure_mask'] is None else (
        'allowed' if mask_allows(p['departure_mask'], terrain) else 'blocked')
    return dict(state=state, reason=reason, evidence=evidence, profile=profile_id,
                scope='landing_initiation' if profile_id == 'highwind-landing' else 'terrain_occupancy',
                terrain_compatible='unknown' if profile_id == 'highwind-landing' else state,
                movement_compatible='unknown', enter_exit_compatible='unknown',
                enter_exit_initiation=departure, runtime_available='not_simulated',
                compatibility_profile=PROFILE['compatibility_profile'])


def reference_gate(model_id, terrain_info, *, tint=0, current_terrain=None,
                   current_model=None, leave_state=0, airborne=False, flight_state=0):
    """A context-explicit reference predicate; unsupported model returns None.

    This is not a movement/landing success result. No code from a decompilation
    is executed; necessary bit/branch behavior is independently expressed.
    """
    _integer(terrain_info, 65535, 'terrain_info')
    _integer(leave_state, 2, 'leave_state')
    if current_terrain is not None:
        _integer(current_terrain, 31, 'current_terrain')
    terrain, script = terrain_info & 31, (terrain_info >> 5) & 7
    bridge = current_model == model_id and current_terrain in (13, 14)
    in_mask = lambda m: mask_allows(m, terrain)
    if model_id in (0, 1, 2):
        return in_mask(PROFILE['bridge_mask'] if bridge else PROFILES['foot']['mask'])
    if model_id in (4, 19):
        _integer(tint, 4, 'tint')
        p = next(p for p in PROFILES.values() if p['tint'] == tint)
        mask = PROFILES['chocobo-yellow']['mask'] if model_id == 4 or leave_state == 2 else p['mask']
        return in_mask(PROFILE['bridge_mask'] if bridge else mask) and (leave_state != 2 or script != 7)
    if model_id == 5:
        return (in_mask('0x70') if leave_state == 2 or flight_state < 0 else True) if airborne else in_mask('0x20800' if leave_state == 2 else '0x70')
    if model_id in (3, 6, 13):
        if leave_state == 2:
            return in_mask(PROFILE['foot_exit_mask']) and script != 7
        if model_id == 3:
            return flight_state >= 0 or terrain == 0
        return in_mask(PROFILES['buggy' if model_id == 6 else 'submarine-surface']['mask'])
    if model_id == 8:
        return in_mask('0x04040008')
    if model_id == 100:
        return terrain == 7
    return None
