import { HDate, months, DailyLearning, getLeyningOnDate, CITIES, cityInfo, zmanim, nowHDate, dayCtx, selichotKey } from './cal.js';
import { gematriya } from '@hebcal/core';
import { renderSegments, strip } from './siddur.js';

/* ---------------- clock (a ?date=YYYY-MM-DDTHH:MM param lets you preview another day) ---------------- */
const TEST = (location.search.match(/[?&]date=([^&]+)/) || [])[1];
const NOW = () => (TEST ? new Date(decodeURIComponent(TEST)) : new Date());

/* ---------------- storage ---------------- */
const DEFAULTS = {
  city: 'ירושלים', purim: 'auto', names: [], censor: false, night: false, font: 22,
  notes: false, learning: ['dirshudafhalacha', 'psalms'], nusach: 'sefard',
};
let S = { ...DEFAULTS };
try { S = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('siddur.settings') || '{}') }; } catch (e) { /* ignore */ }
function save() { try { localStorage.setItem('siddur.settings', JSON.stringify(S)); } catch (e) { /* ignore */ } applyTheme(); }
function applyTheme() {
  document.documentElement.classList.toggle('night', !!S.night);
  document.documentElement.style.setProperty('--fs', S.font + 'px');
}

/* ---------------- data loading ---------------- */
window.D = window.D || {};
const loading = {};
function load(key) {
  if (window.D[key]) return Promise.resolve(window.D[key]);
  if (!loading[key]) {
    loading[key] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'data/' + key + '.js';
      s.onload = () => res(window.D[key]);
      s.onerror = () => { delete loading[key]; rej(new Error('load ' + key)); };
      document.head.appendChild(s);
    });
  }
  return loading[key];
}
const bookKey = (b) => 'tanakh_' + b.replace(/ /g, '_');

/* ---------------- helpers ---------------- */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const app = () => $('#app');
const DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEB_BOOK = {
  Genesis: 'בראשית', Exodus: 'שמות', Leviticus: 'ויקרא', Numbers: 'במדבר', Deuteronomy: 'דברים',
  Joshua: 'יהושע', Judges: 'שופטים', 'I Samuel': 'שמואל א', 'II Samuel': 'שמואל ב', 'I Kings': 'מלכים א', 'II Kings': 'מלכים ב',
  Isaiah: 'ישעיהו', Jeremiah: 'ירמיהו', Ezekiel: 'יחזקאל', Hosea: 'הושע', Joel: 'יואל', Amos: 'עמוס', Obadiah: 'עובדיה',
  Jonah: 'יונה', Micah: 'מיכה', Nahum: 'נחום', Habakkuk: 'חבקוק', Zephaniah: 'צפניה', Haggai: 'חגי', Zechariah: 'זכריה',
  Malachi: 'מלאכי', Daniel: 'דניאל', Ezra: 'עזרא', Nehemiah: 'נחמיה', 'I Chronicles': 'דברי הימים א', 'II Chronicles': 'דברי הימים ב', Job: 'איוב', Proverbs: 'משלי', Psalms: 'תהילים', Esther: 'מגילת אסתר', Lamentations: 'איכה', Ruth: 'רות', Ecclesiastes: 'קהלת',
  'Song of Songs': 'שיר השירים',
};
const ICON = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  sunset: '<path d="M12 10V2M5 10l1.4 1.4M2 18h20M19 10l-1.4 1.4M16 18a4 4 0 0 0-8 0M7 22h10"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  drop: '<path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.3 0z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  scroll: '<path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  candles: '<path d="M9 10v10M15 10v10M6 20h12"/><path d="M9 3c1 1.3 1 2.8 0 4-1-1.2-1-2.7 0-4zM15 3c1 1.3 1 2.8 0 4-1-1.2-1-2.7 0-4z"/>',
  moonfull: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  plate: '<circle cx="12" cy="12" r="6"/><path d="M3 3v6a2 2 0 0 0 2 2M5 3v18M21 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5-6"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>',
  bed: '<path d="M3 19V6M3 13h18v6M21 13a3 3 0 0 0-3-3h-8v3"/><circle cx="6.5" cy="10.5" r="1.5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  star: '<path d="M12 3l2.4 6.1L21 12l-6.6 2.9L12 21l-2.4-6.1L3 12l6.6-2.9z"/>',
  back: '<path d="M9 18l6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
};
const icon = (n, s = 22) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n] || ''}</svg>`;
const COL = {
  blue: ['#3B82F6', '#EFF6FF'], orange: ['#F97316', '#FFF7ED'], teal: ['#14B8A6', '#F0FDFA'], amber: ['#F59E0B', '#FFFBEB'],
  pink: ['#EC4899', '#FDF2F8'], red: ['#EF4444', '#FEF2F2'], green: ['#22C55E', '#F0FDF4'], indigo: ['#6366F1', '#EEF2FF'],
  purple: ['#A855F7', '#FAF5FF'], sky: ['#0EA5E9', '#F0F9FF'],
};
const tile = (href, ic, col, title, sub = '') => `<a class="tile" href="${href}" style="--c:${COL[col][0]};--t:${COL[col][1]}">
  <span class="ti">${icon(ic)}</span><span class="tt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span></a>`;

function nav(active) {
  const items = [['home', 'home', 'היום', '#home'], ['menu', 'grid', 'כל התפילות', '#menu'], ['learn', 'book', 'לימוד', '#learn'], ['set', 'gear', 'הגדרות', '#settings']];
  return `<nav class="nav">${items.map(([k, ic, l, h]) => `<a href="${h}" class="${k === active ? 'on' : ''}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>`;
}
function page(title, body, opts = {}) {
  const back = opts.back ? `<a class="hb" href="${opts.back}" aria-label="חזרה">${icon('back', 24)}</a>` : '';
  app().innerHTML = `<header class="hd">${back}<div class="ht"><h1>${title}</h1>${opts.sub ? `<p>${opts.sub}</p>` : ''}</div>${opts.right || ''}</header>
  <main class="mn ${opts.cls || ''}">${body}</main>${opts.nav === false ? '' : nav(opts.nav || '')}`;
  window.scrollTo(0, 0);
}

function ctxFor(prayer, now = NOW()) {
  const ci = cityInfo(S.city);
  let hd = new HDate(now);
  let motzash = false;
  if (prayer === 'maariv') {
    if (now.getHours() >= 12) { hd = hd.next(); motzash = now.getDay() === 6; }
  } else if (!prayer) {
    const n = nowHDate(S.city, now);
    hd = n.hd;
  }
  return dayCtx(hd, { prayer, walled: ci.walled, purim: S.purim, motzash });
}

