# Breakout Radar

31 coins plus the 13 market gauges of the Structure Shift board (TOTAL2ES, TOTAL3ES, OTHERS, TOTAL, TOTALES, BTCCAP, BTC.D,
USDT.D+USDC.D, USDT.D, ETHBTC, STABLE.C, MEME.C, SPX), scored for an upcoming breakout or breakdown: **1H, 4H and 8H** early warnings,
**1D** confirmation, **1W** trend filter, with chance-of-target and typical days from each coin's own history.

Live (owner login): https://dashboards.mbzazad.workers.dev/breakout/

## How it runs
- **Data: Market-Data only** (`mbzazad-max/market-data`), the shared candle store of every dashboard. This repo never calls
  Binance, TradingView or any connector. `config/board.json` maps every request the page makes to a Market-Data series:
  - Coins: `binance/<SYM>USDT/1D`, `/4H`, `/1H` (Market-Data's own GitHub Binance fetch, every 4 hours, 7 min after each 4H close).
    8H = pairs of closed 4H candles at 00/08/16 UTC. The daily answer ends with today so far, built from today's closed 4H candles.
  - Gauges (added 27 Nov 2026, same 13 as Structure Shift): `tv/CRYPTOCAP_*` 4H and 1H (days and 8H from 4H), USDT.D+USDC.D summed
    candle by candle, ETHBTC from `binance/ETHBTC` 4H/1H, SPX from `tv/SP_SPX` 1D/4H/1H (exchange hours, no 8H).
    The TradingView gauges came from the owner's PC; that upload was switched off 26 Nov 2026, so they are frozen until a new source.
  - Removed 27 Nov 2026 (no Market-Data series): XMR, LEO, XAUT, LIT.
- **Build**: `.github/workflows/build.yml` runs when Market-Data imports a series the radar uses (dispatched by Market-Data, see its
  `dashboards.json`), on the Refresh button, daily at 01:20 UTC and on pushes. `build/build.js` runs the page in jsdom
  (`build/runpage.js`) and presses its own Refresh; the page's TradingView requests are answered from Market-Data, so every score
  is worked out by the page itself. Writes `public/scan.json` (the page's saved documents) and `public/freshness.json`.
  Skips when no input changed; keeps the last good scan on any failure.
- **Page**: `public/index.html` = the claude.ai artifact (Breakout Monitor, https://claude.ai/artifact/Lu9ETgA4dgPwTxVV1JoKBv,
  version 1794010041, the TradingView version; `reference/index.original.html`, checksum in `reference/PAGE_SHA256SUMS`) plus the
  counted edits in `tools/page.js` (watch list, Market-Data wording, 4H/1H tiers and their display) + `shim.js` (read-only
  database from scan.json) + `cloud.js` (Refresh, freshness strip, "← Dashboards").
- **4H / 1H tiers** (added 27 Nov 2026): the page's own 8H tier code, copied with only the candle length, field prefix and wording
  changed (`tests/tiers.js` proves it character by character). Scored for every coin against the same 1D levels.
- **Worker**: `worker/index.js` serves `public/` and `/api/refresh` + `/api/status` for the Refresh button (secret GITHUB_TOKEN,
  set by the workflow from MARKET_DATA_TOKEN). `workers_dev` is off: reached only through the home site.

## Checks (every build)
`node tools/page.js` (page = original + listed edits), `node tests/tiers.js` (tiers = 8H code; every row has 1H/4H/8H).

## Secrets
MARKET_DATA_TOKEN (token A, needs this repo added: Actions read/write, Contents read), CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.
