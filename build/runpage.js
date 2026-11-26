/* Runs the Breakout Radar page (public/index.html: the original artifact plus the edits in tools/page.js) in jsdom and
   presses its own Refresh. The page's TradingView requests are answered from Market-Data candles given by the caller, in
   the exact answer shape mcp-tv-get-ohlcv uses; the page database is an in-memory stand-in seeded with the last build's
   documents. Whatever the page saves with its own code (scan/latest, scanrows/*, bars/*, meta/symmap) is returned unchanged.
   Every score, level and tier is worked out by the page; this file only feeds it data.
   Run-time only: waits between calls are skipped, and the previous scan is shown with its watch-list tag cleared so the
   page's once-a-day lock does not stop a GitHub rebuild (the page then saves its own tag again).
   runPage({ nodeModules, candles: {'SYMBOL|interval': [{t,o,h,l,c,v}] | {error}}, docs: {path: data} }) -> { docs, banner, calls } */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

function answer(rows, args) {
  const r = args.count ? rows.slice(-args.count) : rows;
  return { success: true, symbol: args.symbol, interval: args.interval, count: r.length, format: 'columns',
    bars: { t: r.map((x) => x.t), o: r.map((x) => x.o), h: r.map((x) => x.h), l: r.map((x) => x.l), c: r.map((x) => x.c), v: r.map((x) => x.v) } };
}

async function runPage({ nodeModules, candles, docs, timeoutMs = 180000 }) {
  const { JSDOM } = require(path.join(nodeModules, 'jsdom'));
  const page = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const start = page.indexOf('<script>\n(function () {\n  /* your fixed watch list');
  const end = page.indexOf('</script>', start);
  if (start < 0 || end < 0) throw new Error('could not find the page script');
  const body = page.slice(0, start).replace(/<script src="[^"]*"><\/script>/g, '');
  const dom = new JSDOM(body + '</body></html>', { url: 'https://breakout.build/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const store = {};
  for (const [p, d] of Object.entries(docs || {})) store[p] = JSON.parse(JSON.stringify(d));
  if (store['scan/latest']) store['scan/latest'].list = null;
  const listeners = {};
  const copy = (p) => (p in store ? JSON.parse(JSON.stringify(store[p])) : undefined);
  const snap = (p) => ({ exists: p in store, data: () => copy(p) });
  const db = { doc: (p) => ({
    get: async () => snap(p),
    set: async (d) => { store[p] = JSON.parse(JSON.stringify(d)); (listeners[p] || []).forEach((f) => f(snap(p))); },
    onSnapshot: (next) => { (listeners[p] = listeners[p] || []).push(next); setImmediate(() => next(snap(p))); return () => {}; },
  }) };
  const calls = [];
  const mcp = { callTool: async (server, tool, args) => {
    calls.push({ tool, symbol: args.symbol, interval: args.interval, count: args.count });
    if (tool !== 'mcp-tv-get-ohlcv') throw { code: 'tool_error', message: 'unexpected tool ' + tool };
    const src = candles[args.symbol + '|' + args.interval];
    if (!src) throw { code: 'tool_error', message: 'invalid symbol: ' + args.symbol + ' ' + args.interval + ' is not in Market-Data for this dashboard' };
    if (src.error) throw { code: 'tool_error', message: src.error };
    return { payload: answer(src, args) };
  } };
  const user = { isOwner: async () => true, canEdit: async () => true };
  w.claude = { use: async (k) => ({ db, mcp, user }[k] || null) };
  w.setTimeout = (f, ms, ...a) => setTimeout(f, 0, ...a);
  w.setInterval = () => 0;
  const errors = [];
  w.addEventListener('error', (e) => errors.push(e.message));
  w.eval(page.slice(start + '<script>'.length, end));
  const $ = (id) => w.document.getElementById(id);
  const until = async (fn, what) => { const t0 = Date.now(); while (!fn()) { if (errors.length) throw new Error('page error: ' + errors[0]); if (Date.now() - t0 > timeoutMs) throw new Error('timed out waiting for ' + what); await new Promise((r) => setTimeout(r, 20)); } };
  await until(() => $('refresh') && !$('refresh').hidden && !$('refresh').disabled, 'the page to load');
  const before = store['scan/latest'] && store['scan/latest'].at;
  $('refresh').click();
  await until(() => $('progWrap').hidden && calls.length && !$('banner').hidden, 'the page refresh to finish');
  const banner = $('banner').textContent;
  w.close();
  const saved = store['scan/latest'] && store['scan/latest'].at !== before;
  return { docs: saved ? store : null, banner, calls };
}
module.exports = { runPage, answer };
