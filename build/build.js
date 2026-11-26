/* Breakout Radar build: turns Market-Data's closed candles (repo mbzazad-max/market-data) into the saved scan the page
   shows, by running the page's own Refresh (build/runpage.js). All logic stays in the page; this file only converts data:
     config/board.json maps each page request (symbol + interval) to a Market-Data series:
       binance/<SYM>/1D, /4H, /1H as stored; '<series>/4H>1D' = UTC days from 4H (a day counts once its 20:00 candle closed);
       '<series>/4H>8H' = 8H candles from 4H pairs at 00/08/16 UTC (both halves needed).
       'A+B' = two series added candle by candle (USDT.D+USDC.D, as on Structure Shift).
       session_series (SPX) keep their exchange-hours candle times; 'none' = no such candles on purpose (SPX 8H).
     Daily answers end with today so far, built from today's closed 4H candles (the page treats its last daily bar as the
     open day, as it was with TradingView); every other candle is a closed Market-Data candle.
   Closed candles only; a series that is unclosed, out of order or has a 50% jump is refused and that request fails in the
   page exactly as a failed TradingView call would (the coin keeps its last good row, marked old).
   usage: node build/build.js <market-data dir> <node_modules with jsdom> [--force]
   Writes public/scan.json ({generated, docs}) and public/freshness.json. Skips when no input changed (unless --force).
   On any failure the last good files stay and the run exits 1. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { runPage } = require('./runpage');
const ROOT = path.resolve(__dirname, '..'), PUB = path.join(ROOT, 'public');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const MD = path.resolve(args[0] || 'md'), NM = path.resolve(args[1] || 'node_modules');
const FORCE = process.argv.includes('--force');
const NOW = Math.floor(Date.now() / 1000);
const SEC = { '1H': 3600, '4H': 14400, '8H': 28800, '1D': 86400 };
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const cfg = rd(path.join(ROOT, 'config/board.json'));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

const cache = {};
function load(id) {                                   // 'binance/BTCUSDT/4H' -> [{t,o,h,l,c,v}] oldest first
  if (cache[id]) return cache[id];
  const [src, sym, tf] = id.split('/'), f = path.join(MD, 'data', src, `${sym}_${tf}.csv`);
  if (!fs.existsSync(f)) return (cache[id] = null);
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n'); lines.shift();
  return (cache[id] = lines.map((ln) => { const p = ln.split(','); return { t: +p[0], o: +p[1], h: +p[2], l: +p[3], c: +p[4], v: +(p[5] || 0) }; }));
}
function group(rows, span, need, lastStart) {          // merge 4H rows into `span` candles; keep complete ones only
  const by = new Map();
  for (const r of rows) { const s = r.t - (r.t % span); (by.get(s) || by.set(s, []).get(s)).push(r); }
  const out = [];
  for (const [s, rs] of [...by.entries()].sort((a, b) => a[0] - b[0])) {
    rs.sort((a, b) => a.t - b.t);
    if (rs.length !== need || rs[rs.length - 1].t !== s + lastStart) continue;
    out.push({ t: s, o: rs[0].o, h: Math.max(...rs.map((r) => r.h)), l: Math.min(...rs.map((r) => r.l)), c: rs[rs.length - 1].c, v: rs.reduce((a, r) => a + (r.v || 0), 0) });
  }
  return out;
}
function sum(ids) {                                   // 'A+B': the two series added candle by candle (times both have)
  const parts = ids.map((id) => { const r = load(id); if (!r) throw new Error(id + ' is not in Market-Data'); return r; });
  const maps = parts.slice(1).map((r) => new Map(r.map((x) => [x.t, x])));
  return parts[0].filter((x) => maps.every((m) => m.has(x.t))).map((x) => {
    const o = maps.map((m) => m.get(x.t));
    return { t: x.t, o: x.o + o.reduce((a, y) => a + y.o, 0), h: x.h + o.reduce((a, y) => a + y.h, 0), l: x.l + o.reduce((a, y) => a + y.l, 0), c: x.c + o.reduce((a, y) => a + y.c, 0), v: (x.v || 0) + o.reduce((a, y) => a + (y.v || 0), 0) };
  });
}
const parts = (base) => base.split('+');
function series(spec) {                               // -> {rows, base, period}
  const [base, conv] = spec.split('>');
  const rows = base.includes('+') ? sum(parts(base)) : load(base);
  if (!rows) throw new Error(base + ' is not in Market-Data');
  if (base.includes('+') && !cache[base]) cache[base] = rows;
  const tf = parts(base)[0].split('/')[2];
  if (!conv) return { rows, base, period: SEC[tf], today: base.endsWith('/1D') ? base.replace(/1D$/, '4H') : null };
  if (conv === '1D') return { rows: group(rows, 86400, 6, 72000), base, period: 86400, today: base };
  if (conv === '8H') return { rows: group(rows, 28800, 2, 14400), base, period: 28800 };
  throw new Error('unknown conversion ' + conv);
}
const SESSION = new Set(cfg.session_series || []);   // exchange-hours series (SPX): candles start at the session open
function check(rows, period, base) {
  if (!rows || !rows.length) throw new Error('no candles yet');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!Number.isFinite(r.t) || !Number.isFinite(r.c) || r.c <= 0) throw new Error('bad value at ' + iso(r.t));
    if (r.t % period !== 0 && !SESSION.has(base)) throw new Error('candle off its time grid at ' + iso(r.t));
    if (i && r.t <= rows[i - 1].t) throw new Error('candles out of order at ' + iso(r.t));
    if (r.t + period > NOW) throw new Error('candle not closed yet at ' + iso(r.t));
  }
  for (let i = Math.max(1, rows.length - 120); i < rows.length; i++)
    if (Math.abs(rows[i].c / rows[i - 1].c - 1) > 0.5) throw new Error('impossible jump at ' + iso(rows[i].t));
  return rows;
}

const candles = {}, used = new Map(), problems = [];
for (const [sym, ivs] of Object.entries(cfg.sources)) {
  for (const [iv, spec] of Object.entries(ivs)) {
    if (spec === 'none') { candles[sym + '|' + iv] = []; continue; }   // no such candles on purpose: the page shows "No 8H data"
    try {
      const s = series(spec);
      const rows = check(s.rows, s.period, s.base).slice(-1000);
      // today so far: the page's daily request always ended with the open day (TradingView did); here it is built from
      // today's CLOSED 4H candles only, so every price in it is a closed candle (same as Cycle Map's today_from_4h)
      if (iv === '1D' && s.today) {
        const h4 = (s.today.includes('+') ? sum(parts(s.today)) : load(s.today)) || [], day = rows[rows.length - 1].t + 86400, part = h4.filter((r) => r.t >= day && r.t < day + 86400 && r.t + 14400 <= NOW);
        if (part.length && part.length < 6) rows.push({ t: day, o: part[0].o, h: Math.max(...part.map((r) => r.h)), l: Math.min(...part.map((r) => r.l)), c: part[part.length - 1].c, v: part.reduce((a, r) => a + (r.v || 0), 0) });
      }
      candles[sym + '|' + iv] = rows;
      for (const id of parts(s.base)) {
        const raw = load(id), p = SEC[id.split('/')[2]];
        used.set(id, { id, period_s: p, built_from: raw[raw.length - 1].t, last_close: raw[raw.length - 1].t + p, rows: raw.length });
      }
    } catch (e) {
      candles[sym + '|' + iv] = { error: e.message };
      problems.push(`${sym} ${iv}: ${e.message}`);
      for (const id of parts(spec.split('>')[0])) if (!used.has(id)) used.set(id, { id, period_s: SEC[id.split('/')[2]] || 0, last_close: null });
    }
  }
}
const hash = crypto.createHash('sha256').update(JSON.stringify([...used.values()].map((s) => [s.id, s.last_close])) + fs.readFileSync(path.join(PUB, 'index.html'))).digest('hex').slice(0, 16);
const prevFresh = fs.existsSync(path.join(PUB, 'freshness.json')) ? rd(path.join(PUB, 'freshness.json')) : null;
if (!FORCE && prevFresh && prevFresh.inputs === hash && fs.existsSync(path.join(PUB, 'scan.json'))) { console.log('No new candles since the last build; nothing to do.'); process.exit(0); }
const prev = fs.existsSync(path.join(PUB, 'scan.json')) ? rd(path.join(PUB, 'scan.json')).docs : {};

(async () => {
  const t0 = Date.now();
  const res = await runPage({ nodeModules: NM, candles, docs: prev });
  console.log(`Page refresh: ${res.calls.length} requests answered from Market-Data in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
  console.log('Page says: ' + res.banner);
  if (problems.length) console.log('Refused series:\n  ' + problems.join('\n  '));
  if (!res.docs) { console.log('::error::The page did not save a scan (' + res.banner + '). The last good scan is kept.'); process.exit(1); }
  const head = res.docs['scan/latest'];
  const generated = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  fs.writeFileSync(path.join(PUB, 'scan.json'), JSON.stringify({ generated, docs: res.docs }));
  fs.writeFileSync(path.join(PUB, 'freshness.json'), JSON.stringify({
    generated, inputs: hash, source: 'mbzazad-max/market-data', failed: (head.failed || []).map((x) => x.toUpperCase()),
    last_result: res.banner, refused: problems, series: [...used.values()].sort((a, b) => a.id.localeCompare(b.id)),
  }, null, 1));
  console.log(`Saved: ${head.order.length} rows, summary ${JSON.stringify(head.summary)}`);
})().catch((e) => { console.log('::error::Build failed: ' + (e.message || e) + '. The last good scan is kept.'); process.exit(1); });
