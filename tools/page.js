/* Breakout Radar page for Cloudflare = the ORIGINAL claude.ai page (reference/index.original.html, checksummed) plus a fixed,
   counted list of edits. Nothing else changes; the scoring engine (scanAll, addOdds, the 8H tier) is untouched.
   Edits (owner, 27 Nov 2026):
     1. Watch list: XMR, LEO, XAUT, LIT removed (no Market-Data series). 31 coins + TOTAL2ES + STABLE.C. LIST_V watch-2.
     2. Data-source wording: Market-Data, not TradingView (the page here never calls TradingView; GitHub runs its Refresh).
     3. 4H and 1H early-warning tiers. They are the page's own 8H tier code, copied with only the candle length,
        field prefix (h4_ / h1_) and wording changed: a closed 4H (1H) candle beyond the coin's 1D level by 0.25x ATR(14),
        volume >= 1.5x, RSI on the breakout side of 50, no divergence, stablecoin filter; Failed = back inside within two
        candles; fresh = last three closed candles (12 h on 4H, 3 h on 1H). Computed for every coin (no shortlist).
        The page's own Refresh pulls 300 4H and 300 1H candles per coin for them (answered from Market-Data on GitHub).
     4. Show the tiers: 1H / 4H / 8H switch on the early-warnings card, 4H and 1H tiles, 4H and 1H columns on the board,
        4H and 1H lines in the coin detail.
   usage: node tools/page.js          check public/index.html = edits(reference) + shim.js + cloud.js (exit 1 if not)
          node tools/page.js --write  rebuild public/index.html */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const ref = fs.readFileSync(path.join(ROOT, 'reference/index.original.html'));
const want = fs.readFileSync(path.join(ROOT, 'reference/PAGE_SHA256SUMS'), 'utf8').trim().split(/\s+/)[0];
const sum = crypto.createHash('sha256').update(ref).digest('hex');
if (sum !== want) { console.error('reference/index.original.html changed: ' + sum + ' != ' + want); process.exit(1); }
let src = ref.toString('utf8');
let n = 0;
function rep(old, neu, count = 1) {
  const k = src.split(old).length - 1;
  if (k !== count) { console.error(`PAGE EDIT FAILED (${k} matches, wanted ${count}): ${old.slice(0, 90)}`); process.exit(1); }
  src = src.split(old).join(neu); n++;
}

/* 1. watch list */
for (const c of ['["xmr", "XMR", "KUCOIN:XMRUSDT"], ', '["leo", "LEO", "OKX:LEOUSDT"], ', '["xaut", "XAUT", null], ', '["lit", "LIT", "BYBIT:LITUSDT"], ']) rep(c, '');
rep('/* your fixed watch list (no screener): 35 coins', '/* your fixed watch list (no screener): 31 coins (XMR, LEO, XAUT, LIT removed 27 Nov 2026: not in Market-Data)');
rep('Your watch list of 35 coins plus two gauges', 'Your watch list of 31 coins plus two gauges');
rep("const LIST_V = 'watch-1';", "const LIST_V = 'watch-2';");
rep('Three stages: <b>8H</b> early warning, <b>1D</b> confirmation, <b>1W</b> trend filter.', 'Stages: <b>1H</b>, <b>4H</b> and <b>8H</b> early warnings, <b>1D</b> confirmation, <b>1W</b> trend filter.');

/* 2. data-source wording */
rep('Nothing is pulled from TradingView until you press Refresh.', 'All candles come from your Market-Data repo.');
const li = src.match(/<li><b>Saved scans\.<\/b>.*?<\/li>/)[0];
rep(li, '<li><b>Data.</b> Every candle comes from your <b>Market-Data</b> GitHub repo, the shared store of all your dashboards: Binance spot USDT pairs (1H, 4H, 1D) for the coins, the TradingView gauges uploaded from your PC (1H, 4H) for TOTAL2ES, STABLE.C, USDT.D and USDC.D. Closed candles only: daily bars are Market-Data\'s closed days (the gauges\' days are built from their 4H candles once the 20:00 UTC candle has closed), 8H bars are pairs of 4H candles at 00, 08 and 16 UTC. No TradingView calls. GitHub rebuilds the radar on its own whenever Market-Data gets new candles; <b>Refresh</b> asks GitHub to rebuild now (about a minute), and the strip under the title shows how old each series is.</li>\n      <li><b>4H and 1H early warnings.</b> The same test as the 8H tier on a closed 4H or 1H candle, against the same 1D levels: through the level by at least a quarter of that timeframe\'s ATR, on 1.5× volume, RSI on the breakout side of 50, no divergence, held at Weak while stablecoin dominance breaks up. Fresh = the last three closed candles (12 hours on 4H, 3 hours on 1H). They are scored for every coin. 1H is the earliest and noisiest heads-up; 4H is where entries are refined.</li>');
rep("Press <b>Refresh from TradingView</b> to run the first scan. It takes 5 to 7 minutes and is saved for next time.", "Press <b>Refresh</b> to ask GitHub to build the first scan from Market-Data.");

