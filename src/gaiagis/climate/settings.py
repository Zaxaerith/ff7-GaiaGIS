# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import tomllib
ROOT=Path(__file__).resolve().parents[3]
def settings():
    with (ROOT/'config/climate/earthlike_gaia.toml').open('rb') as f:return tomllib.load(f)
def evidence_settings():
    with (ROOT/'config/climate/evidence_weights.toml').open('rb') as f:return tomllib.load(f)
