// Calendar logic: everything the siddur needs to know about a given day.
import { HDate, HebrewCalendar, flags, months, Location, Zmanim, DailyLearning } from '@hebcal/core';
import '@hebcal/learning';
import { getLeyningOnDate } from '@hebcal/leyning';

export { HDate, months, DailyLearning, getLeyningOnDate };

export const CITIES = [
  ['ירושלים', 31.778, 35.235, true],
  ['בני ברק', 32.0807, 34.8338],
  ['תל אביב', 32.0853, 34.7818],
  ['חיפה', 32.794, 34.9896],
  ['באר שבע', 31.252, 34.791],
  ['פתח תקווה', 32.084, 34.8878],
  ['נתניה', 32.3215, 34.8532],
  ['אשדוד', 31.8014, 34.6435],
  ['ראשון לציון', 31.973, 34.7925],
  ['רחובות', 31.8928, 34.8113],
  ['מודיעין', 31.898, 35.0104],
  ['מודיעין עילית', 31.9325, 35.0442],
  ['ביתר עילית', 31.6969, 35.115],
  ['בית שמש', 31.747, 34.9881],
  ['אלעד', 32.0522, 34.9512],
  ['הרצליה', 32.1624, 34.8447],
  ['חדרה', 32.434, 34.9196],
  ['אשקלון', 31.6688, 34.5743],
  ['קריית גת', 31.61, 34.7642],
  ['עפולה', 32.608, 35.289],
  ['טבריה', 32.7959, 35.53],
  ['צפת', 32.9646, 35.496],
  ['נהריה', 33.0089, 35.0981],
  ['אילת', 29.5577, 34.9519],
];

export function cityInfo(name) {
  const c = CITIES.find((x) => x[0] === name) || CITIES[0];
  return { name: c[0], lat: c[1], lon: c[2], walled: !!c[3], il: true };
}

export function zmanim(city, date) {
  const c = cityInfo(city);
  const loc = new Location(c.lat, c.lon, true, 'Asia/Jerusalem', c.name, 'IL');
  const z = new Zmanim(loc, date, false);
  const fmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
  const t = (d) => (d && !isNaN(d) ? fmt.format(d) : '--:--');
  return {
    raw: z,
    list: [
      ['עלות השחר', t(z.alotHaShachar())],
      ['משיכיר', t(z.misheyakir())],
      ['הנץ החמה', t(z.sunrise())],
      ['סוף זמן ק״ש (מג״א)', t(z.sofZmanShmaMGA())],
      ['סוף זמן ק״ש (גר״א)', t(z.sofZmanShma())],
      ['סוף זמן תפילה (גר״א)', t(z.sofZmanTfilla())],
      ['חצות היום', t(z.chatzot())],
      ['מנחה גדולה', t(z.minchaGedola())],
      ['מנחה קטנה', t(z.minchaKetana())],
      ['פלג המנחה', t(z.plagHaMincha())],
      ['שקיעה', t(z.sunset())],
      ['צאת הכוכבים', t(z.tzeit(6.45))],
    ],
    chatzot: z.chatzot(),
    sunset: z.sunset(),
    tzeit: z.tzeit(6.45),
  };
}

const M = months;

// Hebrew date that applies right now (after sunset it is already the next day).
export function nowHDate(city, now = new Date()) {
  const z = zmanim(city, now);
  let hd = new HDate(now);
  const evening = z.sunset && now > z.sunset;
  if (evening) hd = hd.next();
  return { hd, evening, z };
}

function eventsOn(hd, il) {
  return HebrewCalendar.getHolidaysOnDate(hd, il) || [];
}

function inSelichotSeason(hd, nusach) {
  if (nusach === 'edot') {
    const m0 = hd.getMonth(), d0 = hd.getDate();
    if (hd.getDay() === 6) return false;
    return (m0 === M.ELUL && d0 >= 2) || (m0 === M.TISHREI && d0 >= 3 && d0 <= 9);
  }
  // Ashkenaz (and Sefard) custom: from motzaei Shabbat before Rosh Hashana (at least 4 days), through erev Yom Kippur.
  const y = hd.getFullYear();
  const rh = new HDate(1, M.TISHREI, y + (hd.getMonth() === M.TISHREI ? 0 : 1));
  if (hd.getMonth() === M.TISHREI) {
    const d = hd.getDate();
    return d >= 3 && d <= 9 && hd.getDay() !== 6;
  }
  if (hd.getMonth() !== M.ELUL) return false;
  // first selichot: Sunday (motzash) such that there are >= 4 days before RH
  let start = rh.deltaDays ? null : null;
  let d = rh.prev();
  // find Sunday on or before (rh - 4)
  let cand = new HDate(rh.abs() - 4);
  while (cand.getDay() !== 0) cand = cand.prev();
  start = cand;
  return hd.abs() >= start.abs() && hd.abs() < rh.abs() && hd.getDay() !== 6;
}

