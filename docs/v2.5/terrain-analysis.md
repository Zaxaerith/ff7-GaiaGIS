# Route terrain composition

Input and segment geometry are shared with Route Profile. Each leg belongs to one
source face; the verified shared-edge midpoint splits adjacent terrain faces.
Source registry IDs/names from existing metadata remain the authority, including
unknown/special source classes. No ecological land cover is inferred.

For terrain t: distance(t) = sum of segment lengths owned by faces with terrain t.
Percentage = distance(t)/total sampled corridor distance × 100. Triangle counts
are never the weighting variable. The synthetic equal 50 m Grass/50 m Forest case
produces 50/50%; unequal face lengths produce unequal percentages.

The existing From/To, movement profile and conditional inputs determine the route.
Changing them clears obsolete summaries. The result table and methodology share
the existing Analysis card/scroll tokens. Public/source-missing mode is unavailable;
WM2/WM3 are not given fabricated global analysis. See validation.md for a real
route composition and the combined single-traversal timing.
