import { getLeyningForParsha } from '@hebcal/leyning';
import { parshiot } from '@hebcal/core';
import { HDate, months, DailyLearning, getLeyningOnDate, CITIES, cityInfo, zmanim, nowHDate, dayCtx, selichotKey } from './cal.js';
import { gematriya } from '@hebcal/core';
import { renderSegments, strip, flatten } from './siddur.js';

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
  document.documentElement.classList.toggle('n-edot', S.nusach === 'edot');
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
  return dayCtx(hd, { prayer, walled: ci.walled, purim: S.purim, motzash, nusach: S.nusach });
}

function hebDate(hd) { return hd.renderGematriya(true).replace(/\s*תש/, ' תש'); }

/* ---------------- prayer programs (Nusach Sefard) ---------------- */
const P_SEFARD = {
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


const q = (path, cond, extra = {}) => ({ path, cond, ...extra });
const AS = ['Weekday', 'Shacharit'];
const AM = ['Weekday', 'Minchah'];
const AV = ['Weekday', 'Maariv'];
const P_ASHKENAZ = {
  shacharit: {
    title: 'שחרית',
    parts: [
      { t: 'השכמת הבוקר', p: ['Modeh Ani', 'Netilat Yadayim', 'Asher Yatzar', 'Elokai Neshama', 'Tzitzit', 'Torah Blessings', 'Torah Study', 'Tallit'].map((k) => q([...AS, 'Preparatory Prayers', k])).concat([q([...AS, 'Preparatory Prayers', 'Tefillin'], '!tishabav')]) },
      { t: 'מה טובו ואדון עולם', p: ['Ma Tovu', 'Adon Olam', 'Yigdal'].map((k) => q([...AS, 'Preparatory Prayers', k])) },
      { t: 'ברכות השחר', p: ['Morning Blessings', 'Akedah', 'Sovereignty of Heaven'].map((k) => q([...AS, 'Preparatory Prayers', k])) },
      { t: 'קרבנות', p: [q([...AS, 'Preparatory Prayers', 'Korbanot'])] },
      { t: 'פסוקי דזמרה', p: ['Introductory Psalm', "Mourner's Kaddish", "Barukh She'amar", 'Hodu', 'Mizmor Letoda', 'Yehi Chevod', 'Ashrei', 'Psalm 146', 'Psalm 147', 'Psalm 148', 'Psalm 149', 'Psalm 150', 'Closing Verses', 'Vayevarech David', 'Ata Hu', 'Az Yashir', 'Yishtabach'].map((k) => q([...AS, 'Pesukei Dezimra', k])).concat([q([...AS, 'Pesukei Dezimra', 'Psalm 130'], 'ayt'), q([...AS, 'Pesukei Dezimra', 'Half Kaddish'])]) },
      { t: 'קריאת שמע', p: [q([...AS, 'Blessings of the Shema'])] },
      { t: 'עמידה', p: [q([...AS, 'Amidah'])], amidah: true },
      { t: 'הלל', cond: 'hallel', p: [q(['Festivals', 'Rosh Chodesh', 'Hallel'])], hallel: true },
      { t: 'סליחות', cond: 'minorFast', fastSelichot: true },
      { t: 'אבינו מלכנו', cond: 'avinu', p: [q([...AS, 'Post Amidah', 'Avinu Malkenu'])] },
      { t: 'תחנון', cond: 'tachanun', p: [q([...AS, 'Post Amidah', 'Vidui and 13 Middot']), q([...AS, 'Post Amidah', 'Tachanun', 'For Monday and Thursday'], 'monthu'), q([...AS, 'Post Amidah', 'Tachanun', 'Nefilat Apayim']), q([...AS, 'Post Amidah', 'Tachanun', 'God of Israel'], 'monthu'), q([...AS, 'Post Amidah', 'Tachanun', 'Shomer Yisrael'])] },
      { t: 'חצי קדיש', p: [q([...AS, 'Post Amidah', 'Tachanun', 'Half Kaddish'])] },
      { t: 'קריאת התורה', cond: 'torah', p: [q([...AS, 'Torah Reading'])], reading: true },
      { t: 'אשרי ובא לציון', p: [q([...AS, 'Concluding Prayers', 'Ashrei']), q([...AS, 'Concluding Prayers', "Lamenatze'ach"], '!noLamnatzeach'), q([...AS, 'Concluding Prayers', 'Uva Letzion']), q([...AS, 'Concluding Prayers', 'Kaddish Shalem'])] },
      { t: 'מוסף לראש חודש', cond: 'rc', p: [q(['Festivals', 'Rosh Chodesh', 'Musaf Amidah for Rosh Chodesh'])] },
      { t: 'עלינו', p: [q([...AS, 'Concluding Prayers', 'Alenu']), q([...AS, 'Concluding Prayers', "Mourner's Kaddish"])] },
      { t: 'שיר של יום', p: [q([...AS, 'Concluding Prayers', 'Song of the Day']), q([...AS, 'Concluding Prayers', 'Barchi Nafshi'], 'rc')] },
      { t: 'לדוד ה׳ אורי', cond: 'elul', p: [q([...AS, 'Concluding Prayers', 'LeDavid'])] },
    ],
  },
  mincha: {
    title: 'מנחה',
    parts: [
      { t: 'אשרי', p: [q([...AM, 'Ashrei'])] },
      { t: 'קריאת התורה', cond: 'fast', p: [], reading: true },
      { t: 'עמידה', p: [q([...AM, 'Amida'])], amidah: true },
      { t: 'אבינו מלכנו', cond: 'avinu', p: [q([...AM, 'Post Amidah', 'Avinu Malkenu'])] },
      { t: 'תחנון', cond: 'tachanun', p: [q([...AM, 'Post Amidah', 'Vidui and 13 Middot']), q([...AM, 'Post Amidah', 'Tachanun'])] },
      { t: 'קדיש ועלינו', p: [q([...AM, 'Post Amidah', 'Kaddish Shalem']), q([...AM, 'Concluding Prayers'])] },
    ],
  },
  maariv: {
    title: 'ערבית',
    parts: [
      { t: 'קריאת שמע', p: [q([...AV, 'Vehu Rachum']), q([...AV, 'Barchu']), q([...AV, 'Blessings of the Shema'])] },
      { t: 'עמידה', p: [q([...AV, 'Amidah'])], amidah: true },
      { t: 'קדיש', p: [q([...AV, 'Kaddish Shalem'])] },
      { t: 'מוצאי שבת', cond: 'motzash', p: [q([...AV, "Additions for Motza'ei Shabbat"])] },
      { t: 'ספירת העומר', cond: 'omer', p: [q([...AV, 'Sefirat HaOmer'])], omer: true },
      { t: 'עלינו', p: [q([...AV, 'Alenu']), q([...AV, "Mourner's Kaddish"])] },
      { t: 'לדוד ה׳ אורי', cond: 'elul', p: [q([...AV, 'LeDavid'])] },
    ],
  },
};
const ES = ['Weekday Shacharit'];
const P_EDOT = {
  shacharit: {
    title: 'שחרית',
    parts: [
      { t: 'ברכות השחר', p: [q(['Preparatory Prayers'])] },
      { t: 'טלית ותפילין', p: [q([...ES, 'Petichat Eliyahu']), q([...ES, 'Order of Talit']), q([...ES, 'Order of Tefillin'], '!tishabav')] },
      { t: 'קרבנות', p: [q([...ES, "Hanna's Prayer"]), q([...ES, 'Morning Prayer']), q([...ES, 'Incense Offering'])] },
      { t: 'פסוקי דזמרה', p: [q([...ES, 'Hodu']), q([...ES, "Pesukei D'Zimra"])] },
      { t: 'קריאת שמע', p: [q([...ES, 'The Shema'])] },
      { t: 'עמידה', p: [q([...ES, 'Amida'])], amidah: true },
      { t: 'הלל', cond: 'hallel', p: [q(['Rosh Hodesh', 'Hallel'], null, { to: 33 })], hallel: true },
      { t: 'סליחות', cond: 'minorFast', fastSelichot: true },
      { t: 'וידוי ותחנון', p: [q([...ES, 'Vidui'])], ranges: [[1, 10, 'tachanun'], [11, 12, '!monthu'], [13, 32, 'monthu&tachanun'], [33, 33, 'monthu&tachanun']] },
      { t: 'קריאת התורה', cond: 'torah', p: [q([...ES, 'Torah Reading'])], reading: true },
      { t: 'אשרי ובא לציון', p: [q([...ES, 'Ashrei'], null, { ranges: [[4, 5, '!noLamnatzeach']] }), q([...ES, 'Uva LeSion'])] },
      { t: 'מוסף לראש חודש', cond: 'rc', p: [q(['Rosh Hodesh', 'Mussaf'])] },
      { t: 'שיר של יום', p: [q([...ES, 'Beit Yaakov']), q([...ES, 'Song of the Day'], null, { songDay: true }), q(['Rosh Hodesh', 'Barchi Nafshi'], 'rc')] },
      { t: 'קוה ועלינו', p: [q([...ES, 'Kaveh']), q([...ES, 'Alenu'])] },
    ],
  },
  mincha: {
    title: 'מנחה',
    parts: [
      { t: 'קרבנות ואשרי', p: [q(['Weekday Mincha', 'Offerings'])] },
      { t: 'קריאת התורה', cond: 'fast', p: [], reading: true },
      { t: 'עמידה', p: [q(['Weekday Mincha', 'Amida'])], amidah: true },
      { t: 'וידוי וקדיש', p: [q(['Weekday Mincha', 'Vidui'])], ranges: [[1, 9, 'tachanun']] },
      { t: 'עלינו', p: [q(['Weekday Mincha', 'Alenu'])] },
    ],
  },
  maariv: {
    title: 'ערבית',
    parts: [
      { t: 'קריאת שמע', p: [q(['Weekday Arvit', 'Barchu']), q(['Weekday Arvit', 'The Shema'])] },
      { t: 'עמידה', p: [q(['Weekday Arvit', 'Amidah'])], amidah: true },
      { t: 'ספירת העומר', cond: 'omer', p: [q(['Counting of the Omer'])], omer: true },
      { t: 'עלינו', p: [q(['Weekday Arvit', 'Alenu'])] },
    ],
  },
};
const PROGS = { sefard: P_SEFARD, ashkenaz: P_ASHKENAZ, edot: P_EDOT };
const P = new Proxy({}, { get: (o, k) => (PROGS[S.nusach] || P_SEFARD)[k] });
const FAST_SEL = {
  sefard: { Tevet: ['Fast Days', "Selichot for Asara B'Tevet"], Esther: ['Fast Days', 'Selichot for Taanit Esther'], Tamuz: ['Fast Days', 'Selichot for 17 Tamuz'], Gedaliah: 'polin' },
  ashkenaz: { Tevet: ['Festivals', 'Selichot', 'Ten of Tevet'], Esther: ['Festivals', 'Selichot', 'Fast of Esther'], Tamuz: ['Festivals', 'Selichot', 'Seventeen of Tamuz'], Gedaliah: ['Festivals', 'Selichot', 'Fast of Gedalia'] },
  edot: { Tevet: ['Fast Days and Mourning', 'Tenth of Tevet'], Esther: ['Fast Days and Mourning', 'Fast of Esther'], Tamuz: ['Fast Days and Mourning', 'Seventeenth of Tammuz'], Gedaliah: ['Fast Days and Mourning', 'Fast of Gedalya'] },
};

const ALIYA = ['', 'כהן', 'לוי', 'ישראל', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'מפטיר'];

function refText(book, b, e, key) {
  // b, e like "32:4"
  const t = window.D[key || bookKey(book)];
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

const SHABBAT_ALIYA = ['', 'ראשון · כהן', 'שני · לוי', 'שלישי · ישראל', 'רביעי', 'חמישי', 'שישי', 'שביעי'];
const ALL_MARKS = /[\u0591-\u05C7]/g;

function verseList(book, b, e) {
  const [c1, v1] = b.split(':').map(Number);
  const [c2, v2] = e.split(':').map(Number);
  const out = [];
  const t = window.D[bookKey(book)];
  for (let c = c1; c <= c2; c++) {
    const ch = t[c - 1] || [];
    const from = c === c1 ? v1 : 1, to = c === c2 ? v2 : ch.length;
    for (let v = from; v <= to; v++) out.push([c, v]);
  }
  return out;
}

async function readingHtml(ley, shabbat = false, mode = 'regular') {
  if (!ley) return '';
  const al = ley.weekday || ley.fullkriyah;
  if (!al) return '';
  const keys = Object.keys(al).filter((k) => al[k] && al[k].k);
  const books = [...new Set(keys.map((k) => al[k].k))];
  await Promise.all(books.map((b) => load(bookKey(b))));
  const torahBook = (b) => ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'].includes(b);
  if (mode === 'shnayim') await Promise.all(books.filter(torahBook).map((b) => load('onkelos_' + b)));
  const useT = (b) => torahBook(b) && (mode === 'tikkun' || S.taamim);
  await Promise.all(books.filter(useT).map((b) => load('taamim_' + b)));
  let h = `<div class="block-title">הקריאה: ${esc(ley.name && ley.name.he ? ley.name.he : '')}</div>`;
  for (const k of keys) {
    const a = al[k];
    const nm = (shabbat ? SHABBAT_ALIYA : ALIYA)[+k] || (k === 'M' ? 'מפטיר' : k);
    h += `<p class="aliya">${nm}</p>`;
    if (mode === 'regular' || !torahBook(a.k)) { h += useT(a.k) ? `<p class="tx taam">${refText(a.k, a.b, a.e, 'taamim_' + a.k)}</p>` : `<p class="tx">${refText(a.k, a.b, a.e)}</p>`; continue; }
    const plainT = window.D[useT(a.k) ? 'taamim_' + a.k : bookKey(a.k)];
    for (const [c, v] of verseList(a.k, a.b, a.e)) {
      const verse = (plainT[c - 1] || [])[v - 1] || '';
      const num = `<sup>${gematriya(c)}:${gematriya(v)}</sup>`;
      if (mode === 'shnayim') {
        const onk = ((window.D['onkelos_' + a.k] || [])[c - 1] || [])[v - 1] || '';
        const tc = S.taamim ? ' taam' : '';
        h += `<div class="sm"><p class="tx${tc}">${num}${verse}</p><p class="tx${tc}">${verse}</p><p class="tx onk">${onk}</p></div>`;
      } else {
        const ta = ((window.D['taamim_' + a.k] || [])[c - 1] || [])[v - 1] || verse;
        const stam = ta.replace(/\u05BE/g, ' ').replace(/[\u05C0\u05C3]/g, '').replace(ALL_MARKS, '').replace(/\s+/g, ' ');
        h += `<div class="tk"><p class="tx taam">${num}${ta}</p><p class="tx stam">${stam}</p></div>`;
      }
    }
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
  const sid = await load(S.nusach);
  const ctx = ctxFor(id);
  let html = '';
  const toc = [];
  let n = 0;
  for (const part of prog.parts) {
    if (part.cond && !evalPart(part.cond, ctx)) continue;
    let body = '';
    if (part.fastSelichot) {
      const fs = FAST_SEL[S.nusach] || FAST_SEL.sefard;
      const k = ['Tevet', 'Esther', 'Tamuz', 'Gedaliah'].find((x) => ctx.descs.some((d) => d.includes(x === 'Tamuz' ? 'Tam' : x)));
      const ref = k && fs[k];
      if (ref === 'polin') {
        const sel = await load('selichot');
        body += itemsToHtml(renderSegments(flatten(sel['Fast of Gedaliah']), ctx, S));
      } else if (ref) {
        const node = getPath(sid, ref);
        if (node) body += itemsToHtml(renderSegments(flatten(node), ctx, S));
      }
    }
    for (const pth of part.p || []) {
      const spec = Array.isArray(pth) ? { path: [pth[0], pth[1]], cond: pth[2] } : pth;
      if (spec.cond && !evalPart(spec.cond, ctx)) continue;
      const node = getPath(sid, spec.path);
      if (!node) continue;
      const segs = flatten(node);
      const ranges = spec.ranges || part.ranges || [];
      body += itemsToHtml(renderSegments(segs, ctx, S, {
        ranges, from: spec.from ?? part.from, to: spec.to ?? part.to, amidah: part.amidah,
        omer: part.omer ? ctx.omer : 0, hallel: part.hallel, songDay: spec.songDay ? ctx.dow : undefined,
      }));
    }
    if (part.reading) {
      try { body += await readingHtml(getLeyningOnDate(ctx.hd, true)); } catch (e) { /* no reading */ }
    }
    if (!/class="tx/.test(body)) continue;
    const anchor = 'sec' + n++;
    const title = typeof part.t === 'function' ? part.t(ctx) : part.t;
    toc.push([anchor, title]);
    html += `<section id="${anchor}"><h2 class="ph">${title}</h2>${body}</section>`;
  }
  const banner = dayBanner(ctx);
  $('main').innerHTML = (banner ? `<div class="banner">${banner}</div>` : '') + html + '<div class="end">תם ונשלם</div>';
  $('#jumpBtn').onclick = () => openJump(toc);
}

function evalPart(cond, ctx) {
  return cond.split('&').every((c) => (c[0] === '!' ? !ctx[c.slice(1)] : !!ctx[c]));
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
  const eveCtx = dayCtx(civil.next(), { walled: cityInfo(S.city).walled, purim: S.purim, nusach: S.nusach });
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
const OTHER_PATHS = {
  sefard: {
    birkat: ['Birchat HaMazon', 'Birchat HaMazon'], meein: ['Blessings', "Me'ein Shalosh"], nefashot: ['Blessings', 'Borei Nefashot'],
    asher: ['Weekday Shacharit', 'Morning Blessings'], derech: ['Blessings', "Traveler's Prayer"], bedtime: ['Bedtime Shema'],
    levana: ['Kiddush Levanah'], chanukah: ['Chanukah', 'Menorah Lighting'], sheva: ['Various Blessings', 'Sheva Berachot'],
    brit: ['Various Blessings', 'Circumcision'], omer: ['Weekday Maariv', 'Sefirat HaOmer'],
  },
  ashkenaz: {
    birkat: ['Berachot', 'Birkat HaMazon'], meein: ['Berachot', 'Birkat Hanehenin', 'Eating'], nefashot: ['Berachot', 'Birkat Hanehenin', 'Eating'],
    asher: ['Weekday', 'Shacharit', 'Preparatory Prayers', 'Asher Yatzar'], derech: ['Berachot', 'Tefillat HaDerech'],
    bedtime: ['Weekday', 'Maariv', "Keri'at Shema al Hamita"], levana: ['Weekday', 'Maariv', 'Birkat HaLevana'],
    chanukah: ['Festivals', 'Chanukah'], omer: ['Weekday', 'Maariv', 'Sefirat HaOmer'],
  },
  edot: {
    birkat: ['Post Meal Blessing'], meein: ['Al Hamihya'], nefashot: ['Blessings on Enjoyments'], asher: ['Preparatory Prayers', 'Morning Blessings'],
    derech: ['Assorted Blessings and Prayers', "Traveler's Prayer"], bedtime: ['Bedtime Shema'], levana: ['Blessing of the Moon'],
    chanukah: ['Hanukkah', 'Menorah Lighting'], sheva: ['Assorted Blessings and Prayers', 'Sheva Berachot'],
    brit: ['Assorted Blessings and Prayers', 'Brit Mila'], omer: ['Counting of the Omer'],
  },
};
const OTHER_TITLES = {
  birkat: 'ברכת המזון', meein: 'מעין שלוש', nefashot: 'בורא נפשות', asher: 'ברכות השחר ואשר יצר', derech: 'תפילת הדרך',
  bedtime: 'קריאת שמע על המיטה', levana: 'קידוש לבנה', chanukah: 'הדלקת נרות חנוכה', sheva: 'שבע ברכות', brit: 'ברית מילה', omer: 'ספירת העומר',
};
const EVENING = new Set(['chanukah', 'omer']);

function renderMenu() {
  page('כל התפילות', `
    <label class="search">${icon('search', 20)}<input id="q" type="search" placeholder="חיפוש: תהילים, ברכת המזון, הפטרה…" aria-label="חיפוש"></label>
    <div class="grid2" id="mg">
      ${tile('#p-shacharit', 'sun', 'blue', 'שחרית')}${tile('#p-mincha', 'sunset', 'orange', 'מנחה')}${tile('#p-maariv', 'moon', 'indigo', 'ערבית')}
      ${tile('#s-birkat', 'plate', 'orange', 'ברכת המזון')}${tile('#s-meein', 'leaf', 'green', 'מעין שלוש')}${tile('#s-nefashot', 'drop', 'sky', 'בורא נפשות')}
      ${tile('#s-asher', 'heart', 'pink', 'אשר יצר')}${tile('#s-derech', 'route', 'teal', 'תפילת הדרך')}${tile('#s-bedtime', 'bed', 'indigo', 'ק״ש על המיטה')}
      ${tile('#s-levana', 'moonfull', 'purple', 'קידוש לבנה')}${tile('#tzara', 'shield', 'red', 'תפילה לעת צרה')}${tile('#tehillim', 'book', 'green', 'תהילים')}
      ${tile('#torah', 'scroll', 'blue', 'קריאת התורה')}${tile('#tanakh', 'book', 'indigo', 'תנ״ך')}${tile('#kitzur', 'book', 'purple', 'קיצור שולחן ערוך')}${tile('#haftara', 'scroll', 'amber', 'הפטרת השבוע')}${tile('#megillot', 'scroll', 'orange', 'מגילות')}${tile('#chatzot', 'moon', 'indigo', 'תיקון חצות')}
      ${tile('#selichot', 'heart', 'red', 'סליחות')}${tile('#s-sheva', 'star', 'pink', 'שבע ברכות')}${tile('#s-brit', 'star', 'blue', 'ברית מילה')}
      ${tile('#s-omer', 'star', 'green', 'ספירת העומר')}${tile('#s-chanukah', 'candles', 'blue', 'נרות חנוכה')}${tile('#zmanim', 'clock', 'sky', 'זמני היום')}
    </div>`, { nav: 'menu' });
  $('#q').oninput = (e) => {
    const q = e.target.value.trim();
    document.querySelectorAll('#mg .tile').forEach((t) => { t.style.display = !q || t.textContent.includes(q) ? '' : 'none'; });
  };
}

async function renderOther(id) {
  const title = OTHER_TITLES[id];
  if (!title) return renderHome();
  page(title, '<p class="loading">טוען…</p>', { back: '#menu', nav: false, cls: 'reading' });
  // a prayer the chosen nusach lacks falls back to Nusach Sefard
  let key = S.nusach, path = (OTHER_PATHS[S.nusach] || {})[id];
  if (!path) { key = 'sefard'; path = OTHER_PATHS.sefard[id]; }
  const sid = await load(key);
  const now = NOW();
  const civil = new HDate(now);
  const ci = cityInfo(S.city);
  const hd = EVENING.has(id) ? (now.getHours() >= 12 ? civil.next() : civil) : nowHDate(S.city, now).hd;
  const ctx = dayCtx(hd, { walled: ci.walled, purim: S.purim, nusach: S.nusach });
  if (id === 'omer' && !ctx.omer) { $('main').innerHTML = '<p class="empty">ספירת העומר מתחילה בליל ט״ז בניסן.</p>'; return; }
  const segs = flatten(getPath(sid, path) || []);
  const stopAt = segs.findIndex((x) => /דיני שכחה/.test(strip(x)));
  $('main').innerHTML = itemsToHtml(renderSegments(segs, ctx, S, { to: stopAt > 0 ? stopAt - 1 : undefined, omer: id === 'omer' ? ctx.omer : 0 }));
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
  if (S.nusach === 'edot') {
    const em = await load('selichot_edot');
    const intro = ctx.selichot ? '' : '<p class="empty">היום לא אומרים סליחות. לפי מנהג עדות המזרח הסליחות יופיעו לבד במסך הבית מב׳ באלול ועד ערב יום כיפור.</p>';
    $('main').innerHTML = intro + itemsToHtml(renderSegments(flatten(em), ctx, S));
    return;
  }
  const key = ctx.selichot ? selichotKey(ctx.hd) : (location.hash.includes('-') ? decodeURIComponent(location.hash.slice(location.hash.indexOf('-') + 1)).replace(/_/g, ' ') : null);
  if (!key) {
    $('main').innerHTML = `<p class="empty">היום לא אומרים סליחות. הסליחות יופיעו לבד במסך הבית בימים שאומרים: ממוצאי השבת שלפני ראש השנה ועד ערב יום כיפור.</p>
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


/* ---------------- Torah reading & Tanakh ---------------- */
const TANAKH = [
  ['תורה', ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']],
  ['נביאים', ['Joshua', 'Judges', 'I Samuel', 'II Samuel', 'I Kings', 'II Kings', 'Isaiah', 'Jeremiah', 'Ezekiel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi']],
  ['כתובים', ['Psalms', 'Proverbs', 'Job', 'Song of Songs', 'Ruth', 'Lamentations', 'Ecclesiastes', 'Esther', 'Daniel', 'Ezra', 'Nehemiah', 'I Chronicles', 'II Chronicles']],
];
const bookName = (b) => (HEB_BOOK[b] || b).replace(/^מגילת /, '');
const slug = (x) => x.replace(/ /g, '_');

function nextShabbat() {
  let d = new HDate(NOW());
  while (d.getDay() !== 6) d = d.next();
  return d;
}

function renderTorahMenu() {
  const shab = nextShabbat();
  const ley = getLeyningOnDate(shab, true);
  const cur = ley && ley.parsha ? ley.parsha.join('-') : null;
  const today = getLeyningOnDate(new HDate(NOW()), true);
  // the weekday reading is part of the weekly parasha (and appears in Shacharit), so show it only when it is a different reading (Rosh Chodesh, fast, festival)
  const todayName = today && today.name && today.name.he;
  const todayTile = today && (today.weekday || today.fullkriyah) && new HDate(NOW()).getDay() !== 6 && todayName && !(ley && ley.name && ley.name.he === todayName)
    ? tile('#torah-today', 'scroll', 'orange', 'הקריאה של היום', esc(todayName)) : '';
  const list = parshiot.map((p) => {
    let he = p;
    try { he = getLeyningForParsha(p).name.he; } catch (e) { /* keep */ }
    return `<a class="pname" href="#parasha-${slug(p)}">${esc(he)}</a>`;
  }).join('');
  page('קריאת התורה', `<div class="grid2">
      ${cur ? tile('#parasha-' + slug(cur), 'book', 'blue', 'פרשת השבוע', esc(ley.name.he)) : ''}${todayTile}</div>
    <section class="card"><h2>כל הפרשות</h2><div class="pnames">${list}</div></section>`, { back: '#menu', nav: 'menu' });
}

async function renderParasha(name) {
  page('קריאת התורה', '<p class="loading">טוען…</p>', { back: '#torah', nav: false, cls: 'reading' });
  let ley;
  try { ley = name === 'today' ? getLeyningOnDate(new HDate(NOW()), true) : getLeyningForParsha(name); } catch (e) { ley = null; }
  if (!ley) { $('main').innerHTML = '<p class="empty">לא נמצאה קריאה.</p>'; return; }
  const shabbat = name !== 'today';
  const mode = S.torahMode || 'regular';
  const modes = [['regular', 'רגיל'], ['shnayim', 'שניים מקרא ואחד תרגום'], ['tikkun', 'טעמים מול ספר תורה']];
  let h = `<div class="banner">${esc(ley.name && ley.name.he ? (shabbat ? 'פרשת ' : '') + ley.name.he : '')}</div>
    <div class="seg" role="group" aria-label="תצוגה">${modes.map(([k, l]) => `<button data-mode="${k}" class="${k === mode ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${mode !== 'tikkun' ? `<label class="tgl"><input type="checkbox" id="taamT" ${S.taamim ? 'checked' : ''}> להציג טעמי המקרא</label>` : ''}`;
  if (mode === 'tikkun') h += '<p class="hint">מימין: עם ניקוד וטעמים. משמאל: בכתב סת״ם, כמו בספר התורה.</p>';
  h += await readingHtml(name === 'today' ? ley : { ...ley, weekday: null }, shabbat, mode);
  const haft = shabbat ? (S.nusach === 'edot' && ley.seph ? ley.seph : ley.haft) : null;
  if (haft) {
    const parts = Array.isArray(haft) ? haft : [haft];
    await Promise.all(parts.map((p) => load(bookKey(p.k))));
    h += '<h2 class="ph">הפטרה</h2>' + parts.map((p) => `<h3 class="sh">${HEB_BOOK[p.k] || p.k}</h3><p class="tx">${refText(p.k, p.b, p.e)}</p>`).join('');
  }
  $('main').innerHTML = h;
  document.querySelectorAll('.seg button').forEach((bt) => { bt.onclick = () => { S.torahMode = bt.dataset.mode; save(); renderParasha(name); }; });
  const tt = $('#taamT'); if (tt) tt.onchange = () => { S.taamim = tt.checked; save(); renderParasha(name); };
}

function renderTanakh() {
  page('תנ״ך', TANAKH.map(([title, books]) => `<section class="card"><h2>${title}</h2><div class="pnames">${books.map((b) => `<a class="pname" href="#tn-${slug(b)}">${bookName(b)}</a>`).join('')}</div></section>`).join(''), { back: '#menu', nav: 'menu' });
}

async function renderTanakhBook(book) {
  page(bookName(book), '<p class="loading">טוען…</p>', { back: '#tanakh', nav: false });
  const t = await load(bookKey(book));
  $('main').innerHTML = `<section class="card"><h2>בחר פרק</h2><div class="nums">${t.map((_, i) => `<a class="num" href="#tc-${slug(book)}.${i + 1}">${gematriya(i + 1)}</a>`).join('')}</div></section>`;
}

async function renderTanakhChapter(arg) {
  const k = arg.lastIndexOf('.');
  const book = arg.slice(0, k), c = +arg.slice(k + 1) || 1;
  page(bookName(book) + ' ' + gematriya(c), '<p class="loading">טוען…</p>', { back: '#tn-' + slug(book), nav: false, cls: 'reading' });
  const t = await load(bookKey(book));
  const ch = t[c - 1] || [];
  const pager = `<div class="pager">${c > 1 ? `<a href="#tc-${slug(book)}.${c - 1}">→ פרק ${gematriya(c - 1)}</a>` : '<span></span>'}${c < t.length ? `<a href="#tc-${slug(book)}.${c + 1}">פרק ${gematriya(c + 1)} ←</a>` : ''}</div>`;
  $('main').innerHTML = `<p class="tx">${refText(book, c + ':1', c + ':' + ch.length)}</p>` + pager;
  window.scrollTo(0, 0);
}


/* ---------------- Kitzur Shulchan Arukh ---------------- */
async function renderKitzurIndex() {
  page('קיצור שולחן ערוך', '<p class="loading">טוען…</p>', { back: '#menu', nav: 'menu' });
  const t = await load('kitzur');
  const bare = (x) => strip(x).replace(/[֑-ׇ]/g, '');
  const rows = t.map((sim, i) => {
    const first = bare(sim[0] || '').split(/\s+/).slice(0, 7).join(' ');
    return `<a class="krow" href="#ks-${i + 1}" data-i="${i}"><b>סימן ${gematriya(i + 1)}</b><span>${esc(first)}…</span></a>`;
  }).join('');
  const today = learningLine('kitzurshulchanaruch', new HDate(NOW())).replace(/^.*?\s(?=[א-ת])/, '');
  $('main').innerHTML = `${tile('#l-kitzurshulchanaruch', 'book', 'purple', 'הלימוד של היום', esc(today))}
    <label class="search">${icon('search', 20)}<input id="kq" type="search" placeholder="חיפוש בכל הספר: ציצית, ברכות…" aria-label="חיפוש"></label>
    <section class="card klist" id="kl">${rows}</section>`;
  const plain = t.map((sim) => bare(sim.join(' ')));
  $('#kq').oninput = (e) => {
    const q = e.target.value.trim().replace(/[֑-ׇ]/g, '');
    document.querySelectorAll('#kl .krow').forEach((r) => { r.style.display = !q || plain[+r.dataset.i].includes(q) ? '' : 'none'; });
  };
}

async function renderKitzurSiman(n) {
  const t = await load('kitzur');
  const i = Math.min(t.length, Math.max(1, +n || 1));
  page('קיצור שו״ע · סימן ' + gematriya(i), '', { back: '#kitzur', nav: false, cls: 'reading' });
  const sim = t[i - 1] || [];
  const pager = `<div class="pager">${i > 1 ? `<a href="#ks-${i - 1}">→ סימן ${gematriya(i - 1)}</a>` : '<span></span>'}${i < t.length ? `<a href="#ks-${i + 1}">סימן ${gematriya(i + 1)} ←</a>` : ''}</div>`;
  $('main').innerHTML = sim.map((x, k) => `<p class="tx"><sup>${gematriya(k + 1)}</sup>${x}</p>`).join('') + pager;
  window.scrollTo(0, 0);
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
      <label>נוסח<select id="nusach"><option value="sefard">ספרד</option><option value="ashkenaz">אשכנז</option><option value="edot">עדות המזרח</option></select>
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
      <label class="sw"><span>טעמי המקרא בקריאת התורה</span><input type="checkbox" id="taamim" ${S.taamim ? 'checked' : ''}></label>
      <label class="sw"><span>הצג הוראות והלכות קטנות</span><input type="checkbox" id="notes" ${S.notes ? 'checked' : ''}></label>
      <label>גודל כתב <input type="range" id="font" min="16" max="36" step="1" value="${S.font}"></label>
      <p id="sample" style="margin:0">בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם</p>
    </section>
    <section class="card form">
      <h2>לימוד יומי</h2>
      ${LEARN.map(([k, n]) => `<label class="sw"><span>${n}</span><input type="checkbox" data-learn="${k}" ${S.learning.includes(k) ? 'checked' : ''}></label>`).join('')}
    </section>
    <p class="hint">גרסה ראשונה · הטקסטים מספריא (Sefaria), הלוח מ-Hebcal</p>`, { nav: 'set' });
  $('#purim').value = S.purim;
  $('#nusach').value = S.nusach;
  $('#nusach').onchange = (e) => { S.nusach = e.target.value; save(); };
  $('#city').onchange = (e) => { S.city = e.target.value; save(); };
  $('#purim').onchange = (e) => { S.purim = e.target.value; save(); };
  $('#names').oninput = (e) => { S.names = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); save(); };
  ['censor', 'night', 'notes', 'taamim'].forEach((k) => { $('#' + k).onchange = (e) => { S[k] = e.target.checked; save(); }; });
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
    if (a === 'torah') return b === 'today' ? renderParasha('today') : renderTorahMenu();
    if (a === 'parasha') return renderParasha(b);
    if (a === 'tanakh') return renderTanakh();
    if (a === 'kitzur') return renderKitzurIndex();
    if (a === 'ks') return renderKitzurSiman(b);
    if (a === 'tn') return renderTanakhBook(b);
    if (a === 'tc') return renderTanakhChapter(b);
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