function hebDate(hd) { return hd.renderGematriya(true).replace(/\s*תש/, ' תש'); }

/* ---------------- prayer programs (Nusach Sefard) ---------------- */
const P = {
  shacharit: {
    title: 'שחרית',
    parts: [
      { t: 'השכמת הבוקר', p: [['Upon Arising', 'Modeh Ani'], ['Upon Arising', 'Tallit'], ['Upon Arising', 'Tefilin', '!tishabav']] },
      { t: 'הכנה לתפילה', p: [['Upon Arising', 'Introductory Prayers'], ['Upon Arising', 'Upon Entering Synagogue']] },
      { t: 'ברכות השחר', p: [['Weekday Shacharit', 'Morning Blessings'], ['Weekday Shacharit', 'Blessings on Torah'], ['Weekday Shacharit', 'Morning Prayer']] },
      { t: 'קרבנות', p: [['Weekday Shacharit', 'Korbanot'], ["Weekday Shacharit", "B'raita d'Rabi Yishmael"]] },
      { t: 'פסוקי דזמרה', p: [['Weekday Shacharit', 'Hodu'], ['Weekday Shacharit', 'Yishtabach']] },
      { t: 'קריאת שמע', p: [['Weekday Shacharit', 'The Shema']] },
      { t: 'עמידה', p: [['Weekday Shacharit', 'Amidah']], amidah: true },
      { t: 'הלל', cond: 'hallel', p: [['Rosh Chodesh', 'Hallel']] },
      { t: 'סליחות', cond: 'minorFast', fastSelichot: true },
      { t: 'אבינו מלכנו', cond: 'avinu', p: [['Weekday Shacharit', 'Avinu Malkeinu']] },
      { t: 'תחנון', cond: 'tachanun', p: [['Weekday Shacharit', 'Tachanun']] },
      { t: (c) => (c.monthu && c.tachanun ? 'והוא רחום' : c.tachanun ? 'שומר ישראל' : 'חצי קדיש'), p: [['Weekday Shacharit', 'For Monday & Thursday']], ranges: [[0, 1, 'never'], [2, 19, 'monthu&tachanun'], [20, 24, 'tachanun'], [30, 30, 'never']] },
      { t: 'קריאת התורה', cond: 'torah', p: [['Weekday Shacharit', 'Torah Reading']], reading: true },
      { t: 'אשרי ובא לציון', p: [['Weekday Shacharit', 'Ashrei']], ranges: [[1, 2, 'never'], [3, 3, '!noLamnatzeach'], [4, 4, 'never'], [16, 16, 'never']] },
      { t: 'מוסף לראש חודש', cond: 'rc', p: [['Rosh Chodesh', 'Mussaf']] },
      { t: 'שיר של יום', p: [['Weekday Shacharit', 'Beit Yaakov'], ['Weekday Shacharit', 'Song of the Day'], ['Weekday Shacharit', 'Barchi Nafshi', 'rc']] },
      { t: 'לדוד ה׳ אורי', cond: 'elul', p: [["Weekday Shacharit", "L'David Hashem"]], ranges: [[3, 99, 'never']] },
      { t: 'קוה ועלינו', p: [['Weekday Shacharit', 'Kaveh'], ['Weekday Shacharit', 'Aleinu']] },
    ],
  },
  mincha: {
    title: 'מנחה',
    parts: [
      { t: 'קרבנות ואשרי', p: [['Weekday Mincha', 'Korbanot']] },
      { t: 'קריאת התורה', cond: 'fast', p: [['Weekday Mincha', 'Torah Reading for Fast Day']], reading: true, ranges: [[2, 2, 'never']] },
      { t: 'עמידה', p: [['Weekday Mincha', 'Amidah']], amidah: true },
      { t: 'אבינו מלכנו', cond: 'avinu', p: [['Weekday Mincha', 'Avinu Malkeinu']] },
      { t: 'תחנון', p: [['Weekday Mincha', 'Tachanun']], ranges: [[0, 0, 'never'], [1, 16, 'tachanun'], [32, 34, 'elul'], [35, 999, 'never']] },
    ],
  },
  maariv: {
    title: 'ערבית',
    parts: [
      { t: 'קריאת שמע', p: [['Weekday Maariv', 'The Shema']] },
      { t: 'עמידה', p: [['Weekday Maariv', 'Amidah']], to: 95, amidah: true },
      { t: 'קדיש ושיר למעלות', p: [['Weekday Maariv', 'Amidah']], from: 96, to: 112 },
      { t: 'מוצאי שבת', cond: 'motzash', p: [['Weekday Maariv', 'Motzaei Shabbat']] },
      { t: 'ספירת העומר', cond: 'omer', p: [['Weekday Maariv', 'Sefirat HaOmer']], omer: true },
      { t: 'עלינו', p: [['Weekday Maariv', 'Amidah']], from: 113 },
    ],
  },
};

const ALIYA = ['', 'כהן', 'לוי', 'ישראל', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'מפטיר'];

function refText(book, b, e) {
  // b, e like "32:4"
  const t = window.D[bookKey(book)];
  const [c1, v1] = b.split(':').map(Number);
  const [c2, v2] = e.split(':').map(Number);
  let h = '';
  for (let c = c1; c <= c2; c++) {
    const ch = t[c - 1] || [];
    const from = c === c1 ? v1 : 1;
    const to = c === c2 ? v2 : ch.length;
    for (let v = from; v <= to; v++) if (ch[v - 1]) h += `<sup>${gematriya(v)}</sup>${ch[v - 1]} `;
  }
  return h;
}

async function readingHtml(ley) {
  if (!ley) return '';
  const al = ley.weekday || ley.fullkriyah;
  if (!al) return '';
  const keys = Object.keys(al).filter((k) => al[k] && al[k].k);
  await Promise.all([...new Set(keys.map((k) => al[k].k))].map((b) => load(bookKey(b))));
  let h = `<div class="block-title">הקריאה: ${esc(ley.name && ley.name.he ? ley.name.he : '')}</div>`;
  for (const k of keys) {
    const a = al[k];
    const nm = ALIYA[+k] || (k === 'M' ? 'מפטיר' : k);
    h += `<p class="lbl">${nm}</p><p class="tx">${refText(a.k, a.b, a.e)}</p>`;
  }
  return h;
}

function getPath(obj, path) { let n = obj; for (const p of path) n = n && n[p]; return n; }

