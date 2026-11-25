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
  return { t: 'text', html: s, small: smallWrapped };
}

const HEB_FLEX = (word) => word.split('').map((ch) => (ch === ' ' ? '\\s+' : ch + '[\\u0591-\\u05C7]*')).join('');

export function transformHtml(html, ctx, settings) {
  let h = html;
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
    if (rc && !evalCond(rc, ctx)) { i++; continue; }
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
        if (cj.t === 'empty') { j++; continue; }
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
    for (let q = 0; q < out.length; q++) {
      const it = out[q];
      if (it.k !== 'text') continue;
      const mm = it.html.match(re);
      if (mm && /ר[֑-ׇ]*פ[֑-ׇ]*א[֑-ׇ]*נ[֑-ׇ]*ו/.test(it.html)) {
        const pos = mm.index;
        const a = it.html.slice(0, pos), b = it.html.slice(pos);
        out.splice(q, 1, { k: 'text', html: a }, { k: 'text', html: sickHtml(null, names), red: true }, { k: 'text', html: b });
        break;
      }
    }
  }
  ctx._sickDone = false;
  return out;
}
