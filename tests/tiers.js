/* The 4H and 1H tiers must be the page's own 8H tier code with only the candle length, field prefix and wording changed.
   Turns each copy back (prefix, wording, candle length) and checks it is the original 8H block character for character,
   then checks the built scan has every tier on every row. usage: node tests/tiers.js */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const ref = fs.readFileSync(path.join(ROOT, 'reference/index.original.html'), 'utf8');
const END = '    return { coin, dominance };\n  })();\n';
const block = (s, head) => { const a = s.indexOf(head); if (a < 0) return ''; const b = s.indexOf('    return { coin, dominance };\n  })(', a); const e = s.indexOf('\n', b + 34) + 1; return s.slice(a, e); };
const t8 = block(ref, '  const T8 = (() => {');
let bad = 0;
for (const h of [4, 1]) {
  let s = block(page, `  const T${h} = ((TSPAN) => {`);
  s = s.replace(/^  const T\d+ = \(\(TSPAN\) => \{ \/\*[^*]*\*\//, '  const T8 = (() => {').replace(`})(${h} * 3600);\n`, '})();\n');
  s = s.split(`Broke above more than ${3 * h} h ago`).join('Broke above more than 24 h ago').split(`Broke below more than ${3 * h} h ago`).join('Broke below more than 24 h ago');
  s = s.split('TSPAN').join('H8').split(`h${h}_`).join('h8_').split(`${h}H`).join('8H');
  if (s !== t8) { bad++; console.error(`${h}H tier differs from the 8H tier code`); } else console.log(`${h}H tier = 8H tier code (only candle length, prefix and wording changed)`);
}
const scanFile = path.join(ROOT, 'public/scan.json');
if (fs.existsSync(scanFile)) {
  const d = JSON.parse(fs.readFileSync(scanFile, 'utf8')).docs, head = d['scan/latest'];
  const rows = [...Array(head.chunked).keys()].flatMap((k) => d['scanrows/c' + k].rows);
  for (const p of ['h8', 'h4', 'h1']) {
    const miss = rows.filter((r) => !r[p + '_state']).map((r) => r.coin);
    if (miss.length) { bad++; console.error(`${p}: no state for ${miss.join(', ')}`); }
  }
  const noData = rows.filter((r) => /^No (4|1)H data/.test(r.h4_state + r.h1_state)).map((r) => r.coin);
  console.log(`scan: ${rows.length} rows; 4H/1H missing data: ${noData.length ? noData.join(', ') : 'none'}`);
}
process.exit(bad ? 1 : 0);