function itemsToHtml(items) {
  return items.map((it) => {
    if (it.k === 'heading') return `<h3 class="sh">${esc(it.html)}</h3>`;
    if (it.k === 'label') return `<p class="lbl">${esc(it.html)}</p>`;
    if (it.k === 'note') return `<p class="note">${esc(it.html)}</p>`;
    return `<p class="tx${it.red ? ' ins' : ''}">${it.html}</p>`;
  }).join('');
}

async function renderPrayer(id) {
  const prog = P[id];
  page(prog.title, '<p class="loading">טוען…</p>', { back: '#home', nav: false, cls: 'reading', right: `<button class="jump" id="jumpBtn">${icon('list', 18)}קפיצה</button>` });
  const sid = await load('sefard');
  const ctx = ctxFor(id);
  let html = '';
  const toc = [];
  let n = 0;
  for (const part of prog.parts) {
    if (part.cond && !(part.cond in ctx ? ctx[part.cond] : false)) continue;
    let body = '';
    if (part.fastSelichot) {
      const key = ctx.descs.find((d) => /Tevet/.test(d)) ? "Selichot for Asara B'Tevet" :
        ctx.descs.find((d) => /Esther/.test(d)) ? 'Selichot for Taanit Esther' :
          ctx.descs.find((d) => /Tamuz|Tammuz/.test(d)) ? 'Selichot for 17 Tamuz' : null;
      if (key) body += itemsToHtml(renderSegments(sid['Fast Days'][key], ctx, S));
      else if (ctx.descs.find((d) => /Gedaliah/.test(d))) {
        const sel = await load('selichot');
        body += itemsToHtml(renderSegments(sel['Fast of Gedaliah'], ctx, S));
      }
    }
    for (const pth of part.p || []) {
      const [a, b, cond] = pth;
      if (cond && !dayEval(cond, ctx)) continue;
      const segs = getPath(sid, [a, b]);
      if (!segs) continue;
      let ranges = part.ranges || [];
      if (part.omer) {
        ranges = [];
        for (let k = 4; k <= 52; k++) if (k !== 3 + ctx.omer) ranges.push([k, k, 'never']);
      }
      body += itemsToHtml(renderSegments(segs, ctx, S, { ranges, from: part.from, to: part.to, amidah: part.amidah }));
    }
    if (part.reading) {
      try { body += await readingHtml(getLeyningOnDate(ctx.hd, true)); } catch (e) { /* no reading */ }
    }
    if (!body.trim()) continue;
    const anchor = 'sec' + n++;
    const title = typeof part.t === 'function' ? part.t(ctx) : part.t;
    toc.push([anchor, title]);
    html += `<section id="${anchor}"><h2 class="ph">${title}</h2>${body}</section>`;
  }
  const banner = dayBanner(ctx);
  $('main').innerHTML = (banner ? `<div class="banner">${banner}</div>` : '') + html + '<div class="end">תם ונשלם</div>';
  $('#jumpBtn').onclick = () => openJump(toc);
}

function dayEval(cond, ctx) {
  if (cond[0] === '!') return !ctx[cond.slice(1)];
  return !!ctx[cond];
}

function dayBanner(ctx) {
  const a = [];
  if (ctx.rc) a.push('ראש חודש');
  if (ctx.chanukah) a.push('חנוכה');
  if (ctx.purim) a.push('פורים');
  if (ctx.minorFast) a.push('תענית ציבור');
  if (ctx.tishabav) a.push('תשעה באב');
  if (ctx.ayt) a.push('עשרת ימי תשובה');
  if (ctx.cholhamoed) a.push('חול המועד');
  if (!a.length) return '';
  return 'היום ' + a.join(' · ') + ' – התוספות מסומנות באדום';
}

function openJump(toc) {
  const d = document.createElement('div');
  d.className = 'sheet';
  d.innerHTML = `<div class="sheet-in" role="dialog" aria-label="קפיצה"><p class="sheet-t">קפיצה אל</p>${toc.map(([a, t]) => `<button data-a="${a}">${t}</button>`).join('')}<button class="close">סגור</button></div>`;
  document.body.appendChild(d);
  d.onclick = (e) => {
    const a = e.target.closest('button');
    if (e.target === d || (a && a.classList.contains('close'))) { d.remove(); return; }
    if (a && a.dataset.a) { d.remove(); const el = document.getElementById(a.dataset.a); if (el) el.scrollIntoView(); }
  };
}

/* ---------------- home ---------------- */
function currentPrayer(z, now) {
  if (z.chatzot && now < z.chatzot) return 'shacharit';
  if (z.sunset && now < z.sunset) return 'mincha';
  return 'maariv';
}

function learningLine(key, hd) {
  try {
    const ev = DailyLearning.lookup(key, hd, true);
    return ev ? ev.render('he') : '';
  } catch (e) { return ''; }
}