export function selichotKey(hd) {
  // which Polin selichot day to show
  if (hd.getMonth() === M.TISHREI) {
    const evs = eventsOn(hd, true).map((e) => e.getDesc());
    if (evs.some((d) => /Gedaliah/.test(d))) return 'Fast of Gedaliah';
    if (hd.getDate() === 9) return 'Yom Kippur Eve';
    // days after the fast
    const days = ['Second Day of the Ten Days of Penitence', 'Third Day of the Ten Days of Penitence',
      'Fourth Day of the Ten Days of Penitence', 'Fifth Day of the Ten Days of Penitence'];
    let n = 0;
    for (let d = 4; d < hd.getDate(); d++) {
      const x = new HDate(d, M.TISHREI, hd.getFullYear());
      if (x.getDay() !== 6 && !eventsOn(x, true).some((e) => /Gedaliah/.test(e.getDesc()))) n++;
    }
    return days[Math.min(n, 3)];
  }
  const rh = new HDate(1, M.TISHREI, hd.getFullYear() + 1);
  if (rh.abs() - hd.abs() === 1) return 'Erev Rosh Hashana';
  let cand = new HDate(rh.abs() - 4);
  while (cand.getDay() !== 0) cand = cand.prev();
  let n = 0;
  for (let a = cand.abs(); a < hd.abs(); a++) if (new HDate(a).getDay() !== 6) n++;
  const names = ['First Day', 'Second Day', 'Third Day', 'Fourth Day', 'Fifth Day', 'Sixth Day', 'Seventh Day'];
  return names[Math.min(n, 6)];
}

function talUmatarIL(hd) {
  const m = hd.getMonth();
  const d = hd.getDate();
  if (m === M.CHESHVAN) return d >= 7;
  if (m === M.TISHREI) return false;
  if (m === M.NISAN) return d < 15;
  if (m > M.NISAN && m < M.TISHREI) return false; // Iyyar..Elul
  return true; // Kislev..Adar II
}

function winterIL(hd) {
  const m = hd.getMonth();
  const d = hd.getDate();
  if (m === M.TISHREI) return d >= 22;
  if (m === M.NISAN) return d < 15;
  if (m > M.NISAN && m < M.TISHREI) return false;
  return true;
}

export function omerDay(hd) {
  const y = hd.getFullYear();
  const start = new HDate(16, M.NISAN, y).abs();
  const n = hd.abs() - start + 1;
  return n >= 1 && n <= 49 ? n : 0;
}

