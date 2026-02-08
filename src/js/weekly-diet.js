// src/js/weekly-diet.js
// Client-side weekly tracker: maps a selected week to a time period, then ranks foods by %RDA.

(function () {
  var PROTOCOL_URL = "/resource/weekly_protocol.v1.json";
  var FOODDATA_URL = "/resource/pregnut_fooddata.v1.json";
  var STORAGE_KEY = "pregnut.weeklyDiet.v1";
  var GLOBAL_PREFS_KEY = "pregnut.foodPrefs.v1";

  var PRIORITY_LABEL = {
    high: "High priority",
    medium: "Medium priority",
    supporting: "Supporting"
  };

  var PRIORITY_WEIGHT = {
    high: 1.0,
    medium: 0.6,
    supporting: 0.35
  };

  var MAX_WEEK = 40;
  var MIN_WEEK = 1;
  var SCORE_CAP_PERCENT = 100;
  var BAR_CAP_PERCENT = 200;
  var TOP_FOODS_LIMIT = 10;
  var BY_NUTRIENT_LIMIT = 20;

  // Pastel rainbow palette: nutrients are bound to colors in alphabetical order.
  var NUTRIENT_ALPHA = [
    "Calcium",
    "Choline",
    "DHA",
    "Folate (DFE)",
    "Iron",
    "Potassium",
    "Protein",
    "Riboflavin",
    "Vitamin B-12",
    "Vitamin B-6",
    "Vitamin C",
    "Vitamin D",
    "Zinc"
  ];

  var PASTEL_RAINBOW = [
    "#9EC3E6",
    "#8ADDD7",
    "#BFE9F2",
    "#B7E3A1",
    "#D8E08A",
    "#F3D68A",
    "#F5B47A",
    "#EB8A86",
    "#F7B0CF",
    "#F49BB7",
    "#E7C6F5",
    "#CDB7F3",
    "#9AAFD6"
  ];

  var NUTRIENT_COLOR = (function () {
    var map = {};
    for (var i = 0; i < NUTRIENT_ALPHA.length; i++) {
      map[NUTRIENT_ALPHA[i]] = PASTEL_RAINBOW[i] || "#9EC3E6";
    }
    return map;
  })();

  function nutrientColor(nutrientId) {
    return NUTRIENT_COLOR[nutrientId] || "rgba(31, 122, 122, 0.70)";
  }

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function safeNumber(x) {
    var n = Number(x);
    return isFinite(n) ? n : null;
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("Failed to load " + url + " (" + res.status + ")");
      return res.json();
    });
  }

  function readUrlWeek() {
    try {
      var params = new URLSearchParams(window.location.search);
      var w = params.get("week");
      if (!w) return null;
      var n = parseInt(w, 10);
      return isFinite(n) ? clamp(n, MIN_WEEK, MAX_WEEK) : null;
    } catch (e) {
      return null;
    }
  }

  function writeUrlWeek(week) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("week", String(week));
      window.history.replaceState({}, "", url.toString());
    } catch (e) {}
  }

  function loadKey(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function saveKey(key, prefs) {
    try {
      window.localStorage.setItem(key, JSON.stringify(prefs));
    } catch (e) {}
  }

  function loadPrefs() {
    return loadKey(STORAGE_KEY);
  }

  function savePrefs(prefs) {
    saveKey(STORAGE_KEY, prefs);
  }

  function loadGlobalPrefs() {
    return loadKey(GLOBAL_PREFS_KEY);
  }

  function saveGlobalPrefs(prefs) {
    saveKey(GLOBAL_PREFS_KEY, prefs);
  }

  function utcDateFromIso(iso) {
    // iso: YYYY-MM-DD
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;
    return Date.UTC(y, m - 1, d);
  }

  function utcToday() {
    var now = new Date();
    return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function weekFromDueDate(dueIso) {
    var dueUtc = utcDateFromIso(dueIso);
    if (dueUtc === null) return null;
    var daysUntilDue = Math.round((dueUtc - utcToday()) / 86400000);
    var gestationalDays = 280 - daysUntilDue;
    var week = Math.floor(gestationalDays / 7) + 1;
    return clamp(week, MIN_WEEK, MAX_WEEK);
  }

  function formatWeeks(start, end) {
    if (start === end) return "Week " + start;
    return "Weeks " + start + "\u2013" + end;
  }

  function normalizePriority(p) {
    var s = String(p || "").toLowerCase();
    if (s === "high" || s === "medium" || s === "supporting") return s;
    return "supporting";
  }

  function getPeriodForWeek(protocol, week) {
    if (!protocol || !protocol.periods) return null;
    for (var i = 0; i < protocol.periods.length; i++) {
      var p = protocol.periods[i];
      if (!p || !p.weeks) continue;
      if (week >= p.weeks.start && week <= p.weeks.end) return p;
    }
    return protocol.periods[0] || null;
  }

  function buildCitationIndex(protocol) {
    var idx = {};
    if (!protocol || !protocol.sources || !protocol.sources.length) return idx;
    for (var i = 0; i < protocol.sources.length; i++) {
      idx[protocol.sources[i].id] = i + 1;
    }
    return idx;
  }

  function unitToMicro(unit) {
    // returns multiplier to micro-units (mcg) for mass units, or null if unsupported.
    var u = String(unit || "").toLowerCase();
    if (u === "mcg" || u === "\u00b5g") return 1;
    if (u === "mg") return 1000;
    if (u === "g") return 1000 * 1000;
    return null;
  }

  function convertValue(value, fromUnit, toUnit) {
    if (value === null || value === undefined) return null;
    var n = safeNumber(value);
    if (n === null) return null;

    var from = String(fromUnit || "").trim();
    var to = String(toUnit || "").trim();
    if (from === to) return n;

    // Mass conversions: g, mg, mcg
    var fromMicro = unitToMicro(from);
    var toMicro = unitToMicro(to);
    if (fromMicro !== null && toMicro !== null) {
      var microVal = n * fromMicro;
      return microVal / toMicro;
    }

    // IU isn't convertible; require match.
    return null;
  }

  function percentOfRda(fooddata, food, nutrientId) {
    if (!fooddata || !fooddata.nutrients) return null;
    var nInfo = fooddata.nutrients[nutrientId];
    if (!nInfo || !nInfo.rda) return null;
    var rdaVal = safeNumber(nInfo.rda.value);
    if (rdaVal === null || rdaVal <= 0) return null;
    var value = food && food.nutrients ? food.nutrients[nutrientId] : null;
    var v = convertValue(value, nInfo.unit, nInfo.rda.unit);
    if (v === null) return null;
    return (v / rdaVal) * 100;
  }

  function filterFoods(fooddata, opts) {
    var foods = (fooddata && fooddata.foods) ? fooddata.foods : [];
    var out = [];
    for (var i = 0; i < foods.length; i++) {
      var f = foods[i];
      if (!f) continue;
      if (opts && opts.excludeAvoid && String(f.warning || "").toLowerCase() === "avoid") continue;
      if (opts && opts.naturalOnly && Number(f.natSource) !== 1) continue;
      out.push(f);
    }
    return out;
  }

  function scoreFood(fooddata, food, weightedNutrients) {
    var score = 0;
    for (var i = 0; i < weightedNutrients.length; i++) {
      var wn = weightedNutrients[i];
      var pct = percentOfRda(fooddata, food, wn.id);
      if (pct === null) continue;
      score += Math.min(pct, SCORE_CAP_PERCENT) * wn.weight;
    }
    return score;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function closeAllCautions() {
    var open = document.querySelectorAll(".caution[data-open=\"1\"]");
    for (var i = 0; i < open.length; i++) {
      open[i].removeAttribute("data-open");
      try {
        var btn = open[i].querySelector(".caution-trigger");
        if (btn) btn.setAttribute("aria-expanded", "false");
      } catch (e) {}
    }
  }

  function initCautionEvents() {
    if (window.__pregnutWeeklyCautionInit) return;
    window.__pregnutWeeklyCautionInit = true;

    document.addEventListener("click", function (ev) {
      var t = ev && ev.target ? ev.target : null;
      if (!t || !t.closest) return;

      var trigger = t.closest(".caution-trigger");
      if (trigger) {
        ev.preventDefault();
        ev.stopPropagation();
        var wrap = trigger.closest(".caution");
        if (!wrap) return;
        var isOpen = wrap.getAttribute("data-open") === "1";
        closeAllCautions();
        if (!isOpen) {
          wrap.setAttribute("data-open", "1");
          trigger.setAttribute("aria-expanded", "true");
        }
        return;
      }

      // Tap/click anywhere outside closes (mobile-friendly).
      var inside = t.closest(".caution");
      if (!inside) closeAllCautions();
    });

    document.addEventListener("keydown", function (ev) {
      if (ev && ev.key === "Escape") closeAllCautions();
    });
  }

  function renderTimeline(protocol, week, onPickWeek) {
    var root = $("Timeline");
    if (!root) return;
    clear(root);
    for (var i = 0; i < protocol.periods.length; i++) {
      var p = protocol.periods[i];
      var item = el("button", "timeline-item", null);
      item.type = "button";
      item.setAttribute("data-period-id", p.id);
      if (week >= p.weeks.start && week <= p.weeks.end) {
        item.className += " is-active";
        item.setAttribute("aria-pressed", "true");
      } else {
        item.setAttribute("aria-pressed", "false");
      }

      var weeks = el("div", "timeline-weeks", formatWeeks(p.weeks.start, p.weeks.end));
      var title = el("p", "timeline-title", p.title);
      item.appendChild(weeks);
      item.appendChild(title);
      item.addEventListener("click", (function (start) {
        return function () { onPickWeek(start); };
      })(p.weeks.start));

      root.appendChild(item);
    }

    try {
      // Only auto-scroll when the timeline is actually on screen.
      if (!root.getClientRects || !root.getClientRects().length) return;
      var rect = root.getBoundingClientRect();
      var inView = rect.bottom > 0 && rect.top < (window.innerHeight || 0);
      if (!inView) return;
      var active = root.querySelector(".timeline-item.is-active");
      if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest", inline: "center" });
    } catch (e) {}
  }

  function renderPeriod(protocol, fooddata, state) {
    var period = getPeriodForWeek(protocol, state.week);
    if (!period) return;

    closeAllCautions();

    // Header
    var label = $("PeriodLabel");
    var title = $("PeriodTitle");
    var summary = $("PeriodSummary");
    if (label) label.textContent = formatWeeks(period.weeks.start, period.weeks.end);
    if (title) title.textContent = period.title;
    if (summary) summary.textContent = period.summary || "";

    var tCurrent = $("TimelineCurrent");
    if (tCurrent) tCurrent.textContent = formatWeeks(period.weeks.start, period.weeks.end) + " \u00b7 " + period.title;

    // Period-level citations (shown in details mode)
    var pCites = $("PeriodCites");
    if (pCites) {
      clear(pCites);
      pCites.className = "cite-list period-cites" + (state.details ? " is-visible" : "");
      if (state.details && period.citations && period.citations.length) {
        var cidxP = buildCitationIndex(protocol);
        for (var pc = 0; pc < period.citations.length; pc++) {
          var pid = period.citations[pc];
          var psrc = null;
          for (var psi = 0; psi < protocol.sources.length; psi++) {
            if (protocol.sources[psi].id === pid) { psrc = protocol.sources[psi]; break; }
          }
          if (!psrc || !psrc.url) continue;
          var pnum = cidxP[pid] || "?";
          var pa = el("a", "cite", "[" + pnum + "]");
          pa.href = psrc.url;
          pa.target = "_blank";
          pa.rel = "noopener noreferrer";
          pa.title = psrc.label || psrc.id;
          pCites.appendChild(pa);
        }
      }
    }

    // Hint
    var hint = $("WeekPeriodHint");
    if (hint) {
      hint.textContent = "You are viewing " + formatWeeks(period.weeks.start, period.weeks.end) + ".";
    }

    // Development list
    var devList = $("DevList");
    if (devList) {
      clear(devList);
      var dev = period.development || [];
      for (var i = 0; i < dev.length; i++) {
        devList.appendChild(el("li", "", dev[i]));
      }
    }

    // Notes
    var notes = $("PeriodNotes");
    if (notes) {
      clear(notes);
      var ns = period.notes || [];
      for (var j = 0; j < ns.length; j++) {
        var note = ns[j];
        if (typeof note === "string") {
          notes.appendChild(el("div", "note-chip", note));
          continue;
        }
        var chip = el("div", "note-chip", note.text || "");
        if (state.details && note.citations && note.citations.length) {
          var cidxN = buildCitationIndex(protocol);
          var cl = el("div", "cite-list", null);
          for (var nc = 0; nc < note.citations.length; nc++) {
            var nid = note.citations[nc];
            var nsrc = null;
            for (var nsi = 0; nsi < protocol.sources.length; nsi++) {
              if (protocol.sources[nsi].id === nid) { nsrc = protocol.sources[nsi]; break; }
            }
            if (!nsrc || !nsrc.url) continue;
            var nnum = cidxN[nid] || "?";
            var na = el("a", "cite", "[" + nnum + "]");
            na.href = nsrc.url;
            na.target = "_blank";
            na.rel = "noopener noreferrer";
            na.title = nsrc.label || nsrc.id;
            cl.appendChild(na);
          }
          chip.appendChild(cl);
        }
        notes.appendChild(chip);
      }
    }

    // Nutrients cards
    var cards = $("NutrientCards");
    if (cards) {
      clear(cards);
      var cidx = buildCitationIndex(protocol);
      var priMap = {};
      var priRaw = period.nutrients || [];
      for (var pi = 0; pi < priRaw.length; pi++) {
        if (!priRaw[pi] || !priRaw[pi].id) continue;
        priMap[priRaw[pi].id] = priRaw[pi];
      }

      var allIds = [];
      for (var nid in (fooddata && fooddata.nutrients ? fooddata.nutrients : {})) {
        if (!fooddata.nutrients.hasOwnProperty(nid)) continue;
        if (nid === "Calories") continue;
        if (!fooddata.nutrients[nid] || !fooddata.nutrients[nid].rda) continue;
        allIds.push(nid);
      }
      allIds.sort(function (a, b) { return a.localeCompare(b); });

      var nutrients = [];
      for (var ai = 0; ai < allIds.length; ai++) {
        var id = allIds[ai];
        var base = priMap[id] || null;
        nutrients.push({
          id: id,
          priority: base ? base.priority : "supporting",
          why: base ? base.why : "Supporting nutrient this period.",
          details: base ? base.details : "",
          citations: base ? base.citations : null
        });
      }
      nutrients.sort(function (a, b) {
        var pa = normalizePriority(a.priority);
        var pb = normalizePriority(b.priority);
        var oa = pa === "high" ? 0 : pa === "medium" ? 1 : 2;
        var ob = pb === "high" ? 0 : pb === "medium" ? 1 : 2;
        if (oa !== ob) return oa - ob;
        return String(a.id || "").localeCompare(String(b.id || ""));
      });

      for (var k = 0; k < nutrients.length; k++) {
        var n = nutrients[k];
        var nId = n.id;
        var nInfo = fooddata.nutrients[nId] || {};
        var rdaLabel = nInfo.rda && nInfo.rda.label ? nInfo.rda.label : "";

        var card = el("article", "nutrient-card", null);
        card.style.setProperty("--nutrient-color", nutrientColor(nId));
        if (state.details) card.className += " is-detailed";

        var top = el("div", "nutrient-top", null);
        top.appendChild(el("p", "nutrient-name", nId));
        top.appendChild(el("p", "nutrient-rda", rdaLabel ? ("Daily target: " + rdaLabel) : ""));
        card.appendChild(top);

        var pri = normalizePriority(n.priority);
        var priPill = el("div", "priority-pill is-" + pri, PRIORITY_LABEL[pri] || pri);
        card.appendChild(priPill);

        card.appendChild(el("p", "nutrient-why", n.why || ""));

        var details = el("div", "nutrient-details", null);
        if (n.details) details.appendChild(el("p", "nutrient-why", n.details));

        if (n.citations && n.citations.length) {
          var cl = el("div", "cite-list", null);
          for (var c = 0; c < n.citations.length; c++) {
            var sid = n.citations[c];
            var src = null;
            for (var si = 0; si < protocol.sources.length; si++) {
              if (protocol.sources[si].id === sid) { src = protocol.sources[si]; break; }
            }
            if (!src || !src.url) continue;
            var num = cidx[sid] || "?";
            var a = el("a", "cite", "[" + num + "]");
            a.href = src.url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.title = src.label || src.id;
            cl.appendChild(a);
          }
          details.appendChild(cl);
        }
        card.appendChild(details);
        cards.appendChild(card);
      }
    }

    // Compute priorities for ranking.
    var weighted = [];
    var priList = period.nutrients || [];
    for (var w = 0; w < priList.length; w++) {
      var pr = normalizePriority(priList[w].priority);
      weighted.push({
        id: priList[w].id,
        weight: PRIORITY_WEIGHT[pr] || 0.35,
        priority: pr
      });
    }

    // Filter foods
    var foods = filterFoods(fooddata, {
      naturalOnly: !!state.naturalOnly,
      excludeAvoid: true
    });

    // Top foods overall
    foods.sort(function (a, b) {
      var sa = scoreFood(fooddata, a, weighted);
      var sb = scoreFood(fooddata, b, weighted);
      return sb - sa;
    });
    var topFoods = foods.slice(0, TOP_FOODS_LIMIT);

    renderFoodList(fooddata, topFoods, weighted, $("TopFoods"));

    // By nutrient select options
    var select = $("NutrientSelect");
    if (select) {
      clear(select);
      var keys = [];
      for (var key in fooddata.nutrients) {
        if (!fooddata.nutrients.hasOwnProperty(key)) continue;
        if (key === "Calories") continue;
        if (!fooddata.nutrients[key] || !fooddata.nutrients[key].rda) continue;
        keys.push(key);
      }
      keys.sort(function (a, b) { return a.localeCompare(b); });

      for (var o = 0; o < keys.length; o++) {
        var opt = document.createElement("option");
        opt.value = keys[o];
        opt.textContent = keys[o];
        select.appendChild(opt);
      }

      // Default: first high priority, else first in list.
      var defaultN = null;
      for (var d = 0; d < weighted.length; d++) {
        if (weighted[d].priority === "high") { defaultN = weighted[d].id; break; }
      }
      if (!defaultN) defaultN = keys[0] || null;

      if (state.selectedNutrient && keys.indexOf(state.selectedNutrient) !== -1) {
        select.value = state.selectedNutrient;
      } else if (defaultN) {
        select.value = defaultN;
        state.selectedNutrient = defaultN;
      }

      select.onchange = function () {
        state.selectedNutrient = select.value;
        renderByNutrient(fooddata, state);
        persist(state);
      };
    }

    renderByNutrient(fooddata, state);
  }

  function buildCautionNode(message) {
    var wrap = el("div", "caution", null);
    var btn = el("button", "caution-trigger", "!");
    btn.type = "button";
    btn.setAttribute("aria-label", "Caution");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("data-caution-message", message);

    var pop = el("div", "caution-popover", message);
    pop.setAttribute("role", "tooltip");

    wrap.appendChild(btn);
    wrap.appendChild(pop);
    return wrap;
  }

  function renderFoodList(fooddata, foods, weightedNutrients, root) {
    if (!root) return;
    clear(root);

    // Show bars for high+medium first; keep it readable.
    var bars = [];
    for (var i = 0; i < weightedNutrients.length; i++) {
      if (weightedNutrients[i].priority === "high" || weightedNutrients[i].priority === "medium") {
        bars.push(weightedNutrients[i]);
      }
    }
    if (!bars.length) bars = weightedNutrients.slice(0, 4);

    for (var f = 0; f < foods.length; f++) {
      var food = foods[f];
      var item = el("article", "food-item", null);

      var head = el("div", "food-head", null);
      var headLeft = el("div", "food-head-left", null);
      headLeft.appendChild(el("p", "food-name", food.name));
      head.appendChild(headLeft);

      var headRight = el("div", "food-head-right", null);
      headRight.appendChild(el("p", "food-meta", food.group));
      item.appendChild(head);

      var warn = String(food.warning || "").trim();
      if (warn && warn.toLowerCase() !== "0") {
        var wt = String(food.warningText || "").trim();
        var msg = (warn ? (warn + ": ") : "") + (wt || "Use caution.");
        headRight.appendChild(buildCautionNode(msg));
      }
      head.appendChild(headRight);

      var barRoot = el("div", "food-bars", null);
      for (var b = 0; b < bars.length; b++) {
        var nid = bars[b].id;
        var pct = percentOfRda(fooddata, food, nid);
        if (pct === null) continue;

        var row = el("div", "bar-row", null);
        row.style.setProperty("--nutrient-color", nutrientColor(nid));
        row.appendChild(el("div", "bar-label", nid));

        var track = el("div", "bar-track", null);
        var fill = el("div", "bar-fill", null);
        var w = Math.min(Math.max(pct, 0), BAR_CAP_PERCENT);
        fill.style.width = String(w) + "%";
        track.appendChild(fill);
        row.appendChild(track);

        row.appendChild(el("div", "bar-value", Math.round(pct) + "%"));
        barRoot.appendChild(row);
      }
      item.appendChild(barRoot);
      root.appendChild(item);
    }
  }

  function renderFoodBoxByNutrient(fooddata, foods, nutrientId, root) {
    if (!root) return;
    clear(root);

    var box = el("div", "food-box", null);
    for (var i = 0; i < foods.length; i++) {
      var food = foods[i];
      var pct = percentOfRda(fooddata, food, nutrientId);
      if (pct === null) continue;

      var row = el("div", "food-row", null);

      var main = el("div", "food-row-main", null);
      main.appendChild(el("p", "food-row-name", food.name));

      var metaLine = el("div", "food-row-meta-line", null);
      metaLine.appendChild(el("p", "food-row-meta", food.group));

      var warn = String(food.warning || "").trim();
      if (warn && warn.toLowerCase() !== "0") {
        var wt = String(food.warningText || "").trim();
        var msg = (warn ? (warn + ": ") : "") + (wt || "Use caution.");
        metaLine.appendChild(buildCautionNode(msg));
      }
      main.appendChild(metaLine);

      var bars = el("div", "food-row-bars", null);
      bars.style.setProperty("--nutrient-color", nutrientColor(nutrientId));

      var track = el("div", "bar-track", null);
      var fill = el("div", "bar-fill", null);
      var w = Math.min(Math.max(pct, 0), BAR_CAP_PERCENT);
      fill.style.width = String(w) + "%";
      track.appendChild(fill);
      bars.appendChild(track);
      bars.appendChild(el("div", "bar-value", Math.round(pct) + "%"));

      row.appendChild(main);
      row.appendChild(bars);
      box.appendChild(row);
    }

    root.appendChild(box);
  }

  function renderByNutrient(fooddata, state) {
    var nutrientId = state.selectedNutrient;
    var root = $("FoodsByNutrient");
    if (!root || !nutrientId) return;
    clear(root);

    var foods = filterFoods(fooddata, {
      naturalOnly: !!state.naturalOnly,
      excludeAvoid: true
    });

    foods.sort(function (a, b) {
      var pa = percentOfRda(fooddata, a, nutrientId);
      var pb = percentOfRda(fooddata, b, nutrientId);
      return (pb === null ? -Infinity : pb) - (pa === null ? -Infinity : pa);
    });

    var top = [];
    for (var i = 0; i < foods.length; i++) {
      if (percentOfRda(fooddata, foods[i], nutrientId) === null) continue;
      top.push(foods[i]);
      if (top.length >= BY_NUTRIENT_LIMIT) break;
    }

    renderFoodBoxByNutrient(fooddata, top, nutrientId, root);
  }

  function persist(state) {
    savePrefs({
      mode: state.mode,
      week: state.week,
      dueDate: state.dueDate || null,
      naturalOnly: !!state.naturalOnly,
      details: !!state.details,
      selectedNutrient: state.selectedNutrient || null
    });
    saveGlobalPrefs({
      naturalOnly: !!state.naturalOnly
    });
  }

  function applyControls(state) {
    var wInput = $("WeeklyWeek");
    var wRange = $("WeeklyWeekRange");
    var dInput = $("WeeklyDueDate");
    var nat = $("ToggleNaturalOnly");
    var det = $("ToggleDetails");

    if (wInput) wInput.value = String(state.week);
    if (wRange) wRange.value = String(state.week);
    if (dInput) dInput.value = state.mode === "dueDate" ? (state.dueDate || "") : "";
    if (nat) nat.checked = !!state.naturalOnly;
    if (det) det.setAttribute("aria-expanded", state.details ? "true" : "false");
  }

  function initControls(protocol, fooddata, state) {
    var wInput = $("WeeklyWeek");
    var wRange = $("WeeklyWeekRange");
    var prev = $("WeekPrev");
    var next = $("WeekNext");
    var dInput = $("WeeklyDueDate");
    var nat = $("ToggleNaturalOnly");
    var det = $("ToggleDetails");

    function setWeek(newWeek) {
      state.week = clamp(parseInt(newWeek, 10) || state.week, MIN_WEEK, MAX_WEEK);
      state.mode = "week";
      state.dueDate = null;
      applyControls(state);
      writeUrlWeek(state.week);
      persist(state);
      renderTimeline(protocol, state.week, setWeek);
      renderPeriod(protocol, fooddata, state);

      // Mobile UX: collapse the timeline after picking.
      try {
        var td = $("TimelineDetails");
        if (td && window.matchMedia && window.matchMedia("(max-width: 640px)").matches) td.open = false;
      } catch (e) {}
    }

    function recomputeFromDueDate() {
      if (!state.dueDate) return;
      var w = weekFromDueDate(state.dueDate);
      if (w === null) return;
      state.week = w;
      applyControls(state);
      writeUrlWeek(state.week);
      persist(state);
      renderTimeline(protocol, state.week, setWeek);
      renderPeriod(protocol, fooddata, state);
    }

    if (wInput) {
      wInput.addEventListener("change", function () { setWeek(wInput.value); });
    }
    if (wRange) {
      wRange.addEventListener("input", function () { setWeek(wRange.value); });
    }
    if (prev) prev.addEventListener("click", function () { setWeek(state.week - 1); });
    if (next) next.addEventListener("click", function () { setWeek(state.week + 1); });

    if (dInput) {
      dInput.addEventListener("change", function () {
        var v = String(dInput.value || "").trim();
        if (!v) {
          state.mode = "week";
          state.dueDate = null;
          persist(state);
          return;
        }
        state.mode = "dueDate";
        state.dueDate = v;
        recomputeFromDueDate();
      });
    }

    if (nat) {
      nat.addEventListener("change", function () {
        state.naturalOnly = !!nat.checked;
        persist(state);
        renderPeriod(protocol, fooddata, state);
      });
    }

    if (det) {
      det.addEventListener("click", function () {
        state.details = !state.details;
        applyControls(state);
        persist(state);
        renderPeriod(protocol, fooddata, state);
      });
    }

    // Keyboard: left/right arrows to move weeks.
    window.addEventListener("keydown", function (ev) {
      if (!ev || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.key === "ArrowLeft") { setWeek(state.week - 1); }
      if (ev.key === "ArrowRight") { setWeek(state.week + 1); }
    });

    // If user chose due date mode previously, recompute on load.
    if (state.mode === "dueDate" && state.dueDate) {
      recomputeFromDueDate();
    }
  }

  function renderError(msg) {
    var label = $("PeriodLabel");
    var title = $("PeriodTitle");
    var summary = $("PeriodSummary");
    if (label) label.textContent = "Error";
    if (title) title.textContent = "Weekly Diet failed to load";
    if (summary) summary.textContent = msg;
  }

  function start(protocol, fooddata) {
    // Hydrate nutrients: ensure RDA labels exist
    if (fooddata && fooddata.nutrients) {
      for (var k in fooddata.nutrients) {
        if (!fooddata.nutrients.hasOwnProperty(k)) continue;
        var info = fooddata.nutrients[k];
        if (info && info.rda && !info.rda.label && info.rda.value !== undefined && info.rda.unit) {
          info.rda.label = String(info.rda.value) + " " + String(info.rda.unit);
        }
      }
    }

    var prefs = loadPrefs();
    var globalPrefs = loadGlobalPrefs();
    var initialWeek = readUrlWeek();
    var state = {
      mode: prefs.mode === "dueDate" ? "dueDate" : "week",
      week: clamp(safeNumber(initialWeek !== null ? initialWeek : prefs.week) || 4, MIN_WEEK, MAX_WEEK),
      dueDate: typeof prefs.dueDate === "string" ? prefs.dueDate : null,
      naturalOnly: typeof globalPrefs.naturalOnly === "boolean" ? globalPrefs.naturalOnly : !!prefs.naturalOnly,
      details: !!prefs.details,
      selectedNutrient: typeof prefs.selectedNutrient === "string" ? prefs.selectedNutrient : null
    };

    applyControls(state);
    function onPickWeek(w) {
      // Timeline picks always switch to manual week mode.
      state.mode = "week";
      state.dueDate = null;
      state.week = clamp(parseInt(w, 10) || state.week, MIN_WEEK, MAX_WEEK);
      applyControls(state);
      writeUrlWeek(state.week);
      persist(state);
      renderTimeline(protocol, state.week, onPickWeek);
      renderPeriod(protocol, fooddata, state);

      // Mobile UX: collapse the timeline after picking.
      try {
        var td = $("TimelineDetails");
        if (td && window.matchMedia && window.matchMedia("(max-width: 640px)").matches) td.open = false;
      } catch (e) {}
    }
    renderTimeline(protocol, state.week, onPickWeek);

    renderPeriod(protocol, fooddata, state);
    initControls(protocol, fooddata, state);
    writeUrlWeek(state.week);
    persist(state);

    initCautionEvents();

    try { document.body.classList.add("weekly-ready"); } catch (e) {}
  }

  window.addEventListener("load", function () {
    Promise.all([fetchJson(PROTOCOL_URL), fetchJson(FOODDATA_URL)])
      .then(function (all) {
        var protocol = all[0];
        var fooddata = all[1];
        if (!protocol || !protocol.periods || !protocol.periods.length) {
          throw new Error("Protocol JSON is missing periods.");
        }
        start(protocol, fooddata);
      })
      .catch(function (err) {
        renderError(err && err.message ? err.message : String(err));
      });
  });
})();