function renderHome() {
  const now = NOW();
  const { hd, evening, z } = nowHDate(S.city, now);
  const civil = new HDate(now);
  const ctx = ctxFor(null, now);
  const cur = currentPrayer(z, now);
  const pbtn = (id, ic, col, sub) => `<a class="pbtn ${cur === id ? 'on' : ''}" href="#p-${id}" style="--c:${COL[col][0]};--t:${COL[col][1]}">
    <span class="pi">${icon(ic, 24)}</span><b>${P[id].title}</b><small>${sub}</small></a>`;
  const rows = [];
  const row = (ic, col, label, val, red, href) => rows.push(`<${href ? `a href="${href}"` : 'div'} class="row" style="--c:${COL[col][0]};--t:${COL[col][1]}"><span class="ri">${icon(ic, 18)}</span><span class="rl">${label}</span><span class="rv${red ? ' red' : ''}">${val}</span></${href ? 'a' : 'div'}>`);
  row('drop', 'sky', 'בעמידה', (ctx.winter ? 'משיב הרוח' : 'מוריד הטל') + ' · ' + (ctx.talumatar ? 'ותן טל ומטר' : 'ותן ברכה'), true);
  if (ctx.rc) row('moonfull', 'purple', 'ראש חודש', 'יעלה ויבוא · הלל · מוסף', true);
  if (ctx.chanukah) row('candles', 'blue', 'חנוכה', 'על הניסים · הלל שלם', true);
  if (ctx.minorFast) row('heart', 'pink', 'תענית ציבור', 'עננו · סליחות · אבינו מלכנו', true);
  if (ctx.ayt) row('heart', 'pink', 'עשרת ימי תשובה', 'זכרנו לחיים · המלך הקדוש', true);
  row('list', 'amber', 'תחנון', ctx.tachanun ? 'אומרים' : 'לא אומרים');
  if (ctx.torah || dayCtx(ctx.hd, { prayer: 'shacharit' }).torah) row('scroll', 'orange', 'קריאת התורה', 'בשחרית', false, '#p-shacharit');
  const ps = learningLine('psalms', civil);
  row('book', 'green', 'תהילים יומי', ps.replace(/^תְּהִלִּים\s*/, '') || '—', false, '#tehillim-day');
  if (S.learning.includes('dirshudafhalacha')) row('scroll', 'purple', 'משנה ברורה יומי', learningLine('dirshudafhalacha', civil).replace(/^.*?:\s*/, ''), false, '#learn');

  // special buttons that appear only when relevant
  const special = [];
  const eveCtx = dayCtx(civil.next(), { walled: cityInfo(S.city).walled, purim: S.purim });
  if (ctx.selichot) special.push(tile('#selichot', 'heart', 'pink', 'סליחות', 'סליחות להיום'));
  if (eveCtx.chanukah && (evening || now.getHours() >= 12)) special.push(tile('#s-chanukah', 'candles', 'blue', 'הדלקת נרות חנוכה', 'הלילה: נר ' + gematriya(eveCtx.chanukahDay)));
  if (ctx.purim) special.push(tile('#megilla-Esther', 'scroll', 'amber', 'מגילת אסתר', 'עם הברכות'));
  if (ctx.tishabav) special.push(tile('#read-Lamentations', 'scroll', 'red', 'מגילת איכה', ''));
  const omerCtx = evening ? ctx : eveCtx;
  if (omerCtx.omer && (evening || now.getHours() >= 15)) special.push(tile('#p-maariv', 'star', 'green', 'ספירת העומר', 'הלילה ' + omerCtx.omer + ' לעומר'));
  if (ctx.levana) special.push(tile('#s-levana', 'moonfull', 'indigo', 'קידוש לבנה', 'אפשר לברך'));

  const sub = `יום ${DOW[now.getDay()]} · ${esc(S.city)}${evening ? ' · אור ל' : ''}`;
  page(hebDate(hd), `
    <div class="pgrid">${pbtn('shacharit', 'sun', 'blue', 'עד חצות')}${pbtn('mincha', 'sunset', 'orange', 'עד השקיעה')}${pbtn('maariv', 'moon', 'indigo', 'בלילה')}</div>
    ${special.length ? `<div class="grid2">${special.join('')}</div>` : ''}
    <section class="card"><h2>היום</h2>${rows.join('')}</section>
    <div class="grid2">${tile('#s-birkat', 'plate', 'orange', 'ברכת המזון')}${tile('#s-meein', 'leaf', 'green', 'מעין שלוש')}${tile('#s-derech', 'route', 'teal', 'תפילת הדרך')}${tile('#tehillim', 'book', 'green', 'תהילים')}</div>
  `, { sub, nav: 'home', right: `<a class="hbtn" href="#zmanim" aria-label="זמני היום">${icon('clock', 22)}</a>` });
}

/* ---------------- menu & other prayers ---------------- */
const OTHER = {
  birkat: ['ברכת המזון', ['Birchat HaMazon', 'Birchat HaMazon']],
  meein: ['מעין שלוש', ['Blessings', "Me'ein Shalosh"]],
  nefashot: ['בורא נפשות', ['Blessings', 'Borei Nefashot']],
  asher: ['ברכות השחר ואשר יצר', ['Weekday Shacharit', 'Morning Blessings']],
  derech: ['תפילת הדרך', ['Blessings', "Traveler's Prayer"]],
  bedtime: ['קריאת שמע על המיטה', ['Bedtime Shema']],
  levana: ['קידוש לבנה', ['Kiddush Levanah']],
  chanukah: ['הדלקת נרות חנוכה', ['Chanukah', 'Menorah Lighting'], 'evening'],
  sheva: ['שבע ברכות', ['Various Blessings', 'Sheva Berachot']],
  brit: ['ברית מילה', ['Various Blessings', 'Circumcision']],
  omer: ['ספירת העומר', ['Weekday Maariv', 'Sefirat HaOmer'], 'evening'],
};

function renderMenu() {
  page('כל התפילות', `
    <label class="search">${icon('search', 20)}<input id="q" type="search" placeholder="חיפוש: תהילים, ברכת המזון, הפטרה…" aria-label="חיפוש"></label>
    <div class="grid2" id="mg">
      ${tile('#p-shacharit', 'sun', 'blue', 'שחרית')}${tile('#p-mincha', 'sunset', 'orange', 'מנחה')}${tile('#p-maariv', 'moon', 'indigo', 'ערבית')}
      ${tile('#s-birkat', 'plate', 'orange', 'ברכת המזון')}${tile('#s-meein', 'leaf', 'green', 'מעין שלוש')}${tile('#s-nefashot', 'drop', 'sky', 'בורא נפשות')}
      ${tile('#s-asher', 'heart', 'pink', 'אשר יצר')}${tile('#s-derech', 'route', 'teal', 'תפילת הדרך')}${tile('#s-bedtime', 'bed', 'indigo', 'ק״ש על המיטה')}
      ${tile('#s-levana', 'moonfull', 'purple', 'קידוש לבנה')}${tile('#tzara', 'shield', 'red', 'תפילה לעת צרה')}${tile('#tehillim', 'book', 'green', 'תהילים')}
      ${tile('#haftara', 'scroll', 'amber', 'הפטרת השבוע')}${tile('#megillot', 'scroll', 'orange', 'מגילות')}${tile('#chatzot', 'moon', 'indigo', 'תיקון חצות')}
      ${tile('#selichot', 'heart', 'red', 'סליחות')}${tile('#s-sheva', 'star', 'pink', 'שבע ברכות')}${tile('#s-brit', 'star', 'blue', 'ברית מילה')}
      ${tile('#s-omer', 'star', 'green', 'ספירת העומר')}${tile('#s-chanukah', 'candles', 'blue', 'נרות חנוכה')}${tile('#zmanim', 'clock', 'sky', 'זמני היום')}
    </div>`, { nav: 'menu' });
  $('#q').oninput = (e) => {
    const q = e.target.value.trim();
    document.querySelectorAll('#mg .tile').forEach((t) => { t.style.display = !q || t.textContent.includes(q) ? '' : 'none'; });
  };
}

