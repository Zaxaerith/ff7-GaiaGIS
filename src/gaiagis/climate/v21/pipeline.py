import argparse
from ..grid import Grid
from .earth_data import prepare
def main():
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['earth-data','earth','rasters','synthetic','ensemble','report']);parser.add_argument('--rebuild',action='store_true');args=parser.parse_args()
    if args.phase=='earth-data':prepare(Grid(2.5));print('Earth references prepared')
    elif args.phase=='earth':
        from .benchmark import run_earth
        run_earth()
    elif args.phase=='rasters':
        from .rasterization import run_rasters
        run_rasters(Grid(2.5),args.rebuild)
    elif args.phase=='synthetic':
        from .synthetic import run_synthetic
        run_synthetic()
    elif args.phase=='ensemble':
        from .ensemble import run_ensemble
        run_ensemble(Grid(2.5))
    elif args.phase=='report':
        from .report import run_report
        run_report(Grid(2.5))
if __name__=='__main__':main()
