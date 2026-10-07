// src/js/weekly-diet.js
// Client-side weekly tracker: maps a selected week to a time period, then ranks foods by %RDA.

(function () {
  var PROTOCOL_URL = "/resource/weekly_protocol.v1.json";
  var FOODDATA_URL = "/resource/pregnut_fooddata.v1.json";
  var CHAPTER_ART_URL = "/resource/weekly_chapter_art.v1.json";
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
  var TOP_FOODS_LIMIT = 10;
  var BY_NUTRIENT_LIMIT = 20;

  var V = window.PregnutViz;
  var BY_NUTRIENT_VISIBLE = 8;

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

  function formatWeeks(start, end) {
    if (start === end) return "Week " + start;
    return "Weeks " + start + "\u2013" + end;
  }

  // "Movement + senses (a very active stretch)" -> "Movement & senses"
  function displayTitle(t) {
    var s = String(t || "");
    var idx = s.indexOf("(");
    if (idx > 0) s = s.slice(0, idx);
    return s.replace(/\s*;\s*/g, ", ").replace(/\s\+\s/g, " & ").trim();
  }

  function trimesterLabel(week) {
    if (week <= 13) return "First trimester";
    if (week <= 27) return "Second trimester";
    return "Third trimester";
  }

  function formatWeeksNav(start, end) {
    if (start === end) return "Week " + start;
    return "Weeks " + start + "-" + end;
  }

  var TIMELINE_SHORT_TITLES = {
    "wk1-8": "Foundations",
    "wk9-12": "Organ formation",
    "wk13-16": "Brain and skeleton",
    "wk17-20": "Movement and senses",
    "wk21-24": "Lungs and sleep",
    "wk25-28": "Readiness",
    "wk29-32": "Birth position",
    "wk33-36": "Weight gain",
    "wk37-40": "Full term"
  };

  function timelineShortTitle(period) {
    if (!period) return "";
    var id = String(period.id || "");
    if (TIMELINE_SHORT_TITLES.hasOwnProperty(id)) return TIMELINE_SHORT_TITLES[id];
    var s = String(period.title || "").trim();
    if (!s) return "";
    var idx = s.indexOf("(");
    if (idx !== -1) s = s.slice(0, idx).trim();
    s = s.replace(/[+;:]/g, " ");
    var words = s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join(" ");
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

  function getChapterArt(artdata, period) {
    var entries = artdata && Array.isArray(artdata.chapters) ? artdata.chapters : [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].periodId === period.id) return entries[i];
    }
    return null;
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
    // Toggle is binary: either Natural-only (natSource=1) or Processed-only (natSource=0).
    var wantsNatural = null;
    if (opts && typeof opts.naturalOnly === "boolean") wantsNatural = opts.naturalOnly;
    for (var i = 0; i < foods.length; i++) {
      var f = foods[i];
      if (!f || f.id === "01107") continue;
      if (opts && opts.excludeAvoid && String(f.warning || "").toLowerCase() === "avoid") continue;
      if (wantsNatural === true && Number(f.natSource) !== 1) continue;
      if (wantsNatural === false && Number(f.natSource) !== 0) continue;
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
    if (window.PregnutCautions) window.PregnutCautions.closeAll();
  }

  function readingText(fooddata, food, nutrientId, pct) {
    var nInfo = fooddata.nutrients[nutrientId];
    var amount = V.formatAmount(food.nutrients[nutrientId]) + " " + nInfo.unit;
    return amount + " in 100 g · " + Math.round(pct) + "% of " + nInfo.rda.label + " reference";
  }

  function setSummary(id, lead, text, infoText) {
    var node = $(id);
    if (!node) return;
    clear(node);
    node.appendChild(el("strong", "", lead));
    node.appendChild(document.createTextNode(text));
    if (infoText) node.appendChild(V.info(infoText, "How to read this chart"));
  }

  var TIMELINE_ICONS = {
    "wk1-8": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20v-8"/><path d="M12 14c-4.5 0-7-2.6-7-6 4.5 0 7 2.1 7 6Z"/><path d="M12 11c3.8 0 6-2.1 6-5-3.8 0-6 1.8-6 5Z"/></svg>',
    "wk9-12": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.2c0 5-8.8 10.3-8.8 10.3S3.2 13.2 3.2 8.2A4.2 4.2 0 0 1 12 6.5a4.2 4.2 0 0 1 8.8 1.7Z"/><path d="M8 10h2l1.2-2.2 1.7 4.5 1.1-2.3h2"/></svg>',
    "wk13-16": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 18.8a3.2 3.2 0 0 1-3.1-3.2c0-.6.2-1.2.5-1.7A3.6 3.6 0 0 1 7.2 7a3.8 3.8 0 0 1 7.1-1 3.5 3.5 0 0 1 3.5 5.4 3.8 3.8 0 0 1-2.6 6.8"/><path d="M12 5.4v13.2M8.2 9.2c1.5.1 2.6.8 3.8 2M16.2 8.8c-1.5.1-3 .8-4.2 2.2M8.8 14.3c1.3 0 2.2.5 3.2 1.5M15.8 14c-1.5 0-2.6.6-3.8 1.8"/></svg>',
    "wk17-20": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13c2.2-4.6 4.8-4.6 7 0s4.8 4.6 7 0"/><path d="m17 7 3-3M18.5 8.5 22 8M15.5 6.5V3"/></svg>',
    "wk21-24": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v7"/><path d="M11.8 10.5c-1.3-2.8-2.4-4.2-4-4.2C5.7 6.3 4 10.2 4 14.5c0 2.4 1.3 4 3.3 4 2.5 0 4.5-2.2 4.5-5.2Z"/><path d="M12.2 10.5c1.3-2.8 2.4-4.2 4-4.2 2.1 0 3.8 3.9 3.8 8.2 0 2.4-1.3 4-3.3 4-2.5 0-4.5-2.2-4.5-5.2Z"/></svg>',
    "wk25-28": '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/><path d="M12 8v4l2.7 1.8M12 2.5V5M21.5 12H19"/></svg>',
    "wk29-32": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15"/><path d="m7.5 14.5 4.5 4.5 4.5-4.5"/><path d="M6 7.5a7 7 0 0 1 12 0"/></svg>',
    "wk33-36": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M10 19V5M15 19v-7M20 19V3"/><path d="m4 6 4-3 4 3 4-3 4 2"/></svg>',
    "wk37-40": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.5 5.2 5.7.8-4.1 4 .9 5.7-5-2.7-5 2.7.9-5.7-4.1-4 5.7-.8Z"/></svg>'
  };

  function buildTimelineIcon(periodId) {
    var icon = el("span", "weekly-timeline-icon", null);
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = TIMELINE_ICONS[periodId] || TIMELINE_ICONS["wk1-8"];
    return icon;
  }

  function renderTimeline(protocol, week) {
    var root = $("Timeline");
    if (!root) return;

    if (root.getAttribute("data-built") !== "1") {
      clear(root);
      for (var i = 0; i < protocol.periods.length; i++) {
        var p = protocol.periods[i];
        var span = p.weeks.end - p.weeks.start + 1;
        var seg = el("div", "wk-seg", null);
        seg.style.flexGrow = String(span);
        seg.setAttribute("data-period-id", p.id);
        var ticks = el("div", "wk-ticks", null);
        for (var w = p.weeks.start; w <= p.weeks.end; w++) {
          var tick = el("span", "wk-tick", null);
          tick.setAttribute("data-week", String(w));
          ticks.appendChild(tick);
        }
        seg.appendChild(ticks);
        seg.appendChild(el("span", "wk-seg-weeks", p.weeks.start + "–" + p.weeks.end));
        seg.appendChild(el("span", "wk-seg-title", timelineShortTitle(p)));
        root.appendChild(seg);
      }
      root.setAttribute("data-built", "1");
    }

    var segs = root.children;
    for (var j = 0; j < protocol.periods.length; j++) {
      var pj = protocol.periods[j];
      if (!segs[j]) continue;
      segs[j].classList.toggle("is-active", week >= pj.weeks.start && week <= pj.weeks.end);
      segs[j].classList.toggle("is-past", week > pj.weeks.end);
    }
    var ticksAll = root.querySelectorAll(".wk-tick");
    for (var t = 0; t < ticksAll.length; t++) {
      var tw = parseInt(ticksAll[t].getAttribute("data-week"), 10);
      ticksAll[t].classList.toggle("is-current", tw === week);
      ticksAll[t].classList.toggle("is-past", tw < week);
    }

    var range = $("WeekRange");
    if (range && String(range.value) !== String(week)) range.value = String(week);
    if (range) range.setAttribute("aria-valuetext", "Week " + week);
    var num = $("WeekNumber");
    if (num) num.textContent = String(week);
    var period = getPeriodForWeek(protocol, week);
    var tCurrent = $("TimelineCurrent");
    if (tCurrent && period) {
      clear(tCurrent);
      tCurrent.appendChild(el("strong", "", timelineShortTitle(period)));
      tCurrent.appendChild(el("span", "", trimesterLabel(week)));
    }
  }

  function renderChapterArt(artdata, period) {
    var root = $("ChapterArt");
    if (!root) return;

    var entry = getChapterArt(artdata, period);
    if (!entry) {
      root.hidden = true;
      return;
    }

    root.hidden = false;
    root.setAttribute("data-period-id", period.id || "");

    var image = $("ChapterArtImage");
    if (image) {
      image.alt = entry.alt || "";
      image.sizes = "(max-width: 760px) 92vw, 440px";
      image.srcset = entry.image640 && entry.image960
        ? entry.image640 + " 640w, " + entry.image960 + " 960w, " + entry.image + " 1024w"
        : "";
      image.src = entry.image || "";
    }
  }

  function renderPeriod(protocol, fooddata, state, artdata) {
    var period = getPeriodForWeek(protocol, state.week);
    if (!period) return;

    closeAllCautions();

    var chapter = document.querySelector(".wk-chapter");
    if (chapter && chapter.getAttribute("data-period") !== period.id) {
      chapter.setAttribute("data-period", period.id);
      chapter.classList.remove("is-entering");
      void chapter.offsetWidth;
      chapter.classList.add("is-entering");
    }

    // Header
    var label = $("PeriodLabel");
    var title = $("PeriodTitle");
    var summary = $("PeriodSummary");
    if (label) label.textContent = formatWeeks(period.weeks.start, period.weeks.end);
    if (title) title.textContent = displayTitle(period.title);
    if (summary) summary.textContent = period.summary || "";



    renderChapterArt(artdata, period);

    var cidx = buildCitationIndex(protocol);
    function sourceLinks(ids) {
      var wrap = el("span", "wk-cites", null);
      for (var c = 0; c < (ids || []).length; c++) {
        var src = null;
        for (var si = 0; si < protocol.sources.length; si++) {
          if (protocol.sources[si].id === ids[c]) { src = protocol.sources[si]; break; }
        }
        if (!src || !src.url) continue;
        var a = el("a", "wk-cite", String(cidx[ids[c]] || "?"));
        a.href = src.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.title = src.label || src.id;
        a.setAttribute("aria-label", "Source: " + (src.label || src.id));
        wrap.appendChild(a);
      }
      return wrap.firstChild ? wrap : null;
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
        var note = typeof ns[j] === "string" ? { text: ns[j] } : ns[j];
        var li = el("li", "", note.text || "");
        var nc = sourceLinks(note.citations);
        if (nc) li.appendChild(nc);
        notes.appendChild(li);
      }
      var pc = sourceLinks(period.citations);
      if (pc) {
        var srcLine = el("li", "wk-notes-sources", "Sources for this stage ");
        srcLine.appendChild(pc);
        notes.appendChild(srcLine);
      }
      notes.hidden = !notes.firstChild;
    }

    // Prioritized nutrients; everything else is listed in one line.
    var cards = $("NutrientCards");
    if (cards) {
      clear(cards);
      var order = { high: 0, medium: 1, supporting: 2 };
      var picked = (period.nutrients || []).filter(function (n) {
        return n && n.id && fooddata.nutrients[n.id];
      }).slice().sort(function (a, b) {
        return order[normalizePriority(a.priority)] - order[normalizePriority(b.priority)];
      });
      var pickedIds = {};
      for (var k = 0; k < picked.length; k++) {
        var n = picked[k];
        pickedIds[n.id] = true;
        var pri = normalizePriority(n.priority);
        var nInfo = fooddata.nutrients[n.id] || {};
        var row = el("li", "wk-nutrient is-" + pri, null);
        var head = el("div", "wk-nutrient-head", null);
        head.appendChild(el("h3", "wk-nutrient-name", n.id));
        head.appendChild(el("span", "wk-nutrient-tag", PRIORITY_LABEL[pri] || pri));
        row.appendChild(head);
        var body = el("p", "wk-nutrient-why", n.why || "");
        var cites = sourceLinks(n.citations);
        if (cites) body.appendChild(cites);
        row.appendChild(body);
        var meta = el("p", "wk-nutrient-meta", null);
        if (nInfo.rda && nInfo.rda.label) {
          meta.appendChild(el("span", "", "Reference " + nInfo.rda.label + " a day"));
        }
        if (NUTRIENT_GUIDES[n.id]) {
          var g = el("a", "", "Read the guide");
          g.href = NUTRIENT_GUIDES[n.id];
          meta.appendChild(g);
        }
        if (meta.firstChild) row.appendChild(meta);
        cards.appendChild(row);
      }

      var also = $("AlsoNutrients");
      if (also) {
        var rest = [];
        for (var nid in fooddata.nutrients) {
          if (!fooddata.nutrients.hasOwnProperty(nid) || nid === "Calories") continue;
          if (!fooddata.nutrients[nid] || !fooddata.nutrients[nid].rda || pickedIds[nid]) continue;
          rest.push(nid);
        }
        rest.sort(function (a, b) { return a.localeCompare(b); });
        also.textContent = rest.length ? "Still part of a balanced day: " + rest.join(", ") + "." : "";
        also.hidden = !rest.length;
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

    // By nutrient chips
    var chipRoot = $("NutrientChips");
    if (chipRoot) {
      var keys = [];
      for (var key in fooddata.nutrients) {
        if (!fooddata.nutrients.hasOwnProperty(key)) continue;
        if (key === "Calories") continue;
        if (!fooddata.nutrients[key] || !fooddata.nutrients[key].rda) continue;
        keys.push(key);
      }
      keys.sort(function (a, b) { return a.localeCompare(b); });

      // Default: first high priority, else first in list.
      var defaultN = null;
      for (var d = 0; d < weighted.length; d++) {
        if (weighted[d].priority === "high") { defaultN = weighted[d].id; break; }
      }
      if (!defaultN) defaultN = keys[0] || null;

      if (!(state.selectedNutrient && keys.indexOf(state.selectedNutrient) !== -1) && defaultN) {
        state.selectedNutrient = defaultN;
      }

      V.chips(chipRoot, "weekly-nutrient", keys.map(function (k) {
        return { value: k, label: k };
      }), state.selectedNutrient, function (nutrientId) {
        state.selectedNutrient = nutrientId;
        renderByNutrient(fooddata, state);
        persist(state);
      });
      V.revealSelected(chipRoot);
    }

    renderByNutrient(fooddata, state);
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

    setSummary(
      "TopFoodsSummary",
      "Priority coverage",
      " · match score and share of each highlighted nutrient reference in 100 g",
      "Each bar fills from 0–100% of the nutrient reference amount from a 100 g serving. Foods at or above the reference show a full bar and a ✓; the number shows the exact total. The match score weights this stage's highlighted nutrients, each capped at 100%."
    );

    var maxScore = 0;
    for (var wi = 0; wi < weightedNutrients.length; wi++) {
      maxScore += (weightedNutrients[wi].weight || 0) * SCORE_CAP_PERCENT;
    }

    var list = el("ol", "viz-list weekly-top-list", null);
    for (var f = 0; f < foods.length; f++) {
      var food = foods[f];
      var item = el("li", "weekly-food viz-fade", null);

      var head = el("div", "weekly-food-head", null);
      head.appendChild(V.thumb(food, imageMap));

      var copy = el("div", "viz-copy", null);
      var name = el("p", "viz-name", null);
      var link = el("a", "", null);
      link.href = V.foodUrl(food);
      var parts = V.splitName(food.name);
      link.appendChild(document.createTextNode(parts.main));
      link.appendChild(el("span", "viz-detail", parts.detail ? parts.detail + " · " + food.group : food.group));
      name.appendChild(link);
      copy.appendChild(name);
      var caution = V.safetyNote(food);
      if (caution) copy.appendChild(caution);
      head.appendChild(copy);

      var match = maxScore > 0 ? Math.round((scoreFood(fooddata, food, weightedNutrients) / maxScore) * 100) : 0;
      var matchNode = el("p", "weekly-food-match", null);
      matchNode.appendChild(el("strong", "", match + "%"));
      matchNode.appendChild(el("span", "", "match"));
      head.appendChild(matchNode);
      item.appendChild(head);

      var barRoot = el("div", "weekly-food-bars", null);
      for (var b = 0; b < bars.length; b++) {
        var nid = bars[b].id;
        var pct = percentOfRda(fooddata, food, nid);
        if (pct === null) continue;

        var row = el("div", "weekly-mini", null);
        row.title = readingText(fooddata, food, nid, pct);
        row.appendChild(el("span", "weekly-mini-label", nid));
        row.appendChild(V.value(pct));
        row.appendChild(V.bar(pct, nid + ": " + readingText(fooddata, food, nid, pct)));
        barRoot.appendChild(row);
      }
      item.appendChild(barRoot);
      list.appendChild(item);
    }
    root.appendChild(list);
  }

  function renderFoodBoxByNutrient(fooddata, foods, nutrientId, root) {
    if (!root) return;
    clear(root);

    var nInfo = fooddata && fooddata.nutrients ? fooddata.nutrients[nutrientId] : null;
    var targetLabel = nInfo && nInfo.rda && nInfo.rda.label ? nInfo.rda.label : "";
    setSummary(
      "ByNutrientSummary",
      nutrientId,
      " · % of the " + (targetLabel ? targetLabel + " " : "") + "pregnancy reference in 100 g",
      "Ranked by the amount in 100 g. The bar ends at the full reference amount" +
        (targetLabel ? " (" + targetLabel + ")" : "") +
        "; foods at or above it show a full bar and a ✓, and the number shows the exact total."
    );

    var list = el("ol", "viz-list", null);
    var count = 0;
    for (var i = 0; i < foods.length; i++) {
      var food = foods[i];
      var pct = percentOfRda(fooddata, food, nutrientId);
      if (pct === null) continue;
      var row = V.foodRow({
        food: food,
        percent: pct,
        imageMap: imageMap,
        meta: food.group,
        tip: readingText(fooddata, food, nutrientId, pct)
      });
      if (count >= BY_NUTRIENT_VISIBLE) row.hidden = true;
      list.appendChild(row);
      count++;
    }
    root.appendChild(list);

    if (count > BY_NUTRIENT_VISIBLE) {
      var more = el("button", "weekly-show-more", "Show all " + count);
      more.type = "button";
      more.addEventListener("click", function () {
        var hidden = list.querySelectorAll("li[hidden]");
        for (var h = 0; h < hidden.length; h++) hidden[h].hidden = false;
        more.remove();
      });
      root.appendChild(more);
    }
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
      week: state.week,
      naturalOnly: !!state.naturalOnly,
      selectedNutrient: state.selectedNutrient || null
    });
    saveGlobalPrefs({
      naturalOnly: !!state.naturalOnly
    });
  }

  function renderError(msg) {
    var label = $("PeriodLabel");
    var title = $("PeriodTitle");
    var summary = $("PeriodSummary");
    if (label) label.textContent = "Error";
    if (title) title.textContent = "Weekly Diet failed to load";
    if (summary) summary.textContent = msg;
  }

  function start(protocol, fooddata, artdata) {
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
      week: clamp(safeNumber(initialWeek !== null ? initialWeek : prefs.week) || 4, MIN_WEEK, MAX_WEEK),
      naturalOnly: typeof globalPrefs.naturalOnly === "boolean" ? globalPrefs.naturalOnly : (typeof prefs.naturalOnly === "boolean" ? prefs.naturalOnly : true),
      details: false,
      selectedNutrient: typeof prefs.selectedNutrient === "string" ? prefs.selectedNutrient : null
    };

    function periodIndexForWeek(week) {
      for (var i = 0; i < protocol.periods.length; i++) {
        var p = protocol.periods[i];
        if (week >= p.weeks.start && week <= p.weeks.end) return i;
      }
      return 0;
    }

    function setWeek(newWeek) {
      state.week = clamp(parseInt(newWeek, 10) || state.week, MIN_WEEK, MAX_WEEK);
      writeUrlWeek(state.week);
      persist(state);
      renderTimeline(protocol, state.week);
      var nextPeriod = getPeriodForWeek(protocol, state.week);
      if (nextPeriod !== currentPeriod) {
        currentPeriod = nextPeriod;
        renderPeriod(protocol, fooddata, state, artdata);
      }
    }
    var currentPeriod = getPeriodForWeek(protocol, state.week);

    var range = $("WeekRange");
    if (range) {
      range.addEventListener("input", function () { setWeek(range.value); });
    }

    // Pointer scrubbing on the ruler: each week owns an equal slice of the track.
    var track = $("Timeline");
    if (track) {
      var scrubbing = false;
      var weekAt = function (ev) {
        var r = track.getBoundingClientRect();
        var x = clamp((ev.clientX - r.left) / r.width, 0, 0.9999);
        return Math.floor(x * MAX_WEEK) + MIN_WEEK;
      };
      track.addEventListener("pointerdown", function (ev) {
        scrubbing = true;
        try { track.setPointerCapture(ev.pointerId); } catch (e) {}
        setWeek(weekAt(ev));
      });
      track.addEventListener("pointermove", function (ev) {
        if (scrubbing) setWeek(weekAt(ev));
      });
      var stop = function () { scrubbing = false; };
      track.addEventListener("pointerup", stop);
      track.addEventListener("pointercancel", stop);
    }

    // One global toggle remains: natural vs processed sources.
    var source = $("SourceToggle");
    if (source) {
      V.setChecked(source, state.naturalOnly ? "natural" : "processed");
      source.addEventListener("change", function (ev) {
        var t = ev && ev.target ? ev.target : null;
        if (!t || t.name !== "weekly-source") return;
        state.naturalOnly = t.value === "natural";
        persist(state);
        renderPeriod(protocol, fooddata, state, artdata);
      });
    }

    // Keyboard: left/right arrows switch between timeline "chapters" (periods).
    window.addEventListener("keydown", function (ev) {
      if (!ev || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
      if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;

      var ae = document.activeElement;
      if (ae) {
        var tag = String(ae.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || ae.isContentEditable) return;
      }

      var idx = periodIndexForWeek(state.week);
      var nextIdx = idx + (ev.key === "ArrowRight" ? 1 : -1);
      if (nextIdx < 0 || nextIdx >= protocol.periods.length) return;
      try { ev.preventDefault(); } catch (e) {}
      setWeek(protocol.periods[nextIdx].weeks.start);
    });

    renderTimeline(protocol, state.week);
    renderPeriod(protocol, fooddata, state, artdata);
    writeUrlWeek(state.week);
    persist(state);

    try { document.body.classList.add("weekly-ready"); } catch (e) {}
  }

  var imageMap = {};
  var NUTRIENT_GUIDES = {};
  try { NUTRIENT_GUIDES = JSON.parse(($("NutrientGuides") || {}).textContent || "{}"); } catch (e) {}

  window.addEventListener("load", function () {
    Promise.all([
      fetchJson(PROTOCOL_URL),
      fetchJson(FOODDATA_URL),
      fetchJson(CHAPTER_ART_URL).catch(function () { return { chapters: [] }; }),
      V.loadImageMap()
    ])
      .then(function (all) {
        var protocol = all[0];
        var fooddata = all[1];
        var artdata = all[2];
        imageMap = all[3] || {};
        if (!protocol || !protocol.periods || !protocol.periods.length) {
          throw new Error("Protocol JSON is missing periods.");
        }
        start(protocol, fooddata, artdata);
      })
      .catch(function (err) {
        renderError(err && err.message ? err.message : String(err));
      });
  });
})();