async function renderOther(id) {
  const o = OTHER[id];
  if (!o) return renderHome();
  page(o[0], '<p class="loading">טוען…</p>', { back: '#menu', nav: false, cls: 'reading' });
  const sid = await load('sefard');
  const now = NOW();
  const civil = new HDate(now);
  const ci = cityInfo(S.city);
  const hd = o[2] === 'evening' ? (now.getHours() >= 12 ? civil.next() : civil) : nowHDate(S.city, now).hd;
  const ctx = dayCtx(hd, { walled: ci.walled, purim: S.purim });
  const node = getPath(sid, o[1]);
  let ranges = [];
  if (id === 'omer') {
    if (!ctx.omer) { $('main').innerHTML = '<p class="empty">ספירת העומר מתחילה בליל ט״ז בניסן.</p>'; return; }
    for (let k = 4; k <= 52; k++) if (k !== 3 + ctx.omer) ranges.push([k, k, 'never']);
  }
  const segs = Array.isArray(node) ? node : Object.values(node).flat();
  // stop before the "laws for one who forgot" appendix
  const stopAt = segs.findIndex((s) => /דיני שכחה/.test(strip(s)));
  $('main').innerHTML = itemsToHtml(renderSegments(segs, ctx, S, { ranges, to: stopAt > 0 ? stopAt - 1 : undefined }));
}

async function renderTzara() {
  page('תפילה לעת צרה', '<p class="loading">טוען…</p>', { back: '#menu', nav: false, cls: 'reading' });
  const [ps, sid] = await Promise.all([load(bookKey('Psalms')), load('sefard')]);
  let h = '';
  for (const c of [20, 83, 121, 130, 142]) h += `<h3 class="sh">תהילים ${gematriya(c)}</h3><p class="tx">${refText('Psalms', c + ':1', c + ':' + ps[c - 1].length)}</p>`;
  const ach = sid['Weekday Shacharit']['Torah Reading'].find((s) => /אַחֵֽינוּ כָּל בֵּית יִשְׂרָאֵל/.test(s));
  if (ach) h += `<h3 class="sh">אחינו</h3><p class="tx">${ach}</p>`;
  $('main').innerHTML = h;
}

async function renderChatzot() {
  page('תיקון חצות', '<p class="loading">טוען…</p>', { back: '#menu', nav: false, cls: 'reading' });
  const d = await load('chatzot');
  const ctx = ctxFor(null);
  const T = { 'LeShem Yichud': 'לשם יחוד', 'Tikkun Rachel': 'תיקון רחל', 'Tikkun Leah': 'תיקון לאה' };
  $('main').innerHTML = Object.entries(d).map(([k, v]) => `<h2 class="ph">${T[k] || k}</h2>${itemsToHtml(renderSegments(v, ctx, S))}`).join('');
}

async function renderSelichot() {
  page('סליחות', '<p class="loading">טוען…</p>', { back: '#home', nav: false, cls: 'reading' });
  const ctx = ctxFor(null);
  const sel = await load('selichot');
  const HE = {
    'First Day': 'יום ראשון', 'Second Day': 'יום שני', 'Third Day': 'יום שלישי', 'Fourth Day': 'יום רביעי', 'Fifth Day': 'יום חמישי',
    'Sixth Day': 'יום שישי', 'Seventh Day': 'יום שביעי', 'Erev Rosh Hashana': 'ערב ראש השנה', 'Fast of Gedaliah': 'צום גדליה',
    'Second Day of the Ten Days of Penitence': 'יום ב׳ של עשי״ת', 'Third Day of the Ten Days of Penitence': 'יום ג׳ של עשי״ת',
    'Fourth Day of the Ten Days of Penitence': 'יום ד׳ של עשי״ת', 'Fifth Day of the Ten Days of Penitence': 'יום ה׳ של עשי״ת', 'Yom Kippur Eve': 'ערב יום כיפור',
  };
  const key = ctx.selichot ? selichotKey(ctx.hd) : (location.hash.includes('-') ? decodeURIComponent(location.hash.slice(location.hash.indexOf('-') + 1)).replace(/_/g, ' ') : null);
  if (!key) {
    $('main').innerHTML = `<p class="empty">היום לא אומרים סליחות. הסליחות יופיעו לבד במסך הבית בימים שאומרים, לפי מנהג נוסח ספרד.</p>
      <div class="list">${Object.keys(sel).map((k) => `<a href="#selichot-${k.replace(/ /g, '_')}">${HE[k] || k}</a>`).join('')}</div>`;
    return;
  }
  const node = sel[key];
  const segs = Array.isArray(node) ? node : Object.values(node).flat(3);
  $('main').innerHTML = `<h2 class="ph">${HE[key] || key}</h2>` + itemsToHtml(renderSegments(segs.filter((x) => typeof x === 'string'), ctx, S));
}

/* ---------------- tehillim & tanakh ---------------- */
const WEEK = [[1, 29], [30, 50], [51, 72], [73, 89], [90, 106], [107, 119], [120, 150]];
function renderTehillimMenu() {
  const civil = new HDate(NOW());
  const today = learningLine('psalms', civil).replace(/^תְּהִלִּים\s*/, '');
  const w = WEEK[NOW().getDay()];
  let grid = '';
  for (let i = 1; i <= 150; i++) grid += `<a class="num" href="#tehillim-${i}">${gematriya(i)}</a>`;
  page('תהילים', `
    <div class="grid2">${tile('#tehillim-day', 'book', 'green', 'תהילים יומי', 'היום: ' + today)}${tile('#tehillim-week', 'list', 'teal', 'לפי ימי השבוע', `יום ${DOW[NOW().getDay()]}: ${gematriya(w[0])}–${gematriya(w[1])}`)}</div>
    <section class="card"><h2>בחר פרק</h2><div class="nums">${grid}</div></section>`, { back: '#home', nav: 'menu' });
}

async function renderTehillim(arg) {
  const ps = await load(bookKey('Psalms'));
  let ranges = [];
  let title = 'תהילים';
  if (arg === 'day') {
    const ev = DailyLearning.lookup('psalms', new HDate(NOW()), true);
    const m = ev && ev.getDesc().match(/(\d+)(?::(\d+))?-(\d+)(?::(\d+))?/);
    if (m) {
      const c1 = +m[1], v1 = +(m[2] || 1), c2 = +m[3], v2 = m[4] ? +m[4] : ps[c2 - 1].length;
      ranges = [[c1, v1, c2, v2]];
      title = 'תהילים יומי';
    }
  } else if (arg === 'week') {
    const w = WEEK[NOW().getDay()];
    ranges = [[w[0], 1, w[1], ps[w[1] - 1].length]];
    title = 'תהילים – יום ' + DOW[NOW().getDay()];
  } else {
    const c = Math.min(150, Math.max(1, +arg || 1));
    ranges = [[c, 1, c, ps[c - 1].length]];
    title = 'תהילים ' + gematriya(c);
  }
  let h = '';
  for (const [c1, v1, c2, v2] of ranges) {
    for (let c = c1; c <= c2; c++) {
      h += `<h3 class="sh">פרק ${gematriya(c)}</h3><p class="tx">${refText('Psalms', c + ':' + (c === c1 ? v1 : 1), c + ':' + (c === c2 ? v2 : ps[c - 1].length))}</p>`;
    }
  }
  const one = /^\d+$/.test(arg) ? +arg : null;
  const pager = one ? `<div class="pager">${one > 1 ? `<a href="#tehillim-${one - 1}">→ פרק ${gematriya(one - 1)}</a>` : '<span></span>'}${one < 150 ? `<a href="#tehillim-${one + 1}">פרק ${gematriya(one + 1)} ←</a>` : ''}</div>` : '';
  page(title, h + pager, { back: '#tehillim', nav: false, cls: 'reading' });
}

