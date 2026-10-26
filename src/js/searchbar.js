// Food search for every search box on the site, plus the header menu.
// Suggestions appear as you type, ranked like the rest of PregNut (everyday
// foods first), with the typed part plain and the completion bold. On phones
// a search box opens a full-screen sheet: the field sits at the top and the
// suggestions fill the space above the keyboard.

(function () {
  var INDEX_URL = "/resource/search.v1.json";
  var RECENT_KEY = "pregnut.search.recent.v1";
  var LIMIT = 8;
  var POPULAR = ["Eggs", "Salmon", "Spinach", "Lentils", "Greek yogurt", "Avocado"];
  var phone = window.matchMedia("(max-width: 700px)");

  var indexPromise = null;
  var entries = [];
  var uid = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function normalize(s) {
    return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9%]+/g, " ").trim();
  }

  // entry: [label, url, image, rank, aliases]
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(INDEX_URL)
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(function (rows) {
          entries = rows.map(function (r) {
            var label = normalize(r[0]);
            return { label: r[0], url: r[1], image: r[2], rank: r[3], norm: label, words: (label + " " + normalize(r[4])).split(" "), alias: " " + normalize(r[4]) + " " };
          });
          return entries;
        });
      indexPromise.catch(function () { indexPromise = null; });
    }
    return indexPromise;
  }

  function search(query, limit) {
    var q = normalize(query);
    if (!q) return [];
    var tokens = q.split(" ");
    var hits = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var ok = true;
      for (var t = 0; t < tokens.length && ok; t++) {
        var token = tokens[t];
        var stem = token.length > 3 ? token.replace(/(es|s)$/, "") : token;
        ok = false;
        for (var w = 0; w < e.words.length; w++) {
          if (e.words[w].indexOf(token) === 0 || e.words[w].indexOf(stem) === 0) { ok = true; break; }
        }
      }
      if (!ok) continue;
      var score = e.rank * 10 - e.norm.length / 12;
      if (e.alias.indexOf(" " + q + " ") !== -1) score += 30;
      if (e.norm.indexOf(q) === 0) score += 12;
      if (e.words[0] === tokens[0] || e.words[0] === tokens[0] + "s") score += 8;
      hits.push({ e: e, score: score });
    }
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, limit || LIMIT).map(function (h) { return h.e; });
  }

  // Like Google: what you typed stays plain, the rest of the suggestion is bold.
  function highlight(label, query) {
    var tokens = normalize(query).split(" ").filter(Boolean);
    var frag = document.createDocumentFragment();
    label.split(/(\s+)/).forEach(function (part) {
      var plain = normalize(part);
      var typed = 0;
      tokens.forEach(function (t) { if (plain.indexOf(t) === 0 && t.length > typed) typed = t.length; });
      if (!typed || /^\s+$/.test(part)) { frag.appendChild(part.trim() ? el("b", "", part) : document.createTextNode(part)); return; }
      // Map the normalized length back onto the original characters.
      var cut = 0, seen = 0;
      while (cut < part.length && seen < typed) { if (/[a-z0-9%]/i.test(part[cut])) seen++; cut++; }
      frag.appendChild(document.createTextNode(part.slice(0, cut)));
      if (cut < part.length) frag.appendChild(el("b", "", part.slice(cut)));
    });
    return frag;
  }

  function recent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 5); } catch (e) { return []; }
  }

  function remember(text) {
    try {
      var list = recent().filter(function (r) { return r.toLowerCase() !== text.toLowerCase(); });
      list.unshift(text);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
    } catch (e) {}
  }

  function resultsUrl(query) {
    return "/food/?q=" + encodeURIComponent(query.trim());
  }

  var ICONS = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    recent: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    fill: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // One suggestion list bound to one input. Used by the desktop dropdowns and
  // by the phone sheet.
  function Suggest(input, list, onFill) {
    var self = this;
    var active = -1;
    var rows = [];
    list.id = list.id || "SearchSuggest" + (++uid);
    list.setAttribute("role", "listbox");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("enterkeyhint", "search");

    function option(className, href, label) {
      var li = el("li", "sg-row " + className);
      li.id = list.id + "-" + list.children.length;
      li.setAttribute("role", "option");
      var link = el("a", "sg-link");
      link.href = href;
      link.tabIndex = -1;
      link.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
      link.addEventListener("click", function () { remember(label); });
      li.appendChild(link);
      list.appendChild(li);
      rows.push({ li: li, href: href, label: label });
      return link;
    }

    function textRow(icon, text, query, fillable) {
      var link = option(icon === "recent" ? "is-recent" : "is-query", resultsUrl(query), query);
      link.insertAdjacentHTML("afterbegin", '<span class="sg-icon">' + ICONS[icon] + "</span>");
      link.appendChild(el("span", "sg-text", text));
      if (fillable) addFill(link.parentNode, query);
    }

    // The arrow on the right puts a suggestion into the field to refine it.
    function addFill(li, text) {
      var fill = el("button", "sg-fill");
      fill.type = "button";
      fill.tabIndex = -1;
      fill.setAttribute("aria-label", "Use “" + text + "”");
      fill.innerHTML = ICONS.fill;
      fill.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
      fill.addEventListener("click", function () { input.value = text + " "; input.focus(); self.update(); if (onFill) onFill(); });
      li.appendChild(fill);
    }

    this.update = function () {
      var query = input.value;
      list.textContent = "";
      rows = [];
      active = -1;
      input.removeAttribute("aria-activedescendant");
      if (!query.trim()) {
        var past = recent();
        past.forEach(function (text) { textRow("recent", text, text, true); });
        POPULAR.filter(function (p) { return past.indexOf(p) === -1; }).slice(0, Math.max(0, 6 - past.length))
          .forEach(function (text) { textRow("search", text, text, true); });
      } else {
        search(query).forEach(function (e) {
          var link = option("is-food", e.url, e.label);
          if (e.image) {
            var img = el("img", "sg-pic");
            img.src = e.image;
            img.alt = "";
            img.width = 80;
            img.height = 80;
            img.decoding = "async";
            link.appendChild(img);
          } else {
            var letter = el("span", "sg-pic is-letter", e.label.charAt(0).toUpperCase());
            letter.setAttribute("aria-hidden", "true");
            link.appendChild(letter);
          }
          var text = el("span", "sg-text");
          text.appendChild(highlight(e.label, query));
          link.appendChild(text);
          addFill(link.parentNode, e.label);
        });
        textRow("search", "Search for “" + query.trim() + "”", query.trim(), false);
      }
      var open = rows.length > 0;
      list.hidden = !open;
      input.setAttribute("aria-expanded", String(open));
    };

    function move(step) {
      if (!rows.length) return;
      if (active >= 0) rows[active].li.classList.remove("is-active");
      // -1 is the field itself, between the last row and the first.
      active += step;
      if (active >= rows.length) active = -1;
      else if (active < -1) active = rows.length - 1;
      if (active >= 0) {
        rows[active].li.classList.add("is-active");
        rows[active].li.scrollIntoView({ block: "nearest" });
        input.setAttribute("aria-activedescendant", rows[active].li.id);
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }

    this.submit = function () {
      var query = input.value.trim();
      if (active >= 0) {
        remember(rows[active].label);
        window.location.href = rows[active].href;
        return true;
      }
      if (!query) return false;
      remember(query);
      // An exact name match opens the food; anything else lists results.
      var exact = search(query).filter(function (e) { return normalize(e.label) === normalize(query); })[0];
      window.location.href = exact ? exact.url : resultsUrl(query);
      return true;
    };

    this.close = function () {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    };

    input.addEventListener("input", function () { loadIndex().then(self.update); });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { move(1); ev.preventDefault(); }
      else if (ev.key === "ArrowUp") { move(-1); ev.preventDefault(); }
      else if (ev.key === "Enter") { ev.preventDefault(); self.submit(); }
    });
  }

  // Phone sheet ------------------------------------------------------------

  var sheet = null;

  function buildSheet() {
    var root = el("div", "search-sheet");
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Search foods");
    var bar = el("form", "search-sheet-bar");
    bar.setAttribute("role", "search");
    bar.action = "/food/";
    bar.method = "get";
    bar.insertAdjacentHTML("afterbegin", '<span class="search-sheet-icon">' + ICONS.search + "</span>");
    var label = el("label", "sr-only", "Search a food");
    label.htmlFor = "SearchSheetInput";
    bar.appendChild(label);
    var input = el("input", "search-sheet-input");
    input.id = "SearchSheetInput";
    input.type = "search";
    input.name = "q";
    input.placeholder = "Search a food";
    bar.appendChild(input);
    var cancel = el("button", "search-sheet-cancel", "Cancel");
    cancel.type = "button";
    bar.appendChild(cancel);
    root.appendChild(bar);
    var list = el("ul", "search-sheet-list sg-list");
    root.appendChild(list);
    document.body.appendChild(root);

    var suggest = new Suggest(input, list);
    bar.addEventListener("submit", function (ev) { ev.preventDefault(); suggest.submit(); });
    cancel.addEventListener("click", function () { closeSheet(true); });
    root.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeSheet(true); });
    // Tapping the list on a phone hides the keyboard so more results show.
    list.addEventListener("touchstart", function () { input.blur(); }, { passive: true });

    sheet = { root: root, input: input, list: list, suggest: suggest, pushed: false };
    return sheet;
  }

  // Keep the sheet exactly the size of what's visible above the keyboard.
  function fitSheet() {
    if (!sheet || sheet.root.hidden) return;
    var vv = window.visualViewport;
    sheet.root.style.height = (vv ? vv.height : window.innerHeight) + "px";
    sheet.root.style.top = (vv ? vv.offsetTop : 0) + "px";
  }

  function openSheet(seed) {
    var s = sheet || buildSheet();
    s.input.value = seed || "";
    s.root.hidden = false;
    document.documentElement.classList.add("is-searching");
    fitSheet();
    // Focus inside the tap so phones raise the keyboard.
    s.input.focus({ preventScroll: true });
    if (seed) s.input.setSelectionRange(seed.length, seed.length);
    loadIndex().then(s.suggest.update);
    s.suggest.update();
    // The back button closes the sheet instead of leaving the page.
    try { history.pushState({ pregnutSearch: 1 }, ""); s.pushed = true; } catch (e) { s.pushed = false; }
  }

  function closeSheet(viaHistory) {
    if (!sheet || sheet.root.hidden) return;
    sheet.root.hidden = true;
    sheet.input.blur();
    document.documentElement.classList.remove("is-searching");
    if (viaHistory && sheet.pushed) { sheet.pushed = false; history.back(); }
  }

  window.addEventListener("popstate", function () {
    if (sheet && !sheet.root.hidden) { sheet.pushed = false; closeSheet(false); }
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fitSheet);
    window.visualViewport.addEventListener("scroll", fitSheet);
  }

  // Any search box ----------------------------------------------------------

  // Desktop: suggestions drop down under the field. Phone: the field opens the
  // sheet, carrying over anything already typed.
  function attach(input) {
    if (!input || input.dataset.searchReady) return;
    input.dataset.searchReady = "1";
    var form = input.form;
    var list = el("ul", "sg-list is-dropdown");
    list.hidden = true;
    (form || input.parentNode).appendChild(list);
    var suggest = new Suggest(input, list);

    input.addEventListener("pointerdown", function (ev) {
      if (!phone.matches) { loadIndex(); return; }
      ev.preventDefault();
    });
    input.addEventListener("click", function () { if (phone.matches) openSheet(input.value); });
    input.addEventListener("focus", function () {
      if (phone.matches) { input.blur(); openSheet(input.value); return; }
      loadIndex().then(suggest.update);
      suggest.update();
    });
    input.addEventListener("blur", function () { setTimeout(suggest.close, 120); });
    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (phone.matches) { openSheet(input.value); return; }
        if (!suggest.submit()) input.focus();
      });
    }
  }

  // Header menu -------------------------------------------------------------

  function startNav() {
    var details = document.getElementById("NavCollapse");
    if (!details) return;
    var summary = details.querySelector("summary");
    var menu = window.matchMedia("(max-width: 880px)");

    function sync() { summary.setAttribute("aria-expanded", String(details.open)); }
    function applyMode() { details.open = !menu.matches; sync(); }
    details.addEventListener("toggle", sync);
    if (menu.addEventListener) menu.addEventListener("change", applyMode);
    applyMode();

    details.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { if (menu.matches) details.open = false; });
    });
    document.addEventListener("keydown", function (ev) {
      if (details.open && menu.matches && ev.key === "Escape") { details.open = false; summary.focus(); }
    });
    document.addEventListener("click", function (ev) {
      if (details.open && menu.matches && !details.contains(ev.target)) details.open = false;
    });

    document.querySelectorAll("[data-search-open]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (menu.matches) details.open = false;
        if (phone.matches || menu.matches) openSheet("");
        else document.getElementById("FoodFinderInput").focus();
      });
    });
  }

  function start() {
    document.querySelectorAll("input[data-food-search]").forEach(attach);
    startNav();
  }

  window.PregnutSearch = { attach: attach, open: openSheet, load: loadIndex, search: search };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
