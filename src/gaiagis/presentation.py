"""Bounded, independent audio.fmt/MS ADPCM reader for private UI cues only."""
# SPDX-License-Identifier: GPL-3.0-only
import base64
import hashlib
import io
import json
from pathlib import Path
import struct
import wave
from .dataset import discover,child_ci
from .lzss import FormatError
from .safety import output_path

ADAPTATION=(230,230,230,230,307,409,512,614,768,614,512,409,307,230,230,230)
GENERATOR_VERSION='presentation-menu-2'
# Zero-based audio.fmt records, NOT the game's one-based SFX IDs.
# Ordinary menu acceptance shares the cursor chime. Record 1 is a distinct
# load-save jingle, not a generic button confirmation. See docs/research/explorer-assets.md.
CUE_IDS={'cursor':0,'confirm':0,'cancel':3,'invalid':2}

def parse_audio_fmt(data,dat_size):
    pos=0;rows=[]
    while pos<len(data):
        if len(rows)>=1000 or pos+42>len(data):raise FormatError('Truncated audio.fmt record')
        start=pos;size,offset,loop,loop_start,adpcm_start,loop_end=struct.unpack_from('<6I',data,pos)
        tag,channels,rate,average,align,bits,extra=struct.unpack_from('<HHIIHHH',data,pos+24)
        pos+=42
        # Unused records contain 0xCD allocator markers; cbSize is meaningful
        # only for ADPCM in the classic reader, not a generic record length.
        extra=extra if tag==2 else 0
        if extra>256 or pos+extra>len(data) or offset+size>dat_size or size and (channels not in (1,2) or not 8000<=rate<=96000 or tag not in (1,2) or loop not in (0,1)):raise FormatError('Invalid audio.fmt bounds/format')
        extension=data[pos:pos+extra];pos+=extra
        rows.append(dict(index=len(rows),fmt_offset=start,size=size,offset=offset,loop=bool(loop),loop_start=loop_start,adpcm_start=adpcm_start,loop_end=loop_end,format=tag,channels=channels,sample_rate=rate,average=average,block_align=align,bits=bits,extra=extension))
    return rows

def decode_ms_adpcm(data,record):
    """Mono Microsoft ADPCM only; no permissive fallback to another codec."""
    extra=record['extra'];align=record['block_align']
    if record['format']!=2 or record['channels']!=1 or record['bits']!=4 or len(extra)<4 or align<7:raise FormatError('Unsupported UI ADPCM format')
    samples,count=struct.unpack_from('<HH',extra)
    if count==0 or count>32 or len(extra)!=4+4*count or samples!=2+(align-7)*2:raise FormatError('ADPCM coefficient/block layout')
    coefficients=[struct.unpack_from('<hh',extra,4+i*4) for i in range(count)];out=[]
    for start in range(0,len(data),align):
        block=data[start:start+align]
        if len(block)<7:raise FormatError('Truncated ADPCM block')
        predictor=block[0]
        if predictor>=count:raise FormatError('ADPCM predictor index')
        delta,sample1,sample2=struct.unpack_from('<Hhh',block,1);delta=max(16,delta);a,b=coefficients[predictor];out.extend((sample2,sample1))
        for byte in block[7:]:
            for nibble in (byte>>4,byte&15):
                signed=nibble if nibble<8 else nibble-16
                # Integer truncation toward zero, independently from floating audio.
                prediction=int((sample1*a+sample2*b)/256)+signed*delta
                value=max(-32768,min(32767,prediction));out.append(value);sample2,sample1=sample1,value
                delta=max(16,ADAPTATION[nibble]*delta//256)
    return struct.pack('<'+'h'*len(out),*out)

def pcm_wav(pcm,rate):
    out=io.BytesIO()
    with wave.open(out,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm)
    return out.getvalue()

def build_presentation(source:Path,destination:Path):
    ds=discover(source);sound=child_ci(ds.wm_directory.parent,'sound')
    fmt=child_ci(sound,'audio.fmt') if sound else None;dat=child_ci(sound,'audio.dat') if sound else None
    if not fmt or not dat:raise ValueError('Optional original UI audio unavailable: audio.fmt/audio.dat')
    f=fmt.read_bytes();rows=parse_audio_fmt(f,dat.stat().st_size);audio=[]
    with dat.open('rb') as stream:
        for cue,index in sorted(CUE_IDS.items()):
            if index>=len(rows):raise FormatError('Missing UI audio record')
            r=rows[index]
            if r['loop'] or not 7<=r['size']<=100000:raise FormatError('UI cue must be bounded and non-looping')
            stream.seek(r['offset']);compressed=stream.read(r['size'])
            if len(compressed)!=r['size']:raise FormatError('Truncated UI sample')
            pcm=decode_ms_adpcm(compressed,r);wav=pcm_wav(pcm,r['sample_rate'])
            audio.append(dict(id=cue,wav=base64.b64encode(wav).decode(),source_record=index,loop=False,source_file='audio.dat',fmt_byte_offset=r['fmt_offset'],data_byte_offset=r['offset'],compressed_bytes=r['size'],sample_rate=r['sample_rate'],channels=1,encoding='PCM16LE',original_codec='Microsoft ADPCM',decoded_samples=len(pcm)//2,evidence='zero_based_menu_record_reference_and_actual_audio_record'))
    result=dict(schema='gaiagis-presentation',version=1,generator_revision=GENERATOR_VERSION,sources={'audio.fmt':hashlib.sha256(f).hexdigest(),'audio.dat':hashlib.sha256(dat.read_bytes()).hexdigest()},audio=audio,unresolved_cues=['open'],runtime_equivalence='NOT VERIFIED')
    target=output_path(destination);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(result,sort_keys=True,separators=(',',':'))+'\n',encoding='utf8')
    return dict(bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),records=len(rows),cues=[a['id'] for a in audio],source_modified='NO')