// Build the set of flags for a Hebrew day.
// prayer: 'shacharit' | 'mincha' | 'maariv' | null
export function dayCtx(hd, opts = {}) {
  const il = true;
  const evs = eventsOn(hd, il);
  const descs = evs.map((e) => e.getDesc());
  const has = (f) => evs.some((e) => e.getFlags() & f);
  const m = hd.getMonth();
  const d = hd.getDate();
  const dow = hd.getDay();
  const leap = HDate.isLeapYear(hd.getFullYear());
  const adar = leap ? M.ADAR_II : M.ADAR_I;

  const rc = d === 30 || (d === 1 && m !== M.TISHREI);
  const chanukah = descs.some((x) => /^Chanukah/.test(x));
  let chanukahDay = 0;
  if (chanukah) {
    const k = new HDate(25, M.KISLEV, m === M.KISLEV ? hd.getFullYear() : hd.getFullYear());
    chanukahDay = hd.abs() - new HDate(25, M.KISLEV, hd.getFullYear()).abs() + 1;
    if (chanukahDay < 1) chanukahDay = hd.abs() - new HDate(25, M.KISLEV, hd.getFullYear() - 1).abs() + 1;
  }
  const walled = !!opts.walled;
  const purimSetting = opts.purim || 'auto';
  const isPurim14 = m === adar && d === 14;
  const isPurim15 = m === adar && d === 15;
  let purim;
  if (purimSetting === 'both') purim = isPurim14 || isPurim15;
  else if (purimSetting === '15' || (purimSetting === 'auto' && walled)) purim = isPurim15;
  else purim = isPurim14;
  const minorFast = has(flags.MINOR_FAST) && !descs.some((x) => /Yom Kippur Katan/.test(x));
  const tishabav = descs.some((x) => /Tish'a B'Av/.test(x));
  const fast = minorFast || tishabav;
  const ayt = m === M.TISHREI && d >= 1 && d <= 10;
  const cholhamoed = has(flags.CHOL_HAMOED);
  const cholPesach = cholhamoed && m === M.NISAN;
  const cholSukkot = cholhamoed && m === M.TISHREI;
  const yomtov = has(flags.CHAG);
  const shabbat = dow === 6;

  // No-tachanun days (Sefard custom)
  let noTachanun = shabbat || yomtov || rc || chanukah || cholhamoed || tishabav ||
    m === M.NISAN ||
    (m === M.SHVAT && d === 15) ||
    (m === M.AV && d === 15) ||
    (m === M.IYYAR && (d === 14 || d === 18)) ||
    (m === M.SIVAN && d <= 12) ||
    (m === M.TISHREI && (d === 9 || d >= 11)) ||
    (m === M.ELUL && d === 29) ||
    ((m === adar) && (d === 14 || d === 15)) ||
    (leap && m === M.ADAR_I && (d === 14 || d === 15));
  // Mincha: also skip on the afternoon before Shabbat or a festive day
  if (opts.prayer === 'mincha' && !noTachanun) {
    const tomorrow = dayCtx(hd.next(), { ...opts, prayer: null, noRecurse: true });
    if (dow === 5 || tomorrow.yomtov || tomorrow.chanukah || tomorrow.purim || (tomorrow.rc && m !== M.ELUL) ||
      (tomorrow.month === M.SHVAT && tomorrow.day === 15) || (tomorrow.month === M.AV && tomorrow.day === 15) ||
      tomorrow.tishabav) noTachanun = true;
  }
  const tachanun = !noTachanun;
  const monthu = dow === 1 || dow === 4;
  const noLamnatzeach = rc || chanukah || purim || cholhamoed || tishabav ||
    (m === M.NISAN && d === 14) || (m === M.TISHREI && d === 9) || (m === adar && (d === 14 || d === 15));
  const hallel = rc || chanukah || cholhamoed;
  const fullHallel = chanukah;
  const elul = m === M.ELUL || (m === M.TISHREI && d <= 21);
  const torah = opts.prayer === 'shacharit' ? (monthu || rc || chanukah || purim || fast || cholhamoed) :
    opts.prayer === 'mincha' ? fast : false;
  const avinu = (ayt || minorFast) && !tishabav && !shabbat && !(opts.prayer === 'mincha' && dow === 5);

  return {
    hd, month: m, day: d, dow, rc, chanukah, chanukahDay, purim, fast, minorFast, tishabav, ayt,
    cholhamoed, cholPesach, cholSukkot, yomtov, shabbat, tachanun, monthu, noLamnatzeach,
    hallel, fullHallel, elul, torah, avinu,
    winter: winterIL(hd), talumatar: talUmatarIL(hd),
    omer: omerDay(hd), descs, events: evs,
    selichot: inSelichotSeason(hd, opts.nusach),
    gedaliaTevet: descs.some((x) => /Gedaliah|Tevet/.test(x)),
    esther: descs.some((x) => /Esther/.test(x)),
    tamuz: descs.some((x) => /Tamuz|Tammuz/.test(x)),
    erevShabbat: dow === 5,
    levana: d >= 7 && d <= 15 && !(m === M.AV && d < 10) && !(m === M.TISHREI && d < 10),
    motzash: !!opts.motzash,
    sick: true,
    prayer: opts.prayer || null,
  };
}

