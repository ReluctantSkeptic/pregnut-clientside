// src/js/daily-fit.js
// Daily Fit: log foods in everyday portions, see 13 pregnancy nutrients fill
// up, or plan a whole day from the meal library. Everything stays in this
// browser (localStorage); data comes from /resource/daily-fit.v1.json.

(function () {
  var DATA_URL = "/resource/daily-fit.v1.json";
  var STORE_KEY = "pregnut.dailyFit.v1";
  var SLOTS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["snack", "Snack"], ["dinner", "Dinner"]];
  var STEPS = [0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  // Eggs, slices and bananas count in whole numbers (and a half).
  var COUNT_STEPS = [0.5, 1, 2, 3, 4, 5, 6, 8, 10];
  var MEASURE = /cup|tbsp|tsp|\boz\b|handful|portion|scoop|serving|container|order|plate|bowl|worth/;
  var FRACTIONS = { 0.125: "⅛", 0.25: "¼", 0.5: "½", 0.75: "¾", 1.5: "1½", 2.5: "2½" };
  var GRAMS = -1;

  var data = null;
  var byId = {};
  var index = [];
  var state = loadState();
  var sheet = null; // the item being added or edited
  var openNutrient = -1;
  var undoState = null;
  var toastTimer = 0;

  function $(id) { return document.getElementById(id); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function loadState() {
    var fresh = { date: today(), items: [], plan: {}, prefs: { style: "all", df: false, gf: false, prep: 2 } };
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || "null");
      if (!saved || typeof saved !== "object") return fresh;
      fresh.prefs = saved.prefs || fresh.prefs;
      // A new day starts with an empty list; preferences carry over.
      if (saved.date === fresh.date && Array.isArray(saved.items)) {
        fresh.items = saved.items;
        fresh.plan = saved.plan || {};
      }
    } catch (e) {}
    return fresh;
  }

  function save() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function snapshot() { return JSON.parse(JSON.stringify(state)); }

  // food: [id, label, image, level, warningText, values, portions, rank, alias]
  function food(id) { return byId[id]; }

  function grams(item) {
    var f = food(item.id);
    if (!f) return 0;
    if (item.u === GRAMS) return item.q;
    var unit = f[6][item.u] || f[6][0];
    return item.q * unit[1];
  }

  function amounts(items) {
    var total = data.nutrients.map(function () { return 0; });
    items.forEach(function (item) {
      var f = food(item.id);
      if (!f) return;
      var g = grams(item);
      for (var i = 0; i < total.length; i++) total[i] += f[5][i] * g / 100;
    });
    return total;
  }

  function percent(i, amount) { return amount / data.nutrients[i].target * 100; }

  function fmtQty(q) {
    if (FRACTIONS[q]) return FRACTIONS[q];
    return String(Math.round(q * 100) / 100);
  }

  // "cup (8 fl oz)" -> "cups (8 fl oz)", "medium banana" -> "medium bananas"
  function plural(name) {
    var cut = name.indexOf(" (");
    var head = cut === -1 ? name : name.slice(0, cut);
    var tail = cut === -1 ? "" : name.slice(cut);
    if (/^[¼½¾]|\b(tbsp|tsp|oz)$/.test(head)) return name;
    if (/\bcup\b/.test(head)) return head.replace(/\bcup\b/, "cups") + tail;
    if (/'s worth$/.test(head)) return head.replace(/'s worth$/, "s' worth") + tail;
    head = head.replace(/(\w+)$/, function (w) {
      if (/(ch|sh|s|x)$/.test(w)) return w + "es";
      if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
      return w + "s";
    });
    return head + tail;
  }

  function amountText(item) {
    var f = food(item.id);
    var g = Math.round(grams(item));
    if (item.u === GRAMS) return g + " g";
    var name = (f[6][item.u] || f[6][0])[0];
    return fmtQty(item.q) + " " + (item.q > 1 ? plural(name) : name) + " · " + g + " g";
  }

  // "Vitamin B12" -> "vitamin B12", "Iron" -> "iron", "DHA" stays.
  function inSentence(name) {
    if (/^[A-Z]{2,}/.test(name)) return name;
    if (/^Vitamin /.test(name)) return "vitamin " + name.slice(8);
    return name.toLowerCase();
  }

  function slotName(slot) {
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i][0] === slot) return SLOTS[i][1];
    return slot;
  }

  function guessSlot() {
    var h = new Date().getHours() + new Date().getMinutes() / 60;
    if (h < 10.5) return "breakfast";
    if (h < 14.5) return "lunch";
    if (h < 17) return "snack";
    return "dinner";
  }

  function thumb(f, className) {
    if (f[2]) {
      var img = el("img", className);
      img.src = f[2];
      img.alt = "";
      img.width = 400;
      img.height = 400;
      img.loading = "lazy";
      img.decoding = "async";
      return img;
    }
    var tile = el("span", className + " is-empty", f[1].charAt(0).toUpperCase());
    tile.setAttribute("aria-hidden", "true");
    return tile;
  }

  // Search ----------------------------------------------------------------

  function normalize(s) {
    return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
  }

  function buildIndex() {
    index = data.foods.map(function (f) {
      var text = normalize(f[1] + " " + f[8]);
      return { f: f, text: text, words: text.split(" "), label: normalize(f[1]), alias: " " + normalize(f[8]) + " " };
    });
  }

  function search(query) {
    var q = normalize(query);
    if (!q) return [];
    var tokens = q.split(" ");
    var hits = [];
    index.forEach(function (entry) {
      for (var t = 0; t < tokens.length; t++) {
        var token = tokens[t];
        var stem = token.length > 3 ? token.replace(/(es|s)$/, "") : token;
        var found = false;
        for (var w = 0; w < entry.words.length; w++) {
          if (entry.words[w].indexOf(token) === 0 || entry.words[w].indexOf(stem) === 0) { found = true; break; }
        }
        if (!found) return;
      }
      var score = entry.f[7] * 10 - entry.label.length / 12;
      if (entry.alias.indexOf(" " + q + " ") !== -1) score += 30;
      if (entry.label.indexOf(q) === 0) score += 10;
      if (entry.words[0] === tokens[0] || entry.words[0] === tokens[0] + "s") score += 8;
      hits.push({ f: entry.f, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, 8).map(function (h) { return h.f; });
  }

  var results = [];
  var active = -1;

  function renderResults() {
    var list = $("DfResults");
    var input = $("DfSearch");
    clear(list);
    if (!results.length) {
      if (input.value.trim()) {
        list.appendChild(el("li", "df-result-empty", "No match. Try a simpler word, like \"beans\"."));
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
      } else {
        list.hidden = true;
        input.setAttribute("aria-expanded", "false");
      }
      return;
    }
    results.forEach(function (f, i) {
      var li = el("li", "df-result" + (i === active ? " is-active" : ""));
      li.id = "DfResult" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === active ? "true" : "false");
      li.appendChild(thumb(f, "df-result-photo"));
      var copy = el("span", "df-result-copy");
      copy.appendChild(el("span", "df-result-name", f[1]));
      var unit = f[6][0];
      copy.appendChild(el("span", "df-result-meta", fmtQty(unit[2] || 1) + " " + ((unit[2] || 1) > 1 ? plural(unit[0]) : unit[0])));
      li.appendChild(copy);
      if (f[3] === 2) li.appendChild(el("span", "df-tag is-avoid", "Avoid"));
      li.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
      li.addEventListener("click", function () { choose(i); });
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-activedescendant", active >= 0 ? "DfResult" + active : "");
  }

  function choose(i) {
    var f = results[i];
    if (!f) return;
    $("DfSearch").value = "";
    results = [];
    active = -1;
    renderResults();
    openAmount({ id: f[0], u: 0, q: f[6][0][2] || 1, slot: pendingSlot || guessSlot() }, -1);
    pendingSlot = null;
  }

  var pendingSlot = null;

  function wireSearch() {
    var input = $("DfSearch");
    input.addEventListener("input", function () {
      results = search(input.value);
      active = results.length ? 0 : -1;
      renderResults();
    });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown" && results.length) { active = (active + 1) % results.length; renderResults(); ev.preventDefault(); }
      else if (ev.key === "ArrowUp" && results.length) { active = (active - 1 + results.length) % results.length; renderResults(); ev.preventDefault(); }
      else if (ev.key === "Enter" && active >= 0) { choose(active); ev.preventDefault(); }
      else if (ev.key === "Escape") { input.value = ""; results = []; renderResults(); }
    });
    input.addEventListener("blur", function () {
      setTimeout(function () { results = []; renderResults(); }, 150);
    });
    input.disabled = false;
  }

  // Amount sheet ------------------------------------------------------------

  function openAmount(item, editIndex) {
    var f = food(item.id);
    if (!f) return;
    sheet = { item: { id: item.id, u: item.u, q: item.q, slot: item.slot }, edit: editIndex };
    var photo = $("DfAmountPhoto");
    clear(photo);
    photo.appendChild(thumb(f, "df-sheet-img"));
    $("DfAmountName").textContent = f[1];
    var warn = $("DfAmountWarning");
    warn.hidden = !f[3];
    warn.className = "df-sheet-warning" + (f[3] === 2 ? " is-avoid" : "");
    warn.textContent = f[3] === 2 ? "Pregnancy guidance says to avoid this. " + f[4] : f[4];
    $("DfRemove").hidden = editIndex < 0;
    renderSheet();
    var dialog = $("DfAmount");
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
    $("DfConfirm").focus();
  }

  function renderSheet() {
    var f = food(sheet.item.id);
    var item = sheet.item;
    var units = $("DfUnits");
    clear(units);
    f[6].concat([["grams", 1]]).forEach(function (unit, i) {
      var u = i === f[6].length ? GRAMS : i;
      var label = el("label", "df-pill");
      var input = el("input");
      input.type = "radio";
      input.name = "unit";
      input.checked = item.u === u;
      input.addEventListener("change", function () {
        var g = grams(item);
        item.u = u;
        item.q = u === GRAMS ? Math.max(5, Math.round(g / 5) * 5) : (f[6][u][2] || 1);
        renderSheet();
      });
      label.appendChild(input);
      label.appendChild(el("span", "", unit[0]));
      units.appendChild(label);
    });

    var inGrams = item.u === GRAMS;
    $("DfQty").hidden = inGrams;
    $("DfGramsInput").hidden = !inGrams;
    if (inGrams) $("DfGramsInput").value = item.q;
    else $("DfQty").textContent = fmtQty(item.q);
    $("DfGrams").textContent = inGrams ? "" : "About " + Math.round(grams(item)) + " g";

    renderGains();

    var slots = $("DfSlots");
    clear(slots);
    SLOTS.forEach(function (s) {
      var label = el("label", "df-pill");
      var input = el("input");
      input.type = "radio";
      input.name = "slot";
      input.checked = item.slot === s[0];
      input.addEventListener("change", function () { item.slot = s[0]; renderSheet(); });
      label.appendChild(input);
      label.appendChild(el("span", "", s[1]));
      slots.appendChild(label);
    });
    $("DfConfirm").textContent = sheet.edit >= 0 ? "Save" : "Add to " + slotName(item.slot).toLowerCase();
  }

  function step(dir) {
    var item = sheet.item;
    if (item.u === GRAMS) {
      item.q = Math.max(5, item.q + dir * 10);
    } else {
      var name = food(item.id)[6][item.u][0];
      var steps = MEASURE.test(name) ? STEPS : COUNT_STEPS;
      var i = 0;
      while (i < steps.length - 1 && steps[i] < item.q) i++;
      if (steps[i] !== item.q && dir < 0) i++;
      item.q = steps[Math.max(0, Math.min(steps.length - 1, i + dir))];
    }
    renderSheet();
  }

  function closeSheet(dialog) {
    if (dialog.close) dialog.close(); else dialog.removeAttribute("open");
  }

  function wireSheet() {
    $("DfLess").addEventListener("click", function () { step(-1); });
    $("DfMore").addEventListener("click", function () { step(1); });
    $("DfGramsInput").addEventListener("input", function () {
      var v = Number($("DfGramsInput").value);
      if (v > 0) { sheet.item.q = v; renderGains(); }
    });
    $("DfCancel").addEventListener("click", function () { closeSheet($("DfAmount")); });
    $("DfRemove").addEventListener("click", function () {
      undoable("Removed " + food(sheet.item.id)[1]);
      state.items.splice(sheet.edit, 1);
      commit();
      closeSheet($("DfAmount"));
    });
    $("DfAmountForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var item = sheet.item;
      if (sheet.edit >= 0) {
        state.items[sheet.edit] = item;
      } else {
        undoable("Added " + food(item.id)[1] + " to " + slotName(item.slot).toLowerCase());
        state.items.push(item);
      }
      commit();
      closeSheet($("DfAmount"));
    });
  }

  // What this amount adds; kept separate so typing grams isn't interrupted.
  function renderGains() {
    var gains = $("DfGains");
    clear(gains);
    var ranked = amounts([sheet.item]).map(function (a, i) { return { i: i, p: percent(i, a) }; })
      .filter(function (x) { return x.p >= 1; })
      .sort(function (a, b) { return b.p - a.p; })
      .slice(0, 3);
    if (!ranked.length) gains.appendChild(el("li", "df-gain is-quiet", "Small amounts of these nutrients"));
    ranked.forEach(function (x) {
      gains.appendChild(el("li", "df-gain", "+" + Math.round(x.p) + "% " + inSentence(data.nutrients[x.i].name)));
    });
  }

  // Meals -----------------------------------------------------------------

  function renderMeals() {
    var root = $("DfMeals");
    clear(root);
    SLOTS.forEach(function (s) {
      var section = el("section", "df-meal");
      section.setAttribute("aria-label", s[1]);
      var head = el("div", "df-meal-head");
      var titles = el("div", "df-meal-titles");
      titles.appendChild(el("h2", "df-meal-title", s[1]));
      if (state.plan[s[0]]) titles.appendChild(el("p", "df-meal-plan", state.plan[s[0]]));
      var mealItems = state.items.filter(function (item) { return item.slot === s[0] && food(item.id); });
      if (mealItems.length) {
        var best = amounts(mealItems).map(function (a, i) { return { i: i, p: percent(i, a) }; })
          .sort(function (a, b) { return b.p - a.p; }).slice(0, 2)
          .filter(function (x) { return x.p >= 5; });
        if (best.length) {
          titles.appendChild(el("p", "df-meal-gains", best.map(function (x) {
            return "+" + Math.round(x.p) + "% " + inSentence(data.nutrients[x.i].name);
          }).join(" · ")));
        }
        var stack = el("span", "df-stack");
        stack.setAttribute("aria-hidden", "true");
        mealItems.slice(0, 3).forEach(function (item) { stack.appendChild(thumb(food(item.id), "df-stack-photo")); });
        head.appendChild(stack);
      }
      head.appendChild(titles);
      var add = el("button", "df-meal-add", "Add");
      add.type = "button";
      add.setAttribute("aria-label", "Add a food to " + s[1].toLowerCase());
      add.addEventListener("click", function () {
        pendingSlot = s[0];
        var input = $("DfSearch");
        input.focus();
        input.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      head.appendChild(add);
      section.appendChild(head);

      var list = el("ul", "df-items");
      state.items.forEach(function (item, i) {
        if (item.slot !== s[0]) return;
        var f = food(item.id);
        if (!f) return;
        var li = el("li", "df-item");
        var open = el("button", "df-item-open");
        open.type = "button";
        open.setAttribute("aria-label", "Change amount of " + f[1]);
        open.appendChild(thumb(f, "df-item-photo"));
        var copy = el("span", "df-item-copy");
        copy.appendChild(el("span", "df-item-name", f[1]));
        copy.appendChild(el("span", "df-item-amount", amountText(item)));
        open.appendChild(copy);
        open.addEventListener("click", function () { openAmount(item, i); });
        li.appendChild(open);
        var remove = el("button", "df-item-remove", "×");
        remove.type = "button";
        remove.setAttribute("aria-label", "Remove " + f[1]);
        remove.addEventListener("click", function () {
          undoable("Removed " + f[1]);
          state.items.splice(i, 1);
          commit();
        });
        li.appendChild(remove);
        list.appendChild(li);
      });
      if (!list.children.length) section.appendChild(el("p", "df-meal-empty", "Nothing yet"));
      else section.appendChild(list);
      root.appendChild(section);
    });
    var any = state.items.length > 0;
    $("DfClear").hidden = !any;
    $("DfShuffle").hidden = !Object.keys(state.plan).length;
  }

  // Daily fit -------------------------------------------------------------

  var RING = 2 * Math.PI * 26;

  function status(p) {
    if (p >= 100) return ["is-covered", "Covered"];
    if (p >= 50) return ["is-close", "Getting there"];
    return [p > 0 ? "is-low" : "is-none", p > 0 ? "Low" : "Not yet"];
  }

  function renderFit() {
    var totals = amounts(state.items);
    var list = $("DfNutrients");
    clear(list);
    var covered = 0;
    data.nutrients.forEach(function (n, i) {
      var p = percent(i, totals[i]);
      if (p >= 100) covered++;
      var st = status(p);
      var li = el("li", "df-nutrient " + st[0]);
      var btn = el("button", "df-ring-btn");
      btn.type = "button";
      btn.setAttribute("aria-expanded", openNutrient === i ? "true" : "false");
      btn.setAttribute("aria-label", n.name + ": " + Math.round(p) + "% of the daily pregnancy reference. " + st[1] + ".");
      var svgNS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 60 60");
      svg.setAttribute("class", "df-ring");
      svg.setAttribute("aria-hidden", "true");
      var track = document.createElementNS(svgNS, "circle");
      track.setAttribute("class", "df-ring-track");
      var fill = document.createElementNS(svgNS, "circle");
      fill.setAttribute("class", "df-ring-fill");
      [track, fill].forEach(function (c) { c.setAttribute("cx", "30"); c.setAttribute("cy", "30"); c.setAttribute("r", "26"); });
      fill.setAttribute("stroke-dasharray", RING.toFixed(1));
      fill.setAttribute("stroke-dashoffset", (RING * (1 - Math.min(p, 100) / 100)).toFixed(1));
      svg.appendChild(track);
      svg.appendChild(fill);
      btn.appendChild(svg);
      btn.appendChild(el("span", "df-ring-value", p >= 100 ? "✓" : Math.round(p) + "%"));
      btn.appendChild(el("span", "df-ring-name", n.name));
      btn.addEventListener("click", function () {
        openNutrient = openNutrient === i ? -1 : i;
        renderFit();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
    $("DfCovered").textContent = covered;
    $("DfDockText").textContent = covered + " of 13";
    renderSummary(totals, covered);
    renderDetail(totals);
  }

  var BIG_RING = 2 * Math.PI * 52;

  // One glanceable number, an encouraging line, and the nutrients to look at next.
  function renderSummary(totals, covered) {
    var pcts = totals.map(function (a, i) { return percent(i, a); });
    var overall = pcts.reduce(function (sum, p) { return sum + Math.min(100, p); }, 0) / pcts.length;
    var fill = $("DfBigFill");
    fill.setAttribute("stroke-dasharray", BIG_RING.toFixed(1));
    fill.setAttribute("stroke-dashoffset", (BIG_RING * (1 - overall / 100)).toFixed(1));

    var low = pcts.map(function (p, i) { return { i: i, p: p }; })
      .filter(function (x) { return x.p < 100; })
      .sort(function (a, b) { return a.p - b.p; });
    var lowest = low.length ? inSentence(data.nutrients[low[0].i].name) : "";
    var mood;
    if (!state.items.length) mood = "Add your first food, or let us plan the day for you.";
    else if (covered === pcts.length) mood = "Every nutrient covered. What a day.";
    else if (covered >= 10) mood = "Almost there. A little more " + lowest + " would round it out.";
    else if (covered >= 5) mood = "Good progress. " + lowest.charAt(0).toUpperCase() + lowest.slice(1) + " could use a boost.";
    else mood = "A good start. Keep going.";
    $("DfMood").textContent = mood;

    var chips = $("DfLow");
    clear(chips);
    if (!state.items.length) return;
    low.slice(0, 3).forEach(function (x) {
      var li = el("li");
      var btn = el("button", "df-low-chip", data.nutrients[x.i].name + " " + Math.round(x.p) + "%");
      btn.type = "button";
      btn.setAttribute("aria-label", "Show foods for " + data.nutrients[x.i].name);
      btn.addEventListener("click", function () {
        openNutrient = x.i;
        renderFit();
        $("DfDetail").scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      li.appendChild(btn);
      chips.appendChild(li);
    });
  }

  function renderDetail(totals) {
    var box = $("DfDetail");
    clear(box);
    if (openNutrient < 0) { box.hidden = true; return; }
    var i = openNutrient;
    var n = data.nutrients[i];
    var p = percent(i, totals[i]);
    var head = el("div", "df-detail-head");
    head.appendChild(el("h3", "", n.name));
    var amount = Math.round(totals[i] * 10) / 10;
    head.appendChild(el("p", "", amount + " of " + n.target + " " + n.unit + (p >= 100 ? " · covered" : " · " + Math.max(1, Math.round(100 - p)) + "% to go")));
    box.appendChild(head);

    var from = state.items.map(function (item) {
      var f = food(item.id);
      return { f: f, p: percent(i, f[5][i] * grams(item) / 100) };
    }).filter(function (x) { return x.p >= 1; }).sort(function (a, b) { return b.p - a.p; }).slice(0, 3);
    if (from.length) {
      box.appendChild(el("p", "df-detail-from", "Mostly from " + from.map(function (x) { return x.f[1].split(",")[0].toLowerCase(); }).join(", ") + "."));
    }

    if (p < 100) {
      box.appendChild(el("p", "df-label", "Foods that help"));
      var helpers = el("ul", "df-helpers");
      data.helpers[i].forEach(function (id) {
        var f = food(id);
        if (!f) return;
        var unit = f[6][0];
        var q = unit[2] || 1;
        var gain = percent(i, f[5][i] * unit[1] * q / 100);
        var li = el("li");
        var btn = el("button", "df-helper");
        btn.type = "button";
        btn.appendChild(thumb(f, "df-helper-photo"));
        var copy = el("span", "df-helper-copy");
        copy.appendChild(el("span", "df-helper-name", f[1].split(",")[0]));
        copy.appendChild(el("span", "df-helper-gain", "+" + Math.round(gain) + "% in " + fmtQty(q) + " " + (q > 1 ? plural(unit[0]) : unit[0])));
        btn.appendChild(copy);
        btn.setAttribute("aria-label", "Add " + f[1]);
        btn.addEventListener("click", function () { openAmount({ id: id, u: 0, q: q, slot: guessSlot() }, -1); });
        li.appendChild(btn);
        helpers.appendChild(li);
      });
      box.appendChild(helpers);
    }
    var more = el("a", "df-detail-link", "Why " + inSentence(n.name) + " matters in pregnancy");
    more.href = n.guide;
    box.appendChild(more);
    box.hidden = false;
  }

  // Design my day ---------------------------------------------------------

  function fits(meal, prefs, prep) {
    var diet = meal[2];
    if (prefs.style === "vegetarian" && diet !== "vegetarian" && diet !== "vegan") return false;
    if (prefs.style === "vegan" && diet !== "vegan") return false;
    if (prefs.df && !meal[3]) return false;
    if (prefs.gf && !meal[4]) return false;
    return meal[5] <= prep;
  }

  function mealItems(meal, slot) {
    return meal[6].map(function (it) { return { id: it[0], q: it[1], u: it[2] || 0, slot: slot }; });
  }

  // Try many random days and keep the one that covers the most, so each plan
  // is varied but still strong.
  function planDay(prefs, avoid) {
    var pools = {};
    SLOTS.forEach(function (s) {
      var prep = prefs.prep;
      var pool = [];
      while (prep <= 3) {
        pool = data.meals.filter(function (m) { return m[0] === s[0] && fits(m, prefs, prep); });
        if (pool.length >= 2) break;
        prep++;
      }
      var fresh = pool.filter(function (m) { return !avoid || avoid.indexOf(m[1]) === -1; });
      pools[s[0]] = fresh.length ? fresh : pool;
    });
    var best = null;
    var bestScore = -1;
    for (var t = 0; t < 80; t++) {
      var pick = SLOTS.map(function (s) {
        var pool = pools[s[0]];
        return pool[Math.floor(Math.random() * pool.length)];
      });
      if (pick.some(function (m) { return !m; })) continue;
      var items = [];
      pick.forEach(function (m, k) { items = items.concat(mealItems(m, SLOTS[k][0])); });
      var totals = amounts(items);
      var score = totals.reduce(function (sum, a, i) { return sum + Math.min(100, percent(i, a)); }, 0) + Math.random() * 40;
      if (score > bestScore) { bestScore = score; best = { pick: pick, items: items }; }
    }
    return best;
  }

  function applyPlan(avoid) {
    var plan = planDay(state.prefs, avoid);
    if (!plan) return;
    state.items = plan.items;
    state.plan = {};
    plan.pick.forEach(function (m, k) { state.plan[SLOTS[k][0]] = m[1]; });
    commit();
  }

  function wireDesign() {
    var dialog = $("DfDesign");
    var form = $("DfDesignForm");
    var prep = $("DfPrep");
    var prepWords = ["", "Minimal", "Some", "Happy to cook"];
    prep.addEventListener("input", function () { prep.setAttribute("aria-valuetext", prepWords[prep.value]); });
    $("DfDesignOpen").addEventListener("click", function () {
      var p = state.prefs;
      form.querySelector("input[name=style][value=" + p.style + "]").checked = true;
      form.elements.df.checked = !!p.df;
      form.elements.gf.checked = !!p.gf;
      prep.value = p.prep;
      prep.setAttribute("aria-valuetext", prepWords[p.prep]);
      $("DfDesignHint").hidden = !state.items.length;
      if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
    });
    $("DfDesignOpen").disabled = false;
    $("DfDesignCancel").addEventListener("click", function () { closeSheet(dialog); });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      state.prefs = {
        style: form.querySelector("input[name=style]:checked").value,
        df: form.elements.df.checked,
        gf: form.elements.gf.checked,
        prep: Number(prep.value)
      };
      if (state.items.length) undoable("Planned a new day");
      applyPlan(null);
      closeSheet(dialog);
      $("DfMeals").scrollIntoView({ block: "start", behavior: "smooth" });
    });
    $("DfShuffle").addEventListener("click", function () {
      undoable("Shuffled your day");
      var current = SLOTS.map(function (s) { return state.plan[s[0]]; });
      applyPlan(current);
    });
    $("DfClear").addEventListener("click", function () {
      undoable("Cleared today");
      state.items = [];
      state.plan = {};
      commit();
    });
  }

  // Undo toast and peek bar -------------------------------------------------

  function undoable(message) {
    undoState = snapshot();
    $("DfToastText").textContent = message;
    var toast = $("DfToast");
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; undoState = null; }, 6000);
  }

  function wireToast() {
    $("DfUndo").addEventListener("click", function () {
      if (!undoState) return;
      state = undoState;
      undoState = null;
      $("DfToast").hidden = true;
      commit();
    });
  }

  // Phones get a bottom dock once the search bar scrolls away.
  function wireDock() {
    var dock = $("DfDock");
    $("DfDockScore").addEventListener("click", function () {
      $("DfFit").scrollIntoView({ block: "start", behavior: "smooth" });
    });
    $("DfDockAdd").addEventListener("click", function () {
      var input = $("DfSearch");
      input.scrollIntoView({ block: "center", behavior: "smooth" });
      input.focus({ preventScroll: true });
    });
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      dock.hidden = entries[0].isIntersecting || window.matchMedia("(min-width: 961px)").matches;
    }).observe($("DfSearch"));
  }

  function commit() {
    save();
    renderMeals();
    renderFit();
  }

  function start(json) {
    data = json;
    data.foods.forEach(function (f) { byId[f[0]] = f; });
    state.items = state.items.filter(function (item) { return byId[item.id]; });
    buildIndex();
    wireSearch();
    wireSheet();
    wireDesign();
    wireToast();
    wireDock();
    commit();
  }

  fetch(DATA_URL)
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(start)
    .catch(function () {
      $("DfMeals").textContent = "The calculator could not load. Refresh the page to try again.";
    });
})();
