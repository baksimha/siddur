#!/usr/bin/env python3
"""Texts for the daily-learning programs (Talmud, Mishnah, Rambam, Kitzur, etc.)."""
import json, os, re

SRC = os.path.expanduser('~/sefaria/archive/json')
OUT = '/home/claude/app/www/data'
HC = json.load(open('/tmp/hebcal_names.json'))
TAAMIM = re.compile('[֑-ֽ֯]')


def load(p):
    return json.load(open(os.path.join(SRC, p), encoding='utf-8'))


def write(key, obj):
    s = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, key + '.js'), 'w', encoding='utf-8') as f:
        f.write('window.D=window.D||{};D[%s]=%s;' % (json.dumps(key), s))
    return len(s)


def norm(n):
    n = n.lower().replace("'", '').replace('mishneh torah, ', '').replace('mishnah ', '')
    n = n.replace('baba', 'bava').replace('ch', 'kh').replace('tz', 'ts')
    n = re.sub(r'[^a-z]', '', n)
    n = re.sub(r'(.)\1', r'\1', n)
    n = re.sub(r'h$', '', n)
    return n


def clean(s):
    if not isinstance(s, str):
        return s
    s = re.sub(r'<i [^>]*></i>', '', s)
    s = re.sub(r'<sup[^>]*>.*?</sup>', '', s)
    s = re.sub(r'<(?!/?(b|small|br)\b)[^>]+>', '', s)
    return TAAMIM.sub('', s).strip()


def deep(x):
    if isinstance(x, list):
        return [deep(y) for y in x]
    if isinstance(x, dict):
        return {k: deep(v) for k, v in x.items()}
    return clean(x)


total = 0
index = {}

# --- Bavli
bav = {}
for root, _, files in os.walk(os.path.join(SRC, 'Talmud/Bavli')):
    if root.endswith('Hebrew') and 'merged.json' in files:
        name = root.split('/')[-2]
        bav[norm(name)] = name
        total += write('bavli_' + name.replace(' ', '_'), deep(load(os.path.relpath(os.path.join(root, 'merged.json'), SRC))['text']))
# --- Mishnah
mis = {}
for root, _, files in os.walk(os.path.join(SRC, 'Mishnah')):
    if root.endswith('Hebrew') and 'merged.json' in files and 'Seder' in root:
        name = root.split('/')[-2]
        mis[norm(name)] = name
        total += write('mishnah_' + name.replace(' ', '_').replace("'", ''), deep(load(os.path.relpath(os.path.join(root, 'merged.json'), SRC))['text']))
# --- Rambam
ram = {}
for root, _, files in os.walk(os.path.join(SRC, 'Halakhah/Mishneh Torah')):
    if root.endswith('Hebrew') and 'merged.json' in files:
        name = root.split('/')[-2]
        if not name.startswith('Mishneh Torah, '):
            continue
        ram[norm(name)] = name
        total += write('rambam_' + re.sub(r'[^A-Za-z]', '_', name[15:]), deep(load(os.path.relpath(os.path.join(root, 'merged.json'), SRC))['text']))


def mapnames(hc, table, prefix, fix):
    m = {}
    for n in hc:
        k = norm(n)
        hit = table.get(k) or table.get(fix.get(n, ''), None)
        if not hit:
            # loose match: same first 5 letters and close length
            cands = [v for kk, v in table.items() if kk[:5] == k[:5]]
            hit = cands[0] if len(cands) == 1 else None
        if hit:
            m[n] = prefix + (re.sub(r'[^A-Za-z]', '_', hit[15:]) if prefix == 'rambam_' else hit.replace(' ', '_').replace("'", ''))
        else:
            print('UNMATCHED', prefix, n)
    return m


index['bavli'] = mapnames(set(HC['dafyomi']) | set(HC['dirshuamudyomi']), bav, 'bavli_', {})
index['bavli'].update({'Midot': 'mishnah_Mishnah_Middot', 'Kinnim': 'mishnah_Mishnah_Kinnim', 'Shekalim': 'mishnah_Mishnah_Shekalim'})
index['mishnah'] = mapnames(HC['mishnayomi'], mis, 'mishnah_', {})
index['mishnah']['Avot'] = 'mishnah_Pirkei_Avot'
index['rambam'] = mapnames(HC['rambam1'], ram, 'rambam_', {})

# --- single books
total += write('kitzur', deep(load('Halakhah/Kitzur Shulchan Arukh/Hebrew/merged.json')['text']))
ah = load('Halakhah/Arukh HaShulchan/Hebrew/merged.json')['text']
total += write('arukh_oc', deep(ah['Orach Chaim']))
total += write('chafetz', deep(load('Halakhah/Acharonim/Chafetz Chaim/Hebrew/merged.json')['text']))
total += write('shemirat', deep(load('Musar/Acharonim/Shemirat HaLashon/Hebrew/merged.json')['text']))
total += write('tanya', deep(load('Chasidut/Chabad/Tanya/Hebrew/merged.json')['text']))


def clean_tanakh(s):
    s = re.sub(r'<span class="mam-spi-[^"]*">.*?</span>', '', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\{[^}]*\}', '', s)
    s = re.sub(r'\s*\(([א-ת\s]+)\)', '', s)
    s = s.replace('[', '').replace(']', '')
    s = TAAMIM.sub('', s).replace('׀', '')
    return re.sub(r'\s+', ' ', s).strip()


for b in ['Daniel', 'Ezra', 'Nehemiah', 'I Chronicles', 'II Chronicles', 'Job', 'Proverbs']:
    t = load('Tanakh/Writings/%s/Hebrew/merged.json' % b)['text']
    total += write('tanakh_' + b.replace(' ', '_'), [[clean_tanakh(v) for v in ch] for ch in t])

total += write('learn_index', index)
print('total bytes', total, {k: len(v) for k, v in index.items()})