async function renderBook(book) {
  page(HEB_BOOK[book] || book, '<p class="loading">טוען…</p>', { back: '#megillot', nav: false, cls: 'reading' });
  const t = await load(bookKey(book));
  $('main').innerHTML = t.map((ch, i) => `<h3 class="sh">פרק ${gematriya(i + 1)}</h3><p class="tx">${refText(book, (i + 1) + ':1', (i + 1) + ':' + ch.length)}</p>`).join('');
}

async function renderMegilla() {
  page('מגילת אסתר', '<p class="loading">טוען…</p>', { back: '#home', nav: false, cls: 'reading' });
  const [sid, t] = await Promise.all([load('sefard'), load(bookKey('Esther'))]);
  const ctx = ctxFor(null);
  const blessings = sid.Purim['Megillah Reading'];
  const before = itemsToHtml(renderSegments(blessings, ctx, S, { to: 5 }));
  const after = itemsToHtml(renderSegments(blessings, ctx, S, { from: 7 }));
  const text = t.map((ch, i) => `<h3 class="sh">פרק ${gematriya(i + 1)}</h3><p class="tx">${refText('Esther', (i + 1) + ':1', (i + 1) + ':' + ch.length)}</p>`).join('');
  $('main').innerHTML = `<h2 class="ph">ברכות לפני הקריאה</h2>${before}<h2 class="ph">המגילה</h2>${text}<h2 class="ph">אחרי הקריאה</h2>${after}`;
}

function renderMegillot() {
  page('מגילות', `<div class="grid2">
    ${tile('#megilla-Esther', 'scroll', 'amber', 'מגילת אסתר', 'פורים')}${tile('#read-Lamentations', 'scroll', 'red', 'איכה', 'תשעה באב')}
    ${tile('#read-Ruth', 'scroll', 'green', 'רות', 'שבועות')}${tile('#read-Song_of_Songs', 'scroll', 'pink', 'שיר השירים', 'פסח')}
    ${tile('#read-Ecclesiastes', 'scroll', 'teal', 'קהלת', 'סוכות')}</div>`, { back: '#menu', nav: 'menu' });
}

async function renderHaftara() {
  page('הפטרת השבוע', '<p class="loading">טוען…</p>', { back: '#menu', nav: false, cls: 'reading' });
  let d = new HDate(NOW());
  while (d.getDay() !== 6) d = d.next();
  const ley = getLeyningOnDate(d, true);
  if (!ley || !ley.haft) { $('main').innerHTML = '<p class="empty">לא נמצאה הפטרה לשבת הקרובה.</p>'; return; }
  const parts = Array.isArray(ley.haft) ? ley.haft : [ley.haft];
  await Promise.all(parts.map((p) => load(bookKey(p.k))));
  const name = ley.name && ley.name.he ? ley.name.he : '';
  $('main').innerHTML = `<div class="banner">שבת ${hebDate(d)} · ${esc(name)}</div>` +
    parts.map((p) => `<h3 class="sh">${HEB_BOOK[p.k] || p.k}</h3><p class="tx">${refText(p.k, p.b, p.e)}</p>`).join('');
}

/* ---------------- learning ---------------- */
const LEARN = [
  ['dirshudafhalacha', 'משנה ברורה יומי (דרשו)'], ['psalms', 'תהילים יומי'], ['dafyomi', 'דף יומי'], ['dirshuamudyomi', 'עמוד יומי (דרשו)'],
  ['mishnayomi', 'משנה יומית'], ['rambam1', 'רמב״ם – פרק ליום'], ['rambam3', 'רמב״ם – 3 פרקים'], ['kitzurshulchanaruch', 'קיצור שולחן ערוך'],
  ['arukhhashulchanyomi', 'ערוך השולחן'], ['chofetzchaim', 'חפץ חיים'], ['shemirathalashon', 'שמירת הלשון'], ['nachyomi', 'נ״ך יומי'], ['tanyayomi', 'תניא יומי'],
];

async function renderLearn() {
  const hd = new HDate(NOW());
  const rows = S.learning.map((k) => {
    const name = (LEARN.find((x) => x[0] === k) || [k, k])[1];
    const v = learningLine(k, hd).replace(/^.*?:\s*/, '');
    const href = k === 'dirshudafhalacha' ? '#mb' : k === 'psalms' ? '#tehillim-day' : '#l-' + k;
    return `<a href="${href}" class="row" style="--c:#A855F7;--t:#FAF5FF"><span class="ri">${icon('book', 18)}</span><span class="rl">${name}</span><span class="rv">${esc(v)}</span></a>`;
  });
  page('לימוד יומי', `<section class="card"><h2>היום · ${hebDate(hd)}</h2>${rows.join('') || '<p class="empty">לא נבחר לימוד. בחר בהגדרות.</p>'}</section>
    <p class="hint">את מסלולי הלימוד בוחרים בהגדרות. כל לימוד נפתח עם הטקסט המלא.</p>`, { nav: 'learn' });
}

const num = (x) => String(x).split(/[.:]/).map(Number);
const segs = (arr) => (arr || []).filter((x) => typeof x === 'string' && x.trim()).map((x) => `<p class="tx">${x}</p>`).join('');
function rangeParse(str) {
  // "9.1-9.2" | "4-6" | "28:1" -> [[a,b],[c,d]]
  const [a, b] = String(str).split('-');
  const A = num(a);
  let B = b && !/end|סוף/.test(b) ? num(b) : (b ? [A[0], 9999] : A);
  if (B.length === 1 && A.length === 2) B = [A[0], B[0]];
  return [A, B];
}

