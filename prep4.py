#!/usr/bin/env python3
"""English translations aligned to the Hebrew texts (public-domain / CC licensed versions only)."""
import json, os, re
SRC = os.path.expanduser('~/sefaria/archive/json')
OUT = '/home/claude/app/www/data'
def load(p): return json.load(open(os.path.join(SRC, p), encoding='utf-8'))
def write(key, obj):
    s = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(OUT, key + '.js'), 'w', encoding='utf-8').write('window.D=window.D||{};D[%s]=%s;' % (json.dumps(key), s))
    return len(s)
def drop_footnotes(s):
    # remove <i class="footnote">…</i>, which may contain nested <i>…</i>
    out, i = [], 0
    while True:
        j = s.find('<i class="footnote">', i)
        if j < 0:
            out.append(s[i:]); break
        out.append(s[i:j])
        depth, k = 0, j
        while k < len(s):
            if s.startswith('<i', k) and (s[k+2] in ' >'):
                depth += 1; k = s.index('>', k) + 1
            elif s.startswith('</i>', k):
                depth -= 1; k += 4
                if depth == 0: break
            else:
                k += 1
        i = k
    return ''.join(out)
def clean(s):
    s = re.sub(r'<sup[^>]*>.*?</sup>', '', s)
    s = drop_footnotes(s)
    s = re.sub(r'<(?!/?(b|i|small|br)\b)[^>]+>', '', s)
    return re.sub(r'\s+', ' ', s).strip()
def align(heb, ens):
    """Mirror the Hebrew structure; at each leaf take the first non-empty English string."""
    if isinstance(heb, dict):
        return {k: align(v, [e.get(k) if isinstance(e, dict) else None for e in ens]) for k, v in heb.items()}
    if isinstance(heb, list):
        return [align(v, [e[i] if isinstance(e, list) and i < len(e) else None for e in ens]) for i, v in enumerate(heb)]
    for e in ens:
        if isinstance(e, str) and e.strip():
            return clean(e)
    return ''
def heb_struct(key):
    s = open(os.path.join(OUT, key + '.js'), encoding='utf-8').read()
    return json.loads(s[s.index('=', 25) + 1:-1])
SID = 'Liturgy/Siddur/%s/English/%s.json'
MET = 'Translation based on the Metsudah linear siddur, by Avrohom Davis, 1981'
COM = 'Sefaria Community Translation'
total = 0
for key, book, versions in [
    ('sefard', 'Siddur Sefard', [MET, COM]),
    ('ashkenaz', 'Siddur Ashkenaz', [MET, 'The Standard Prayer Book, tr. by Simeon Singer, [1915]', COM]),
    ('edot', 'Siddur Edot HaMizrach', [COM]),
]:
    ens = [load(SID % (book, v))['text'] for v in versions]
    al = align(heb_struct(key), ens)
    filled = sum(1 for _ in re.finditer(r'"[^"]{3,}', json.dumps(al, ensure_ascii=False)))
    total += write('en_' + key, al)
    print(key, 'aligned')
k = 'Halakhah/Kitzur Shulchan Arukh/English/%s.json'
ens = [load(k % 'Kitzur Shulchan Aruch, trans. Rabbi Avrohom Davis, Metsudah Pub., 1996')['text'], load(k % COM)['text']]
total += write('en_kitzur', align(heb_struct('kitzur'), ens))
for root, _, files in os.walk(os.path.join(SRC, 'Tanakh')):
    for f in files:
        if f == 'The Holy Scriptures A New Translation JPS 1917.json' and root.endswith('English') and '/Targum/' not in root:
            b = root.split('/')[-2]
            t = load(os.path.relpath(os.path.join(root, f), SRC))['text']
            total += write('en_tanakh_' + b.replace(' ', '_'), [[clean(v) if isinstance(v, str) else '' for v in ch] for ch in t])
print('total', total)