/* 3. 4H and 1H tiers: copies of the page's own 8H tier */
const a = src.indexOf('  const T8 = (() => {'), bEnd = '    return { coin, dominance };\n  })();\n', b = src.indexOf(bEnd, a);
if (a < 0 || b < 0) { console.error('PAGE EDIT FAILED: 8H tier block not found'); process.exit(1); }
const t8 = src.slice(a, b + bEnd.length);
function tier(hrs) {
  let s = t8.split('H8').join('TSPAN').split('h8_').join(`h${hrs}_`).split('8H').join(`${hrs}H`)
    .split('Broke above more than 24 h ago').join(`Broke above more than ${3 * hrs} h ago`).split('Broke below more than 24 h ago').join(`Broke below more than ${3 * hrs} h ago`);
  return s.replace('  const T8 = (() => {', `  const T${hrs} = ((TSPAN) => { /* ${hrs}H tier: the page's 8H tier code on ${hrs}H candles (Cloudflare edit 3) */`)
    .replace(/\}\)\(\);\n$/, `})(${hrs} * 3600);\n`);
}
src = src.slice(0, b + bEnd.length) + tier(4) + tier(1) + src.slice(b + bEnd.length); n++;
rep("  const fetch8 = (sym) => fetchRaw(sym, '480', 300);\n",
  "  const fetch8 = (sym) => fetchRaw(sym, '480', 300);\n  const fetch4 = (sym) => fetchRaw(sym, '240', 300), fetch1 = (sym) => fetchRaw(sym, '60', 300);\n  const LOW = { h4: {}, h1: {} }; /* 4H and 1H bars of the current refresh (Cloudflare edit 3) */\n  const lowTier = (p, T, bars, r, dom) => (bars ? T.coin(bars, r, dom) : { [p + '_state']: 'No ' + p.slice(1) + 'H data', [p + '_kind']: 'none', [p + '_dir']: '' });\n");
rep(`    if (got.length || (dom.G.usdt && dom.G.usdc)) {
      $('progText').textContent = 'Scoring and saving…';`,
`    /* 4H and 1H tiers: every coin that loaded (Cloudflare edit 3) */
    LOW.h4 = {}; LOW.h1 = {};
    for (let i = 0; i < pre.length && !stopped; i++) {
      const r = pre[i], t = universeList.find((x) => x[0] === r.id);
      $('progText').textContent = \`Loading \${r.coin} 4H and 1H (\${i + 1} of \${pre.length})…\`;
      for (const [k, fn] of [['h4', fetch4], ['h1', fetch1]]) {
        const e = await pull(fn, t[2]);
        if (e.data) LOW[k][r.id] = e.data; else if (e.fatal) { stopped = e.fatal; break; }
        await sleep(GAP_MS);
      }
    }
    if (got.length || (dom.G.usdt && dom.G.usdc)) {
      $('progText').textContent = 'Scoring and saving…';`);
rep("    fresh.forEach((r) => Object.assign(r, B8[r.id] ? T8.coin(B8[r.id], r, dom) : shortIds.has(r.id) ? { h8_state: 'No 8H data', h8_kind: 'none', h8_dir: '' } : SKIP8));\n",
  "    fresh.forEach((r) => Object.assign(r, B8[r.id] ? T8.coin(B8[r.id], r, dom) : shortIds.has(r.id) ? { h8_state: 'No 8H data', h8_kind: 'none', h8_dir: '' } : SKIP8));\n    fresh.forEach((r) => Object.assign(r, lowTier('h4', T4, LOW.h4[r.id], r, dom), lowTier('h1', T1, LOW.h1[r.id], r, dom)));\n");

/* 4. show the tiers */
rep(`      <div class="tile dn"><span>8H early breakdown</span><b>\${S.early_dn ?? '–'}</b></div>`,
`      <div class="tile dn"><span>8H early breakdown</span><b>\${S.early_dn ?? '–'}</b></div>
      <div class="tile up"><span>4H early breakout</span><b>\${lowCount(rows, 'h4', 'up')}</b></div>
      <div class="tile dn"><span>4H early breakdown</span><b>\${lowCount(rows, 'h4', 'dn')}</b></div>
      <div class="tile up"><span>1H early breakout</span><b>\${lowCount(rows, 'h1', 'up')}</b></div>
      <div class="tile dn"><span>1H early breakdown</span><b>\${lowCount(rows, 'h1', 'dn')}</b></div>`);
