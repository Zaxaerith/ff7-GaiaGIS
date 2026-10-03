import sys
if len(sys.argv)>1 and sys.argv[1]=="build-sphere":
    from .sphere_cli import main
    raise SystemExit(main(sys.argv[2:]))
from .cli import main
raise SystemExit(main())
