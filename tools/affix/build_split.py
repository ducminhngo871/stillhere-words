import json,sys,re
import os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from lex import *
import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
d=json.load(open(os.path.join(ROOT,'data/sat/sat.json')))
cores=sorted({x['core'] for x in d['words']})
ROOTMAP={r[0]:r for r in ROOTS}
pre=[(f,p[0]) for p in PREFIXES if p[0]!="in- (vào)" for f in p[1]]
lead=[]
for rid,forms,*_ in ROOTS:
    for f in forms:
        if f in LEAD_ROOTS: lead.append((f,rid))
suf=sorted([(f,s[0]) for s in SUFFIXES for f in s[1]],key=lambda x:-len(x[0]))
def decomp_pre(s):
    if s=='': return [[]]
    out=[]
    for f,pid in pre:
        if s.startswith(f):
            for rest in decomp_pre(s[len(f):]): out.append([(f,'p',pid)]+rest)
    for f,rid in lead:
        if s.startswith(f):
            for rest in decomp_pre(s[len(f):]): out.append([(f,'r',rid)]+rest)
    return out
def decomp_suf(s,depth=0):
    if s=='': return [[]]
    if depth>3: return []
    out=[]
    for f,sid in suf:
        if s.startswith(f):
            for rest in decomp_suf(s[len(f):],depth+1): out.append([(f,'s',sid)]+rest)
    if s[0] in 'iuaoe' and len(s)>1:
        for f,sid in suf:
            if s[1:].startswith(f):
                for rest in decomp_suf(s[1+len(f):],depth+1): out.append([(s[0]+f,'s',sid)]+rest)
    if s in ('e','s','es','d','ed','ing'): out.append([(s,'s','-'+s)])
    return out
res={}
for w in cores:
    if ' ' in w or w in DROP: continue
    best=None
    for rid,forms,vi,en,org in ROOTS:
        for f in forms:
            i=w.find(f)
            while i>=0:
                P=decomp_pre(w[:i]); S=decomp_suf(w[i+len(f):])
                if P and S:
                    for p in P:
                        cand=p+[(f,'r',rid)]+min(S,key=len)
                        score=len(f)*3-len(cand)+sum(2 for x in p if x[1]=='r')
                        if best is None or score>best[0]: best=(score,cand)
                i=w.find(f,i+1)
    if not best: continue
    parts=[list(x) for x in best[1]]
    # merge trailing tiny inflection pieces into previous suffix
    merged=[]
    for a,t,b in parts:
        if t=='s' and b in ('-ed','-ing'): merged.append([a,'s','-ed' if b=='-ed' else '-ing']); continue
        if t=='s' and b in ('-e','-s','-es','-d') and merged: merged[-1][0]+=a; continue
        merged.append([a,t,b])
    for m in merged:
        if m[1]=='p' and m[2]=='in- (không)' and w in IN_INTO: m[2]='in- (vào)'
        if w in PREFIX_FIX and m[1]=='p' and m[0] in PREFIX_FIX[w]: m[2]=PREFIX_FIX[w][m[0]]
    assert ''.join(m[0] for m in merged)==w,(w,merged)
    res[w]=merged
json.dump(res,open(os.path.join(ROOT,'data/affix/splits.json'),'w'),ensure_ascii=False)
print(len(res))
new=[w for w in res if any(m[1]=='r' for m in res[w][:-1] if m!=res[w][[x[1] for x in res[w]].index('r')])]
for w,c in sorted(res.items()):
    if sum(1 for m in c if m[1]=='r')>1 or w.startswith(('bene','mal','equ','uni','omni','magn','ambi','homo','hetero','ana','in','im')): print(w,'=',' | '.join(f"{a}({t}:{b})" for a,t,b in c))
