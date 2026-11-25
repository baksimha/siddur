// Turns Sefaria siddur segments into what to show today.
import { condFromLabel, evalCond, RED, SINGLE } from './cal.js';

const NIK = /[ְ-ׇּׁׂ]/;
export const strip = (s) => s.replace(/<[^>]+>/g, '');

export function classify(seg) {
  const s = (seg || '').trim();
  const plain = strip(s).replace(/\s+/g, ' ').trim();
  if (!plain) return { t: 'empty' };
  const smallWrapped = /^(\s*<(b|big)>)*\s*<small>/.test(s) && /<\/small>\s*(<\/(b|big)>\s*)*$/.test(s);
  if (!NIK.test(plain)) {
    const cond = condFromLabel(plain);
    const shortLabel = plain.length <= 70 && /:\s*\)?\s*$/.test(plain);
    if (shortLabel || (cond && plain.length <= 90) || (smallWrapped && plain.length <= 40)) {
      return { t: 'label', text: plain, cond };
    }
    if (/^\s*(<(b|big)>)+/.test(s) && plain.length < 45) return { t: 'heading', text: plain };
    return { t: 'note', text: plain, cond };
  }
  // several inline variants in one segment: "<small>בקיץ:</small> ... <small>בחורף:</small> ..."
  const marks = s.match(/<small>\s*[^<]{1,25}:\s*<\/small>/g) || [];
  if (marks.filter((x) => condFromLabel(strip(x))).length > 1) return { t: 'text', html: s, multi: true, small: false };
  // inline label at the start: "<small>לר"ח:</small> רֹאשׁ הַחֹֽדֶשׁ"
  const m = s.match(/^((?:\s*<(?:small|b)>)+)\s*([^<]{1,40}?)\s*((?:<\/(?:small|b)>\s*)+)([\s\S]+)$/);
  if (m) {
    const lab = m[2].trim();
    const labPlain = lab.replace(/[֑-ׇ]/g, '');
    const cond = condFromLabel(labPlain);
    if ((!NIK.test(lab) || (cond && lab.length <= 25 && /:\)?$/.test(lab))) && strip(m[4]).trim()) {
      return { t: 'text', html: m[4], inlineLabel: labPlain.replace(/[()]/g, ''), cond, small: false };
    }
  }
  // "<small>instruction<br>prayer text</small>": the instruction decides whether the text is said
  const ib = s.match(/^\s*(?:<small>\s*)+([^<]{3,200}?)\s*<br>([\s\S]+)$/);
  if (ib && !NIK.test(ib[1]) && NIK.test(strip(ib[2]))) {
    return { t: 'text', html: ib[2].replace(/(<\/small>\s*)+$/, ''), small: false, cond: condFromLabel(ib[1]) || null, inlineLabel: ib[1] };
  }
  // a small paragraph that opens with plain (unvocalized) words is an instruction, unless it is a known variant
  if (smallWrapped && !NIK.test(plain.slice(0, 22))) {
    const lm = plain.match(/^\s*\(?([^:\u05B0-\u05BC]{2,40}):/);
    if (!(lm && condFromLabel(lm[1]))) return { t: 'note', text: plain, cond: null };
  }
  // paragraphs that belong to a special day even when the siddur gives them no label
  const pn = plain.replace(/[\u0591-\u05C7]/g, '').replace(/^[\s(]+/, '');
  if (/^ו?על הנסים ועל הפרקן/.test(pn)) return { t: 'text', html: s, small: smallWrapped, cond: 'chanukah|purim' };
  return { t: 'text', html: s, small: smallWrapped };
}

const HEB_FLEX = (word) => word.split('').map((ch) => (ch === ' ' ? '\\s+' : ch + '[\\u0591-\\u05C7]*')).join('');

function inlineVariants(h, ctx) {
  const put = (label, content, all) => {
    const cond = condFromLabel(label.replace(/[()]/g, ''));
    if (!cond) return all;
    if (!evalCond(cond, ctx)) return '';
    return RED.has(cond) ? '<span class="ins">' + content + '</span>' : content;
  };
  let prev;
  do {
    prev = h;
    // <small><small>LABEL:</small> text</small>
    h = h.replace(/<small>\s*<small>\s*([^<\u05B0-\u05BC]{2,40}?)\s*<\/small>((?:(?!<small>)[\s\S])*?)<\/small>/g, (all, l, c) => put(l, c, all));
  } while (h !== prev);
  // <small>LABEL: text</small>
  h = h.replace(/<small>\s*([^<\u05B0-\u05BC:]{2,40}):\s*([^<]+)<\/small>/g, (all, l, c) => put(l, c, all));
  // <em>LABEL:</em> text<br>
  h = h.replace(/<em>\s*([^<]{2,40}?):?\s*<\/em>\s*([^<]*)(<br>)?/g, (all, l, c, br) => { const r = put(l, c, all); return r === all ? all : (r ? r + (br || '') : ''); });
  return h;
}

export function transformHtml(html, ctx, settings) {
  let h = inlineVariants(html, ctx);
  // inline Ten Days of Repentance variants
  const ayt = '\\(\\s*<small>\\s*בעשי"ת\\s*</small>\\s*';
  h = h.replace(new RegExp('(' + HEB_FLEX('שלום') + ')\\s*' + ayt + '([^)]*)\\)', 'g'), (all, a, b) => (ctx.ayt ? '<span class="ins">' + b.trim() + '</span>' : a));
  h = h.replace(new RegExp(ayt + '([^)]*)\\)\\s*(' + HEB_FLEX('שלום') + ')', 'g'), (all, b, a) => (ctx.ayt ? '<span class="ins">' + b.trim() + '</span>' : a));
  h = h.replace(new RegExp(ayt + '([^)]*)\\)\\s*(' + HEB_FLEX('מן כל') + ')', 'g'), (all, b, a) => (ctx.ayt ? '<span class="ins">' + b.trim() + '</span>' : a));
  h = h.replace(new RegExp(ayt + '([^)]*)\\)', 'g'), (all, b) => (ctx.ayt ? '<span class="ins">' + b.trim() + '</span>' : ''));
  h = h.replace(/<big>/g, '<b>').replace(/<\/big>/g, '</b>');
  h = h.replace(/<i [^>]*><\/i>/g, '');
  if (settings.censor) {
    h = h.replace(/י([֑-ׇ]*)ה([֑-ׇ]*)ו([֑-ׇ]*)ה([֑-ׇ]*)/g, 'י$1-ה$2ו$3ה$4');
  }
  return h;
}

function sickHtml(base, names) {
  const list = names.map((n) => n.replace(/^ל(?=[\u05D0-\u05EA])/, '')).join(', לְ');
  if (base) {
    const r = base.replace(/לַחוֹלֶה\s*\(פלוני\/פלונית\)\s*בֶּן\/בַּת\s*\(פלונית\)/, 'לְ' + list);
    if (r !== base) return r.replace(/<\/?small>/g, '');
  }
  return 'יְהִי רָצוֹן מִלְּפָנֶיךָ יְהֹוָה אֱלֹהַי וֵאלֹהֵי אֲבוֹתַי, שֶׁתִּשְׁלַח מְהֵרָה רְפוּאָה שְׁלֵמָה מִן הַשָּׁמַיִם, רְפוּאַת הַנֶּפֶשׁ וּרְפוּאַת הַגּוּף, לְ' + list + ' בְּתוֹךְ שְׁאָר חוֹלֵי יִשְׂרָאֵל:';
}

/**
 * Render a list of segments for today.
 * opts: { from, to, ranges: [[from,to,cond]], key }
 * returns array of items {k:'text'|'label'|'heading'|'note', html, red}
 */
export function flatten(node) {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (node && typeof node === 'object') return Object.values(node).flatMap(flatten);
  return [];
}

export function renderSegments(segs, ctx, settings, opts = {}) {
  const out = [];
  const n = segs.length;
  const from = opts.from || 0;
  const to = opts.to == null ? n - 1 : opts.to;
  const rangeCond = (i) => {
    for (const r of opts.ranges || []) if (i >= r[0] && i <= r[1]) return r[2];
    return null;
  };
  const names = (settings.names || []).filter((x) => x.trim());
  let stopAll = false;
  // hidden by grouping rules (Omer day, song of the day, half Hallel)
  const hide = new Set();
  const plainN = (x) => strip(x || '').replace(/[\u0591-\u05C7]/g, '').trim();
  if (opts.omer) {
    let g = 0;
    for (let q = 0; q < n; q++) {
      if (/^\S{1,4}\s(ניסן|אייר|סיון|סיוון)/.test(plainN(segs[q]))) {
        g++;
        let r = q + 1;
        while (r < n && !/^\S{1,4}\s(ניסן|אייר|סיון|סיוון)/.test(plainN(segs[r])) && (!NIK.test(strip(segs[r])) || /עמר/.test(plainN(segs[r]))) && strip(segs[r]).length < 200) r++;
        if (g !== opts.omer) for (let z = q; z < r; z++) hide.add(z);
        q = r - 1;
      }
    }
  }
  if (opts.songDay !== undefined) {
    const DN = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'ששי': 5, 'שישי': 5 };
    for (let q = 0; q < n; q++) {
      const mm = plainN(segs[q]).match(/^מזמור ליום (ראשון|שני|שלישי|רביעי|חמישי|ששי|שישי)/);
      if (!mm) continue;
      let r = q + 1;
      while (r < n && !/^מזמור ליום/.test(plainN(segs[r])) && NIK.test(strip(segs[r]))) r++;
      if (DN[mm[1]] !== opts.songDay) for (let z = q; z < r; z++) hide.add(z);
      q = r - 1;
    }
  }
  if (opts.hallel && !ctx.fullHallel) {
    for (let q = 0; q < n; q++) if (/^(לא לנו|אהבתי כי ישמע)/.test(plainN(segs[q]))) hide.add(q);
  }
  const emitText = (i, c, red) => {
    let src = c.html;
    if (c.multi) {
      const parts = src.split(/(<small>\s*[^<]{1,25}:\s*<\/small>)/);
      let res = parts[0];
      for (let p = 1; p < parts.length; p += 2) {
        const cond = condFromLabel(strip(parts[p]));
        if (!cond) { res += parts[p] + parts[p + 1]; continue; }
        if (evalCond(cond, ctx)) res += RED.has(cond) ? '<span class="ins">' + parts[p + 1] + '</span>' : parts[p + 1];
      }
      src = res;
    }
    let html = transformHtml(src, ctx, settings);
    out.push({ k: 'text', html, red, small: false, idx: i });
  };
  let i = from;
  while (i <= to) {
    const rc = rangeCond(i);
    if ((rc && !evalCond(rc, ctx)) || hide.has(i)) { i++; continue; }
    const c = classify(segs[i]);
    if (c.t === 'empty') { i++; continue; }
    if (c.t === 'label' && c.cond === 'stopchanukah') {
      if (ctx.chanukah) { stopAll = true; }
      i++; if (stopAll) break; continue;
    }
    if (c.t === 'label' && c.cond) {
      // collect the scope of this condition
      const scope = [];
      let j = i + 1, firstSmall = null;
      while (j <= to) {
        const cj = classify(segs[j]);
        if (cj.t === 'empty' || hide.has(j)) { j++; continue; }
        if (cj.t === 'heading' || cj.t === 'note' || (cj.t === 'label' && cj.cond)) break;
        if (cj.t === 'label') { scope.push([j, cj]); j++; continue; }
        if (firstSmall !== null) {
          if (SINGLE.has(c.cond)) break;
          if (firstSmall && !cj.small) break;
          if (!firstSmall && /^\s*<b>/.test(segs[j])) break;
        } else firstSmall = !!cj.small;
        scope.push([j, cj]);
        j++;
      }
      if (c.cond === 'sick') {
        if (names.length) {
          const base = scope.length ? scope[scope.length - 1][1].html : null;
          out.push({ k: 'text', html: sickHtml(base, names), red: true });
          ctx._sickDone = true;
        }
      } else if (evalCond(c.cond, ctx)) {
        const red = RED.has(c.cond);
        for (const [k, ck] of scope) {
          if (ck.t === 'label') { if (settings.notes) out.push({ k: 'label', html: ck.text }); continue; }
          if (ck.cond && !evalCond(ck.cond, ctx)) continue;
          emitText(k, ck, red || (ck.cond && RED.has(ck.cond)));
        }
      }
      i = j;
      continue;
    }
    if (c.t === 'label') { out.push({ k: 'label', html: c.text }); i++; continue; }
    if (c.t === 'heading') { out.push({ k: 'heading', html: c.text }); i++; continue; }
    if (c.t === 'note') { if (settings.notes) out.push({ k: 'note', html: c.text }); i++; continue; }
    // text
    if (c.cond) {
      if (evalCond(c.cond, ctx)) emitText(i, c, RED.has(c.cond));
      i++; continue;
    }
    const red = rc ? RED.has(rc) : false;
    emitText(i, c, red);
    i++;
  }
  // names for the sick in Amidah sections without a ready-made slot
  if (opts.amidah && names.length && !ctx._sickDone) {
    const re = new RegExp(HEB_FLEX('כי אל מלך רופא'));
    const refa = /ר[\u0591-\u05C7]*פ[\u0591-\u05C7]*א[\u0591-\u05C7]*נ[\u0591-\u05C7]*ו/;
    let done = false;
    for (let q = 0; q < out.length && !done; q++) {
      const it = out[q];
      if (it.k !== 'text' || !refa.test(it.html)) continue;
      const mm = it.html.match(re);
      if (mm) {
        const a = it.html.slice(0, mm.index), b = it.html.slice(mm.index);
        out.splice(q, 1, { k: 'text', html: a }, { k: 'text', html: sickHtml(null, names), red: true }, { k: 'text', html: b });
      } else {
        out.splice(q + 1, 0, { k: 'text', html: sickHtml(null, names), red: true });
      }
      done = true;
    }
  }
  ctx._sickDone = false;
  return out;
}
