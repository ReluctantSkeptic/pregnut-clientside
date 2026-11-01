/* PregNut: registers the service worker and shows a small install bar. */
(function () {
  'use strict';
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
  var KEY = 'pwa-install-dismissed-until', DAYS = 30;
  var SKIP = ["/contact"];
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function snoozed() { try { return Number(localStorage.getItem(KEY) || 0) > Date.now(); } catch (e) { return false; } }
  function snooze() { try { localStorage.setItem(KEY, String(Date.now() + DAYS * 864e5)); } catch (e) {} }
  if (standalone() || snoozed()) return;
  function skipped() { return SKIP.some(function (p) { return location.pathname === p || location.pathname.indexOf(p + '/') === 0; }); }
  if (skipped()) return;
  var ua = navigator.userAgent;
  var ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var iosSafari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV/.test(ua);
  var AVOID = [".cookie-banner",".home-mobile-cta",".df-toast",".df-fab"];
  var COVER = [".search-sheet",".caution-popover"];
  var deferred = null, host = null, bar = null, timer = null;
  function whenEngaged(cb) {
    var done = false, t;
    function go() { if (done) return; done = true; clearTimeout(t); window.removeEventListener('scroll', go); cb(); }
    t = setTimeout(go, 4000);
    window.addEventListener('scroll', go, { passive: true });
  }
  function hide() {
    if (!bar) return;
    bar.classList.remove('in'); clearInterval(timer);
    window.removeEventListener('resize', lift); window.removeEventListener('scroll', lift);
    var h = host; host = bar = null;
    setTimeout(function () { if (h && h.parentNode) h.parentNode.removeChild(h); }, 400);
  }
  function show() {
    if (bar || standalone() || snoozed() || (!deferred && !iosSafari)) return;
    host = document.createElement('div');
    host.setAttribute('data-pwa-install', '');
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var style = document.createElement('style');
    style.textContent = ":host{all:initial}\n.bar{position:fixed;z-index:2147483000;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));transform:translate(-50%,16px);opacity:0;width:min(420px,calc(100vw - 24px));box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:10px 10px 10px 12px;background:#fffefb;color:#263038;border:1px solid rgba(38,48,56,0.14);border-radius:20px;box-shadow:0 1px 2px rgba(38,48,56,0.04), 0 18px 50px rgba(38,48,56,0.16);font-family:\"Funnel Sans\",system-ui,-apple-system,\"Segoe UI\",sans-serif;-webkit-font-smoothing:antialiased;transition:transform .35s cubic-bezier(.2,.8,.2,1),opacity .35s ease}\n.bar.in{transform:translate(-50%,0);opacity:1}\n@media (min-width:768px){.bar{bottom:calc(20px + env(safe-area-inset-bottom,0px))}}\n.ic{width:38px;height:38px;border-radius:0px;flex:none;display:block}\n.tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}\n.nm{font-size:15px;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:\"Funnel Display\",\"Funnel Sans\",system-ui,sans-serif;}\n.hint{font-size:12.5px;line-height:1.25;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.go{flex:none;font:inherit;font-size:14px;font-weight:650;line-height:1;padding:11px 16px;border:0;border-radius:999px;background:#315f56;color:#fffefb;cursor:pointer;}\n.go:hover{filter:brightness(1.06)}\n.x{flex:none;width:34px;height:34px;display:grid;place-items:center;padding:0;border:0;border-radius:999px;background:transparent;color:inherit;opacity:.6;cursor:pointer}\n.x:hover{opacity:1;background:#e9e5da}\nbutton:focus-visible{outline:2px solid #244940;outline-offset:2px}\n.bar.off{display:none}\n@media (prefers-reduced-motion:reduce){.bar{transition:none}}";
    bar = document.createElement('div');
    bar.className = 'bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Install PregNut');
    bar.innerHTML = '<img class="ic" src="/pwa/icon-192.png" alt="" width="38" height="38">' +
      '<div class="tx"><span class="nm">PregNut</span>' + (deferred ? '' : '<span class="hint">Share, then Add to Home Screen</span>') + '</div>' +
      (deferred ? '<button type="button" class="go">Install</button>' : '') +
      '<button type="button" class="x" aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>';
    root.appendChild(style); root.appendChild(bar);
    document.body.appendChild(host);
    var go = bar.querySelector('.go');
    if (go) go.addEventListener('click', function () {
      var p = deferred; deferred = null; if (!p) return hide();
      p.prompt();
      (p.userChoice || Promise.resolve({})).then(function (c) { if (c && c.outcome !== 'accepted') snooze(); hide(); }, hide);
    });
    bar.querySelector('.x').addEventListener('click', function () { snooze(); hide(); });
    lift();
    window.addEventListener('resize', lift); window.addEventListener('scroll', lift, { passive: true });
    timer = setInterval(lift, 700);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (bar) bar.classList.add('in'); }); });
  }
  // Keep clear of the site's own fixed bottom bars (cookie notice, sticky CTAs).
  function shown(el) {
    if (el.hidden) return false;
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }
  function lift() {
    if (!bar) return;
    // Step aside on in-app routes that skip the bar and while a dialog or full-screen player is open.
    bar.classList.toggle('off', skipped() || COVER.some(function (sel) { return Array.prototype.some.call(document.querySelectorAll(sel), shown); }));
    var top = window.innerHeight;
    AVOID.forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
        if (el.hidden) return;
        var cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || (cs.position !== 'fixed' && cs.position !== 'sticky')) return;
        var r = el.getBoundingClientRect();
        if (r.height < 1 || r.bottom < window.innerHeight - 4) return;
        top = Math.min(top, r.top);
      });
    });
    bar.style.bottom = top < window.innerHeight ? (window.innerHeight - top + 10) + 'px' : '';
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; whenEngaged(show); });
  window.addEventListener('appinstalled', function () { deferred = null; hide(); });
  if (iosSafari) whenEngaged(show);
})();
