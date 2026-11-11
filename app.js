/* ============================================================
   Prolific Stats: legge il CSV delle sottomissioni Prolific,
   converte tutto in euro e mostra statistiche, grafici e tabelle.
   ============================================================ */
(() => {
  'use strict';

  // ---------------------------------------------------------- utilità
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage non disponibile */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const nf0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf4 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const SYM = { GBP: '£', USD: '$', EUR: '€' };
  const CUR_NAME = { GBP: 'Sterlina (£)', USD: 'Dollaro ($)', EUR: 'Euro (€)' };
  const eur = v => '€' + nf2.format(v || 0);
  const eurAxis = v => '€' + (Math.abs(v) < 10 && v % 1 ? nf1.format(v) : nf0.format(v));
  const eurShort = v => (Math.abs(v) >= 1000 ? '€' + nf1.format(v / 1000) + 'k' : Math.abs(v) < 10 ? '€' + nf1.format(v) : '€' + nf0.format(Math.round(v)));
  const money = (v, cur) => (SYM[cur] || '') + nf2.format(v || 0);
  const pct = v => nf0.format(v * 100) + '%';
  const round2 = v => Math.round(v * 100) / 100;
  const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const MONTHS_SHORT = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
  const WD = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  const WD_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const pad = n => String(n).padStart(2, '0');
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const mkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d || 1); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const monthLabel = k => { const [y, m] = k.split('-').map(Number); return cap(MONTHS[m - 1]) + ' ' + y; };
  const monthShort = k => { const [y, m] = k.split('-').map(Number); return MONTHS_SHORT[m - 1] + ' ' + String(y).slice(2); };
  const monthIndex = k => { const [y, m] = k.split('-').map(Number); return y * 12 + m - 1; };
  const monthFromIndex = i => `${Math.floor(i / 12)}-${pad(i % 12 + 1)}`;
  const dfmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dfmtDay = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
  const dfmtFull = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dfmtDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtKey = k => (k ? dfmtDate.format(fromKey(k)) : '');
  const weekLabel = mon => {
    const sun = addDays(mon, 6);
    if (mon.getMonth() === sun.getMonth()) return `${mon.getDate()}–${sun.getDate()} ${dfmtDay.format(sun).split(' ')[1]}`;
    return `${dfmtDay.format(mon)} – ${dfmtDay.format(sun)}`;
  };
  const isoWeek = d => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  };
  const durText = min => {
    if (min == null) return '—';
    if (min < 60) return `${Math.max(1, Math.round(min))} min`;
    const t = Math.round(min), h = Math.floor(t / 60), m = t % 60; // arrotondo prima, così non esce "4 h 60 min"
    return m ? `${h} h ${m} min` : `${h} h`;
  };

  const ICON = {
    cal: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    doc: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 11h5M10 14.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    coin: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M14.5 9a3 3 0 1 0 0 6M8.5 11h5M8.5 13h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  const STATUS_ORDER = ['APPROVED', 'SCREENED OUT', 'AWAITING REVIEW', 'RETURNED', 'TIMED-OUT', 'REJECTED'];
  const STATUS = {
    'APPROVED': { cls: 'approved', it: 'Approvato' },
    'SCREENED OUT': { cls: 'screened', it: 'Escluso dallo screening (compenso pagato)' },
    'AWAITING REVIEW': { cls: 'awaiting', it: 'In attesa di revisione' },
    'RETURNED': { cls: 'returned', it: 'Restituito' },
    'TIMED-OUT': { cls: 'timedout', it: 'Tempo scaduto' },
    'REJECTED': { cls: 'rejected', it: 'Rifiutato' },
  };
  const statusCls = s => (STATUS[s] ? STATUS[s].cls : 'returned');
  const statusPill = (s, sm) => `<span class="status ${statusCls(s)}${sm ? ' sm' : ''}" title="${esc(STATUS[s] ? STATUS[s].it : s)}">${esc(s)}</span>`;

  // Palette dei grafici (validata) e rampa ordinale per le fasce
  const RAMP_LIGHT = ['#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281'];
  const RAMP_DARK = ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4'];
  const AVATAR_COLORS = ['#4f63d2', '#2b8a7e', '#b4536f', '#7a5cc4', '#b7711f', '#3a7bbf', '#5f8132', '#a35a3f', '#5a6475'];

  // ---------------------------------------------------------- stato
  const DEFAULTS = {
    rates: { GBP: 1.1986, USD: 0.8934, date: '2026-11-09', source: 'predefinito' },
    historical: true,
    thresholds: [1, 3, 5, 10],
    basis: 'earned',
    theme: 'light',
  };
  function loadSettings() {
    const s = store.get('ps.settings', {}) || {};
    return {
      ...DEFAULTS, ...s,
      rates: { ...DEFAULTS.rates, ...(s.rates || {}) },
      thresholds: Array.isArray(s.thresholds) && s.thresholds.length ? s.thresholds : DEFAULTS.thresholds,
    };
  }
  let S = loadSettings();
  const saveSettings = () => store.set('ps.settings', S);
  let HIST = store.get('ps.hist', null);
  let HIST_KEYS = null;
  let rateStatus = { state: 'idle', msg: '' };
  let RAW = [];
  let DATA = [];
  let FILE = store.get('ps.fileinfo', null);
  const F = { q: '', study: '', researcher: '', researcherExact: false, from: '', to: '', min: '', max: '', statuses: new Set(), currencies: new Set(), datePreset: '' };
  let TAB = store.get('ps.tab', 'overview');
  if (!['overview', 'monthly', 'studies', 'researchers', 'history'].includes(TAB)) TAB = 'overview';
  let HSORT = 'date-desc', HLIMIT = 50, HOPEN = true;
  let MSEG = 'money', SSEG = 'saldo', RSEG = 'saldo';
  // schede mensili: quali mesi mostrare ('all', 'y2025' = anno, 'n6' = ultimi 6 mesi)
  let MVIEW = 'all';
  const MCOLLAPSED = new Set(); // schede mensili ridotte (solo mese e guadagnato), chiave 'YYYY-MM'
  // periodo della sezione "Grafici" del riepilogo: k = chiave di overviewPeriods() o 'custom' con from/to
  let OVP = { k: 'all', from: '', to: '' };
  // stato aperto/chiuso dei <details data-keep="..."> da conservare tra un rendering e l'altro
  const KEEP_OPEN = new Map();
  const charts = [];
  const FMT = new WeakMap();
  let LAZY = null; // IntersectionObserver che crea i grafici delle schede mensili quando diventano visibili

  // ---------------------------------------------------------- CSV
  function parseCSV(t) {
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) {
        if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && t[i + 1] === '\n') i++;
        row.push(f); rows.push(row); row = []; f = '';
      } else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function parseMoney(s, fallbackCur) {
    s = String(s || '').trim();
    let cur = fallbackCur || 'GBP';
    if (s.includes('£') || /GBP/i.test(s)) cur = 'GBP';
    else if (s.includes('$') || /USD/i.test(s)) cur = 'USD';
    else if (s.includes('€') || /EUR/i.test(s)) cur = 'EUR';
    let num = s.replace(/[^0-9.,-]/g, '');
    if (num.includes(',') && !num.includes('.')) num = num.replace(',', '.');
    else num = num.replace(/,/g, '');
    return { cur, val: parseFloat(num) || 0 };
  }
  // Le date del CSV Prolific sono in UTC
  function parseDate(s) {
    const m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?/);
    if (!m) return null;
    const ms = m[7] ? Number(m[7].slice(0, 3).padEnd(3, '0')) : 0;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0), ms));
  }
  function normStatus(s) {
    s = String(s || '').trim().toUpperCase().replace(/[_\s]+/g, ' ');
    if (s === 'TIMED OUT' || s === 'TIMEDOUT') return 'TIMED-OUT';
    if (s === 'SCREENEDOUT') return 'SCREENED OUT';
    return s || 'SCONOSCIUTO';
  }
  function ingest(text, name) {
    const rows = parseCSV(String(text).replace(/^﻿/, ''));
    if (rows.length < 2) throw new Error('Il file non contiene righe di dati.');
    const head = rows[0].map(h => h.trim().toLowerCase());
    const col = names => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
    const C = {
      study: col(['study', 'study name', 'studio']),
      reward: col(['reward', 'premio']),
      bonus: col(['bonus']),
      started: col(['started at', 'started', 'iniziato']),
      completed: col(['completed at', 'completed', 'completato']),
      code: col(['completion code', 'code', 'codice']),
      status: col(['status', 'stato']),
      by: col(['published by', 'researcher', 'ricercatore']),
    };
    if (C.study < 0 || C.reward < 0 || C.status < 0) throw new Error('Intestazioni non riconosciute: servono almeno le colonne Study, Reward e Status.');
    const out = [];
    let skipped = 0;
    rows.slice(1).forEach(r => {
      if (!r.some(c => String(c).trim() !== '')) return;
      const rw = parseMoney(r[C.reward]);
      const bo = C.bonus >= 0 ? parseMoney(r[C.bonus], rw.cur) : { cur: rw.cur, val: 0 };
      const started = C.started >= 0 ? parseDate(r[C.started]) : null;
      // le sottomissioni senza data di inizio non entrano in nessuna statistica (né nello storico)
      if (!started) { skipped++; return; }
      const completed = C.completed >= 0 ? parseDate(r[C.completed]) : null;
      const when = started;
      let minutes = started && completed ? (completed - started) / 60000 : null;
      if (minutes != null && (minutes < 0 || minutes > 24 * 60)) minutes = null;
      out.push({
        id: out.length,
        study: String(r[C.study] || '').trim() || '(senza titolo)',
        researcher: (C.by >= 0 ? String(r[C.by] || '') : '').replace(/\s+/g, ' ').trim() || '(sconosciuto)',
        cur: rw.cur, reward: rw.val, bonusCur: bo.cur, bonus: bo.val,
        started, completed, when,
        dateKey: when ? dkey(when) : '',
        monthKey: when ? mkey(when) : '',
        rateKey: when ? when.toISOString().slice(0, 10) : '',
        minutes,
        code: C.code >= 0 ? String(r[C.code] || '').trim() : '',
        status: normStatus(r[C.status]),
      });
    });
    if (!out.length) throw new Error(skipped ? 'Nessuna riga del file ha una data di inizio (colonna Started At).' : 'Il file non contiene righe di dati.');
    RAW = out;
    FILE = { name: name || 'CSV', rows: out.length, skipped, loaded: new Date().toISOString() };
  }

  // ---------------------------------------------------------- tassi di cambio
  function histRate(cur, key) {
    if (!HIST || !HIST.rates || !key) return null;
    if (!HIST_KEYS) HIST_KEYS = Object.keys(HIST.rates).sort();
    if (!HIST_KEYS.length) return null;
    let lo = 0, hi = HIST_KEYS.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (HIST_KEYS[mid] <= key) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    const k = HIST_KEYS[ans < 0 ? 0 : ans];
    const v = HIST.rates[k] && HIST.rates[k][cur];
    return v ? 1 / v : null;
  }
  function rateFor(cur, key) {
    if (cur === 'EUR') return 1;
    if (S.historical) { const h = histRate(cur, key); if (h) return h; }
    return +S.rates[cur] || 1;
  }
  async function fetchJSON(urls) {
    let last;
    for (const u of urls) {
      try {
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) { last = e; }
    }
    throw last || new Error('rete non disponibile');
  }
  const shiftKey = (k, n) => addDays(new Date(k + 'T12:00:00Z'), n).toISOString().slice(0, 10);
  async function refreshRates(force) {
    rateStatus = { state: 'loading', msg: 'Aggiorno i tassi BCE…' };
    renderRateStatus();
    try {
      const latest = await fetchJSON([
        'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=GBP,USD',
        'https://api.frankfurter.app/latest?from=EUR&to=GBP,USD',
      ]);
      if (!latest || !latest.rates || !latest.rates.GBP || !latest.rates.USD) throw new Error('risposta non valida');
      S.rates = { GBP: +(1 / latest.rates.GBP).toFixed(4), USD: +(1 / latest.rates.USD).toFixed(4), date: latest.date, source: 'BCE' };
      saveSettings();
      const keys = RAW.map(r => r.rateKey).filter(Boolean).sort();
      if (keys.length) {
        const from = shiftKey(keys[0], -7), to = keys[keys.length - 1];
        if (force || !HIST || HIST.from > from || HIST.to < to) {
          const ts = await fetchJSON([
            `https://api.frankfurter.dev/v1/${from}..${to}?base=EUR&symbols=GBP,USD`,
            `https://api.frankfurter.app/${from}..${to}?from=EUR&to=GBP,USD`,
          ]);
          if (ts && ts.rates && Object.keys(ts.rates).length) {
            HIST = { from, to, rates: ts.rates, fetched: new Date().toISOString() };
            HIST_KEYS = null;
            store.set('ps.hist', HIST);
          }
        }
      }
      rateStatus = { state: 'ok', msg: `Tassi BCE aggiornati (ultimo disponibile: ${fmtKey(S.rates.date)}).` };
    } catch (e) {
      rateStatus = { state: 'err', msg: 'Non riesco a scaricare i tassi BCE: uso gli ultimi tassi salvati.' };
    }
    convert();
    renderAll();
    renderRateStatus();
  }

  // ---------------------------------------------------------- conversione in euro
  function convert() {
    DATA = RAW.map(r => {
      const rate = rateFor(r.cur, r.rateKey);
      const brate = rateFor(r.bonusCur, r.rateKey);
      const rewardEur = r.reward * rate, bonusEur = r.bonus * brate;
      const st = r.status;
      const isEarned = st === 'APPROVED' || st === 'SCREENED OUT';
      const isPending = st === 'AWAITING REVIEW';
      // Come Prolific: approvato = premio + bonus; screened out = solo il compenso (bonus)
      const earned = st === 'APPROVED' ? rewardEur + bonusEur : st === 'SCREENED OUT' ? bonusEur : 0;
      const pending = isPending ? rewardEur + bonusEur : 0;
      const value = isEarned ? earned : isPending ? pending : rewardEur + bonusEur;
      return { ...r, rate, rewardEur, bonusEur, earned, pending, value, isEarned, isPending };
    });
  }

  // ---------------------------------------------------------- filtri
  function applyFilters(rows) {
    const q = norm(F.q.trim()), rq = norm(F.researcher.trim());
    const min = F.min === '' ? null : +F.min, max = F.max === '' ? null : +F.max;
    return rows.filter(r => {
      if (q && !norm(r.study).includes(q)) return false;
      if (F.study && r.study !== F.study) return false; // studio esatto (dai clic), la ricerca invece è parziale
      // nome esatto se scelto con un clic, parziale se scritto nel campo del filtro
      if (rq && !(F.researcherExact ? r.researcher === F.researcher : norm(r.researcher).includes(rq))) return false;
      if (F.from && (!r.dateKey || r.dateKey < F.from)) return false;
      if (F.to && (!r.dateKey || r.dateKey > F.to)) return false;
      const v = round2(r.value);
      if (min != null && v < min) return false;
      if (max != null && v > max) return false;
      if (F.statuses.size && !F.statuses.has(r.status)) return false;
      if (F.currencies.size && !F.currencies.has(r.cur)) return false;
      return true;
    });
  }
  function resetFilters() {
    Object.assign(F, { q: '', study: '', researcher: '', researcherExact: false, from: '', to: '', min: '', max: '', datePreset: '' });
    F.statuses.clear(); F.currencies.clear();
    $('#fSearch').value = '';
  }

  // ---------------------------------------------------------- fasce di importo
  function bucketOf(v) {
    const t = S.thresholds; v = round2(v);
    for (let i = 0; i < t.length; i++) if (v < t[i]) return i;
    return t.length;
  }
  const numLabel = v => (Number.isInteger(v) ? String(v) : nf2.format(v));
  function bucketLabels() {
    const t = S.thresholds, out = [`< ${numLabel(t[0])} €`];
    for (let i = 1; i < t.length; i++) {
      const a = t[i - 1], b = t[i];
      if (Number.isInteger(a) && Number.isInteger(b)) out.push(b - 1 === a ? `${a} €` : `${a}-${b - 1} €`);
      else out.push(`${numLabel(a)}-${numLabel(b)} €`);
    }
    out.push(`${numLabel(t[t.length - 1])} € e >`);
    return out;
  }
  function bucketRanges() {
    const t = S.thresholds, out = [`meno di ${eur(t[0])}`];
    for (let i = 1; i < t.length; i++) out.push(`da ${eur(t[i - 1])} a ${eur(t[i] - 0.01)}`);
    out.push(`${eur(t[t.length - 1])} o più`);
    return out;
  }
  const inBasis = r => (S.basis === 'approved' ? r.status === 'APPROVED' : r.isEarned);
  const basisLabel = () => (S.basis === 'approved' ? 'Studi approvati per fascia di importo' : 'Studi pagati per fascia di importo (approvati + screened out)');

  // ---------------------------------------------------------- aggregazione
  function agg(rows) {
    const nb = S.thresholds.length + 1;
    const a = { n: rows.length, saldo: 0, pending: 0, nEarned: 0, nApproved: 0, nScreened: 0, nPending: 0, nLost: 0, minutes: 0, buckets: new Array(nb).fill(0) };
    for (const r of rows) {
      if (r.isEarned) { a.saldo += r.earned; a.nEarned++; if (r.minutes != null) a.minutes += r.minutes; }
      if (r.status === 'APPROVED') a.nApproved++;
      else if (r.status === 'SCREENED OUT') a.nScreened++;
      else if (r.isPending) { a.pending += r.pending; a.nPending++; }
      else a.nLost++;
      if (inBasis(r)) a.buckets[bucketOf(r.earned)]++;
    }
    a.perHour = a.minutes > 0 ? a.saldo / (a.minutes / 60) : null;
    return a;
  }
  function groupRows(rows, keyFn) {
    const m = new Map();
    rows.forEach(r => { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return Array.from(m, ([key, rs]) => ({ key, rows: rs }));
  }

  // ---------------------------------------------------------- tema
  const isDark = () => S.theme === 'dark' || (S.theme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  function applyTheme() {
    if (S.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = S.theme;
  }
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function rampColors(n) {
    const steps = isDark() ? RAMP_DARK : RAMP_LIGHT;
    if (n === 1) return [steps[4]];
    return Array.from({ length: n }, (_, j) => steps[Math.round(j * (steps.length - 1) / (n - 1))]);
  }
  function avatarHtml(name, lg) {
    let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const parts = name.split(/[\s._@-]+/).filter(Boolean);
    const ini = ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    return `<span class="avatar${lg ? ' lg' : ''}" style="background:${AVATAR_COLORS[h % AVATAR_COLORS.length]}" aria-hidden="true">${esc(ini)}</span>`;
  }

  // ---------------------------------------------------------- Chart.js: plugin e opzioni comuni
  if (window.Chart) {
    Chart.register({
      id: 'tipLabels',
      defaults: { enabled: false },
      afterDatasetsDraw(chart, args, o) {
        if (!o.enabled) return;
        const metas = chart.getSortedVisibleDatasetMetas();
        if (!metas.length) return;
        const fmt = FMT.get(chart.canvas) || (v => String(v));
        const horizontal = chart.options.indexAxis === 'y';
        const top = metas[metas.length - 1];
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = `500 12px ${tok('--font')}`;
        ctx.fillStyle = tok('--ink-2');
        const totals = top.data.map((el, i) => {
          let total = 0;
          metas.forEach(m => { total += +chart.data.datasets[m.index].data[i] || 0; });
          return total;
        });
        const texts = compact => totals.map((t, i) => (t ? fmt(t, i, compact) || '' : ''));
        let txts = texts(false);
        if (!horizontal) {
          // con tante colonne le etichette si sovrappongono: prima la forma breve, poi niente
          const slot = chart.chartArea.width / Math.max(1, top.data.length) - 4;
          const widest = arr => Math.max(0, ...arr.map(t => ctx.measureText(t).width));
          if (widest(txts) > slot) { txts = texts(true); if (widest(txts) > slot) { ctx.restore(); return; } }
        }
        top.data.forEach((el, i) => {
          const txt = txts[i];
          if (!txt) return;
          if (horizontal) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, el.x + 6, el.y); }
          else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(txt, el.x, el.y - 5); }
        });
        ctx.restore();
      },
    });
    Chart.register({
      id: 'endLabel',
      defaults: { enabled: false },
      afterDatasetsDraw(chart, args, o) {
        if (!o.enabled) return;
        const pts = chart.getDatasetMeta(0).data;
        if (!pts.length) return;
        const p = pts[pts.length - 1];
        const v = chart.data.datasets[0].data[pts.length - 1];
        const fmt = FMT.get(chart.canvas) || (x => String(x));
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = `600 13px ${tok('--font')}`;
        ctx.fillStyle = tok('--ink');
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fmt(v), p.x - 4, p.y - 10);
        ctx.restore();
      },
    });
    Chart.register({
      id: 'crosshair',
      defaults: { enabled: false },
      beforeDatasetsDraw(chart, args, o) {
        if (!o.enabled || !chart.tooltip) return;
        const act = chart.tooltip.getActiveElements ? chart.tooltip.getActiveElements() : [];
        if (!act.length) return;
        const x = act[0].element.x, { top, bottom } = chart.chartArea, ctx = chart.ctx;
        ctx.save(); ctx.strokeStyle = tok('--axis'); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.restore();
      },
    });
    /* Asse degli anni sotto i mesi: separatore tratteggiato tra un anno e l'altro
       e l'anno scritto al centro dei suoi mesi. keys = chiavi 'YYYY-MM' delle colonne. */
    Chart.register({
      id: 'yearAxis',
      defaults: { keys: null },
      afterDraw(chart, args, o) {
        const keys = o.keys;
        const x = chart.scales.x;
        if (!keys || !keys.length || !x) return;
        const { top, bottom } = chart.chartArea, ctx = chart.ctx;
        const runs = [];
        keys.forEach((k, i) => {
          const y = k.slice(0, 4);
          if (!runs.length || runs[runs.length - 1].y !== y) runs.push({ y, a: i, b: i });
          else runs[runs.length - 1].b = i;
        });
        const half = keys.length > 1 ? (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2 : x.width / 2;
        ctx.save();
        ctx.strokeStyle = tok('--axis'); ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        runs.slice(1).forEach(r => {
          const px = Math.round(x.getPixelForValue(r.a) - half) + 0.5;
          ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, x.bottom + 18); ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.font = `600 12px ${tok('--font')}`; ctx.fillStyle = tok('--ink-2');
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        runs.forEach(r => {
          const l = x.getPixelForValue(r.a) - half, rgt = x.getPixelForValue(r.b) + half;
          if (ctx.measureText(r.y).width > rgt - l - 4) return;
          ctx.fillText(r.y, (l + rgt) / 2, x.bottom + 4);
        });
        ctx.restore();
      },
    });
  }
  function setChartDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = tok('--font');
    Chart.defaults.font.size = 12;
    Chart.defaults.color = tok('--muted');
    Chart.defaults.borderColor = tok('--grid');
  }
  function destroyCharts() {
    if (LAZY) { LAZY.disconnect(); LAZY = null; }
    while (charts.length) charts.pop().destroy();
  }
  function makeChart(id, cfg, fmt) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    if (!window.Chart) { canvas.parentElement.innerHTML = '<p class="empty-note">Grafico non disponibile: libreria Chart.js non caricata.</p>'; return null; }
    if (fmt) FMT.set(canvas, fmt);
    const c = new Chart(canvas, cfg);
    charts.push(c);
    return c;
  }
  function tooltipOpts(callbacks) {
    return {
      backgroundColor: tok('--tip-bg'), titleColor: tok('--tip-ink'), bodyColor: tok('--tip-ink'), footerColor: tok('--muted'),
      borderColor: tok('--border'), borderWidth: 1, padding: 12, cornerRadius: 10, boxPadding: 6, usePointStyle: true,
      titleFont: { weight: '600' }, callbacks: callbacks || {},
    };
  }
  const legendOpts = show => ({
    display: !!show, position: 'top', align: 'start',
    labels: { usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10, boxHeight: 10, padding: 16, color: tok('--ink-2') },
  });
  const valueScale = (fmt, opts = {}) => ({
    beginAtZero: true, stacked: !!opts.stacked, grace: '12%',
    grid: { color: tok('--grid'), drawTicks: false }, border: { display: false },
    ticks: { callback: v => fmt(v), padding: 8, maxTicksLimit: 6, precision: opts.integer ? 0 : undefined },
  });
  const catScale = (opts = {}) => ({
    stacked: !!opts.stacked, grid: { display: false }, border: { color: tok('--axis') },
    ticks: { padding: 6, color: tok('--ink-2'), maxRotation: 0, autoSkip: true, ...(opts.ticks || {}) },
  });
  const barDs = (label, data, color, extra = {}) => ({
    label, data, backgroundColor: color, hoverBackgroundColor: color,
    borderRadius: 4, borderSkipped: 'start', maxBarThickness: 24, categoryPercentage: 0.8, barPercentage: 0.9, ...extra,
  });
  // segmenti impilati separati da 2px del colore della superficie
  const stackGap = () => ({ borderColor: tok('--card'), borderWidth: { top: 2, right: 0, bottom: 0, left: 0 } });

  // ---------------------------------------------------------- componenti HTML
  function vizCard(id, title, sub, o = {}) {
    const seg = o.seg ? `<div class="seg" data-seg="${o.seg.name}" role="group">${o.seg.options.map(([v, l]) => `<button type="button" data-v="${v}" class="${o.seg.value === v ? 'on' : ''}">${l}</button>`).join('')}</div>` : '';
    // o.tables: più tabelle comprimibili sotto il grafico ({ id, label, open, keep }); keep = ricorda aperto/chiuso
    const tables = o.tables || [{ id, label: o.tableLabel || 'Tabella', open: !o.closed }];
    const det = t => {
      const open = t.keep && KEEP_OPEN.has(t.keep) ? KEEP_OPEN.get(t.keep) : t.open;
      return `<details ${open ? 'open' : ''}${t.keep ? ` data-keep="${esc(t.keep)}"` : ''}><summary>${t.label}</summary><div id="t-${t.id}"></div></details>`;
    };
    // o.cls: classi in più per la card; o.toolbar: HTML (es. una barra di filtri) tra il titolo e il grafico
    return `<article class="card viz ${o.span || o.split ? 'span-2' : ''} ${o.split ? 'split' : ''} ${o.cls || ''}">
      <div class="viz-head"><div><h3>${title}</h3>${sub ? `<p${o.subTip ? ` title="${o.subTip}"` : ''}>${sub}</p>` : ''}</div>${seg}</div>
      ${o.toolbar || ''}
      <div class="viz-body">
        <div class="chart-box ${o.size || ''}"><canvas id="c-${id}" role="img" aria-label="${esc(title)}"></canvas></div>
        ${o.tables ? `<div class="viz-tables">${tables.map(det).join('')}</div>` : det(tables[0])}
      </div>
    </article>`;
  }
  function mount(id, el) { const host = document.getElementById(id); if (host) { host.innerHTML = ''; host.appendChild(el); } }
  // scorre fino a el lasciando spazio per la barra di navigazione (e per la barra delle schede mensili, se è fissa)
  // instant: salto senza animazione (arrivando da un altro tab)
  function scrollToEl(el, withBar, instant) {
    const nav = $('.nav'), bar = $('.panel:not([hidden]) .mtool');
    let off = (nav ? nav.offsetHeight : 0) + 14;
    if (withBar && bar && getComputedStyle(bar).position === 'sticky') off += bar.offsetHeight;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - off), behavior: reduce || instant ? 'auto' : 'smooth' });
  }
  // breve evidenziazione dell'elemento raggiunto (animazione CSS .flash)
  const flash = el => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); };

  /* Tabella "dati e guadagni": per ogni gruppo il saldo in euro e il numero di studi
     per fascia di importo (come la tabella Notion), con somma e media in fondo. */
  function bracketTable(groups, o = {}) {
    const labels = bucketLabels(), ranges = bucketRanges(), nb = labels.length;
    const items = groups.map((g, i) => ({ ...g, i, a: agg(g.rows) }));
    let sk = o.sort || 'saldo', dir = (sk === 'order' || sk === 'name') ? 1 : -1, expanded = false;
    const limit = o.limit || 0;
    const T = items.reduce((t, it) => {
      t.saldo += it.a.saldo; t.pending += it.a.pending; t.n += it.a.n; t.minutes += it.a.minutes;
      it.a.buckets.forEach((v, j) => { t.b[j] += v; });
      return t;
    }, { saldo: 0, pending: 0, n: 0, minutes: 0, b: new Array(nb).fill(0) });
    const counted = items.filter(it => !it.noAvg).length;
    const G = counted || 1;
    const maxB = Math.max(1, ...items.map(it => Math.max(...it.a.buckets)));
    const get = (it, k) => {
      if (k === 'order') return it.i;
      if (k === 'name') return norm(it.label);
      if (k === 'saldo') return it.a.saldo;
      if (k === 'pending') return it.a.pending;
      if (k === 'n') return it.a.n;
      if (k === 'ph') return it.a.perHour == null ? -1 : it.a.perHour;
      return it.a.buckets[+k.slice(1)];
    };
    const nameCell = it => {
      const main = o.onPick && !it.noPick
        ? `<button type="button" class="link main" data-pick="${it.i}" title="${esc(o.pickHint ? o.pickHint(it) : 'Vedi nello storico: ' + it.label)}">${o.kind === 'time' ? `<b>${esc(it.label)}</b>` : esc(it.label)}</button>`
        : `<span class="main">${o.kind === 'time' ? `<b>${esc(it.label)}</b>` : esc(it.label)}</span>`;
      const sub = it.sub ? `<span class="secondary">${esc(it.sub)}</span>` : '';
      if (o.kind === 'status') return `${o.onPick ? `<button type="button" class="link" data-pick="${it.i}" title="Vedi nello storico: ${esc(it.key)}">${statusPill(it.key, true)}</button>` : statusPill(it.key, true)}${sub}`;
      const ico = o.kind === 'researcher' ? avatarHtml(it.label)
        : o.kind === 'time' ? `<span class="mini-ico">${ICON.cal}</span>`
          : o.kind === 'study' ? `<span class="mini-ico">${ICON.doc}</span>`
            : o.kind === 'currency' ? `<span class="mini-ico">${ICON.coin}</span>`
              : o.kind === 'hour' ? `<span class="mini-ico">${ICON.clock}</span>` : '';
      return `<div class="namecell">${ico}<span class="txt">${main}${sub}</span></div>`;
    };
    const wrap = document.createElement('div');
    wrap.className = 'btable-wrap';
    const th = (k, html, cls, title) => `<th data-k="${k}" class="${cls || ''}${sk === k ? ' sorted' : ''}"${title ? ` title="${esc(title)}"` : ''} aria-sort="${sk === k ? (dir > 0 ? 'ascending' : 'descending') : 'none'}">${html}${sk === k ? `<span class="arr">${dir > 0 ? '▲' : '▼'}</span>` : ''}</th>`;
    const H = '<span class="hash">#</span>';
    function draw() {
      const sorted = items.slice().sort((x, y) => {
        const a = get(x, sk), b = get(y, sk);
        return ((a < b ? -1 : a > b ? 1 : 0) * dir) || (y.a.saldo - x.a.saldo) || (x.i - y.i);
      });
      const shown = limit && !expanded ? sorted.slice(0, limit) : sorted;
      const body = shown.map(it => {
        const a = it.a;
        const cells = a.buckets.map(v => (v
          ? `<td style="background:color-mix(in srgb, var(--heat) ${Math.round(5 + 20 * v / maxB)}%, transparent)">${v}</td>`
          : '<td class="zero">0</td>')).join('');
        return `<tr><td class="name">${nameCell(it)}</td><td class="saldo">${eur(a.saldo)}</td><td class="${a.pending ? '' : 'zero'}">${a.pending ? eur(a.pending) : '—'}</td><td>${a.n}</td>${cells}<td class="${a.perHour == null ? 'zero' : ''}">${a.perHour == null ? '—' : eur(a.perHour) + '/h'}</td></tr>`;
      }).join('');
      const avgPH = T.minutes > 0 ? T.saldo / (T.minutes / 60) : null;
      const AG = l => `<span class="agg">${l}</span>`;
      const foot = `<tr><td class="name">${AG('Somma')}${counted} ${esc(counted === 1 ? (o.unitOne || 'gruppo') : (o.unit || 'gruppi'))}${counted < items.length ? ' + senza data' : ''}</td><td class="saldo">${AG('Somma')}${eur(T.saldo)}</td><td>${AG('Somma')}${eur(T.pending)}</td><td>${AG('Somma')}${T.n}</td>${T.b.map(v => `<td>${AG('Somma')}${v}</td>`).join('')}<td class="zero">—</td></tr>
        <tr><td class="name">${AG('Media')}per ${esc(o.unitOne || 'gruppo')}</td><td>${AG('Media')}${eur(T.saldo / G)}</td><td>${AG('Media')}${eur(T.pending / G)}</td><td>${AG('Media')}${nf2.format(T.n / G)}</td>${T.b.map(v => `<td>${AG('Media')}${nf2.format(v / G)}</td>`).join('')}<td title="Media ponderata sul tempo impiegato">${avgPH == null ? '—' : eur(avgPH) + '/h'}</td></tr>`;
      wrap.innerHTML = `<div class="tscroll"><table class="btable">
        <thead>
          <tr class="grp"><th class="l" colspan="4"></th><th colspan="${nb}">${esc(basisLabel())}</th><th></th></tr>
          <tr>${th('name', esc(o.title || 'Gruppo'), 'l')}${th('saldo', H + 'Saldo', '', 'Guadagnato in euro')}${th('pending', H + 'In attesa', '', 'Studi in AWAITING REVIEW')}${th('n', H + 'Tot.', '', 'Tutte le sottomissioni del gruppo, comprese restituite e in attesa')}${labels.map((l, j) => th('b' + j, H + esc(l), '', ranges[j])).join('')}${th('ph', H + '€/ora', '', 'Guadagnato diviso il tempo impiegato')}</tr>
        </thead>
        <tbody>${body || `<tr><td colspan="${5 + nb}" class="name zero">Nessun dato</td></tr>`}</tbody>
        ${o.noFoot ? '' : `<tfoot>${foot}</tfoot>`}
      </table></div>
      ${limit && items.length > limit ? `<div class="more-row"><button class="btn sm more-btn" type="button">${expanded ? 'Mostra meno' : `Mostra tutti (${items.length})`}</button></div>` : ''}`;
    }
    wrap.addEventListener('click', e => {
      const h = e.target.closest('th[data-k]');
      if (h) {
        const k = h.dataset.k;
        if (sk === k) dir *= -1; else { sk = k; dir = (k === 'name' || k === 'order') ? 1 : -1; }
        draw(); return;
      }
      const p = e.target.closest('[data-pick]');
      if (p && o.onPick) { o.onPick(items[+p.dataset.pick]); return; }
      if (e.target.closest('.more-btn')) { expanded = !expanded; draw(); }
    });
    draw();
    return wrap;
  }

  // ---------------------------------------------------------- rendering generale
  function renderAll() {
    if (!RAW.length) return;
    updateWallet();
    updatePills();
    renderChips();
    renderActive();
  }
  function renderActive() {
    if (!RAW.length) return;
    destroyCharts();
    setChartDefaults();
    $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === TAB));
    $$('.panel').forEach(p => { p.hidden = p.dataset.panel !== TAB; });
    // i filtri esistono solo nello Storico: negli altri tab barra nascosta e dati completi
    $('#filterbar').hidden = $('#chips').hidden = TAB !== 'history';
    const panel = $(`.panel[data-panel="${TAB}"]`);
    const rows = TAB === 'history' ? applyFilters(DATA) : DATA;
    if (!rows.length) {
      panel.innerHTML = `<div class="card" style="margin-top:28px;padding:40px;text-align:center"><p class="empty-note" style="padding:0 0 14px">Nessuna sottomissione corrisponde ai filtri selezionati.</p><button class="btn" type="button" data-reset>Azzera filtri</button></div>`;
      return;
    }
    ({ overview: renderOverview, monthly: renderMonthly, studies: renderStudies, researchers: renderResearchers, history: renderHistory }[TAB] || renderOverview)(panel, rows);
  }
  // cambio tab: uscendo dallo Storico i filtri si azzerano
  function setTab(t) {
    TAB = t; store.set('ps.tab', TAB); HLIMIT = 50;
    if (TAB !== 'history') { resetFilters(); closeDropdowns(); updatePills(); renderChips(); }
    renderActive();
  }
  function updateWallet() {
    $('#wallet').hidden = false;
    $('#walletEarned').textContent = eur(sum(DATA, r => r.earned));
    $('#walletPending').textContent = eur(sum(DATA, r => r.pending));
  }
  function periodText(rows) {
    const keys = rows.map(r => r.dateKey).filter(Boolean).sort();
    if (!keys.length) return '';
    return keys[0] === keys[keys.length - 1] ? fmtKey(keys[0]) : `dal ${fmtKey(keys[0])} al ${fmtKey(keys[keys.length - 1])}`;
  }
  function ratesNote() {
    const r = S.rates;
    const mode = S.historical && HIST ? 'tasso BCE del giorno di ogni studio' : 'tasso fisso';
    const skipped = FILE && FILE.skipped ? ` · ${pl(FILE.skipped, 'sottomissione senza data di inizio esclusa', 'sottomissioni senza data di inizio escluse')} dalle statistiche` : '';
    return `<div class="rates-note">Conversione in euro: ${mode} · ultimo 1 £ = ${nf4.format(r.GBP)} € · 1 $ = ${nf4.format(r.USD)} €${r.date ? ` (${fmtKey(r.date)})` : ''}${skipped} <button type="button" data-open-settings>Cambia</button></div>`;
  }

  // ---------------------------------------------------------- RIEPILOGO
  // periodi rapidi della sezione "Grafici": [chiave, etichetta, dal, al, descrizione, gruppo]
  function overviewPeriods(rows) {
    const t = new Date(), today = dkey(t), y = t.getFullYear(), m = t.getMonth();
    const years = [...new Set(rows.filter(r => r.dateKey).map(r => r.dateKey.slice(0, 4)))].filter(v => +v !== y).sort().reverse();
    return [
      ['all', 'Tutto', '', '', 'Tutte le sottomissioni', 'base'],
      ['month', 'Questo mese', dkey(new Date(y, m, 1)), today, '', 'base'],
      ['prev', 'Mese scorso', dkey(new Date(y, m - 1, 1)), dkey(new Date(y, m, 0)), '', 'base'],
      ['year', 'Quest\'anno', `${y}-01-01`, today, '', 'base'],
      ['d7', '7 giorni', dkey(addDays(t, -6)), today, 'Ultimi 7 giorni', 'last'],
      ['d30', '30 giorni', dkey(addDays(t, -29)), today, 'Ultimi 30 giorni', 'last'],
      ['m3', '3 mesi', dkey(new Date(y, m - 2, 1)), today, 'Ultimi 3 mesi (compreso questo)', 'last'],
      ['m12', '12 mesi', dkey(new Date(y, m - 11, 1)), today, 'Ultimi 12 mesi (compreso questo)', 'last'],
    ].concat(years.map(v => ['y' + v, v, `${v}-01-01`, `${v}-12-31`, `Anno ${v}`, 'year']));
  }
  // periodo attivo (OVP) risolto in date; effFrom/effTo = date reali, usate per precompilare "Personalizzato"
  function overviewRange(rows) {
    const list = overviewPeriods(rows);
    let p = OVP.k === 'custom' ? ['custom', 'Personalizzato', OVP.from, OVP.to, ''] : list.find(x => x[0] === OVP.k);
    if (!p) { OVP = { k: 'all', from: '', to: '' }; p = list[0]; }
    const keys = rows.map(r => r.dateKey).filter(Boolean).sort();
    return { key: p[0], label: p[4] || p[1], from: p[2], to: p[3], list, effFrom: p[2] || keys[0] || '', effTo: p[3] || keys[keys.length - 1] || '' };
  }
  function renderOverview(p, rows) {
    const a = agg(rows);
    const byCur = {}, byCurP = {};
    rows.forEach(r => {
      if (r.status === 'APPROVED') byCur[r.cur] = (byCur[r.cur] || 0) + r.reward + r.bonus;
      else if (r.status === 'SCREENED OUT') byCur[r.bonusCur] = (byCur[r.bonusCur] || 0) + r.bonus;
      else if (r.isPending) byCurP[r.cur] = (byCurP[r.cur] || 0) + r.reward + r.bonus;
    });
    const curText = o => Object.keys(o).sort().map(c => money(o[c], c)).join(' | ') || '—';
    // periodo in corso (oggi, questa settimana, questo mese) e periodo migliore di sempre
    const withDate = rows.filter(r => r.dateKey);
    const paid = withDate.filter(r => r.isEarned);
    const bestOf = keyFn => groupRows(paid, keyFn).map(g => ({ k: g.key, v: sum(g.rows, r => r.earned) })).sort((x, y) => y.v - x.v)[0];
    const now = new Date(), today = dkey(now), mon = mondayOf(now), thisMonth = mkey(now);
    const inRange = (from, to) => withDate.filter(r => r.dateKey >= from && r.dateKey <= to);
    const period = (from, to) => { const rs = inRange(from, to); return { rs, v: sum(rs, r => r.earned), pend: sum(rs, r => r.pending) }; };
    const pToday = period(today, today);
    const wFrom = dkey(mon), wTo = dkey(addDays(mon, 6)), pWeek = period(wFrom, wTo);
    const mr = monthRange(thisMonth), pMonth = period(mr.from, mr.to);
    const bDay = bestOf(r => r.dateKey), bWeek = bestOf(r => dkey(mondayOf(r.when))), bMonth = bestOf(r => r.monthKey);
    const weekText = k => { const m = fromKey(k); return `${weekLabel(m)} ${addDays(m, 6).getFullYear()}`; };
    const nowSub = p => (p.rs.length ? `${pl(p.rs.length, 'sottomissione', 'sottomissioni')}${p.pend ? ` · ${eur(p.pend)} in attesa` : ''}` : 'nessuna sottomissione');
    // card cliccabile solo se nel periodo c'è almeno una sottomissione:
    // link = [dal, al, preset] apre lo Storico, { month } apre l'infografica del mese nel tab Mensile;
    // live = periodo in corso, importo in giallo
    const tile = (label, value, sub, link, live) => {
      const inner = `<div class="t-label">${label}</div><div class="t-value${live ? ' live' : ''}"${live ? ' title="Periodo in corso"' : ''}>${value}</div><div class="t-sub" title="${esc(sub)}">${esc(sub)}</div>`;
      if (link && link.month) return `<button type="button" class="card tile tile-link" data-tmonth="${link.month}" title="Apri l'infografica di ${esc(monthLabel(link.month))}">${inner}</button>`;
      return link ? `<button type="button" class="card tile tile-link" data-thist="${link.join('|')}" title="Vedi nello storico">${inner}</button>` : `<div class="card tile">${inner}</div>`;
    };

    // periodo del grafico "Andamento dei guadagni": vale solo per quel grafico e per la sua tabella,
    // gli altri grafici della sezione usano sempre tutti i dati
    const R = overviewRange(rows);
    const cr = R.key === 'all' ? rows : rows.filter(r => r.dateKey && (!R.from || r.dateKey >= R.from) && (!R.to || r.dateKey <= R.to));
    const cra = agg(cr);
    const rangeText = R.key === 'all' ? periodText(rows)
      : R.from && R.to ? (R.from === R.to ? fmtKey(R.from) : `dal ${fmtKey(R.from)} al ${fmtKey(R.to)}`)
        : R.from ? `dal ${fmtKey(R.from)}` : R.to ? `fino al ${fmtKey(R.to)}` : '';
    // filtro equivalente per lo Storico (le chiavi dei periodi comuni hanno lo stesso nome nella barra filtri)
    const periodPatch = R.key === 'all' ? {} : { from: R.from, to: R.to, datePreset: { d7: '7', d30: '30', month: 'month', prev: 'prev' }[R.key] || '' };
    const chip = ([k, l, , , t]) => `<button type="button" data-ovp="${k}" class="${R.key === k ? 'on' : ''}" aria-pressed="${R.key === k}"${t ? ` title="${esc(t)}" aria-label="${esc(t)}"` : ''}>${esc(l)}</button>`;
    const sep = '<span class="mtool-sep" aria-hidden="true"></span>';
    const group = g => R.list.filter(x => x[5] === g);
    const toolbar = `<div class="mtool mtool-inline" role="region" aria-label="Periodo del grafico">
        <div class="mtool-views">
          <span class="mtool-label">Periodo</span>
          <div class="mtool-chips" role="group" aria-label="Periodo del grafico">
            ${group('base').map(chip).join('')}${sep}<span class="mtool-sub" aria-hidden="true">Ultimi</span>${group('last').map(chip).join('')}
            ${group('year').length ? sep + group('year').map(chip).join('') : ''}${sep}
            <button type="button" data-ovp="custom" class="${R.key === 'custom' ? 'on' : ''}" aria-pressed="${R.key === 'custom'}" data-from="${R.effFrom}" data-to="${R.effTo}">Personalizzato</button>
          </div>
        </div>
        <div class="mtool-goto">
          <label class="mtool-label" for="ovFrom">Dal</label><input type="date" id="ovFrom" value="${R.effFrom}" title="Cambia la data per un periodo personalizzato">
          <label class="mtool-label" for="ovTo">Al</label><input type="date" id="ovTo" value="${R.effTo}" title="Cambia la data per un periodo personalizzato">
          <button type="button" class="btn sm" data-ovp="all"${R.key === 'all' ? ' disabled' : ''}>Azzera</button>
        </div>
      </div>`;

    p.innerHTML = `
      <h2 class="section-title">Riepilogo <span class="sub">${esc(periodText(rows))}</span></h2>
      <div class="card summary">
        <div><div class="label">Sottomissioni totali</div><div class="value">${a.n}</div><div class="foot">${pl(a.nLost, 'non pagata', 'non pagate')} (restituite, scadute, rifiutate)</div></div>
        <div><div class="label">Sottomissioni pagate</div><div class="value">${a.nEarned}</div><div class="foot">${pl(a.nApproved, 'approvata', 'approvate')} · ${a.nScreened} screened out</div></div>
        <div><div class="label">Totale guadagnato <span class="info" title="Premio + bonus degli studi APPROVED, più il compenso (bonus) degli SCREENED OUT. È lo stesso calcolo del riepilogo Prolific.">i</span></div><div class="value">${eur(a.saldo)}</div><div class="foot">${curText(byCur)}</div></div>
        <div><div class="label">In attesa</div><div class="value ink">${eur(a.pending)}</div><div class="foot">${a.nPending} in revisione${Object.keys(byCurP).length ? ' · ' + curText(byCurP) : ''}</div></div>
        <div><div class="label">Paga oraria <span class="info" title="Guadagnato diviso il tempo impiegato negli studi pagati (approvati e screened out).">i</span></div><div class="value">${a.perHour == null ? '—' : eur(a.perHour) + '/h'}</div><div class="foot">sugli studi pagati</div></div>
        <div><div class="label">Tempo totale</div><div class="value ink">${durText(a.minutes)}</div><div class="foot">negli studi pagati</div></div>
      </div>
      <div class="tiles">
        ${tile('Guadagno di oggi', eur(pToday.v), nowSub(pToday), pToday.rs.length && [today, today, 'today'], true)}
        ${tile('Guadagno giorno migliore', bDay ? eur(bDay.v) : '—', bDay ? fmtKey(bDay.k) : '', bDay && [bDay.k, bDay.k, ''])}
        ${tile('Guadagno settimanale', eur(pWeek.v), `${weekText(wFrom)} · ${nowSub(pWeek)}`, pWeek.rs.length && [wFrom, wTo, ''], true)}
        ${tile('Guadagno settimana migliore', bWeek ? eur(bWeek.v) : '—', bWeek ? weekText(bWeek.k) : '', bWeek && [bWeek.k, dkey(addDays(fromKey(bWeek.k), 6)), ''])}
        ${tile('Guadagno mensile', eur(pMonth.v), `${monthLabel(thisMonth)} · ${nowSub(pMonth)}`, pMonth.rs.length && { month: thisMonth }, true)}
        ${tile('Guadagno mese migliore', bMonth ? eur(bMonth.v) : '—', bMonth ? monthLabel(bMonth.k) : '', bMonth && { month: bMonth.k })}
      </div>
      ${ratesNote()}
      <h2 class="section-title">Grafici</h2>
      <div class="grid-2">
        ${(t => vizCard('cum', 'Andamento dei guadagni', esc(t), {
          span: true, cls: 'ovcum', subTip: esc(t), toolbar, tableLabel: 'Tabella: dati e guadagni del periodo',
        }))(`Guadagnato cumulato giorno per giorno · ${R.key === 'all' ? 'tutto il periodo' : R.label}${rangeText ? ' · ' + rangeText : ''} · ${pl(cra.n, 'sottomissione', 'sottomissioni')} · ${eur(cra.saldo)}`)}
        ${vizCard('status', 'Sottomissioni per stato', 'Quante sottomissioni hai in ogni stato', { split: true, tableLabel: 'Tabella: per stato' })}
        ${vizCard('bucket', 'Studi per fascia di importo', 'Quanti studi pagati in ogni fascia, per valuta originale', { split: true, tableLabel: 'Tabella: per valuta' })}
        ${vizCard('wd', 'Guadagni per giorno della settimana', 'In base all\'ora di inizio dello studio', { split: true, tableLabel: 'Tabella: per giorno della settimana' })}
        ${vizCard('hour', 'Guadagni per fascia oraria', 'Ora di inizio dello studio (ora locale)', { split: true, tableLabel: 'Tabella: per ora' })}
      </div>`;

    // Andamento cumulato (solo il periodo scelto): asse dal primo all'ultimo giorno del periodo, mai oltre oggi;
    // un periodo senza sottomissioni mostra una linea piatta a zero
    const crDated = cr.filter(r => r.dateKey);
    const keys = crDated.map(r => r.dateKey).sort();
    const start = R.from || keys[0], end0 = R.to || keys[keys.length - 1];
    const end = end0 && end0 > today && (!keys.length || keys[keys.length - 1] <= today) ? today : end0;
    if (start && end && start <= end) {
      const dayKeys = [];
      for (let d = fromKey(start), e = fromKey(end); d <= e; d = addDays(d, 1)) dayKeys.push(dkey(d));
      const daily = new Map(dayKeys.map(k => [k, 0]));
      crDated.forEach(r => { if (r.isEarned && daily.has(r.dateKey)) daily.set(r.dateKey, daily.get(r.dateKey) + r.earned); });
      let c = 0;
      const cum = dayKeys.map(k => round2(c += daily.get(k)));
      const s1 = tok('--series-1');
      const longRange = dayKeys.length > 366;
      makeChart('c-cum', {
        type: 'line',
        data: {
          labels: dayKeys.map(k => (longRange ? dfmtDate : dfmtDay).format(fromKey(k))),
          datasets: [{
            label: 'Guadagnato cumulato', data: cum, borderColor: s1, backgroundColor: s1 + '1a', fill: 'origin',
            borderWidth: 2, cubicInterpolationMode: 'monotone', borderJoinStyle: 'round', borderCapStyle: 'round',
            pointRadius: cum.map((_, i) => (i === cum.length - 1 ? 4 : 0)), pointBackgroundColor: s1, pointBorderColor: tok('--card'), pointBorderWidth: 2,
            pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHitRadius: 14,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
          interaction: { mode: 'index', intersect: false }, layout: { padding: { top: 26, right: 8 } },
          scales: { x: catScale({ ticks: { maxTicksLimit: 10 } }), y: valueScale(eurAxis) },
          plugins: {
            legend: legendOpts(false),
            crosshair: { enabled: true }, endLabel: { enabled: true },
            tooltip: tooltipOpts({
              title: it => cap(dfmtFull.format(fromKey(dayKeys[it[0].dataIndex]))),
              label: ctx => ` Totale: ${eur(ctx.parsed.y)}`,
              afterLabel: ctx => ` Quel giorno: ${eur(daily.get(dayKeys[ctx.dataIndex]))}`,
            }),
          },
        },
      }, v => eur(v));
    } else {
      const cv = document.getElementById('c-cum');
      if (cv) cv.parentElement.innerHTML = '<p class="empty-note">Nessun giorno da mostrare in questo periodo.</p>';
    }
    // tabella con un'unica riga: il periodo scelto (clic = Storico su quel periodo)
    mount('t-cum', bracketTable([{
      key: R.key, label: R.key === 'all' ? 'Tutto il periodo' : R.key === 'custom' ? 'Periodo personalizzato' : R.label, sub: rangeText, rows: cr,
    }], { kind: 'time', title: 'Periodo', noFoot: true, pickHint: () => 'Vedi nello storico le sottomissioni del periodo', onPick: () => openHistory(periodPatch) }));

    // gli altri grafici della sezione non dipendono dal periodo: sempre tutti i dati
    const dated = rows.filter(r => r.dateKey);

    // Stato
    const statuses = groupRows(rows, r => r.status)
      .sort((x, y) => (STATUS_ORDER.indexOf(x.key) + 99 * (STATUS_ORDER.indexOf(x.key) < 0)) - (STATUS_ORDER.indexOf(y.key) + 99 * (STATUS_ORDER.indexOf(y.key) < 0)))
      .map(g => ({ ...g, label: g.key }));
    const stAgg = statuses.map(g => agg(g.rows));
    makeChart('c-status', {
      type: 'bar',
      data: { labels: statuses.map(g => g.key), datasets: [barDs('Sottomissioni', statuses.map(g => g.rows.length), tok('--series-1'))] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        interaction: { mode: 'index', axis: 'y', intersect: false }, layout: { padding: { right: 36 } },
        scales: { x: valueScale(v => nf0.format(v), { integer: true }), y: catScale() },
        plugins: {
          legend: legendOpts(false), tipLabels: { enabled: true },
          tooltip: tooltipOpts({
            label: ctx => ` Sottomissioni: ${ctx.parsed.x}`,
            afterLabel: ctx => { const s = stAgg[ctx.dataIndex]; return s.saldo ? ` Guadagnato: ${eur(s.saldo)}` : s.pending ? ` In attesa: ${eur(s.pending)}` : ''; },
          }),
        },
      },
    }, v => nf0.format(v));
    mount('t-status', bracketTable(statuses, { kind: 'status', title: 'Stato', unit: 'stati', unitOne: 'stato', onPick: g => openHistory({ statuses: new Set([g.key]) }) }));

    // Fasce di importo per valuta
    const labels = bucketLabels();
    const curs = ['GBP', 'USD', 'EUR'].filter(c => rows.some(r => r.cur === c));
    const sc = [tok('--series-1'), tok('--series-2'), tok('--series-3')];
    const counted = rows.filter(inBasis);
    makeChart('c-bucket', {
      type: 'bar',
      data: {
        labels,
        datasets: curs.map((c, i) => barDs(CUR_NAME[c], labels.map((_, j) => counted.filter(r => r.cur === c && bucketOf(r.earned) === j).length), sc[i], curs.length > 1 ? stackGap() : {})),
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        interaction: { mode: 'index', intersect: false }, layout: { padding: { top: 18 } },
        scales: { x: catScale({ stacked: true }), y: valueScale(v => nf0.format(v), { stacked: true, integer: true }) },
        plugins: {
          legend: legendOpts(curs.length > 1), tipLabels: { enabled: true },
          tooltip: tooltipOpts({ title: it => `${it[0].label} (${bucketRanges()[it[0].dataIndex]})`, label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} studi` }),
        },
      },
    }, v => nf0.format(v));
    mount('t-bucket', bracketTable(groupRows(rows, r => r.cur).map(g => ({ ...g, label: CUR_NAME[g.key] || g.key, sub: pl(g.rows.length, 'sottomissione', 'sottomissioni') })),
      { kind: 'currency', title: 'Valuta originale', unit: 'valute', unitOne: 'valuta', onPick: g => openHistory({ currencies: new Set([g.key]) }) }));

    // Giorno della settimana
    const wdGroups = WD.map((name, i) => ({ key: i, label: name, rows: dated.filter(r => (r.when.getDay() + 6) % 7 === i) }));
    const wdEarn = wdGroups.map(g => round2(sum(g.rows, r => r.earned)));
    makeChart('c-wd', {
      type: 'bar',
      data: { labels: WD_SHORT, datasets: [barDs('Guadagnato', wdEarn, tok('--series-1'))] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        interaction: { mode: 'index', intersect: false }, layout: { padding: { top: 18 } },
        scales: { x: catScale(), y: valueScale(eurAxis) },
        plugins: {
          legend: legendOpts(false), tipLabels: { enabled: true },
          tooltip: tooltipOpts({ title: it => WD[it[0].dataIndex], label: ctx => ` Guadagnato: ${eur(ctx.parsed.y)}`, afterLabel: ctx => ` Sottomissioni: ${wdGroups[ctx.dataIndex].rows.length}` }),
        },
      },
    }, v => eur(v));
    mount('t-wd', bracketTable(wdGroups.filter(g => g.rows.length).map(g => ({ ...g, sub: pl(g.rows.length, 'sottomissione', 'sottomissioni') })), { kind: 'time', title: 'Giorno', unit: 'giorni', unitOne: 'giorno' }));

    // Fascia oraria
    const hours = Array.from({ length: 24 }, (_, h) => ({ key: h, label: `${pad(h)}:00–${pad(h)}:59`, rows: dated.filter(r => r.when.getHours() === h) }));
    makeChart('c-hour', {
      type: 'bar',
      data: { labels: hours.map(h => pad(h.key)), datasets: [barDs('Guadagnato', hours.map(h => round2(sum(h.rows, r => r.earned))), tok('--series-1'))] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        interaction: { mode: 'index', intersect: false }, layout: { padding: { top: 18 } },
        scales: { x: catScale({ ticks: { autoSkip: false, callback(v, i) { return i % 2 ? '' : this.getLabelForValue(v); } } }), y: valueScale(eurAxis) },
        plugins: {
          legend: legendOpts(false),
          tooltip: tooltipOpts({ title: it => hours[it[0].dataIndex].label, label: ctx => ` Guadagnato: ${eur(ctx.parsed.y)}`, afterLabel: ctx => ` Sottomissioni: ${hours[ctx.dataIndex].rows.length}` }),
        },
      },
    });
    mount('t-hour', bracketTable(hours.filter(h => h.rows.length).map(h => ({ ...h, sub: pl(h.rows.length, 'sottomissione', 'sottomissioni') })), { kind: 'hour', title: 'Ora di inizio', limit: 10, unit: 'fasce orarie', unitOne: 'fascia oraria' }));
  }

  // ---------------------------------------------------------- MENSILE
  function monthRange(k) {
    const [y, m] = k.split('-').map(Number);
    return { from: `${k}-01`, to: `${k}-${pad(new Date(y, m, 0).getDate())}`, days: new Date(y, m, 0).getDate() };
  }
  // mesi delle schede da mostrare con la vista v ('all', 'y2025', 'n6'); keys = mesi con dati, in ordine
  function monthViewKeys(keys, v) {
    if (!keys.length || v === 'all') return new Set(keys);
    if (v[0] === 'y') return new Set(keys.filter(k => k.startsWith(v.slice(1) + '-')));
    if (v[0] === 'n') { const last = monthIndex(keys[keys.length - 1]), n = +v.slice(1); return new Set(keys.filter(k => last - monthIndex(k) < n)); }
    return new Set(keys);
  }
  // pulsanti di selezione rapida delle schede: solo quelli che cambiano davvero qualcosa
  function monthViewOptions(keys) {
    const span = keys.length ? monthIndex(keys[keys.length - 1]) - monthIndex(keys[0]) + 1 : 0;
    const years = [...new Set(keys.map(k => k.slice(0, 4)))].sort().reverse();
    const thisYear = String(new Date().getFullYear());
    const quick = [['all', 'Tutti']];
    if (years.length > 1 && years.includes(thisYear)) quick.push(['y' + thisYear, 'Quest\'anno']);
    const last = [2, 3, 6, 12].filter(n => n < span).map(n => ['n' + n, `${n} mesi`, `Ultimi ${n} mesi`]);
    const yrs = years.length > 1 ? years.filter(y => y !== thisYear).map(y => ['y' + y, y]) : [];
    return { quick, last, yrs, years };
  }
  // mostra/nasconde le schede secondo MVIEW senza ridisegnare la pagina (i grafici restano dove sono)
  function applyMonthView() {
    const p = $('.panel[data-panel="monthly"]');
    const cards = $$('.month[data-mk]', p);
    if (!cards.length) return;
    const keys = cards.map(c => c.dataset.mk).sort();
    const offered = $$('[data-mview]', p).map(b => b.dataset.mview);
    if (!offered.includes(MVIEW)) MVIEW = 'all';
    const show = monthViewKeys(keys, MVIEW);
    cards.forEach(c => { c.hidden = !show.has(c.dataset.mk); });
    $$('[data-yhead]', p).forEach(h => { h.hidden = !keys.some(k => show.has(k) && k.startsWith(h.dataset.yhead + '-')); });
    $$('[data-mview]', p).forEach(b => { const on = b.dataset.mview === MVIEW; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const cnt = $('#mCount', p);
    if (cnt) cnt.textContent = show.size === keys.length ? `Tutti i ${keys.length} mesi` : `${show.size} di ${keys.length} mesi`;
    syncCollapseAll();
  }
  // "Vai a": nel menu dei mesi sono attivi solo quelli con dati nell'anno scelto
  function fillGotoMonths() {
    const ys = $('#mGoY'), ms = $('#mGoM');
    if (!ys || !ms) return;
    const have = new Set($$('.month[data-mk]').map(c => c.dataset.mk));
    const opts = [...ms.options];
    opts.forEach(o => { o.disabled = !have.has(`${ys.value}-${o.value}`); });
    if (ms.selectedIndex < 0 || opts[ms.selectedIndex].disabled) {
      const cur = Math.max(0, ms.selectedIndex);
      const best = opts.filter(o => !o.disabled).sort((a, b) => Math.abs(a.index - cur) - Math.abs(b.index - cur))[0];
      if (best) ms.value = best.value;
    }
  }
  function syncGoto(k) {
    const ys = $('#mGoY'), ms = $('#mGoM');
    if (!ys || !ms) return;
    ys.value = k.slice(0, 4); ms.value = k.slice(5, 7); fillGotoMonths();
  }
  function goToMonth(k, instant) {
    const card = document.getElementById('m-' + k);
    if (!card) return;
    if (card.hidden) { MVIEW = 'y' + k.slice(0, 4); applyMonthView(); }
    if (card.classList.contains('collapsed')) { setCollapsed(card, false); syncCollapseAll(); }
    syncGoto(k);
    scrollToEl(card, true, instant);
    flash(card);
  }
  // dal riepilogo annuale alla tabella dei mesi di quell'anno (aperta se era chiusa)
  function goToYearTable(y) {
    const d = $(`details[data-keep="m-${y}"]`);
    if (!d) return;
    d.open = true; KEEP_OPEN.set('m-' + y, true);
    scrollToEl(d, false);
    flash(d);
  }
  // scheda ridotta: restano solo il mese e il guadagnato
  function setCollapsed(card, on) {
    card.classList.toggle('collapsed', on);
    const b = card.querySelector('[data-mtoggle]');
    if (b) {
      const l = on ? 'Espandi la scheda' : 'Riduci la scheda';
      b.setAttribute('aria-expanded', String(!on)); b.title = l; b.setAttribute('aria-label', `${l} di ${monthLabel(card.dataset.mk)}`);
    }
    if (on) MCOLLAPSED.add(card.dataset.mk); else MCOLLAPSED.delete(card.dataset.mk);
  }
  // il pulsante della barra agisce sulle schede mostrate: "Riduci tutte" se almeno una è aperta
  function syncCollapseAll() {
    const b = $('[data-mcollapse]');
    if (!b) return;
    const anyOpen = $$('.month[data-mk]').some(c => !c.hidden && !c.classList.contains('collapsed'));
    b.dataset.mcollapse = anyOpen ? 'all' : 'none';
    b.textContent = anyOpen ? 'Riduci tutte' : 'Espandi tutte';
  }

  function renderMonthly(p, rows) {
    const dated = rows.filter(r => r.monthKey);
    const mkeys = [...new Set(dated.map(r => r.monthKey))].sort();
    const byMonth = new Map(mkeys.map(k => [k, []]));
    dated.forEach(r => byMonth.get(r.monthKey).push(r));
    const groups = mkeys.map(k => ({ key: k, label: monthShort(k), sub: monthLabel(k), rows: byMonth.get(k) }));
    const nowKey = mkey(new Date());
    const today = new Date();
    // asse del grafico continuo: anche i mesi senza sottomissioni hanno la loro colonna
    const chartKeys = [];
    if (mkeys.length) for (let i = monthIndex(mkeys[0]), e = monthIndex(mkeys[mkeys.length - 1]); i <= e; i++) chartKeys.push(monthFromIndex(i));
    const many = chartKeys.length > 12; // più di un anno: grafico a tutta larghezza e tabelle per anno
    const view = monthViewOptions(mkeys);
    const years = view.years;
    const yearGroups = years.map(y => {
      const ms = groups.filter(g => g.key.startsWith(y + '-'));
      const mn = g => MONTHS_SHORT[+g.key.slice(5) - 1].toLowerCase();
      const span = ms.length === 1 ? ` · ${mn(ms[0])}` : ms.length < 12 ? ` · ${mn(ms[0])}–${mn(ms[ms.length - 1])}` : '';
      return { key: y, label: y, sub: pl(ms.length, 'mese', 'mesi') + span, months: ms, rows: ms.flatMap(g => g.rows) };
    });
    const yearSaldo = yg => sum(yg.rows, r => r.earned);

    const cards = mkeys.slice().reverse().map(k => {
      const rs = byMonth.get(k);
      const a = agg(rs);
      const prevKey = mkeys[mkeys.indexOf(k) - 1];
      const { days } = monthRange(k);
      const current = k === nowKey;
      const elapsed = current ? today.getDate() : days;
      // mese in corso: confronto con gli stessi giorni del mese precedente
      const prevRows = prevKey ? byMonth.get(prevKey) : null;
      const prev = prevRows ? agg(current ? prevRows.filter(r => r.when.getDate() <= elapsed) : prevRows) : null;
      const activeDays = new Set(rs.map(r => r.dateKey)).size;
      const bestStudy = groupRows(rs.filter(r => r.isEarned), r => r.study).map(g => ({ k: g.key, v: sum(g.rows, r => r.earned) })).sort((x, y) => y.v - x.v)[0];
      const bestRes = groupRows(rs.filter(r => r.isEarned), r => r.researcher).map(g => ({ k: g.key, v: sum(g.rows, r => r.earned) })).sort((x, y) => y.v - x.v)[0];
      let delta = '';
      if (prev && prev.saldo > 0) {
        const d = (a.saldo - prev.saldo) / prev.saldo;
        const up = d >= 0;
        delta = `<div class="delta ${up ? 'up' : 'down'}"><span aria-hidden="true">${up ? '▲' : '▼'}</span>${up ? '+' : '−'}${pct(Math.abs(d))} rispetto ${current ? `ai primi ${elapsed} giorni di ${esc(MONTHS[+prevKey.slice(5) - 1])} (${eur(prev.saldo)})` : `a ${esc(MONTHS[+prevKey.slice(5) - 1])} (${eur(prev.saldo)})`}</div>`;
      }
      const li = (l, v, t) => `<li><span>${l}</span><span${t ? ` title="${esc(t)}"` : ''}>${v}</span></li>`;
      const head = years.length > 1 && (k === mkeys[mkeys.length - 1] || k.slice(0, 4) !== mkeys[mkeys.indexOf(k) + 1].slice(0, 4))
        ? (yg => `<div class="year-head" data-yhead="${yg.key}"><h3>${yg.key}</h3><span>${eur(yearSaldo(yg))} guadagnati · ${esc(yg.sub)}</span></div>`)(yearGroups.find(g => g.key === k.slice(0, 4)))
        : '';
      const col = MCOLLAPSED.has(k);
      const tl = col ? 'Espandi la scheda' : 'Riduci la scheda';
      return `${head}<article class="card month${col ? ' collapsed' : ''}" id="m-${k}" data-mk="${k}">
        <div class="month-head">
          <h3><span class="mini-ico">${ICON.cal}</span>${esc(monthLabel(k))}${current ? '<span class="tag">in corso</span>' : ''}</h3>
          <div class="month-actions">
            <span class="m-mini">${eur(a.saldo)}</span>
            <button class="btn sm" type="button" data-month="${k}" title="Apri lo storico con le sottomissioni di ${esc(monthLabel(k))}">Vedi nello storico</button>
            <button class="icon-btn m-toggle" type="button" data-mtoggle aria-controls="mc-${k}" aria-expanded="${!col}" title="${tl}" aria-label="${tl} di ${esc(monthLabel(k))}">${ICON.chev}</button>
          </div>
        </div>
        <div class="month-content" id="mc-${k}">
        <div class="month-body">
          <div>
            <div class="m-hero">${eur(a.saldo)}</div>
            <div class="m-hero-sub">guadagnati${a.pending ? ` · ${eur(a.pending)} in attesa` : ''}</div>
            ${delta}
            <ul class="m-list">
              ${li('Sottomissioni', a.n)}
              ${li('Approvate · screened out', `${a.nApproved} · ${a.nScreened}`)}
              ${li('In attesa · non pagate', `${a.nPending} · ${a.nLost}`)}
              ${li('Paga oraria effettiva', a.perHour == null ? '—' : eur(a.perHour) + '/h')}
              ${li('Media per studio pagato', a.nEarned ? eur(a.saldo / a.nEarned) : '—')}
              ${li('Media al giorno', eur(a.saldo / elapsed), current ? `su ${elapsed} giorni trascorsi` : `su ${days} giorni`)}
              ${li('Media giorni effettivi', activeDays ? eur(a.saldo / activeDays) : '—', `Guadagnato diviso i ${activeDays} giorni con almeno una sottomissione`)}
              ${current ? li('Proiezione a fine mese', eur(a.saldo / elapsed * days), 'Stima al ritmo attuale') : ''}
              ${li('Giorni attivi', `${activeDays} su ${elapsed}`)}
              ${li('Studio migliore', bestStudy ? `${esc(bestStudy.k)} (${eur(bestStudy.v)})` : '—', bestStudy ? bestStudy.k : '')}
              ${li('Ricercatore top', bestRes ? `${esc(bestRes.k)} (${eur(bestRes.v)})` : '—', bestRes ? bestRes.k : '')}
            </ul>
          </div>
          <div class="viz-inner viz" style="padding:0">
            <div class="viz-head"><div><h3>Guadagni giorno per giorno</h3><p>${esc(monthLabel(k))}</p></div></div>
            <div class="chart-box"><canvas id="c-m-${k}" role="img" aria-label="Guadagni giornalieri di ${esc(monthLabel(k))}"></canvas></div>
          </div>
        </div>
        <div class="viz" style="padding:0">
          <details open><summary>Tabella: dati e guadagni per settimana</summary><div id="t-m-${k}"></div></details>
        </div>
        </div>
      </article>`;
    }).join('');

    const tables = many
      ? [{ id: 'years', label: 'Tabella: dati e guadagni per anno', open: true, keep: 'm-years' }].concat(yearGroups.map(yg => ({
        id: 'months-' + yg.key, keep: 'm-' + yg.key, open: yg.key === years[0],
        label: `Tabella: mesi del ${yg.key} <span class="sum-meta">${esc(yg.sub)} · ${eur(yearSaldo(yg))}</span>`,
      })))
      : null;
    const chip = ([v, l, t]) => `<button type="button" data-mview="${v}"${t ? ` title="${esc(t)}" aria-label="${esc(t)}"` : ''}>${esc(l)}</button>`;
    const sep = '<span class="mtool-sep" aria-hidden="true"></span>';
    const showTool = mkeys.length > 3;
    const lastKey = mkeys[mkeys.length - 1] || '';
    const toolbar = showTool ? `<div class="mtool card" role="region" aria-label="Selezione delle schede mensili">
        <div class="mtool-views">
          <span class="mtool-label">Mostra</span>
          <div class="mtool-chips" role="group" aria-label="Mesi da mostrare">${view.quick.map(chip).join('')}${view.last.length ? `${sep}<span class="mtool-sub" aria-hidden="true">Ultimi</span>${view.last.map(chip).join('')}` : ''}${view.yrs.length ? sep + view.yrs.map(chip).join('') : ''}</div>
          <span class="mtool-count" id="mCount" aria-live="polite"></span>
        </div>
        <div class="mtool-goto">
          <button type="button" class="btn sm" data-mcollapse="all">Riduci tutte</button>
          ${sep}
          <label class="mtool-label" for="mGoM">Vai a</label>
          <select id="mGoM" aria-label="Mese">${MONTHS.map((n, i) => `<option value="${pad(i + 1)}"${pad(i + 1) === lastKey.slice(5) ? ' selected' : ''}>${cap(n)}</option>`).join('')}</select>
          <select id="mGoY" aria-label="Anno">${years.map(y => `<option${y === lastKey.slice(0, 4) ? ' selected' : ''}>${y}</option>`).join('')}</select>
          <button type="button" class="btn sm primary" data-mgo>Vai</button>
        </div>
      </div>` : '';

    p.innerHTML = `
      <h2 class="section-title">Confronto mensile <span class="sub">${esc(periodText(rows))}</span></h2>
      <div class="stack">
        ${vizCard('months', 'Mese per mese', (MSEG === 'money' ? 'Guadagnato (approvati + compenso screen-out) e in attesa' : 'Numero di studi pagati per fascia di importo') + ' · clic su un mese per aprirne la scheda', {
          split: !many, span: many, size: many ? 'tall' : '', tables,
          seg: { name: 'mseg', value: MSEG, options: [['money', 'Guadagni'], ['buckets', 'Numero studi']] }, tableLabel: 'Tabella: dati e guadagni per mese',
        })}
      </div>
      <div class="mcards">
        <h2 class="section-title">Schede mensili</h2>
        ${toolbar}
        <div class="stack">${cards}</div>
      </div>`;

    // grafico mese per mese (asse continuo: i mesi senza dati valgono zero)
    const cg = chartKeys.map(k => ({ key: k, rows: byMonth.get(k) || [] }));
    const labels = cg.map(g => (many ? MONTHS_SHORT[+g.key.slice(5) - 1] : monthShort(g.key)));
    const pickAt = els => (els.length && byMonth.has(chartKeys[els[0].index]) ? chartKeys[els[0].index] : null);
    const common = {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false }, layout: { padding: { top: 18, bottom: many ? 20 : 0 } },
      onClick: (e, els) => { const k = pickAt(els); if (k) goToMonth(k); },
      onHover: (e, els, chart) => { chart.canvas.style.cursor = pickAt(els) ? 'pointer' : ''; },
    };
    const xScale = catScale({ stacked: true, ticks: many ? { autoSkipPadding: 6 } : {} });
    const ttTitle = it => monthLabel(chartKeys[it[0].dataIndex]);
    const ttHint = it => (byMonth.has(chartKeys[it[0].dataIndex]) ? 'Clic per aprire la scheda del mese' : 'Nessuna sottomissione');
    if (MSEG === 'money') {
      const appr = cg.map(g => round2(sum(g.rows.filter(r => r.status === 'APPROVED'), r => r.earned)));
      const scr = cg.map(g => round2(sum(g.rows.filter(r => r.status === 'SCREENED OUT'), r => r.earned)));
      const pend = cg.map(g => round2(sum(g.rows, r => r.pending)));
      const earned = cg.map(g => round2(sum(g.rows.filter(r => r.isEarned), r => r.earned)));
      const gap = stackGap();
      makeChart('c-months', {
        type: 'bar',
        data: {
          labels,
          datasets: [
            barDs('Approvati (premio + bonus)', appr, tok('--series-1'), gap),
            barDs('Compenso screen-out', scr, tok('--series-2'), gap),
            barDs('In attesa', pend, tok('--series-3'), gap),
          ],
        },
        options: {
          ...common,
          scales: { x: xScale, y: valueScale(eurAxis, { stacked: true }) },
          plugins: {
            legend: legendOpts(true), tipLabels: { enabled: true }, yearAxis: { keys: many ? chartKeys : null },
            tooltip: tooltipOpts({ title: ttTitle, label: ctx => ` ${ctx.dataset.label}: ${eur(ctx.parsed.y)}`, footer: it => [`Guadagnato: ${eur(earned[it[0].dataIndex])}`, ttHint(it)] }),
          },
        },
      }, (t, i, compact) => (compact ? eurShort(earned[i]) : eur(earned[i])));
    } else {
      const bl = bucketLabels(), colors = rampColors(bl.length), gap = stackGap();
      makeChart('c-months', {
        type: 'bar',
        data: {
          labels,
          datasets: bl.map((l, j) => barDs(l, cg.map(g => g.rows.filter(r => inBasis(r) && bucketOf(r.earned) === j).length), colors[j], gap)),
        },
        options: {
          ...common,
          scales: { x: xScale, y: valueScale(v => nf0.format(v), { stacked: true, integer: true }) },
          plugins: {
            legend: legendOpts(true), tipLabels: { enabled: true }, yearAxis: { keys: many ? chartKeys : null },
            tooltip: tooltipOpts({ title: ttTitle, label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} studi`, footer: it => ttHint(it) }),
          },
        },
      }, (v, i, compact) => (compact ? nf0.format(v) : `${nf0.format(v)} studi`));
    }
    // tabelle: con più di un anno una per anno (più il riepilogo annuale), altrimenti una sola
    const monthOpts = { kind: 'time', title: 'Mese', sort: 'order', unit: 'mesi', unitOne: 'mese', pickHint: g => `Vai alla scheda di ${monthLabel(g.key)}`, onPick: g => goToMonth(g.key) };
    if (many) {
      mount('t-years', bracketTable(yearGroups, { kind: 'time', title: 'Anno', sort: 'order', unit: 'anni', unitOne: 'anno', pickHint: g => `Vai alla tabella dei mesi del ${g.key}`, onPick: g => goToYearTable(g.key) }));
      yearGroups.forEach(yg => mount('t-months-' + yg.key, bracketTable(yg.months, monthOpts)));
    } else {
      mount('t-months', bracketTable(groups, monthOpts));
    }
    applyMonthView();
    fillGotoMonths();

    // schede mensili: grafico giornaliero (creato quando la scheda si avvicina allo schermo) + tabella per settimana
    const drawMonth = k => {
      const rs = byMonth.get(k);
      const { days } = monthRange(k);
      const [y, m] = k.split('-').map(Number);
      const perDay = Array.from({ length: days }, (_, i) => rs.filter(r => r.when.getDate() === i + 1));
      makeChart(`c-m-${k}`, {
        type: 'bar',
        data: { labels: perDay.map((_, i) => String(i + 1)), datasets: [barDs('Guadagnato', perDay.map(d => round2(sum(d, r => r.earned))), tok('--series-1'), { categoryPercentage: 0.85, barPercentage: 0.9 })] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
          interaction: { mode: 'index', intersect: false }, layout: { padding: { top: 10 } },
          scales: { x: catScale({ ticks: { maxTicksLimit: 16 } }), y: valueScale(eurAxis) },
          // clic su un giorno con sottomissioni: Storico filtrato su quel giorno.
          // Rimandato: il nuovo rendering distrugge questo grafico, e Chart.js sta ancora gestendo il clic
          onClick: (e, els) => {
            const i = els.length ? els[0].index : -1;
            if (i >= 0 && perDay[i].length) { const d = `${k}-${pad(i + 1)}`; setTimeout(() => openHistory({ from: d, to: d }), 0); }
          },
          onHover: (e, els, chart) => { chart.canvas.style.cursor = els.length && perDay[els[0].index].length ? 'pointer' : ''; },
          plugins: {
            legend: legendOpts(false),
            tooltip: tooltipOpts({
              title: it => cap(dfmtFull.format(new Date(y, m - 1, it[0].dataIndex + 1))),
              label: ctx => ` Guadagnato: ${eur(ctx.parsed.y)}`,
              afterLabel: ctx => { const d = perDay[ctx.dataIndex]; const pend = sum(d, r => r.pending); return [` Sottomissioni: ${d.length}`].concat(pend ? [` In attesa: ${eur(pend)}`] : []); },
              footer: it => (perDay[it[0].dataIndex].length ? 'Clic per vederle nello storico' : ''),
            }),
          },
        },
      });
    };
    mkeys.forEach(k => {
      const mr = monthRange(k);
      // la settimana viene limitata al mese: lo Storico mostra solo gli studi di questo mese in quella settimana
      const wk = groupRows(byMonth.get(k), r => dkey(mondayOf(r.when))).sort((a, b) => (a.key < b.key ? -1 : 1))
        .map(g => {
          const from = g.key > mr.from ? g.key : mr.from, to0 = dkey(addDays(fromKey(g.key), 6)), to = to0 < mr.to ? to0 : mr.to;
          return { ...g, label: weekLabel(fromKey(g.key)), sub: `Settimana ${isoWeek(fromKey(g.key))}`, from, to };
        });
      mount(`t-m-${k}`, bracketTable(wk, {
        kind: 'time', title: 'Settimana', sort: 'order', unit: 'settimane', unitOne: 'settimana',
        pickHint: g => `Vedi nello storico: ${g.from === g.to ? fmtKey(g.from) : `${dfmtDay.format(fromKey(g.from))} – ${dfmtDate.format(fromKey(g.to))}`}`,
        onPick: g => openHistory({ from: g.from, to: g.to }),
      }));
    });
    // i grafici giornalieri vengono creati solo quando il loro riquadro si avvicina allo schermo
    // (i riquadri delle schede ridotte o nascoste non si intersecano: il grafico nasce quando si riaprono)
    if (window.IntersectionObserver) {
      const obs = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        obs.unobserve(en.target);
        drawMonth(en.target.closest('.month').dataset.mk);
      }), { rootMargin: '400px 0px' });
      LAZY = obs;
      $$('.month[data-mk] .chart-box', p).forEach(el => obs.observe(el));
    } else mkeys.forEach(drawMonth);
  }

  // ---------------------------------------------------------- STUDI e RICERCATORI
  // onPick(item): clic su una barra (rimandato: il nuovo rendering distrugge il grafico mentre Chart.js gestisce il clic)
  // pickHint(item): testo in fondo al tooltip che spiega dove porta il clic
  function topBars(id, items, metric, unitLabel, onPick, pickHint) {
    const f = metric === 'saldo' ? (it => it.a.saldo) : metric === 'n' ? (it => it.a.n) : (it => it.a.perHour);
    const list = items.filter(it => (metric === 'ph' ? it.a.perHour != null && it.a.nApproved > 0 : f(it) > 0))
      .sort((x, y) => f(y) - f(x)).slice(0, 10);
    const fmt = metric === 'n' ? (v => nf0.format(v)) : metric === 'ph' ? (v => eur(v) + '/h') : (v => eur(v));
    const metricName = metric === 'saldo' ? 'Guadagnato' : metric === 'n' ? 'Sottomissioni' : 'Paga oraria';
    if (!list.length) { const c = document.getElementById(id); if (c) c.parentElement.innerHTML = '<p class="empty-note">Nessun dato da mostrare.</p>'; return; }
    makeChart(id, {
      type: 'bar',
      data: { labels: list.map(it => it.label), datasets: [barDs(metricName, list.map(it => (metric === 'n' ? f(it) : round2(f(it)))), tok('--series-1'))] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        interaction: { mode: 'index', axis: 'y', intersect: false }, layout: { padding: { right: 78 } },
        ...(onPick ? {
          onClick: (e, els) => { if (els.length) { const it = list[els[0].index]; setTimeout(() => onPick(it), 0); } },
          onHover: (e, els, chart) => { chart.canvas.style.cursor = els.length ? 'pointer' : ''; },
        } : {}),
        scales: {
          x: valueScale(metric === 'n' ? (v => nf0.format(v)) : eurAxis, { integer: metric === 'n' }),
          y: catScale({ ticks: { autoSkip: false, callback(v) { return trunc(this.getLabelForValue(v), 30); } } }),
        },
        plugins: {
          legend: legendOpts(false), tipLabels: { enabled: true },
          tooltip: tooltipOpts({
            title: it => list[it[0].dataIndex].label,
            label: ctx => ` ${metricName}: ${fmt(ctx.parsed.x)}`,
            afterLabel: ctx => {
              const a = list[ctx.dataIndex].a;
              return [` Guadagnato: ${eur(a.saldo)}`, ` Sottomissioni: ${a.n} (${a.nApproved} approvate, ${a.nScreened} screened out)`].concat(a.perHour != null ? [` Paga oraria: ${eur(a.perHour)}/h`] : []);
            },
            ...(onPick ? { footer: t => (pickHint ? pickHint(list[t[0].dataIndex]) : 'Clic per vederlo nello storico') } : {}),
          }),
        },
      },
    }, v => fmt(v));
    return unitLabel;
  }

  // ---- infografiche dei TOP_CARDS studi e ricercatori più redditizi; usano lo stile delle schede mensili
  const TOP_CARDS = 30;
  // cosa cambia tra le due infografiche: id, parole e filtro (esatto) con cui aprire lo Storico
  const INFO = {
    study: {
      pre: 'st', what: 'studio', of: 'dello studio', this: 'a questo studio', one: 'partecipazione', many: 'partecipazioni', Many: 'Partecipazioni',
      history: key => ({ study: key }),
    },
    researcher: {
      pre: 'rs', what: 'ricercatore', of: 'del ricercatore', this: 'di questo ricercatore', one: 'sottomissione', many: 'sottomissioni', Many: 'Sottomissioni',
      history: key => ({ researcher: key, researcherExact: true }),
    },
  };
  // i più redditizi (guadagnato > 0) e la loro posizione in classifica
  function topRanked(items) {
    const top = items.filter(it => it.a.saldo > 0).sort((x, y) => (y.a.saldo - x.a.saldo) || (y.a.n - x.a.n)).slice(0, TOP_CARDS);
    return { top, rankOf: new Map(top.map((it, i) => [it.key, i + 1])) };
  }
  // la singola sottomissione pagata di più (premio + bonus, o compenso screen-out)
  const bestPaid = rows => rows.filter(r => r.isEarned).reduce((b, r) => (!b || r.earned > b.earned ? r : b), null);
  function infoCard(kind, it, rank, total) {
    const K = INFO[kind], rs = it.rows, a = it.a;
    const days = rs.map(r => r.dateKey).filter(Boolean).sort();
    const top = (keyFn, list) => groupRows(list, keyFn).map(g => ({ k: g.key, v: sum(g.rows, r => r.earned) })).sort((x, y) => y.v - x.v);
    const months = top(r => r.monthKey, rs.filter(r => r.monthKey));
    const timed = rs.filter(r => r.minutes != null);
    const li = (l, v, t) => `<li><span>${l}</span><span${t ? ` title="${esc(t)}"` : ''}>${v}</span></li>`;
    const span = days.length ? (days[0].slice(0, 7) === days[days.length - 1].slice(0, 7) ? monthLabel(days[0].slice(0, 7)) : `da ${monthLabel(days[0].slice(0, 7))} a ${monthLabel(days[days.length - 1].slice(0, 7))}`) : 'Nessuna data nel CSV';
    let ico, by, extraTop = '', extraEnd = '';
    if (kind === 'study') {
      const res = [...new Set(rs.map(r => r.researcher))];
      ico = `<span class="mini-ico">${ICON.doc}</span>`;
      by = `<p class="info-by" title="${esc(res.join(', '))}">${res.length === 1 ? `Di ${esc(res[0])}` : `${res.length} ricercatori: ${esc(trunc(res.join(', '), 90))}`}</p>`;
    } else {
      const st = top(r => r.study, rs.filter(r => r.isEarned));
      const nStudies = new Set(rs.map(r => r.study)).size;
      ico = avatarHtml(it.label);
      by = `<p class="info-by">${pl(nStudies, 'studio diverso', 'studi diversi')}</p>`;
      extraTop = li('Tasso di screen-out', a.n ? pct(a.nScreened / a.n) : '—', `${a.nScreened} screened out su ${a.n} sottomissioni`);
      extraEnd = li('Studio migliore', st.length ? `${esc(st[0].k)} (${eur(st[0].v)})` : '—', st.length ? st[0].k : '');
    }
    return `<article class="card month infocard" id="${K.pre}-${rank}" data-kind="${kind}" data-rank="${rank}">
      <div class="month-head">
        <h3>${ico}<span class="info-title">${esc(it.label)}</span><span class="tag rank" title="${rank}° ${K.what} per guadagno su ${total}">#${rank}</span></h3>
        <div class="month-actions"><button class="btn sm" type="button" data-info-hist="${kind}" data-key="${esc(it.key)}" title="Apri lo storico con le ${K.many} ${K.this}">Vedi nello storico</button></div>
      </div>
      ${by}
      <div class="month-body">
        <div>
          <div class="m-hero">${eur(a.saldo)}</div>
          <div class="m-hero-sub">guadagnati${a.pending ? ` · ${eur(a.pending)} in attesa` : ''}</div>
          <ul class="m-list">
            ${li(K.Many, a.n)}
            ${li('Approvate · screened out', `${a.nApproved} · ${a.nScreened}`)}
            ${li('In attesa · non pagate', `${a.nPending} · ${a.nLost}`)}
            ${extraTop}
            ${li('Paga oraria effettiva', a.perHour == null ? '—' : eur(a.perHour) + '/h')}
            ${li(`Media per ${K.one} pagata`, a.nEarned ? eur(a.saldo / a.nEarned) : '—')}
            ${li('Durata media', timed.length ? durText(sum(timed, r => r.minutes) / timed.length) : '—')}
            ${li(`Prima ${K.one}`, days.length ? esc(fmtKey(days[0])) : '—')}
            ${li(`Ultima ${K.one}`, days.length ? esc(fmtKey(days[days.length - 1])) : '—')}
            ${li('Mesi attivi', months.length)}
            ${li('Mese migliore', months.length && months[0].v > 0 ? `${esc(monthLabel(months[0].k))} (${eur(months[0].v)})` : '—')}
            ${extraEnd}
          </ul>
        </div>
        <div class="viz-inner viz" style="padding:0">
          <div class="viz-head"><div><h3>Guadagni mese per mese</h3><p>${esc(span)}</p></div></div>
          <div class="chart-box"><canvas id="c-${K.pre}-${rank}" role="img" aria-label="Guadagni mensili ${K.of} ${esc(it.label)}"></canvas></div>
        </div>
      </div>
    </article>`;
  }
  // grafico mensile di un'infografica: asse continuo dal primo all'ultimo mese, clic su un mese = Storico filtrato
  function drawInfoChart(kind, rank, it) {
    const K = INFO[kind];
    const rs = it.rows.filter(r => r.monthKey);
    const canvas = document.getElementById(`c-${K.pre}-${rank}`);
    if (!canvas) return;
    if (!rs.length) { canvas.parentElement.innerHTML = '<p class="empty-note">Nessuna data nel CSV.</p>'; return; }
    const mk = rs.map(r => r.monthKey).sort();
    const keys = [];
    for (let i = monthIndex(mk[0]), e = monthIndex(mk[mk.length - 1]); i <= e; i++) keys.push(monthFromIndex(i));
    const by = new Map(keys.map(k => [k, []]));
    rs.forEach(r => by.get(r.monthKey).push(r));
    const many = keys.length > 12;
    const part = f => keys.map(k => round2(sum(by.get(k).filter(f), r => r.earned)));
    const appr = part(r => r.status === 'APPROVED'), scr = part(r => r.status === 'SCREENED OUT');
    const pend = keys.map(k => round2(sum(by.get(k), r => r.pending)));
    const earned = keys.map((k, i) => round2(appr[i] + scr[i]));
    const gap = stackGap();
    const ds = [barDs('Approvati (premio + bonus)', appr, tok('--series-1'), gap)];
    if (scr.some(v => v)) ds.push(barDs('Compenso screen-out', scr, tok('--series-2'), gap));
    if (pend.some(v => v)) ds.push(barDs('In attesa', pend, tok('--series-3'), gap));
    const has = i => i >= 0 && by.get(keys[i]).length > 0;
    makeChart(`c-${K.pre}-${rank}`, {
      type: 'bar',
      data: { labels: keys.map(k => (many ? MONTHS_SHORT[+k.slice(5) - 1] : monthShort(k))), datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        interaction: { mode: 'index', intersect: false }, layout: { padding: { top: 18, bottom: many ? 20 : 0 } },
        onClick: (e, els) => {
          const i = els.length ? els[0].index : -1;
          if (!has(i)) return;
          const r = monthRange(keys[i]);
          setTimeout(() => openHistory({ ...K.history(it.key), from: r.from, to: r.to, datePreset: 'm' + keys[i] }), 0);
        },
        onHover: (e, els, chart) => { chart.canvas.style.cursor = els.length && has(els[0].index) ? 'pointer' : ''; },
        scales: { x: catScale({ stacked: true, ticks: many ? { autoSkipPadding: 6 } : {} }), y: valueScale(eurAxis, { stacked: true }) },
        plugins: {
          legend: legendOpts(ds.length > 1), tipLabels: { enabled: true }, yearAxis: { keys: many ? keys : null },
          tooltip: tooltipOpts({
            title: t => monthLabel(keys[t[0].dataIndex]),
            label: ctx => ` ${ctx.dataset.label}: ${eur(ctx.parsed.y)}`,
            footer: t => { const n = by.get(keys[t[0].dataIndex]).length; return n ? [`${K.Many}: ${n}`, 'Clic per vederle nello storico'] : `Nessuna ${K.one}`; },
          }),
        },
      },
    }, (t, i, compact) => (compact ? eurShort(earned[i]) : eur(earned[i])));
  }
  function goToInfo(kind, rank) {
    const el = document.getElementById(`${INFO[kind].pre}-${rank}`);
    if (!el) return;
    scrollToEl(el, false);
    flash(el);
  }
  // clic su uno studio/ricercatore (grafico o tabella): infografica se è tra i più redditizi, altrimenti Storico
  const pickInfo = (kind, rankOf) => it => (rankOf.has(it.key) ? goToInfo(kind, rankOf.get(it.key)) : openHistory(INFO[kind].history(it.key)));
  const chartHint = rankOf => it => (rankOf.has(it.key) ? `Clic per aprire l'infografica (#${rankOf.get(it.key)})` : 'Clic per vederlo nello storico');
  const tableHint = (kind, rankOf) => g => (rankOf.has(g.key) ? `Vai all'infografica ${INFO[kind].of} (#${rankOf.get(g.key)})` : `Vedi nello storico: ${g.label}`);
  // i grafici delle infografiche nascono quando il loro riquadro si avvicina allo schermo
  function lazyInfoCharts(kind, p, top) {
    const boxes = $$(`.infocard[data-kind="${kind}"] .chart-box`, p);
    const draw = el => { const rank = +el.closest('.infocard').dataset.rank; drawInfoChart(kind, rank, top[rank - 1]); };
    if (!window.IntersectionObserver) { boxes.forEach(draw); return; }
    const obs = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { obs.unobserve(en.target); draw(en.target); } }), { rootMargin: '400px 0px' });
    LAZY = obs;
    boxes.forEach(el => obs.observe(el));
  }
  const bestTile = (label, best, main) => `<div class="card tile"><div class="t-label">${label}</div><div class="t-value">${best ? eur(best.earned) : '—'}</div><div class="t-sub" title="${esc(best ? `${best.study} · ${best.researcher} · ${best.when ? dfmt.format(best.when) : 'senza data'} · ${durText(best.minutes)}` : '')}">${esc(best ? `${main(best)}${best.dateKey ? ' · ' + fmtKey(best.dateKey) : ''}` : '')}</div></div>`;

  function renderStudies(p, rows) {
    if (SSEG !== 'saldo' && SSEG !== 'n') SSEG = 'saldo';
    const groups = groupRows(rows, r => r.study).map(g => {
      const res = [...new Set(g.rows.map(r => r.researcher))];
      return { ...g, label: g.key, sub: res.length === 1 ? `Di ${res[0]}` : `${res.length} ricercatori` };
    });
    const items = groups.map(g => ({ ...g, a: agg(g.rows) }));
    const bySaldo = items.slice().sort((x, y) => y.a.saldo - x.a.saldo)[0];
    const byN = items.slice().sort((x, y) => y.a.n - x.a.n)[0];
    const { top, rankOf } = topRanked(items);
    groups.forEach(g => { if (rankOf.has(g.key)) g.sub += ` · infografica #${rankOf.get(g.key)}`; });
    const sub = { saldo: 'I 10 studi che ti hanno fatto guadagnare di più', n: 'I 10 studi a cui hai partecipato più volte' }[SSEG] + ` · clic su uno studio per aprirne l'infografica (se è tra i ${TOP_CARDS} più redditizi) o lo storico`;
    p.innerHTML = `
      <h2 class="section-title">Studi <span class="sub">${items.length} studi diversi · ${esc(periodText(rows))}</span></h2>
      <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
        <div class="card tile"><div class="t-label">Studi diversi</div><div class="t-value">${items.length}</div><div class="t-sub">${rows.length} sottomissioni</div></div>
        <div class="card tile"><div class="t-label">Più redditizio</div><div class="t-value">${bySaldo ? eur(bySaldo.a.saldo) : '—'}</div><div class="t-sub" title="${esc(bySaldo ? bySaldo.label : '')}">${esc(bySaldo ? bySaldo.label : '')}</div></div>
        <div class="card tile"><div class="t-label">Più frequente</div><div class="t-value">${byN ? byN.a.n + ' volte' : '—'}</div><div class="t-sub" title="${esc(byN ? byN.label : '')}">${esc(byN ? byN.label : '')}</div></div>
        ${bestTile('Più pagato in assoluto', bestPaid(rows), b => b.study)}
      </div>
      <div class="stack" style="margin-top:20px">
        ${vizCard('studies', 'Classifica degli studi', sub, { span: true, size: 'tall', seg: { name: 'sseg', value: SSEG, options: [['saldo', 'Guadagno'], ['n', 'Partecipazioni']] }, tableLabel: 'Tabella: dati e guadagni per studio' })}
      </div>
      ${top.length ? `<h2 class="section-title">${top.length === 1 ? 'Lo studio più redditizio' : `I ${top.length} studi più redditizi`} <span class="sub">dal più redditizio · clic su un mese del grafico per vederne le partecipazioni nello storico</span></h2>
      <div class="stack">${top.map((it, i) => infoCard('study', it, i + 1, items.length)).join('')}</div>` : ''}`;
    // grafico e tabella si comportano allo stesso modo: infografica per i più redditizi, Storico per gli altri
    const pick = pickInfo('study', rankOf);
    topBars('c-studies', items, SSEG, undefined, pick, chartHint(rankOf));
    mount('t-studies', bracketTable(groups, { kind: 'study', title: 'Studio', limit: 15, unit: 'studi', unitOne: 'studio', pickHint: tableHint('study', rankOf), onPick: pick }));
    lazyInfoCharts('study', p, top);
  }
  function renderResearchers(p, rows) {
    if (RSEG !== 'saldo' && RSEG !== 'n') RSEG = 'saldo';
    const groups = groupRows(rows, r => r.researcher).map(g => {
      const studies = new Set(g.rows.map(r => r.study)).size;
      return { ...g, label: g.key, sub: `${pl(g.rows.length, 'sottomissione', 'sottomissioni')} · ${pl(studies, 'studio', 'studi')}` };
    });
    const items = groups.map(g => ({ ...g, a: agg(g.rows) }));
    const bySaldo = items.slice().sort((x, y) => y.a.saldo - x.a.saldo)[0];
    const byN = items.slice().sort((x, y) => y.a.n - x.a.n)[0];
    // percentuale di screen-out più alta (confronto tra frazioni senza arrotondamenti);
    // a parità vince chi ha più sottomissioni, poi più screen-out
    const worst = items.filter(it => it.a.n >= 3)
      .sort((x, y) => (y.a.nScreened * x.a.n - x.a.nScreened * y.a.n) || (y.a.n - x.a.n) || (y.a.nScreened - x.a.nScreened))[0];
    const { top, rankOf } = topRanked(items);
    groups.forEach(g => { if (rankOf.has(g.key)) g.sub += ` · infografica #${rankOf.get(g.key)}`; });
    const sub = { saldo: 'I 10 ricercatori che ti hanno pagato di più', n: 'I 10 ricercatori con più sottomissioni' }[RSEG] + ` · clic su un ricercatore per aprirne l'infografica (se è tra i ${TOP_CARDS} che ti hanno pagato di più) o lo storico`;
    p.innerHTML = `
      <h2 class="section-title">Ricercatori <span class="sub">${items.length} ricercatori · ${esc(periodText(rows))}</span></h2>
      <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
        <div class="card tile"><div class="t-label">Ricercatori</div><div class="t-value">${items.length}</div><div class="t-sub">${rows.length} sottomissioni</div></div>
        <div class="card tile"><div class="t-label">Ti ha pagato di più</div><div class="t-value">${bySaldo ? eur(bySaldo.a.saldo) : '—'}</div><div class="t-sub" title="${esc(bySaldo ? bySaldo.label : '')}">${esc(bySaldo ? bySaldo.label : '')}</div></div>
        <div class="card tile"><div class="t-label">Più sottomissioni</div><div class="t-value">${byN ? byN.a.n : '—'}</div><div class="t-sub" title="${esc(byN ? byN.label : '')}">${esc(byN ? byN.label : '')}</div></div>
        <div class="card tile"><div class="t-label">Più screen-out (min. 3)</div><div class="t-value">${worst && worst.a.nScreened ? pct(worst.a.nScreened / worst.a.n) : '—'}</div><div class="t-sub" title="${esc(worst ? worst.label : '')}">${esc(worst && worst.a.nScreened ? `${worst.label} · ${worst.a.nScreened} su ${worst.a.n}` : '')}</div></div>      </div>
      <div class="stack" style="margin-top:20px">
        ${vizCard('res', 'Classifica dei ricercatori', sub, { span: true, size: 'tall', seg: { name: 'rseg', value: RSEG, options: [['saldo', 'Guadagno'], ['n', 'Sottomissioni']] }, tableLabel: 'Tabella: dati e guadagni per ricercatore' })}
      </div>
      ${top.length ? `<h2 class="section-title">${top.length === 1 ? 'Il ricercatore che ti ha pagato di più' : `I ${top.length} ricercatori che ti hanno pagato di più`} <span class="sub">dal più redditizio · clic su un mese del grafico per vederne le sottomissioni nello storico</span></h2>
      <div class="stack">${top.map((it, i) => infoCard('researcher', it, i + 1, items.length)).join('')}</div>` : ''}`;
    const pick = pickInfo('researcher', rankOf);
    topBars('c-res', items, RSEG, undefined, pick, chartHint(rankOf));
    mount('t-res', bracketTable(groups, { kind: 'researcher', title: 'Ricercatore', limit: 15, unit: 'ricercatori', unitOne: 'ricercatore', pickHint: tableHint('researcher', rankOf), onPick: pick }));
    lazyInfoCharts('researcher', p, top);
  }

  // ---------------------------------------------------------- STORICO
  const SORTS = {
    'date-desc': 'Data: dal più recente', 'date-asc': 'Data: dal meno recente',
    'value-desc': 'Importo: dal più alto', 'value-asc': 'Importo: dal più basso',
    'name-asc': 'Nome studio: A → Z', 'name-desc': 'Nome studio: Z → A',
    'dur-desc': 'Durata: dalla più lunga', 'dur-asc': 'Durata: dalla più breve',
    'ph-desc': 'Paga oraria: dalla più alta', 'ph-asc': 'Paga oraria: dalla più bassa',
  };
  // paga oraria di una riga: guadagnato (o, se in revisione, quanto renderebbe) diviso il tempo impiegato
  const rowPerHour = r => {
    const v = r.isEarned ? r.earned : r.isPending ? r.pending : null;
    return v != null && r.minutes > 0 ? v / (r.minutes / 60) : null;
  };
  function phCell(r) {
    const ph = rowPerHour(r);
    if (ph == null) return `<span class="zero" title="${r.minutes > 0 ? 'Studio non pagato' : 'Durata non disponibile'}">—</span>`;
    return `<span class="hph">${eur(ph)}/h</span>${r.isPending ? '<span class="hsmall">se approvato</span>' : ''}`;
  }
  function sortHistory(rows) {
    const [k, d] = HSORT.split('-'), dir = d === 'asc' ? 1 : -1;
    const val = r => (k === 'date' ? (r.when ? r.when.getTime() : null) : k === 'value' ? r.value : k === 'name' ? norm(r.study) : k === 'dur' ? r.minutes : k === 'ph' ? rowPerHour(r) : null);
    return rows.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return a.id - b.id;
      if (x == null) return 1;
      if (y == null) return -1;
      return ((x < y ? -1 : x > y ? 1 : 0) * dir) || (a.id - b.id);
    });
  }
  function amountCell(r) {
    const orig = `${money(r.reward, r.cur)}${r.cur !== 'EUR' ? ` × ${nf4.format(r.rate)}` : ''}`;
    if (r.status === 'APPROVED') {
      return `<div class="amount">Premio: <b>${eur(r.earned)}</b><span class="hsmall">${orig}${r.bonus ? ` · bonus ${money(r.bonus, r.bonusCur)}` : ''}</span></div>`;
    }
    if (r.status === 'SCREENED OUT') {
      return `<div class="amount">Compenso: <b>${eur(r.earned)}</b><span class="hsmall">premio non pagato: ${eur(r.rewardEur)} (${money(r.reward, r.cur)})</span></div>`;
    }
    if (r.isPending) return `<div class="amount pending">In attesa: <b>${eur(r.pending)}</b><span class="hsmall">${orig}</span></div>`;
    return `<div class="amount none">Premio: <b>${eur(r.value)}</b><span class="hsmall">non pagato · ${orig}</span></div>`;
  }
  function renderHistory(p, rows) {
    const sorted = sortHistory(rows);
    const shown = sorted.slice(0, HLIMIT);
    const [sk, sd] = HSORT.split('-');
    const thS = (k, l) => `<th data-sort="${k}" aria-sort="${sk === k ? (sd === 'asc' ? 'ascending' : 'descending') : 'none'}">${l}${sk === k ? ` <span style="font-size:11px">${sd === 'asc' ? '▲' : '▼'}</span>` : ''}</th>`;
    p.innerHTML = `
      <h2 class="section-title">Storico sottomissioni
        <button type="button" class="collapse-btn ${HOPEN ? '' : 'closed'}" id="hCollapse" aria-label="Mostra o nascondi lo storico" aria-expanded="${HOPEN}">${ICON.chev}</button>
        <span class="sub">${rows.length} di ${DATA.length} sottomissioni · guadagnato ${eur(sum(rows, r => r.earned))}</span>
      </h2>
      <div class="card htable-card" ${HOPEN ? '' : 'hidden'}>
        <div class="hscroll"><table class="htable">
          <thead><tr>${thS('name', 'Nome studio')}${thS('date', 'Data')}${thS('value', 'Importo')}${thS('dur', 'Durata')}${thS('ph', 'Paga oraria')}<th>Stato</th></tr></thead>
          <tbody>${shown.map(r => `<tr>
            <td><div class="hstudy">${avatarHtml(r.researcher, true)}<div>
              <button type="button" class="link title" data-fstudy="${r.id}">${esc(r.study)}</button>
              <div class="by">Di <button type="button" class="link" data-fres="${r.id}">${esc(r.researcher)}</button></div></div></div></td>
            <td class="hdate">${r.when ? esc(dfmt.format(r.when)) : '<span class="hsmall" style="margin:0">senza data</span>'}${r.code ? `<span class="hsmall">Codice: ${esc(trunc(r.code, 22))}</span>` : ''}</td>
            <td>${amountCell(r)}</td>
            <td>${durText(r.minutes)}</td>
            <td>${phCell(r)}</td>
            <td>${statusPill(r.status)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        <div class="hist-foot"><span>Mostrate ${shown.length} di ${rows.length}</span>
          ${shown.length < rows.length ? `<span class="btn-row" style="margin:0"><button class="btn sm" type="button" data-hmore="50">Mostra altre 50</button><button class="btn sm" type="button" data-hmore="all">Mostra tutte</button></span>` : ''}
        </div>
      </div>`;
  }

  // ---------------------------------------------------------- barra filtri
  function setDateRange(from, to, preset) {
    F.from = from || ''; F.to = to || ''; F.datePreset = preset || '';
    afterFilterChange();
  }
  /* Apre lo Storico con i filtri di patch (es. { from, to } o { statuses: new Set([...]) }).
     Negli altri tab i filtri non esistono: i clic su settimane, giorni, stati, studi… passano da qui. */
  function openHistory(patch) {
    resetFilters();
    Object.assign(F, patch);
    $('#fSearch').value = F.q;
    TAB = 'history'; store.set('ps.tab', TAB); HOPEN = true; HLIMIT = 50;
    closeDropdowns();
    afterFilterChange();
    window.scrollTo({ top: 0 });
  }
  function datePresets() {
    const t = new Date(), today = dkey(t);
    const mStart = new Date(t.getFullYear(), t.getMonth(), 1);
    const pmStart = new Date(t.getFullYear(), t.getMonth() - 1, 1), pmEnd = new Date(t.getFullYear(), t.getMonth(), 0);
    return [
      ['all', 'Tutto il periodo', '', ''],
      ['today', 'Oggi', today, today],
      ['7', 'Ultimi 7 giorni', dkey(addDays(t, -6)), today],
      ['30', 'Ultimi 30 giorni', dkey(addDays(t, -29)), today],
      ['month', 'Questo mese', dkey(mStart), today],
      ['prev', 'Mese scorso', dkey(pmStart), dkey(pmEnd)],
    ];
  }
  function renderPop(name) {
    const pop = $(`.dd[data-dd="${name}"] [data-pop]`);
    if (!pop) return;
    if (name === 'researcher') {
      const top = groupRows(DATA, r => r.researcher).sort((a, b) => b.rows.length - a.rows.length).slice(0, 8);
      pop.innerHTML = `<h4>Ricercatore</h4>
        <div class="field-row"><label class="field">Nome (anche parziale)<input type="text" id="fRes" list="resList" value="${esc(F.researcher)}" autocomplete="off"></label></div>
        <datalist id="resList">${[...new Set(DATA.map(r => r.researcher))].sort().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <hr><h4>Più frequenti</h4>
        ${top.map(g => `<button type="button" class="opt" data-res="${esc(g.key)}"><span class="check">${F.researcher === g.key ? '✓' : ''}</span>${esc(trunc(g.key, 30))}<span class="n">${g.rows.length}</span></button>`).join('')}
        <hr><button type="button" class="opt" data-res=""><span class="check"></span>Tutti i ricercatori</button>`;
    } else if (name === 'date') {
      const months = [...new Set(DATA.map(r => r.monthKey).filter(Boolean))].sort().reverse();
      pop.innerHTML = `<h4>Periodo</h4>
        ${datePresets().map(([id, l]) => `<button type="button" class="opt" data-preset="${id}"><span class="check">${(F.datePreset === id || (id === 'all' && !F.from && !F.to)) ? '✓' : ''}</span>${l}</button>`).join('')}
        ${months.length ? `<hr><h4>Mesi</h4><div class="quick">${months.map(k => `<button type="button" data-mpick="${k}" class="${F.datePreset === 'm' + k ? 'on' : ''}">${esc(monthLabel(k))}</button>`).join('')}</div>` : ''}
        <hr><h4>Intervallo personalizzato</h4>
        <div class="field-row"><label class="field">Dal<input type="date" id="fFrom" value="${F.from}"></label><label class="field">Al<input type="date" id="fTo" value="${F.to}"></label></div>`;
    } else if (name === 'status') {
      const counts = groupRows(DATA, r => r.status);
      const ordered = counts.sort((a, b) => ((STATUS_ORDER.indexOf(a.key) + 1 || 99) - (STATUS_ORDER.indexOf(b.key) + 1 || 99)));
      pop.innerHTML = `<h4>Stato</h4>
        ${ordered.map(g => `<label class="opt"><input type="checkbox" data-status="${esc(g.key)}" ${F.statuses.has(g.key) ? 'checked' : ''}>${statusPill(g.key, true)}<span class="n">${g.rows.length}</span></label>`).join('')}
        <hr><div class="quick"><button type="button" data-squick="paid">Solo pagati</button><button type="button" data-squick="lost">Solo non pagati</button><button type="button" data-squick="">Tutti</button></div>`;
    } else if (name === 'amount') {
      const t = S.thresholds, labels = bucketLabels();
      const ranges = labels.map((l, j) => [j === 0 ? '' : t[j - 1], j < t.length ? +(t[j] - 0.01).toFixed(2) : '']);
      pop.innerHTML = `<h4>Importo in euro</h4>
        <div class="field-row"><label class="field">Minimo €<input type="number" step="0.01" min="0" id="fMin" value="${F.min}"></label><label class="field">Massimo €<input type="number" step="0.01" min="0" id="fMax" value="${F.max}"></label></div>
        <h4>Fasce</h4>
        <div class="quick">${labels.map((l, j) => `<button type="button" data-arange="${ranges[j][0]}|${ranges[j][1]}" class="${String(F.min) === String(ranges[j][0]) && String(F.max) === String(ranges[j][1]) ? 'on' : ''}">${esc(l)}</button>`).join('')}<button type="button" data-arange="|">Qualsiasi</button></div>
        <p class="hsmall" style="padding:0 8px 6px">Si applica all'importo in euro di ogni riga: guadagnato per approvati e screened out, in attesa per quelli in revisione, premio per gli altri.</p>`;
    } else if (name === 'currency') {
      const counts = groupRows(DATA, r => r.cur);
      pop.innerHTML = `<h4>Valuta originale</h4>
        ${counts.map(g => `<label class="opt"><input type="checkbox" data-cur="${g.key}" ${F.currencies.has(g.key) ? 'checked' : ''}>${esc(CUR_NAME[g.key] || g.key)}<span class="n">${g.rows.length}</span></label>`).join('')}`;
    } else if (name === 'sort') {
      pop.innerHTML = `<h4>Ordina lo storico</h4>${Object.entries(SORTS).map(([k, l]) => `<button type="button" class="opt" data-hsort="${k}"><span class="check">${HSORT === k ? '✓' : ''}</span>${l}</button>`).join('')}`;
    }
  }
  function datePillText() {
    if (!F.from && !F.to) return 'Data';
    const pr = datePresets().find(p => p[0] === F.datePreset);
    if (pr) return pr[1];
    if (F.datePreset && F.datePreset[0] === 'm') return monthLabel(F.datePreset.slice(1));
    if (F.from && F.to) return F.from === F.to ? fmtKey(F.from) : `${dfmtDay.format(fromKey(F.from))} – ${dfmtDay.format(fromKey(F.to))}`;
    return F.from ? `Dal ${fmtKey(F.from)}` : `Fino al ${fmtKey(F.to)}`;
  }
  function amountText() {
    if (F.min !== '' && F.max !== '') return `${eur(+F.min)} – ${eur(+F.max)}`;
    if (F.min !== '') return `≥ ${eur(+F.min)}`;
    if (F.max !== '') return `≤ ${eur(+F.max)}`;
    return '';
  }
  function updatePills() {
    const set = (name, on, text) => {
      const b = $(`.dd[data-dd="${name}"] [data-dd-btn]`);
      b.classList.toggle('on', on);
      b.querySelector('span').textContent = text;
      b.title = text; // il testo lungo viene troncato: il tooltip lo mostra intero
    };
    set('researcher', !!F.researcher, F.researcher ? trunc(F.researcher, 22) : 'Ricercatore');
    set('date', !!(F.from || F.to), datePillText());
    set('status', F.statuses.size > 0, F.statuses.size ? (F.statuses.size === 1 ? cap([...F.statuses][0].toLowerCase()) : `Stato (${F.statuses.size})`) : 'Stato');
    set('amount', F.min !== '' || F.max !== '', amountText() || 'Importo');
    set('currency', F.currencies.size > 0, F.currencies.size ? 'Valuta: ' + [...F.currencies].map(c => SYM[c] || c).join(' ') : 'Valuta');
    $('#sortLabel').textContent = SORTS[HSORT];
  }
  function renderChips() {
    const chips = [];
    if (F.q) chips.push(['q', `Ricerca: “${trunc(F.q, 30)}”`]);
    if (F.study) chips.push(['study', `Studio: ${trunc(F.study, 40)}`]);
    if (F.researcher) chips.push(['researcher', `Ricercatore: ${trunc(F.researcher, 30)}`]);
    if (F.from || F.to) chips.push(['date', `Periodo: ${datePillText()}`]);
    if (F.statuses.size) chips.push(['status', `Stato: ${[...F.statuses].join(', ')}`]);
    if (F.min !== '' || F.max !== '') chips.push(['amount', `Importo: ${amountText()}`]);
    if (F.currencies.size) chips.push(['currency', `Valuta: ${[...F.currencies].map(c => SYM[c] || c).join(' ')}`]);
    $('#chips').innerHTML = chips.map(([k, l]) => `<span class="chip">${esc(l)}<button type="button" data-unchip="${k}" aria-label="Rimuovi filtro">${ICON.x}</button></span>`).join('')
      + (chips.length > 1 ? '<button type="button" class="chip-reset" data-reset>Azzera tutti i filtri</button>' : '')
      // segnaposto: la riga dei filtri attivi ha sempre la stessa altezza
      + (chips.length ? '' : '<span class="chips-empty">Nessun filtro attivo</span>');
  }
  function clearFilter(k) {
    if (k === 'q') { F.q = ''; $('#fSearch').value = ''; }
    if (k === 'study') F.study = '';
    if (k === 'researcher') { F.researcher = ''; F.researcherExact = false; }
    if (k === 'date') { F.from = ''; F.to = ''; F.datePreset = ''; }
    if (k === 'status') F.statuses.clear();
    if (k === 'amount') { F.min = ''; F.max = ''; }
    if (k === 'currency') F.currencies.clear();
  }
  let renderTimer = null;
  function afterFilterChange(debounce) {
    HLIMIT = 50;
    updatePills();
    renderChips();
    const open = $('.dd.open');
    if (open && !debounce) renderPop(open.dataset.dd);
    clearTimeout(renderTimer);
    if (debounce) renderTimer = setTimeout(renderActive, 160);
    else renderActive();
  }
  function closeDropdowns(except) { $$('.dd.open').forEach(d => { if (d !== except) d.classList.remove('open'); }); }

  // ---------------------------------------------------------- impostazioni
  function renderRateStatus() {
    const el = $('#rateStatus');
    if (!el) return;
    el.className = rateStatus.state === 'ok' ? 'ok' : rateStatus.state === 'err' ? 'err' : 'muted';
    el.textContent = rateStatus.msg || (S.rates.date ? `Tassi del ${fmtKey(S.rates.date)} (${S.rates.source}).` : '');
  }
  function renderDrawer() {
    const b = $('#drawerBody');
    b.innerHTML = `
      <section>
        <h3>Conversione in euro</h3>
        <label class="radio"><input type="radio" name="rmode" value="hist" ${S.historical ? 'checked' : ''}><span><b>Tasso BCE del giorno di ogni studio</b><br><span class="muted">Ogni importo viene convertito al cambio del giorno in cui hai iniziato lo studio.</span></span></label>
        <label class="radio"><input type="radio" name="rmode" value="fixed" ${S.historical ? '' : 'checked'}><span><b>Tasso fisso</b><br><span class="muted">Usa i due valori qui sotto per tutti gli importi.</span></span></label>
        <div class="rate-row">
          <label class="field">1 £ (GBP) in €<input type="number" step="0.0001" min="0" id="rGBP" value="${S.rates.GBP}"></label>
          <label class="field">1 $ (USD) in €<input type="number" step="0.0001" min="0" id="rUSD" value="${S.rates.USD}"></label>
        </div>
        <div class="btn-row"><button class="btn sm" type="button" id="btnRates">Aggiorna tassi BCE</button></div>
        <p id="rateStatus" class="muted"></p>
        <p class="muted">I tassi arrivano dalla Banca Centrale Europea tramite il servizio gratuito Frankfurter. Viene inviato solo l'intervallo di date, nessun tuo dato.</p>
      </section>
      <section>
        <h3>Fasce di importo delle tabelle</h3>
        <label class="field">Soglie in euro, separate da virgola<input type="text" id="thr" value="${S.thresholds.join(', ')}"></label>
        <p class="muted" id="thrPreview">Colonne: ${bucketLabels().map(esc).join(' · ')}</p>
        <label class="radio"><input type="radio" name="basis" value="earned" ${S.basis === 'earned' ? 'checked' : ''}><span>Conta approvati e screened out (importo realmente ricevuto)</span></label>
        <label class="radio"><input type="radio" name="basis" value="approved" ${S.basis === 'approved' ? 'checked' : ''}><span>Conta solo gli approvati</span></label>
      </section>
      <section>
        <h3>Tema</h3>
        <div class="seg" id="themeSeg">${[['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([v, l]) => `<button type="button" data-theme-v="${v}" class="${S.theme === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      </section>
      <section>
        <h3>Come vengono calcolati i guadagni</h3>
        <p><b>Guadagnato</b> = premio + bonus degli studi APPROVED, più il compenso (colonna Bonus) degli SCREENED OUT. Il premio di uno studio screened out non viene pagato. È lo stesso totale del riepilogo di Prolific.</p>
        <p><b>In attesa</b> = premio + bonus degli studi AWAITING REVIEW.</p>
        <p>Gli orari del CSV sono in UTC e vengono mostrati nel fuso orario del tuo computer.</p>
      </section>
      <section>
        <h3>Dati</h3>
        <p>${FILE ? `<b>${esc(FILE.name)}</b> · ${FILE.rows} righe${FILE.skipped ? ` (${pl(FILE.skipped, 'riga senza data di inizio esclusa', 'righe senza data di inizio escluse')})` : ''} · caricato il ${esc(dfmt.format(new Date(FILE.loaded)))}` : 'Nessun file caricato.'}</p>
        <div class="btn-row"><button class="btn sm" type="button" id="btnReload">Carica un altro CSV</button><button class="btn sm danger" type="button" id="btnForget">Rimuovi i dati salvati</button></div>
        <p class="muted">Il CSV resta salvato solo in questo browser, così non devi ricaricarlo a ogni apertura.</p>
      </section>`;
    renderRateStatus();
  }
  function openDrawer() { renderDrawer(); $('#drawer').hidden = false; $('#drawerBackdrop').hidden = false; }
  function closeDrawer() { $('#drawer').hidden = true; $('#drawerBackdrop').hidden = true; }

  // ---------------------------------------------------------- caricamento file
  function showApp(on) {
    $('#empty').hidden = on;
    $('#app').hidden = !on;
    $('#wallet').hidden = !on;
  }
  function loadText(text, name, persist) {
    try {
      ingest(text, name);
    } catch (e) {
      const el = $('#loadError');
      el.textContent = e.message || 'File non valido.';
      el.hidden = false;
      if (!$('#app').hidden) alert(e.message || 'File non valido.');
      return false;
    }
    $('#loadError').hidden = true;
    // CSV salvato: nome e data di caricamento originali, conteggi ricalcolati adesso
    if (!persist) { const info = store.get('ps.fileinfo', null); if (info) FILE = { ...FILE, name: info.name, loaded: info.loaded }; }
    if (persist) { store.set('ps.csv', text); store.set('ps.fileinfo', FILE); }
    resetFilters();
    MVIEW = 'all'; KEEP_OPEN.clear(); MCOLLAPSED.clear(); OVP = { k: 'all', from: '', to: '' };
    convert();
    showApp(true);
    renderAll();
    refreshRates(false);
    return true;
  }
  function readFile(file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => loadText(String(fr.result || ''), file.name, true);
    fr.onerror = () => { const el = $('#loadError'); el.textContent = 'Impossibile leggere il file.'; el.hidden = false; };
    fr.readAsText(file, 'utf-8');
  }

  // ---------------------------------------------------------- eventi
  function bind() {
    $('#pickFile').addEventListener('click', () => $('#fileInput').click());
    $('#btnUpload').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', e => { readFile(e.target.files[0]); e.target.value = ''; });

    let dragDepth = 0;
    const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $('#drop').classList.add('over'); if (!$('#app').hidden) $('#dropveil').hidden = false; });
    window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) { $('#drop').classList.remove('over'); $('#dropveil').hidden = true; } });
    window.addEventListener('drop', e => {
      if (!hasFiles(e)) return;
      e.preventDefault(); dragDepth = 0;
      $('#drop').classList.remove('over'); $('#dropveil').hidden = true;
      readFile(e.dataTransfer.files[0]);
    });

    $('#fSearch').addEventListener('input', e => { F.q = e.target.value; afterFilterChange(true); });

    $('#btnSettings').addEventListener('click', openDrawer);
    $('#closeDrawer').addEventListener('click', closeDrawer);
    $('#drawerBackdrop').addEventListener('click', closeDrawer);

    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDropdowns(); closeDrawer(); } });

    document.addEventListener('click', e => {
      const t = e.target;
      // menu a tendina dei filtri
      const ddBtn = t.closest('[data-dd-btn]');
      if (ddBtn) {
        const dd = ddBtn.closest('.dd');
        const willOpen = !dd.classList.contains('open');
        closeDropdowns(dd);
        if (willOpen) { renderPop(dd.dataset.dd); dd.classList.add('open'); const first = dd.querySelector('input[type="text"], input[type="date"], input[type="number"]'); if (first && dd.dataset.dd === 'researcher') first.focus(); }
        else dd.classList.remove('open');
        return;
      }
      if (!t.closest('.dd')) closeDropdowns();

      const tab = t.closest('[data-tab]');
      if (tab) { setTab(tab.dataset.tab); window.scrollTo({ top: 0 }); return; }
      const tabLink = t.closest('[data-tab-link]');
      if (tabLink) { e.preventDefault(); setTab(tabLink.dataset.tabLink); return; }

      const el = sel => t.closest(sel);
      let x;
      if ((x = el('[data-res]'))) { F.researcher = x.dataset.res; F.researcherExact = !!F.researcher; const inp = $('#fRes'); if (inp) inp.value = F.researcher; afterFilterChange(); return; }
      if ((x = el('[data-preset]'))) { const p = datePresets().find(d => d[0] === x.dataset.preset); setDateRange(p[2], p[3], p[0] === 'all' ? '' : p[0]); return; }
      if ((x = el('[data-mpick]'))) { const r = monthRange(x.dataset.mpick); setDateRange(r.from, r.to, 'm' + x.dataset.mpick); return; }
      if ((x = el('[data-squick]'))) {
        const v = x.dataset.squick;
        F.statuses = v === 'paid' ? new Set(['APPROVED', 'SCREENED OUT']) : v === 'lost' ? new Set(DATA.filter(r => !r.isEarned && !r.isPending).map(r => r.status)) : new Set();
        afterFilterChange(); return;
      }
      if ((x = el('[data-arange]'))) { const [a, b] = x.dataset.arange.split('|'); F.min = a; F.max = b; afterFilterChange(); return; }
      if ((x = el('[data-hsort]'))) { HSORT = x.dataset.hsort; closeDropdowns(); updatePills(); renderActive(); return; }
      if ((x = el('[data-unchip]'))) { clearFilter(x.dataset.unchip); afterFilterChange(); return; }
      if ((x = el('[data-reset]'))) { resetFilters(); afterFilterChange(); return; }
      if ((x = el('[data-open-settings]'))) { openDrawer(); return; }
      if ((x = el('[data-month]'))) { const r = monthRange(x.dataset.month); openHistory({ from: r.from, to: r.to, datePreset: 'm' + x.dataset.month }); return; }
      if ((x = el('[data-ovp]'))) {
        const k = x.dataset.ovp;
        OVP = k === 'custom' ? { k, from: x.dataset.from || '', to: x.dataset.to || '' } : { k, from: '', to: '' };
        renderActive(); return;
      }
      if ((x = el('[data-tmonth]'))) { setTab('monthly'); goToMonth(x.dataset.tmonth, true); return; }
      if ((x = el('[data-thist]'))) { const [from, to, datePreset] = x.dataset.thist.split('|'); openHistory({ from, to, datePreset }); return; }
      if ((x = el('[data-info-hist]'))) { openHistory(INFO[x.dataset.infoHist].history(x.dataset.key)); return; }
      if ((x = el('[data-mview]'))) { MVIEW = x.dataset.mview; applyMonthView(); return; }
      if ((x = el('[data-mtoggle]'))) { const c = x.closest('.month'); setCollapsed(c, !c.classList.contains('collapsed')); syncCollapseAll(); return; }
      if ((x = el('[data-mcollapse]'))) {
        const on = x.dataset.mcollapse === 'all';
        $$('.month[data-mk]').filter(c => !c.hidden).forEach(c => setCollapsed(c, on));
        syncCollapseAll(); return;
      }
      if ((x = el('[data-mgo]'))) { goToMonth(`${$('#mGoY').value}-${$('#mGoM').value}`); return; }
      if ((x = el('[data-seg] button'))) {
        const name = x.closest('[data-seg]').dataset.seg, v = x.dataset.v;
        if (name === 'mseg') MSEG = v; else if (name === 'sseg') SSEG = v; else if (name === 'rseg') RSEG = v;
        renderActive(); return;
      }
      if ((x = el('[data-fstudy]'))) { F.study = DATA[+x.dataset.fstudy].study; afterFilterChange(); return; }
      if ((x = el('[data-fres]'))) { F.researcher = DATA[+x.dataset.fres].researcher; F.researcherExact = true; afterFilterChange(); return; }
      if ((x = el('#hCollapse'))) { HOPEN = !HOPEN; renderActive(); return; }
      if ((x = el('[data-hmore]'))) { HLIMIT = x.dataset.hmore === 'all' ? Infinity : HLIMIT + 50; renderActive(); return; }
      if ((x = el('.htable th[data-sort]'))) {
        const k = x.dataset.sort, [ck, cd] = HSORT.split('-');
        const def = { name: 'asc', date: 'desc', value: 'desc', dur: 'desc', ph: 'desc' }[k];
        HSORT = `${k}-${ck === k ? (cd === 'asc' ? 'desc' : 'asc') : def}`;
        updatePills(); renderActive(); return;
      }
      // impostazioni
      if ((x = el('#btnRates'))) { refreshRates(true); return; }
      if ((x = el('[data-theme-v]'))) { S.theme = x.dataset.themeV; saveSettings(); applyTheme(); renderDrawer(); renderActive(); return; }
      if ((x = el('#btnReload'))) { $('#fileInput').click(); return; }
      if ((x = el('#btnForget'))) {
        if (!confirm('Rimuovere il CSV salvato in questo browser?')) return;
        store.del('ps.csv'); store.del('ps.fileinfo'); RAW = []; DATA = []; FILE = null;
        destroyCharts(); closeDrawer(); showApp(false); return;
      }
    });

    document.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'fRes') { F.researcher = t.value; F.researcherExact = false; afterFilterChange(true); }
      else if (t.id === 'fMin') { F.min = t.value; afterFilterChange(true); }
      else if (t.id === 'fMax') { F.max = t.value; afterFilterChange(true); }
      else if (t.id === 'thr') {
        const v = t.value.split(/[,;\s]+/).map(s => parseFloat(s.replace(',', '.'))).filter(n => isFinite(n) && n > 0);
        const uniq = [...new Set(v)].sort((a, b) => a - b).slice(0, 8);
        if (uniq.length) {
          S.thresholds = uniq; saveSettings();
          $('#thrPreview').textContent = 'Colonne: ' + bucketLabels().join(' · ');
          clearTimeout(renderTimer); renderTimer = setTimeout(renderActive, 300);
        }
      } else if (t.id === 'rGBP' || t.id === 'rUSD') {
        const n = parseFloat(t.value);
        if (isFinite(n) && n > 0) {
          S.rates[t.id === 'rGBP' ? 'GBP' : 'USD'] = n; S.rates.source = 'manuale'; saveSettings();
          convert(); clearTimeout(renderTimer); renderTimer = setTimeout(renderAll, 250);
        }
      }
    });
    document.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'fFrom' || t.id === 'fTo') { F.from = $('#fFrom').value; F.to = $('#fTo').value; F.datePreset = ''; afterFilterChange(); }
      else if (t.dataset && t.dataset.status !== undefined) { if (t.checked) F.statuses.add(t.dataset.status); else F.statuses.delete(t.dataset.status); afterFilterChange(); }
      else if (t.dataset && t.dataset.cur !== undefined) { if (t.checked) F.currencies.add(t.dataset.cur); else F.currencies.delete(t.dataset.cur); afterFilterChange(); }
      else if (t.name === 'rmode') { S.historical = t.value === 'hist'; saveSettings(); convert(); renderAll(); if (S.historical && !HIST) refreshRates(false); }
      else if (t.name === 'basis') { S.basis = t.value; saveSettings(); renderActive(); }
      else if (t.id === 'ovFrom' || t.id === 'ovTo') {
        let from = $('#ovFrom').value, to = $('#ovTo').value;
        if (from && to && from > to) [from, to] = [to, from];
        OVP = { k: 'custom', from, to }; renderActive();
      }
      else if (t.id === 'mGoY') { fillGotoMonths(); goToMonth(`${t.value}-${$('#mGoM').value}`); }
      else if (t.id === 'mGoM') goToMonth(`${$('#mGoY').value}-${t.value}`);
    });
    // "toggle" non risale il DOM: lo si ascolta in fase di cattura
    document.addEventListener('toggle', e => {
      const d = e.target;
      if (d.dataset && d.dataset.keep) KEEP_OPEN.set(d.dataset.keep, d.open);
    }, true);

    if (window.matchMedia) {
      const mq = matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => { if (S.theme === 'auto') renderActive(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (RAW.length) renderActive(); });
  }

  // ---------------------------------------------------------- avvio
  applyTheme();
  bind();
  const saved = store.get('ps.csv', null);
  if (saved && !loadText(saved, (FILE && FILE.name) || 'CSV salvato', false)) showApp(false);
  if (!saved) showApp(false);
})();
