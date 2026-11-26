/* Breakout Radar on Cloudflare: Refresh button (asks GitHub to rebuild from the newest Market-Data candles),
   a freshness strip that flags every series later than its normal schedule, and the "← Dashboards" link.
   Uses the page's own styles (pill, btn, banner, note). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var slug = location.pathname.split('/')[1] || '';
  var API = slug ? '/api/' + slug + '/' : 'api/';
  var bar = document.querySelector('header .status');
  var pill = document.createElement('span'); pill.className = 'pill'; pill.id = 'runState'; pill.hidden = true;
  var btn = document.createElement('button'); btn.className = 'btn'; btn.type = 'button'; btn.id = 'ghRefresh'; btn.textContent = 'Refresh'; btn.hidden = true;
  btn.title = 'Ask GitHub to rebuild the radar from the newest Market-Data candles';
  bar.appendChild(pill); bar.appendChild(btn);
  var strip = document.createElement('div'); strip.className = 'note'; strip.id = 'fresh'; strip.hidden = true;
  document.querySelector('header .top').insertAdjacentElement('afterend', strip);

  var t2s = function (s) { if (!s) return '-'; var d = new Date(s * 1000); return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  function state(text, kind) { pill.hidden = false; pill.className = 'pill ' + (kind || ''); pill.textContent = text; }
  // Binance arrives every 4 hours (1H four at a time), the PC gauges every 4 hours: allow one fetch cycle before flagging.
  function slack(s) { return s.period_s >= 86400 ? 1 : Math.ceil(4 * 3600 / s.period_s) + 1; }

  function showFresh(F) {
    var now = Date.now() / 1000, rows = F.series.map(function (s) {
      var behind = s.last_close ? Math.max(0, Math.floor((now - s.last_close) / s.period_s)) : null;
      return { s: s, behind: behind, flag: behind === null || behind > slack(s) };
    });
    var flagged = rows.filter(function (r) { return r.flag; });
    var head = 'Built ' + esc(F.generated) + ' from Market-Data · ' + rows.length + ' series, ' +
      (flagged.length ? '<b>' + flagged.length + ' later than their normal schedule</b>' : 'all on schedule');
    if (F.failed && F.failed.length) head += ' · not loaded: ' + F.failed.map(esc).join(', ');
    var body = rows.map(function (r) {
      var s = r.s, st = r.behind === null ? 'no data' : r.behind === 0 ? 'current' : r.behind + ' candle' + (r.behind > 1 ? 's' : '') + ' behind';
      return '<tr' + (r.flag ? ' style="color:var(--dn)"' : '') + '><td>' + esc(s.id) + '</td><td class="num">' + esc(t2s(s.last_close)) + '</td><td>' + st + '</td></tr>';
    }).join('');
    strip.hidden = false;
    strip.innerHTML = '<details><summary>' + head + '</summary><div class="scroll" style="max-height:320px"><table style="margin-top:8px"><thead><tr><th>Market-Data series</th>' +
      '<th>Last closed candle (your time)</th><th>Status</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<p class="note" style="margin-top:6px">' + esc(F.last_result || '') + ' Binance candles arrive every 4 hours, 7 minutes after each 4H close; the gauges come from your PC every 4 hours.</p></details>';
  }
  fetch('freshness.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (F) { if (F) showFresh(F); }).catch(function () {});

  var polling = null;
  function poll(startedAt) {
    clearTimeout(polling);
    fetch(API + 'status', { cache: 'no-store', redirect: 'manual', credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('no access'); return r.json(); }).then(function (s) {
      btn.hidden = false;
      if (s.status && s.status !== 'completed') { state('Rebuilding…', 'warn'); btn.disabled = true; polling = setTimeout(function () { poll(startedAt || Date.now()); }, 8000); return; }
      btn.disabled = false;
      if (!startedAt) return;
      if (s.conclusion === 'success') { state('Done ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 'up'); setTimeout(function () { location.reload(); }, 1500); }
      else state('Refresh failed, last good scan kept', 'dn');
    }).catch(function () { btn.disabled = false; if (startedAt) state('Could not check progress', 'warn'); else btn.hidden = true; });
  }
  btn.addEventListener('click', function () {
    btn.disabled = true; state('Starting…', '');
    fetch(API + 'refresh', { method: 'POST', redirect: 'manual', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); })
      .then(function () { state('Rebuilding…', 'warn'); setTimeout(function () { poll(Date.now()); }, 5000); })
      .catch(function (e) { btn.disabled = false; state('Refresh not started: ' + e.message, 'dn'); });
  });
  poll(0);

  var a = document.createElement('a'); a.href = '/'; a.textContent = '← Dashboards'; a.className = 'note'; a.style.textDecoration = 'none';
  var w = document.querySelector('.wrap'); w.insertBefore(a, w.firstChild);
})();
