// src/js/daily-fit.js
// Daily Fit: log foods in everyday portions, see 13 pregnancy nutrients fill
// up, or plan a whole day from the meal library. Everything stays in this
// browser (localStorage); data comes from /resource/daily-fit.v1.json.

(function () {
  var DATA_URL = "/resource/daily-fit.v1.json";
  var STORE_KEY = "pregnut.dailyFit.v1";
  var SLOTS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["snack", "Snack"], ["dinner", "Dinner"]];
  // Shown while a meal is empty.
  var SLOT_PHOTOS = {
    breakfast: "/resource/portions/portion-oatmeal-100g.webp",
    lunch: "/resource/portions/portion-lentils-100g.webp",
    snack: "/resource/portions/portion-almonds-100g.webp",
    dinner: "/resource/portions/portion-salmon-100g.webp"
  };
  var STEPS = [0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  // Eggs, slices and bananas count in whole numbers (and a half).
  var COUNT_STEPS = [0.5, 1, 2, 3, 4, 5, 6, 8, 10];
  var MEASURE = /cup|tbsp|tsp|\boz\b|handful|portion|scoop|serving|container|order|plate|bowl|worth/;
  var FRACTIONS = { 0.125: "⅛", 0.25: "¼", 0.5: "½", 0.75: "¾", 1.5: "1½", 2.5: "2½" };
  var GRAMS = -1;
  var CALORIES = 13; // index of calories in each food's values

  var data = null;
  var byId = {};
  var index = [];
  var state = loadState();
  var tab = guessSlot();
  var sheet = null; // the item being added or edited
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

  // food: [id, label, image, level, warningText, values, portions, rank, alias, largeImage]
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

  function calories(items) {
    return items.reduce(function (sum, item) {
      var f = food(item.id);
      return f ? sum + f[5][CALORIES] * grams(item) / 100 : sum;
    }, 0);
  }

  function percent(i, amount) { return amount / data.nutrients[i].target * 100; }

  function ranked(items, count) {
    return amounts(items).map(function (a, i) { return { i: i, p: percent(i, a) }; })
      .filter(function (x) { return x.p >= 1; })
      .sort(function (a, b) { return b.p - a.p; })
      .slice(0, count);
  }

  function fmtQty(q) {
    if (FRACTIONS[q]) return FRACTIONS[q];
    return String(Math.round(q * 100) / 100);
  }

  function fmtAmount(n) {
    if (n >= 100) return String(Math.round(n));
    if (n >= 10) return String(Math.round(n));
    return String(Math.round(n * 10) / 10);
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

  function portionText(f, u, q) {
    var name = (f[6][u] || f[6][0])[0];
    return fmtQty(q) + " " + (q > 1 ? plural(name) : name);
  }

  function amountText(item) {
    var f = food(item.id);
    var g = Math.round(grams(item));
    if (item.u === GRAMS) return g + " g";
    return portionText(f, item.u, item.q) + " · " + g + " g";
  }

  // "Vitamin B12" -> "vitamin B12", "Iron" -> "iron", "DHA" stays.
  function inSentence(name) {
    if (/^[A-Z]{2,}/.test(name)) return name;
    if (/^Vitamin /.test(name)) return "vitamin " + name.slice(8);
    return name.toLowerCase();
  }

  function shortName(f) { return f[1].split(",")[0]; }

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

  function photo(f, className, large) {
    var src = large && f[9] ? f[9] : f[2];
    if (src) {
      var img = el("img", className);
      img.src = src;
      img.alt = "";
      img.width = large && f[9] ? 900 : 400;
      img.height = img.width;
      img.loading = "lazy";
      img.decoding = "async";
      return img;
    }
    var tile = el("span", className + " is-empty", f[1].charAt(0).toUpperCase());
    tile.setAttribute("aria-hidden", "true");
    return tile;
  }

  function openDialog(dialog) {
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (dialog.close) dialog.close(); else dialog.removeAttribute("open");
  }

  // Close a sheet by tapping the dimmed backdrop.
  function closeOnBackdrop(dialog) {
    dialog.addEventListener("click", function (ev) { if (ev.target === dialog) closeDialog(dialog); });
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
  var pendingSlot = null;

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
      li.appendChild(photo(f, "df-result-photo"));
      var copy = el("span", "df-result-copy");
      copy.appendChild(el("span", "df-result-name", f[1]));
      copy.appendChild(el("span", "df-result-meta", portionText(f, 0, f[6][0][2] || 1)));
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
    openAmount({ id: f[0], u: 0, q: f[6][0][2] || 1, slot: pendingSlot || tab }, -1);
    pendingSlot = null;
  }

  function focusSearch(slot) {
    pendingSlot = slot || null;
    var input = $("DfSearch");
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus({ preventScroll: true });
  }

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
    var holder = $("DfAmountPhoto");
    clear(holder);
    holder.hidden = !f[9] && !f[2];
    if (!holder.hidden) holder.appendChild(photo(f, "df-sheet-img", true));
    holder.parentNode.classList.toggle("is-plain", holder.hidden);
    $("DfAmountName").textContent = f[1];
    var warn = $("DfAmountWarning");
    warn.hidden = !f[3];
    warn.className = "df-sheet-warning" + (f[3] === 2 ? " is-avoid" : "");
    warn.textContent = f[3] === 2 ? "Pregnancy guidance says to avoid this. " + f[4] : f[4];
    $("DfRemove").hidden = editIndex < 0;
    renderSheet();
    openDialog($("DfAmount"));
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
    $("DfGrams").textContent = inGrams ? "" : Math.round(grams(item)) + " g";
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

  // What this amount adds, as tall stat bars; kept separate so typing grams isn't interrupted.
  function renderGains() {
    var gains = $("DfGains");
    clear(gains);
    var top = ranked([sheet.item], 3);
    if (!top.length) { gains.appendChild(el("li", "df-gain is-quiet", "Small amounts of these nutrients")); return; }
    top.forEach(function (x) {
      var li = el("li", "df-gain");
      var value = el("span", "df-gain-value", "+" + Math.round(x.p));
      value.appendChild(el("small", "", "%"));
      li.appendChild(value);
      li.appendChild(el("span", "df-gain-name", data.nutrients[x.i].name));
      gains.appendChild(li);
    });
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

  function wireSheet() {
    var dialog = $("DfAmount");
    closeOnBackdrop(dialog);
    $("DfLess").addEventListener("click", function () { step(-1); });
    $("DfMore").addEventListener("click", function () { step(1); });
    $("DfGramsInput").addEventListener("input", function () {
      var v = Number($("DfGramsInput").value);
      if (v > 0) { sheet.item.q = v; renderGains(); }
    });
    $("DfCancel").addEventListener("click", function () { closeDialog(dialog); });
    $("DfRemove").addEventListener("click", function () {
      undoable("Removed " + shortName(food(sheet.item.id)));
      state.items.splice(sheet.edit, 1);
      commit();
      closeDialog(dialog);
    });
    $("DfAmountForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var item = sheet.item;
      if (sheet.edit >= 0) {
        state.items[sheet.edit] = item;
      } else {
        undoable("Added " + shortName(food(item.id)) + " to " + slotName(item.slot).toLowerCase());
        state.items.push(item);
      }
      tab = item.slot;
      commit();
      closeDialog(dialog);
    });
  }

  // Meals: tabs, a photo card for the chosen meal, and its foods ------------

  function mealItems(slot) {
    return state.items.filter(function (item) { return item.slot === slot && food(item.id); });
  }

  function renderTabs() {
    var root = $("DfTabs");
    clear(root);
    SLOTS.forEach(function (s) {
      var count = mealItems(s[0]).length;
      var btn = el("button", "df-tab", s[1]);
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", tab === s[0] ? "true" : "false");
      if (count) btn.appendChild(el("span", "df-tab-count", count));
      btn.addEventListener("click", function () { tab = s[0]; renderMeals(); });
      root.appendChild(btn);
    });
  }

  function heroCard(items) {
    var card = el("div", "df-hero-card" + (items.length ? "" : " is-empty"));
    // The biggest food with a photo leads; drinks only if nothing else has one.
    var main = null;
    items.forEach(function (item) {
      var f = food(item.id);
      if (!f[9] && !f[2]) return;
      var drink = /fl oz/.test((f[6][item.u] || f[6][0])[0]);
      var score = grams(item) - (drink ? 10000 : 0);
      if (!main || score > main.score) main = { item: item, score: score };
    });
    var lead = main ? food(main.item.id) : null;
    if (lead && lead[9]) {
      card.appendChild(photo(lead, "df-hero-photo", true));
    } else if (lead) {
      // Small photos sit on a plate instead of being stretched.
      card.className += " is-plate";
      card.appendChild(photo(lead, "df-hero-plate"));
    } else {
      var img = el("img", "df-hero-photo");
      img.src = SLOT_PHOTOS[tab];
      img.alt = "";
      img.width = 900;
      img.height = 900;
      card.appendChild(img);
    }
    var copy = el("div", "df-hero-copy");
    if (items.length) {
      copy.appendChild(el("h3", "", state.plan[tab] || "Your " + slotName(tab).toLowerCase()));
      copy.appendChild(el("p", "", items.length + (items.length === 1 ? " food" : " foods") + " · " + Math.round(calories(items)) + " kcal"));
    } else {
      copy.appendChild(el("h3", "", "Nothing for " + slotName(tab).toLowerCase() + " yet"));
      copy.appendChild(el("p", "", "Search a food, or let us design your day."));
    }
    card.appendChild(copy);
    var add = el("button", "df-hero-add");
    add.type = "button";
    add.setAttribute("aria-label", "Add a food to " + slotName(tab).toLowerCase());
    add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    add.addEventListener("click", function () { focusSearch(tab); });
    card.appendChild(add);
    return card;
  }

  function mealStats(items) {
    var stats = el("ul", "df-stats");
    var protein = 0;
    data.nutrients.forEach(function (n, i) { if (n.name === "Protein") protein = amounts(items)[i]; });
    var best = ranked(items, 1)[0];
    var rows = [
      [String(Math.round(calories(items))), "", "Calories", "is-ink"],
      [fmtAmount(protein), "g", "Protein", "is-green"],
      best ? [String(Math.round(best.p)), "%", data.nutrients[best.i].name, "is-peach"] : ["0", "%", "Nutrients", "is-peach"]
    ];
    rows.forEach(function (r) {
      var li = el("li", "df-stat " + r[3]);
      var v = el("span", "df-stat-value", r[0]);
      if (r[1]) v.appendChild(el("small", "", r[1]));
      li.appendChild(v);
      li.appendChild(el("span", "df-stat-name", r[2]));
      stats.appendChild(li);
    });
    return stats;
  }

  function ingredientList(items) {
    var box = el("div", "df-foods");
    var head = el("div", "df-foods-head");
    var titles = el("div");
    titles.appendChild(el("h3", "", "Foods"));
    titles.appendChild(el("p", "", items.length ? items.length + (items.length === 1 ? " food" : " foods") + " in " + slotName(tab).toLowerCase() : "Add what you ate"));
    head.appendChild(titles);
    var add = el("button", "df-round-btn");
    add.type = "button";
    add.setAttribute("aria-label", "Add a food to " + slotName(tab).toLowerCase());
    add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    add.addEventListener("click", function () { focusSearch(tab); });
    head.appendChild(add);
    box.appendChild(head);

    var list = el("ul", "df-items");
    state.items.forEach(function (item, i) {
      if (item.slot !== tab) return;
      var f = food(item.id);
      if (!f) return;
      var li = el("li", "df-item");
      var open = el("button", "df-item-open");
      open.type = "button";
      open.setAttribute("aria-label", "Change amount of " + f[1]);
      var pic = el("span", "df-item-pic");
      pic.appendChild(photo(f, "df-item-photo"));
      open.appendChild(pic);
      var copy = el("span", "df-item-copy");
      copy.appendChild(el("span", "df-item-name", f[1]));
      var top = ranked([item], 1)[0];
      copy.appendChild(el("span", "df-item-amount", amountText(item) + (top && top.p >= 5 ? " · +" + Math.round(top.p) + "% " + inSentence(data.nutrients[top.i].name) : "")));
      open.appendChild(copy);
      open.addEventListener("click", function () { openAmount(item, i); });
      li.appendChild(open);
      var remove = el("button", "df-item-remove", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove " + f[1]);
      remove.addEventListener("click", function () {
        undoable("Removed " + shortName(f));
        state.items.splice(i, 1);
        commit();
      });
      li.appendChild(remove);
      list.appendChild(li);
    });
    if (list.children.length) box.appendChild(list);
    return box;
  }

  function renderMeals() {
    renderTabs();
    var root = $("DfMeals");
    clear(root);
    var items = mealItems(tab);
    var left = el("div", "df-meal-main");
    left.appendChild(heroCard(items));
    left.appendChild(mealStats(items));
    root.appendChild(left);
    root.appendChild(ingredientList(items));
    $("DfClear").hidden = !state.items.length;
    $("DfShuffle").hidden = !Object.keys(state.plan).length;
  }

  // Nutrient cards ----------------------------------------------------------

  var RING = 2 * Math.PI * 9;

  function status(p) {
    if (p >= 100) return "is-covered";
    if (p >= 50) return "is-close";
    return p > 0 ? "is-low" : "is-none";
  }

  function renderFit() {
    var totals = amounts(state.items);
    var list = $("DfNutrients");
    clear(list);
    var covered = 0;
    data.nutrients.forEach(function (n, i) {
      var p = percent(i, totals[i]);
      if (p >= 100) covered++;
      var li = el("li", "df-card " + status(p));
      var btn = el("button", "df-card-btn");
      btn.type = "button";
      btn.setAttribute("aria-label", n.name + ": " + Math.round(p) + "% of the daily pregnancy reference. Show foods.");
      var top = el("span", "df-card-top");
      top.appendChild(el("span", "df-card-name", n.name));
      top.insertAdjacentHTML("beforeend", '<svg class="df-mini-ring" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle class="df-mini-fill" cx="12" cy="12" r="9" stroke-dasharray="' +
        RING.toFixed(1) + '" stroke-dashoffset="' + (RING * (1 - Math.min(p, 100) / 100)).toFixed(1) + '"/></svg>');
      btn.appendChild(top);
      btn.appendChild(el("span", "df-card-label", fmtAmount(totals[i]) + " of " + n.target + " " + n.unit));
      var value = el("span", "df-card-value", p >= 100 ? "✓ " + Math.round(p) : String(Math.round(p)));
      value.appendChild(el("small", "", "%"));
      btn.appendChild(value);
      btn.addEventListener("click", function () { openNutrient(i); });
      li.appendChild(btn);
      list.appendChild(li);
    });
    $("DfCovered").textContent = covered;
    $("DfDockText").textContent = covered + " of 13";
    renderMood(totals, covered);
  }

  function renderMood(totals, covered) {
    var low = totals.map(function (a, i) { return { i: i, p: percent(i, a) }; })
      .filter(function (x) { return x.p < 100; })
      .sort(function (a, b) { return a.p - b.p; });
    var lowest = low.length ? inSentence(data.nutrients[low[0].i].name) : "";
    var mood;
    if (!state.items.length) mood = "Add what you ate and watch your nutrients fill up.";
    else if (covered === totals.length) mood = "Every nutrient covered. What a day.";
    else if (covered >= 10) mood = "Almost there. A little more " + lowest + " would round it out.";
    else if (covered >= 5) mood = "Good progress. " + lowest.charAt(0).toUpperCase() + lowest.slice(1) + " could use a boost.";
    else mood = "A good start. Keep going.";
    $("DfMood").textContent = mood;
  }

  // Tapping a card opens a sheet: where it stands, what fed it, what would help.
  function openNutrient(i) {
    var totals = amounts(state.items);
    var n = data.nutrients[i];
    var p = percent(i, totals[i]);
    var body = $("DfNutrientBody");
    clear(body);

    var top = el("div", "df-sheet-top");
    top.appendChild(el("h2", "", n.name));
    var close = el("button", "df-skip", "Close");
    close.type = "button";
    close.addEventListener("click", function () { closeDialog($("DfNutrientSheet")); });
    top.appendChild(close);
    body.appendChild(top);
    body.appendChild(el("p", "df-sub", fmtAmount(totals[i]) + " of " + n.target + " " + n.unit + (p >= 100 ? " · covered for today" : " · " + Math.max(1, Math.round(100 - p)) + "% to go")));
    var meter = el("div", "df-meter " + status(p));
    var bar = el("span");
    bar.style.width = Math.min(100, p) + "%";
    meter.appendChild(bar);
    body.appendChild(meter);

    var from = state.items.map(function (item) {
      var f = food(item.id);
      return { f: f, p: percent(i, f[5][i] * grams(item) / 100) };
    }).filter(function (x) { return x.p >= 1; }).sort(function (a, b) { return b.p - a.p; }).slice(0, 3);
    if (from.length) {
      body.appendChild(el("p", "df-detail-from", "Mostly from " + from.map(function (x) { return shortName(x.f).toLowerCase(); }).join(", ") + "."));
    }

    if (p < 100) {
      body.appendChild(el("p", "df-label", "Foods that help"));
      var helpers = el("ul", "df-items");
      data.helpers[i].forEach(function (id) {
        var f = food(id);
        if (!f) return;
        var unit = f[6][0];
        var q = unit[2] || 1;
        var gain = percent(i, f[5][i] * unit[1] * q / 100);
        var li = el("li", "df-item");
        var btn = el("button", "df-item-open");
        btn.type = "button";
        btn.setAttribute("aria-label", "Add " + f[1]);
        var pic = el("span", "df-item-pic");
        pic.appendChild(photo(f, "df-item-photo"));
        btn.appendChild(pic);
        var copy = el("span", "df-item-copy");
        copy.appendChild(el("span", "df-item-name", shortName(f)));
        copy.appendChild(el("span", "df-item-amount", "+" + Math.round(gain) + "% in " + portionText(f, 0, q)));
        btn.appendChild(copy);
        btn.addEventListener("click", function () {
          closeDialog($("DfNutrientSheet"));
          openAmount({ id: id, u: 0, q: q, slot: tab }, -1);
        });
        li.appendChild(btn);
        li.appendChild(el("span", "df-item-plus", "+"));
        helpers.appendChild(li);
      });
      body.appendChild(helpers);
    }
    var more = el("a", "df-detail-link", "Why " + inSentence(n.name) + " matters in pregnancy");
    more.href = n.guide;
    body.appendChild(more);
    openDialog($("DfNutrientSheet"));
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

  function planItems(meal, slot) {
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
      pick.forEach(function (m, k) { items = items.concat(planItems(m, SLOTS[k][0])); });
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
    closeOnBackdrop(dialog);
    $("DfDesignOpen").addEventListener("click", function () {
      var p = state.prefs;
      form.querySelector("input[name=style][value=" + p.style + "]").checked = true;
      form.elements.df.checked = !!p.df;
      form.elements.gf.checked = !!p.gf;
      form.querySelector("input[name=prep][value='" + p.prep + "']").checked = true;
      $("DfDesignHint").hidden = !state.items.length;
      openDialog(dialog);
    });
    $("DfDesignOpen").disabled = false;
    $("DfDesignCancel").addEventListener("click", function () { closeDialog(dialog); });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      state.prefs = {
        style: form.querySelector("input[name=style]:checked").value,
        df: form.elements.df.checked,
        gf: form.elements.gf.checked,
        prep: Number(form.querySelector("input[name=prep]:checked").value)
      };
      if (state.items.length) undoable("Planned a new day");
      applyPlan(null);
      tab = "breakfast";
      renderMeals();
      closeDialog(dialog);
      $("DfFit").scrollIntoView({ block: "start", behavior: "smooth" });
    });
    $("DfShuffle").addEventListener("click", function () {
      undoable("Shuffled your day");
      applyPlan(SLOTS.map(function (s) { return state.plan[s[0]]; }));
    });
    $("DfClear").addEventListener("click", function () {
      undoable("Cleared today");
      state.items = [];
      state.plan = {};
      commit();
    });
  }

  // Undo toast and phone dock ---------------------------------------------

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
    $("DfDockAdd").addEventListener("click", function () { focusSearch(null); });
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      dock.hidden = entries[0].isIntersecting || window.matchMedia("(min-width: 961px)").matches;
    }).observe($("DfSearch"));
  }

  function greet() {
    var h = new Date().getHours();
    $("DfHello").textContent = h < 12 ? "Good morning," : h < 17 ? "Good afternoon," : "Good evening,";
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
    closeOnBackdrop($("DfNutrientSheet"));
    greet();
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
