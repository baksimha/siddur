#!/usr/bin/env python3
"""Build offline data files for the siddur app from the Sefaria export."""
import json, os, re, sys

SRC = os.path.expanduser('~/sefaria/archive/json')
OUT = '/home/claude/app/www/data'
os.makedirs(OUT, exist_ok=True)

TAAMIM = re.compile('[֑-ֽ֯]')  # cantillation + meteg


def load(path):
    return json.load(open(os.path.join(SRC, path), encoding='utf-8'))


def write(key, obj):
    s = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, key + '.js'), 'w', encoding='utf-8') as f:
        f.write('window.D=window.D||{};D[%s]=%s;' % (json.dumps(key), s))
    return len(s)


def clean_tanakh(s):
    s = re.sub(r'<span class="mam-spi-[^"]*">.*?</span>', '', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\{[^}]*\}', '', s)
    s = re.sub(r'\s*\(([\u05D0-\u05EA\s]+)\)', '', s)  # ketiv (unvocalized) - read the kri
    s = s.replace('[', '').replace(']', '')
    s = TAAMIM.sub('', s)
    s = s.replace('׀', '')  # paseq
    return re.sub(r'\s+', ' ', s).strip()


total = 0
# --- Siddur Sefard ---
sid = load('Liturgy/Siddur/Siddur Sefard/Hebrew/merged.json')['text']
for drop in ['Pesach Haggadah', 'Yotzerot', 'Lag BaOmer Songs', 'Shabbat Evening Meal',
             'Shabbat Day Meal', 'Third Meal', 'Simchat Torah', 'Shabbat Morning Services',
             'Shabbat Mincha', 'Musaf', 'Kabbalat Shabbat', 'Shabbat Eve Maariv', 'Shabbat Eve Mincha']:
    sid.pop(drop, None)
total += write('sefard', sid)

# --- Tikkun Chatzot (from Edot HaMizrach siddur) ---
em = load('Liturgy/Siddur/Siddur Edot HaMizrach/Hebrew/merged.json')['text']
total += write('chatzot', em['The Midnight Rite'])

# --- Selichot (Ashkenaz timing, Polin text) ---
sel = load('Liturgy/High Holidays/Selichot Nusach Polin/Hebrew/merged.json')['text']
total += write('selichot', sel)

# --- Tanakh books ---
books = {}
for cat in ['Torah', 'Prophets']:
    for b in sorted(os.listdir(os.path.join(SRC, 'Tanakh', cat))):
        books[b] = 'Tanakh/%s/%s/Hebrew/merged.json' % (cat, b)
for b in ['Psalms', 'Esther', 'Lamentations', 'Ruth', 'Ecclesiastes', 'Song of Songs']:
    books[b] = 'Tanakh/Writings/%s/Hebrew/merged.json' % b
for b, p in books.items():
    t = load(p)['text']
    t = [[clean_tanakh(v) for v in ch] for ch in t]
    total += write('tanakh_' + b.replace(' ', '_'), t)

# --- Shulchan Arukh OC + Mishnah Berurah, aligned per se'if ---
sa = load('Halakhah/Shulchan Arukh/Shulchan Arukh, Orach Chayim/Hebrew/merged.json')['text']
mb = load('Halakhah/Shulchan Arukh/Commentary/Mishnah Berurah/Mishnah Berurah/Hebrew/merged.json')['text']['']

NON = re.compile(r'[^א-ת ]')


def norm(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub('[֑-ׇ]', '', s)
    s = NON.sub(' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def dh(c):
    t = re.sub(r'<[^>]+>', '', c)
    t = re.sub(r'^\s*\([^)]*\)\s*', '', t)
    t = re.split(r'\s[–\-]\s|\s-|–|\.|:', t, 1)[0]
    w = norm(t).split()
    return ' '.join(w[:3])


chunks = {}
matched = tot = 0
for si, seifim in enumerate(sa):
    comments = mb[si] if si < len(mb) else []
    nseif = [norm(x) for x in seifim]
    assign = []
    ptr = 0
    for c in comments:
        key = dh(c)
        found = None
        if key:
            for j in range(ptr, len(nseif)):
                if key in nseif[j]:
                    found = j
                    break
            if found is None and len(key.split()) > 1:
                k1 = ' '.join(key.split()[:2])
                for j in range(ptr, len(nseif)):
                    if k1 in nseif[j]:
                        found = j
                        break
        tot += 1
        if found is not None:
            matched += 1
            ptr = found
        assign.append(ptr)
    entry = []
    for j, s in enumerate(seifim):
        entry.append({'s': s, 'm': [comments[k] for k in range(len(comments)) if assign[k] == j]})
    chunks.setdefault(si // 25, {})[si + 1] = entry
for ci, obj in chunks.items():
    total += write('mb_%d' % ci, obj)
print('MB comments matched by heading: %d/%d' % (matched, tot))
print('total bytes', total)