rep('  function early(rows) {\n', `  let TIER = 8; /* early-warnings switch: 8, 4 or 1 (Cloudflare edit 4) */
  const lowCount = (rows, p, d) => (rows.some((r) => r[p + '_kind'] != null) ? rows.filter((r) => r[p + '_kind'] === 'early' && r[p + '_dir'] === d).length : '–');
  const lowCls = (r, p) => { const k = r[p + '_kind'], d = r[p + '_dir']; return k === 'early' || k === 'weak' || k === 'near' || k === 'beyond' ? (d === 'up' ? 'up' : 'dn') : k === 'fail' ? 'warn' : ''; };
  /* the 8H card, shown for the chosen timeframe: the chosen tier's fields are read in place of the 8H ones */
  function early(rows) {
    const chips = '<div class="chips" style="margin:2px 0 4px">' + [8, 4, 1].map((t) => \`<button class="chip" data-tier="\${t}" aria-pressed="\${TIER === t}">\${t}H</button>\`).join('') + '</div>';
    if (TIER === 8) return early8(rows).replace('</h2>', '</h2>' + chips);
    const p = 'h' + TIER + '_', view = rows.map((r) => { const o = Object.assign({}, r); for (const k of Object.keys(r)) if (k.startsWith(p)) o['h8_' + k.slice(p.length)] = r[k]; if (o.h8_ago != null) o.h8_ago = o.h8_ago * TIER / 8; return o; });
    return early8(view).split('8H').join(TIER + 'H').replace('in the last 24 hours', 'in the last ' + 3 * TIER + ' hours').replace('</h2>', '</h2>' + chips);
  }
  function early8(rows) {
`);
rep("  document.addEventListener('click', (e) => {\n", "  document.addEventListener('click', (e) => { const tb = e.target.closest('[data-tier]'); if (tb) { TIER = +tb.dataset.tier; render(); } });\n  document.addEventListener('click', (e) => {\n");
rep("['h8_state', '8H'], ", "['h8_state', '8H'], ['h4_state', '4H'], ['h1_state', '1H'], ");
rep("['coin', 'signal', 'h8_state', ", "['coin', 'signal', 'h8_state', 'h4_state', 'h1_state', ");
rep("<td><span class=\"pill ${kindCls(r)}\">${esc(r.h8_state || '–')}</span></td>",
  "<td><span class=\"pill ${kindCls(r)}\">${esc(r.h8_state || '–')}</span></td><td><span class=\"pill ${lowCls(r, 'h4')}\">${esc(r.h4_state || '–')}</span></td><td><span class=\"pill ${lowCls(r, 'h1')}\">${esc(r.h1_state || '–')}</span></td>");
rep("        <div><b>1D pattern</b><span>${esc(r.d_pattern || '–')}</span></div>",
  "        <div><b>4H signal</b><span>${esc(r.h4_state || '–')}</span></div><div><b>4H RSI · vol</b><span>${r.h4_rsi == null ? '–' : r.h4_rsi.toFixed(0)} · ${r.h4_vol_x == null ? '–' : r.h4_vol_x.toFixed(1) + '×'}</span></div>\n        <div><b>1H signal</b><span>${esc(r.h1_state || '–')}</span></div><div><b>1H RSI · vol</b><span>${r.h1_rsi == null ? '–' : r.h1_rsi.toFixed(0)} · ${r.h1_vol_x == null ? '–' : r.h1_vol_x.toFixed(1) + '×'}</span></div>\n        <div><b>1D pattern</b><span>${esc(r.d_pattern || '–')}</span></div>");
rep("      ${r.h8_why ? `<p class=\"note\"><b>8H:</b> ${esc(r.h8_why)}</p>` : ''}",
  "      ${r.h8_why ? `<p class=\"note\"><b>8H:</b> ${esc(r.h8_why)}</p>` : ''}${r.h4_why ? `<p class=\"note\"><b>4H:</b> ${esc(r.h4_why)}</p>` : ''}${r.h1_why ? `<p class=\"note\"><b>1H:</b> ${esc(r.h1_why)}</p>` : ''}");

/* shim before the page script, Refresh + freshness strip at the end */
rep('<script>\n(function () {\n  /* your fixed watch list', '<script src="shim.js"></script>\n<script>\n(function () {\n  /* your fixed watch list');
const out = src.replace(/<\/body><\/html>\s*$/, '<script src="cloud.js"></script>\n</body></html>\n');
if (out === src) { console.error('PAGE EDIT FAILED: page end not found'); process.exit(1); }
const file = path.join(ROOT, 'public/index.html');
if (process.argv.includes('--write')) fs.writeFileSync(file, out);
if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== out) { console.error('public/index.html is not the original page plus the listed edits; run node tools/page.js --write'); process.exit(1); }
console.log(`Page = original ${sum.slice(0, 12)} + ${n} edits + shim.js + cloud.js`);
module.exports = { built: out };
