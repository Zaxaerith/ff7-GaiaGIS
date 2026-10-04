"""Shared read-only EV decoder extracted from the v1.1 entrance parser."""
# SPDX-License-Identifier: GPL-3.0-only
from dataclasses import dataclass
import struct
from .lzss import FormatError

CALL_TABLE_BYTES = 0x400
PUSH_CONSTANT, ENTER_FIELD = 0x110, 0x318
RETURN, JUMP, BRANCH_FALSE = 0x203, 0x200, 0x201

@dataclass(frozen=True)
class Function:
    table: int
    header: int
    start: int
    end: int
    @property
    def kind(self): return self.header >> 14
    @property
    def model(self): return (self.header >> 8) & 63 if self.kind == 1 else None
    @property
    def id(self): return self.header & (15 if self.kind == 2 else 255)

def decode_ev(data):
    if len(data) < CALL_TABLE_BYTES or len(data) % 2:
        raise FormatError('Truncated EV table/code')
    words = struct.unpack_from('<'+'H'*((len(data)-CALL_TABLE_BYTES)//2), data, CALL_TABLE_BYTES)
    records = []
    for table in range(1,256):
        header,start = struct.unpack_from('<HH',data,table*4)
        if header == 65535: continue
        if header >> 14 > 2 or not 0 < start < len(words):
            raise FormatError('Invalid EV call record')
        records.append((table,header,start))
    functions=[]; intervals={}
    for table,header,start in records:
        end=min([s for _,_,s in records if s>start]+[len(words)])
        functions.append(Function(table,header,start,end))
        if start in intervals: continue
        instructions={};pc=start
        while pc<end:
            op=words[pc];size=2 if 0x100<op<0x200 or op in (JUMP,BRANCH_FALSE) else 1
            if op>0x355 or pc+size>end:
                raise FormatError(f'Invalid EV instruction at word {pc}')
            instructions[pc]=(op,words[pc+1] if size==2 else None,pc+size)
            pc+=size
        intervals[start]=instructions
    return functions,intervals

def basic_blocks(function, instructions):
    leaders={function.start}
    for pc,(op,arg,nxt) in instructions.items():
        if op in (JUMP,BRANCH_FALSE):
            if arg not in instructions: raise FormatError(f'EV branch into operand/outside function: {arg}')
            leaders.add(arg)
        if op in (JUMP,BRANCH_FALSE,RETURN) and nxt in instructions: leaders.add(nxt)
    ordered=sorted(leaders)
    return {pc:max(x for x in ordered if x<=pc) for pc in instructions}
