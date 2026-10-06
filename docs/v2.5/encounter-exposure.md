# Static encounter exposure

The same solved corridor legs read existing face region/terrain/Chocobo flags.
The unchanged v1.2 `resolveEncounter` owner applies classic-PC region clamp,
terrain aliases and fallback slot policy. Distances aggregate by resolved source
encounter-set ID. A set can cover multiple region/terrain inputs; source scene
IDs for each encounter table remain inspectable. Set active/rate/record semantics
and source bytes are unchanged.

Chocobo-eligible exposure reports distance with the original face Chocobo flag.
It is a static source-flag measure; it does not promise an eligible runtime vehicle,
story/save state or encounter. Missing encounter data is explicit; route profile
and terrain composition continue independently.

This module has no RNG, step counter, encounter occurrence model, expected battle
count or probability calculation. Coverage of an inactive/fallback set still means
source lookup coverage, not encounters actually occurring. Distances/percentages
refer to the sampled TIN corridor on the assumed V1 sphere. Synthetic tests verify
lookup and distance conservation; private real-source results are in validation.md.