// Label text (no nikud) → condition key
export function condFromLabel(raw) {
  const t = raw.replace(/[֑-ׇ]/g, '').replace(/[״“”]/g, '"').replace(/[׳’]/g, "'").replace(/[()]/g, '').trim();
  if (!t) return null;
  if (/מדלגין/.test(t)) return 'fullhallel';
  if (/עד כאן אומרים בחנוכה/.test(t)) return 'stopchanukah';
  if (/עשי"ת|עשרת ימי תשובה|בעשי"ת/.test(t)) return 'ayt';
  if (/^בקיץ/.test(t)) return '!winter';
  if (/^בחורף/.test(t)) return 'winter';
  if (/בימות החמה/.test(t)) return '!talumatar';
  if (/בימות הגשמים/.test(t)) return 'talumatar';
  if (/מי שרוצה להתפלל על החולה/.test(t)) return 'sick';
  if (/בחול קודם ברכת המזון/.test(t)) return 'tachanun';
  if (/בשבת קודם ברכת המזון/.test(t)) return '!tachanun';
  if (/בימים שגומרים את ההלל|שאין גומרים/.test(t)) return 'fullhallel';
  if (/בחנוכה ופורים/.test(t)) return 'chanukah|purim';
  if (/בראש חו?דש אומרים כאן הלל|שאין אומרים בהם תחנון יאמר|בתענית צי?בור השליח|כשמתפללים מנחה קטנה|אם אין כהנים|והכהנים אחריו|בכל לילות החול מלבד/.test(t)) return 'never';
  if (/מדלגים למנצח/.test(t)) return 'never';
  if (/ביום שיש בו תחנון/.test(t)) return 'tachanun';
  if (/ביום שאין בו תחנון|בימים שאין בהם תחנון אומרים/.test(t)) return '!tachanun';
  if (/בימי?ם? שני וחמישי מוסיפים/.test(t)) return 'monthu';
  if (/בימי?ם? שני וחמישי אין אומרים/.test(t)) return '!monthu';
  if (/בצום גדליה ובעשרה בטבת/.test(t)) return 'gedaliaTevet';
  if (/בתענית אסתר ובפורים/.test(t)) return 'esther|purim';
  if (/בשבעה עשר בתמוז/.test(t)) return 'tamuz';
  if (/למחרת יום הכיפורים/.test(t)) return 'never';
  if (/בערב שבת אין אומרים/.test(t)) return '!erevShabbat';
  if (/בערב שבת אומרים/.test(t)) return 'erevShabbat';
  if (/בליל ראש חו?דש/.test(t)) return 'rc';
  if (/במוצאי שבת/.test(t)) return 'motzash';
  const dows = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'ששי': 5 };
  const mm = t.match(/^ב(ראשון|שני|שלישי|רביעי|חמישי|שישי|ששי) בשבת/) || t.match(/^שיר של יום (ראשון|שני|שלישי|רביעי|חמישי|שישי|ששי)/);
  if (mm) return 'dow:' + dows[mm[1]];
  if (/מוצאי שבת/.test(t)) return 'motzash';
  if (/שבת/.test(t)) return 'never';
  if (/בראש חו?דש ובחול המועד/.test(t)) return 'rc|cholhamoed';
  if (/^(ל|ב)?ר"ח|^בראש חו?דש|^בר"ח|יש נוהגין לומר בר"ח/.test(t)) return 'rc';
  if (/^(ל|ב)פסח/.test(t)) return 'cholPesach';
  if (/^(ל|ב)סכות|^(ל|ב)סוכות/.test(t)) return 'cholSukkot';
  if (/בשבועות|לש"ע|לר"ה|ביו"ט|יו"כ|בראש השנה|לשמיני|ילדים האוכלים/.test(t)) return 'never';
  if (/^בחנוכה/.test(t)) return 'chanukah';
  if (/^בפורים/.test(t)) return 'purim';
  if (/אומר כאן הש"ץ|ברכת כהנים/.test(t)) return 'never';
  if (/תשעה באב/.test(t) && /במנחת/.test(t)) return 'tishabav';
  if (/בט' אב ויוה"כ אין אומרים/.test(t)) return '!tishabav';
  if (/תענית צי?בור|בתענית/.test(t)) return 'fast';
  if (/שאין אומרים תחנון אין אומרים/.test(t)) return 'tachanun';
  if (/נשים אומרות|בבית האבל|ובימים שאין בהם תחנון/.test(t)) return 'never';
  if (/בשני ובחמישי ושאר ימים שמוציאין|בשעת הכנסת ס"ת/.test(t)) return 'torah';
  if (/רק בלילה הראשון/.test(t)) return 'chanukah1';
  if (/בחול קודם ברכת המזון/.test(t)) return 'always';
  return null;
}

export const RED = new Set(['ayt', '!winter', 'winter', '!talumatar', 'talumatar', 'rc', 'rc|cholhamoed', 'cholPesach',
  'cholSukkot', 'chanukah', 'purim', 'fast', 'tishabav', 'sick']);
export const SINGLE = new Set(['!winter', 'winter', '!talumatar', 'talumatar']);

export function evalCond(c, ctx) {
  if (!c) return true;
  if (c === 'always') return true;
  if (c === 'never') return false;
  if (c.includes('|')) return c.split('|').some((x) => evalCond(x, ctx));
  if (c.includes('&')) return c.split('&').every((x) => evalCond(x, ctx));
  if (c[0] === '!') return !evalCond(c.slice(1), ctx);
  if (c.startsWith('dow:')) return ctx.dow === +c.slice(4);
  if (c === 'chanukah1') return ctx.chanukahDay === 1;
  if (c === 'fullhallel') return !!ctx.fullHallel;
  if (c === 'stopchanukah') return !ctx.chanukah;
  return !!ctx[c];
}
