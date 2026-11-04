"""Two bounded Field CFG identities. A language label is never authority."""
# SPDX-License-Identifier: GPL-3.0-only
LEGACY = 'legacy-stop'
CMUSC8 = 'field-cfg-en-cmusc8-1'
EN_ARCHIVE = 'af695ccf7c681be222f5f716758160e39469ec02bc0af3dd6f20a5e9c2a34807'
MAPLIST = 'd6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29'


def source_decoder(sources):
    return CMUSC8 if sources.get('flevel.lgp') == EN_ARCHIVE and sources.get('maplist') == MAPLIST and not any(k in sources for k in ('fflevel.lgp','gflevel.lgp','sflevel.lgp')) else LEGACY


def context_decoder(context):
    decoder = context.get('scriptDecoder') if context.get('version', 1) >= 6 else context.get('scriptDecoder', LEGACY)
    if decoder not in (LEGACY, CMUSC8) or decoder == CMUSC8 and source_decoder(context['sources']) != CMUSC8:
        raise ValueError('Unverified Field CFG decoder source')
    if context.get('version', 1) < 6 and decoder != LEGACY:
        raise ValueError('Legacy Context cannot carry recovered CFG')
    return decoder


def evidence_identity(kind, context):
    """Legacy Contexts keep their original transport and revision."""
    decoder = context_decoder(context)
    version = 2 if context.get('version', 1) >= 6 else 1
    return version, f'{kind}-{version}', decoder


def validate_profile(meta, kind, context=None):
    version = meta.get('version')
    if type(version) is not int or version not in (1, 2) or meta.get('generator_revision') != f'{kind}-{version}':
        raise ValueError('Field evidence version/generator')
    decoder = LEGACY if version == 1 else meta.get('decoder')
    if decoder not in (LEGACY, CMUSC8) or decoder == CMUSC8 and source_decoder(meta['sources']) != CMUSC8:
        raise ValueError('Field evidence decoder/source')
    if context is not None and (decoder != context_decoder(context) or (context.get('version', 1) >= 6) != (version == 2)):
        raise ValueError('Field evidence mixed CFG generations')
    return decoder
