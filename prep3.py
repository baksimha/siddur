#!/usr/bin/env python3
"""Torah with cantillation marks, and Targum Onkelos (for Shnayim Mikra)."""
import json, os, re
SRC = os.path.expanduser('~/sefaria/archive/json')
OUT = '/home/claude/app/www/data'
def write(key, obj):
    s = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(OUT, key + '.js'), 'w', encoding='utf-8').write('window.D=window.D||{};D[%s]=%s;' % (json.dumps(key), s))
def taam(s):
    s = re.sub(r'<span class="mam-spi-[^"]*">.*?</span>', '', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\{[^}]*\}', '', s)
    s = re.sub(r'\s*\(([א-ת\s]+)\)', '', s)
    return re.sub(r'\s+', ' ', s.replace('[', '').replace(']', '')).strip()
def plain(s):
    return re.sub(r'<[^>]+>', '', s).strip()
for b in ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']:
    t = json.load(open(f'{SRC}/Tanakh/Torah/{b}/Hebrew/merged.json'))['text']
    write('taamim_' + b, [[taam(v) for v in ch] for ch in t])
    o = json.load(open(f'{SRC}/Tanakh/Targum/Onkelos/Torah/Onkelos {b}/Hebrew/merged.json'))['text']
    write('onkelos_' + b, [[plain(v) for v in ch] for ch in o])
print('ok')
