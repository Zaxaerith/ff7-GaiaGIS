# Public CI and private local testing

GitHub main distributes the Web source and Web test suite. Web CI runs `npm ci`,
`npm test`, `npm run build`, `npm run build:release` and `npm run audit:release`
from `web/`. It does not depend on the private Python `tests/` directory.

The existing development checkout retains its Python tests and local QA/research
scripts byte-for-byte, ignored and untracked. A fresh clone does not contain them;
they are not downloaded or recreated automatically. In an existing private checkout,
the application runner remains usable:

```powershell
python -B scripts/test_application.py --source "YOUR_FF7_INSTALLATION"
```

This runner excludes sealed climate tests. FF7 inputs remain read-only and all
outputs stay inside the workspace. Private browser QA scripts and the versioned
navigation performance harness also remain available locally.

Distribution excludes local Python test runners, climate regression/fixture/report
helpers, the native-map research probe, browser QA harnesses and the private
navigation benchmark. Product dataset generators, launchers, validators, source
and release audits, mathematical projection fixtures, asset measurement, build
tools and license notices remain tracked. Research launchers and safety audits
are retained; their local test modes require the private files above.

The removal uses ordinary commits and `git rm --cached`; old commits, tags and
Releases are preserved. This changes current-tree distribution, not historical
availability. Public delivery remains code-only.
