"""Source-checkout entry point; installed distributions use src/gaiagis directly."""
# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
from importlib.util import spec_from_file_location

_source = Path(__file__).resolve().parents[1] / 'src' / 'gaiagis'
__path__ = [str(_source)]
__spec__ = spec_from_file_location(__name__, _source / '__init__.py', submodule_search_locations=__path__)
__loader__ = __spec__.loader
__file__ = __spec__.origin