async function renderLearnItem(k) {
  const name = (LEARN.find((x) => x[0] === k) || [k, k])[1];
  page(name, '<p class="loading">טוען…</p>', { back: '#learn', nav: false, cls: 'reading' });
  const hd = new HDate(NOW());
  let ev;
  try { ev = DailyLearning.lookup(k, hd, true); } catch (e) { ev = null; }
  if (!ev) { $('main').innerHTML = '<p class="empty">אין לימוד היום במסלול הזה.</p>'; return; }
  const idx = await load('learn_index');
  let h = `<div class="banner">${esc(ev.render('he'))}</div>`;
  const desc = ev.getDesc();
  try {
    if (k === 'dafyomi' || k === 'dirshuamudyomi') {
      const nm = k === 'dafyomi' ? ev.daf.name : ev.amud.name;
      const key = idx.bavli[nm];
      if (!key) throw new Error('missing');
      const t = await load(key);
      if (key.startsWith('mishnah_')) {
        h += t.map((ch, i) => `<h3 class="sh">פרק ${gematriya(i + 1)}</h3>${segs(ch)}`).join('');
      } else {
        const sides = k === 'dafyomi' ? [[ev.daf.blatt, 'a'], [ev.daf.blatt, 'b']] : [[ev.amud.amud, ev.amud.side]];
        for (const [d, sd] of sides) {
          const i = 2 * d - 2 + (sd === 'b' ? 1 : 0);
          h += `<h3 class="sh">דף ${gematriya(d)} עמוד ${sd === 'a' ? 'א' : 'ב'}</h3>${segs(t[i])}`;
        }
      }
    } else if (k === 'mishnayomi') {
      for (const m of ev.mishnaYomi) {
        const t = await load(idx.mishnah[m.k]);
        const [c, v] = num(m.v);
        h += `<h3 class="sh">פרק ${gematriya(c)} משנה ${gematriya(v)}</h3><p class="tx">${(t[c - 1] || [])[v - 1] || ''}</p>`;
      }
    } else if (k === 'rambam1' || k === 'rambam3') {
      const list = k === 'rambam1' ? [ev.reading] : ev.readings;
      for (const r of list) {
        const t = await load(idx.rambam[r.name]);
        const [[a], [b]] = rangeParse(r.perek);
        for (let p = a; p <= b; p++) h += `<h3 class="sh">פרק ${gematriya(p)}</h3>${(t[p - 1] || []).map((x, i) => `<p class="tx"><sup>${gematriya(i + 1)}</sup>${x}</p>`).join('')}`;
      }
    } else if (k === 'kitzurshulchanaruch' || k === 'arukhhashulchanyomi') {
      if (k === 'arukhhashulchanyomi' && ev.reading.k !== 'Orach Chaim') throw new Error('missing');
      const t = await load(k === 'kitzurshulchanaruch' ? 'kitzur' : 'arukh_oc');
      const [[s1, f1], [s2, f2]] = rangeParse(k === 'kitzurshulchanaruch' ? ev.reading.b + '-' + (ev.reading.e || ev.reading.b) : ev.reading.v);
      for (let si = s1; si <= s2; si++) {
        const sim = t[si - 1] || [];
        const a = si === s1 ? f1 || 1 : 1, b = si === s2 ? f2 || sim.length : sim.length;
        h += `<h3 class="sh">סימן ${gematriya(si)}</h3>`;
        for (let f = a; f <= b; f++) if (sim[f - 1]) h += `<p class="tx"><sup>${gematriya(f)}</sup>${sim[f - 1]}</p>`;
      }
    } else if (k === 'chofetzchaim' || k === 'shemirathalashon') {
      const memo = ev.memo || desc;
      let t = await load(k === 'chofetzchaim' ? 'chafetz' : 'shemirat');
      let section = null, label = '';
      if (k === 'shemirathalashon') {
        const bk = /Book II/.test(memo) ? 'Book II' : 'Book I';
        const sub = Object.keys(t[bk]).filter((x) => x && memo.includes(x)).sort((x, y) => y.length - x.length)[0] || '';
        section = t[bk][sub]; label = sub;
      } else {
        const key = Object.keys(t).filter((x) => memo.startsWith(x)).sort((x, y) => y.length - x.length)[0] ||
          Object.keys(t).find((x) => memo.startsWith(x.split(' ')[0]));
        section = t[key];
        if (section && !Array.isArray(section)) {
          const sub = Object.keys(section).filter((x) => x && memo.includes(x)).sort((x, y) => y.length - x.length)[0];
          section = sub ? section[sub] : Object.values(section).map((v) => (Array.isArray(v) ? v : v[''] || Object.values(v).flat()));
        }
      }
      const m = memo.match(/([\d.]+)(?:-([\d.]+))?(?:\s|$)/);
      if (!section || !m) throw new Error('missing');
      const [b, e] = [num(m[1]), num(m[2] || m[1])];
      if (Array.isArray(section) && Array.isArray(section[0])) {
        for (let c = b[0]; c <= e[0]; c++) {
          const ch = section[c - 1] || [];
          const from = c === b[0] ? b[1] || 1 : 1, to = c === e[0] ? e[1] || ch.length : ch.length;
          h += `<h3 class="sh">פרק ${gematriya(c)}</h3>`;
          for (let v = from; v <= to; v++) if (ch[v - 1]) h += `<p class="tx"><sup>${gematriya(v)}</sup>${ch[v - 1]}</p>`;
        }
      } else if (Array.isArray(section)) {
        for (let v = b[0]; v <= e[0]; v++) if (section[v - 1]) h += `<p class="tx">${section[v - 1]}</p>`;
      }
    } else if (k === 'tanyayomi') {
      const t = await load('tanya');
      const key = Object.keys(t).find((x) => x.includes(ev.reading.book));
      let sec = t[key];
      if (!Array.isArray(sec)) sec = sec[''] || Object.values(sec).find(Array.isArray);
      const ch = Array.isArray(sec[0]) ? sec[ev.reading.chap - 1] : sec;
      h += `<h3 class="sh">פרק ${gematriya(ev.reading.chap)}</h3>${segs(ch)}`;
    } else if (k === 'nachyomi') {
      await load(bookKey(ev.k));
      const t = window.D[bookKey(ev.k)];
      h += `<h3 class="sh">${HEB_BOOK[ev.k] || ev.k} ${gematriya(ev.v)}</h3><p class="tx">${refText(ev.k, ev.v + ':1', ev.v + ':' + t[ev.v - 1].length)}</p>`;
    } else throw new Error('missing');
  } catch (e) {
    h += '<p class="empty">הטקסט של הלימוד הזה עדיין לא זמין באפליקציה.</p>';
  }
  $('main').innerHTML = h;
}

