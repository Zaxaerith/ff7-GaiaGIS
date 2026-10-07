# SPDX-License-Identifier: GPL-3.0-only
"""Unified product CLI. Module-specific and old installed entry points remain compatible."""
import argparse
import importlib
import sys
from ._version import __version__
COMMANDS={'local':'local','validate':'cli','build-workspace':'build_workspace','build-sphere':'sphere_cli'}
def main(argv=None):
    args=list(sys.argv[1:] if argv is None else argv)
    if args==['--version']:print(__version__);return 0
    if args and args[0] in COMMANDS:
        return importlib.import_module('.'+COMMANDS[args.pop(0)],__package__).main(args)
    if args and args[0] not in ('-h','--help'):
        # Retain the original python -m gaiagis --source ... validation interface.
        from .cli import main as validate
        return validate(args)
    parser=argparse.ArgumentParser(description='GaiaGIS read-only local GIS tools')
    parser.add_argument('--version',action='version',version=__version__)
    parser.add_argument('command',choices=COMMANDS)
    parser.print_help();return 0
if __name__=='__main__':raise SystemExit(main())
