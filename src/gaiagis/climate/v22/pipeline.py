import argparse
def main():
    p=argparse.ArgumentParser();p.add_argument('phase',choices=['pet','soil','soil-fix','precipitation','overlap','gate','report']);a=p.parse_args()
    if a.phase=='pet':
        from .pet_reference import prepare
        prepare()
    elif a.phase in ['soil','precipitation']:
        from . import diagnostics
        getattr(diagnostics,a.phase)()
    elif a.phase=='gate':
        from .gate import run
        run()
    elif a.phase=='overlap':
        from .overlap import run
        run()
    elif a.phase=='soil-fix':
        from .periodic_bucket import run
        run()
    elif a.phase=='report':
        from .report import run
        run()
    else:raise SystemExit('Phase implementation pending: '+a.phase)
if __name__=='__main__':main()
