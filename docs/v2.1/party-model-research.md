# Party asset research — v2.1

## Observed resources
world_us.lgp contains the existing verified world-map leaders Cloud bbe.hrc (21 bones), Tifa dlb.hrc (24), Cid ata.hrc (21). Keep those exact sources. char.lgp is 48,989,867 bytes and contains 385 HRC resources. Independently decoded candidates: Barret acgd.hrc/sd_ballet_sk/21, Aerith auff.hrc/n_earith_sk/23, Red XIII adda.hrc/sd_red_sk/29, Yuffie abjb.hrc/sd_yufi_sk/24, Cait Sith aebc.hrc/sd_ketcy_sk/28, Vincent aehd.hrc/sd_vincent_sk/25. Identity is cross-checked with internal field model loader names, not screenshots.

## Animation evidence
[Field section-3 layout](https://wiki.ffrtt.ru/index.php/FF7/Field/Model_Loader) describes model HRC names, source scale and ordered A-file bindings. The actual blackbg1 payload confirms record sizes and complete consumption: its Aerith binds avbf/avca/avcb, Barret adcb/adcc/adcd and Red XIII aeae/aeaf/aeba. These animation files match each corresponding skeleton exactly. The [Ifalna-derived reference inventory](https://github.com/maciej-trebacz/ff7-lgp-explorer/blob/main/src/assets/model-animations.json) is a discovery hint only, not copied or used at runtime. Additional model bindings require actual source evidence. A matching bone count alone is insufficient for retargeting.

## Classification and boundaries
Six added characters are **Extended Explorer models: original FF7 field assets, not original world-map leader assets**. Use actual field-loader animation bindings where structurally compatible; otherwise static/limited preview. No invented animation or lore identity. Preserve Explorer transport v2 and old v1/v2 loading. Registry additions are optional, independently validated. Source-unit conversion, ground contact and forward axis must be checked from posed geometry and private QA; animation speed is still preview 30 fps.

## Final source binding inventory

| Character | Source HRC | Bones | Actual field loader | Idle / move / third source clip (frames) | Class |
|---|---|---:|---|---|---|
| Cloud | world_us.lgp: bbe.hrc | 21 | original world registry | bid 1 / bie 15 (existing bindings) | World-map leader |
| Tifa | world_us.lgp: dlb.hrc | 24 | original world registry | dse 1 / dta 15 (existing bindings) | World-map leader |
| Cid | world_us.lgp: ata.hrc | 21 | original world registry | aze 1 / baa 15 (existing bindings) | World-map leader |
| Barret | char.lgp: acgd.hrc | 21 | flevel.lgp: blackbg1 | adcb 1 / adcc 30 / adcd 15 | Extended field, Tier A |
| Aerith | char.lgp: auff.hrc | 23 | blackbg1 | avbf 2 / avca 20 / avcb 15 | Extended field, Tier A |
| Red XIII | char.lgp: adda.hrc | 29 | blackbg1 | aeae 1 / aeaf 20 / aeba 15 | Extended field, Tier A |
| Yuffie | char.lgp: abjb.hrc | 24 | blackbg4 | acfb 2 / acfc 25 / acfd 14 | Extended field, Tier A |
| Cait Sith | char.lgp: aebc.hrc | 28 | blackbg5 | aeha 2 / aehb 30 / aehc 15 | Extended field, Tier A |
| Vincent | char.lgp: aehd.hrc | 25 | blackbgi | afdf 2 / afea 30 / afeb 15 | Extended field, Tier A |

Tier A means its own original field-loader animation binding; it does not mean a verified world leader or Steam 2026 animation timing. Vincent's own 25-bone binding is used instead of a discovery-list suggestion involving 21-bone Cloud clips. Red XIII and Cait Sith use their own skeleton/animations. There is no retargeting, procedural gait or fan model. Every HRC→RSD→P→TEX reference is validated. Actual idle and move frames produce finite bone matrices, and all nine models pass switching and ground-bound checks in the browser.

Field-loader source scale is retained as provenance. Extended models are normalized for navigation display to heights 510 (Barret), 270 (Red XIII), 500 (Cait Sith), 450 raw display units (others). These are explicit reconstructed display sizes, not physical/canonical heights or source-coordinate changes. Cloud/Tifa/Cid retain scale 15.2. The model frame uses the established complete source-frame rotation; bone lengths, Euler order and original animation values remain source-local. Old packs retain original eight models and show the six missing characters disabled. Extended model IDs are null, never invented WM runtime IDs.