async function renderMB() {
  page('משנה ברורה יומי', '<p class="loading">טוען…</p>', { back: '#learn', nav: false, cls: 'reading' });
  const ev = DailyLearning.lookup('dirshudafhalacha', new HDate(NOW()), true);
  if (!ev || !ev.reading) { $('main').innerHTML = '<p class="empty">אין לימוד היום.</p>'; return; }
  const [s1, f1] = ev.reading.b.split(':').map(Number);
  const [s2, f2] = (ev.reading.e || ev.reading.b).split(':').map(Number);
  let h = `<div class="banner">${esc(ev.render('he'))}</div>`;
  for (let s = s1; s <= s2; s++) {
    const chunk = await load('mb_' + Math.floor((s - 1) / 25));
    const sim = chunk[s] || [];
    const a = s === s1 ? f1 : 1, b = s === s2 ? f2 : sim.length;
    h += `<h2 class="ph">סימן ${gematriya(s)}</h2>`;
    for (let f = a; f <= b; f++) {
      const e = sim[f - 1];
      if (!e) continue;
      h += `<h3 class="sh">שולחן ערוך · סעיף ${gematriya(f)}</h3><p class="tx sa">${e.s.replace(/<i [^>]*><\/i>/g, '')}</p>`;
      if (e.m.length) h += `<div class="mbx"><p class="lbl">משנה ברורה</p>${e.m.map((c) => `<p class="mbc">${c}</p>`).join('')}</div>`;
    }
  }
  $('main').innerHTML = h;
}

/* ---------------- zmanim ---------------- */
function renderZmanim() {
  const now = NOW();
  const z = zmanim(S.city, now);
  page('זמני היום', `<div class="banner">${esc(S.city)} · ${hebDate(new HDate(now))}</div>
    <section class="card">${z.list.map(([l, v]) => `<div class="zrow"><span>${l}</span><b>${v}</b></div>`).join('')}</section>
    <p class="hint">הזמנים מחושבים לפי העיר שנבחרה בהגדרות, כולל מעבר שעון חורף וקיץ. מומלץ לא לסמוך על הדקה האחרונה.</p>`, { back: '#home', nav: 'home' });
}

/* ---------------- settings ---------------- */
function renderSettings() {
  page('הגדרות', `
    <section class="card form">
      <label>נוסח<select id="nusach"><option value="sefard">ספרד</option><option disabled>אשכנז (בקרוב)</option><option disabled>עדות המזרח (בקרוב)</option></select>
        <small>קובע גם מתי מופיעות סליחות</small></label>
      <label>עיר<select id="city">${CITIES.map((c) => `<option ${c[0] === S.city ? 'selected' : ''}>${c[0]}</option>`).join('')}</select>
        <small>לזמני היום, לתחילת היום העברי ולפורים</small></label>
      <label>פורים<select id="purim">
        <option value="auto">לפי העיר</option><option value="14">י״ד אדר</option><option value="15">ט״ו אדר (ירושלים)</option><option value="both">שניהם</option></select></label>
    </section>
    <section class="card form redb">
      <h2>${icon('heart', 18)} שמות לרפואה</h2>
      <small>שם אחד בכל שורה, למשל: רות בת מרים. יופיעו באדום בברכת רפאנו.</small>
      <textarea id="names" rows="6" placeholder="פלוני בן פלונית">${esc((S.names || []).join('\n'))}</textarea>
    </section>
    <section class="card form">
      <label class="sw"><span>מצנזר שמות ה׳</span><input type="checkbox" id="censor" ${S.censor ? 'checked' : ''}></label>
      <label class="sw"><span>מצב לילה</span><input type="checkbox" id="night" ${S.night ? 'checked' : ''}></label>
      <label class="sw"><span>הצג הוראות והלכות קטנות</span><input type="checkbox" id="notes" ${S.notes ? 'checked' : ''}></label>
      <label>גודל כתב <input type="range" id="font" min="16" max="36" step="1" value="${S.font}"></label>
      <p class="tx" id="sample" style="margin:0">בָּרוּךְ אַתָּה יְהֹוָה</p>
    </section>
    <section class="card form">
      <h2>לימוד יומי</h2>
      ${LEARN.map(([k, n]) => `<label class="sw"><span>${n}</span><input type="checkbox" data-learn="${k}" ${S.learning.includes(k) ? 'checked' : ''}></label>`).join('')}
    </section>
    <p class="hint">גרסה ראשונה · הטקסטים מספריא (Sefaria), הלוח מ-Hebcal</p>`, { nav: 'set' });
  $('#purim').value = S.purim;
  $('#city').onchange = (e) => { S.city = e.target.value; save(); };
  $('#purim').onchange = (e) => { S.purim = e.target.value; save(); };
  $('#names').oninput = (e) => { S.names = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); save(); };
  ['censor', 'night', 'notes'].forEach((k) => { $('#' + k).onchange = (e) => { S[k] = e.target.checked; save(); }; });
  $('#font').oninput = (e) => { S.font = +e.target.value; save(); };
  document.querySelectorAll('[data-learn]').forEach((el) => {
    el.onchange = () => { S.learning = [...document.querySelectorAll('[data-learn]:checked')].map((x) => x.dataset.learn); save(); };
  });
}

/* ---------------- router ---------------- */
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  const k = h.indexOf('-');
  const a = k < 0 ? h : h.slice(0, k);
  const b = k < 0 ? '' : h.slice(k + 1).replace(/_/g, ' ');
  try {
    if (a === 'p' && P[b]) return renderPrayer(b);
    if (a === 'menu') return renderMenu();
    if (a === 's') return renderOther(b);
    if (a === 'tehillim') return b ? renderTehillim(b) : renderTehillimMenu();
    if (a === 'read') return renderBook(b);
    if (a === 'megilla') return renderMegilla();
    if (a === 'megillot') return renderMegillot();
    if (a === 'haftara') return renderHaftara();
    if (a === 'tzara') return renderTzara();
    if (a === 'chatzot') return renderChatzot();
    if (a === 'selichot') return renderSelichot();
    if (a === 'learn') return renderLearn();
    if (a === 'mb') return renderMB();
    if (a === 'l') return renderLearnItem(b);
    if (a === 'zmanim') return renderZmanim();
    if (a === 'settings') return renderSettings();
    return renderHome();
  } catch (e) {
    app().innerHTML = `<p class="empty">שגיאה: ${esc(e.message)}</p>`;
    console.error(e);
  }
}
window.addEventListener('hashchange', route);
window.addEventListener('unhandledrejection', (e) => { const m = $('main'); if (m) m.innerHTML = `<p class="empty">שגיאה בטעינה: ${esc(e.reason && e.reason.message)}</p>`; });
applyTheme();
route();
