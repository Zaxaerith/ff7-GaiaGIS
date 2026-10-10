# SPDX-License-Identifier: GPL-3.0-only
import os
import sys

# Finder/open arguments must establish the root before importing safety/exporters.
if '--workspace-root' in sys.argv:
    index=sys.argv.index('--workspace-root')
    if sys.platform!='darwin' or index+1>=len(sys.argv):raise SystemExit('--workspace-root requires a macOS application and an absolute directory')
    os.environ['GAIAGIS_WORKSPACE_ROOT']=sys.argv[index+1]
    del sys.argv[index:index+2]
from gaiagis.portable import main
if __name__=='__main__':raise SystemExit(main())
