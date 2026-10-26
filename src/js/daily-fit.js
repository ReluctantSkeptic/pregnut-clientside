// src/js/daily-fit.js
// Daily Fit: log foods in everyday portions and watch 13 pregnancy nutrients
// fill a half-circle gauge, or plan a whole day from the meal library. Everything stays in this
// browser (localStorage); data comes from /resource/daily-fit.v1.json.

(function () {
  var DATA_URL = "/resource/daily-fit.v1.json";
  var STORE_KEY = "pregnut.dailyFit.v1";
  var SLOTS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["snack", "Snack"], ["dinner", "Dinner"]];
  // Shown while a meal is empty.
  var SLOT_PHOTOS = {
    breakfast: "/resource/portions/cutouts/portion-oatmeal-100g-600.webp",
    lunch: "/resource/portions/cutouts/portion-lentils-100g-600.webp",
    snack: "/resource/portions/cutouts/portion-almonds-100g-600.webp",
    dinner: "/resource/portions/cutouts/portion-salmon-100g-600.webp"
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
    var fresh = { date: today(), items: [], plan: {}, prefs: { diet: "everything", prep: 2 } };
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || "null");
      if (!saved || typeof saved !== "object") return fresh;
      fresh.prefs = migratePrefs(saved.prefs) || fresh.prefs;
      // A new day starts with an empty list; preferences carry over.
      if (saved.date === fresh.date && Array.isArray(saved.items)) {
        fresh.items = saved.items;
        fresh.plan = saved.plan || {};
      }
    } catch (e) {}
    return fresh;
  }

  // Earlier versions stored a style plus dairy-free and gluten-free switches.
  function migratePrefs(p) {
    if (!p || typeof p !== "object") return null;
    if (p.diet) return { diet: p.diet, prep: p.prep || 2 };
    var diet = p.style === "vegetarian" || p.style === "vegan" ? p.style : p.df ? "dairyfree" : p.gf ? "glutenfree" : "everything";
    return { diet: diet, prep: p.prep || 2 };
  }

  function save() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function snapshot() { return JSON.parse(JSON.stringify(state)); }

  // food: [id, label, image, level, warningText, values, portions, rank, alias, largeImage, cutout]
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
    exitSearchMode(true);
    openAmount({ id: f[0], u: 0, q: f[6][0][2] || 1, slot: pendingSlot || tab || guessSlot() }, -1);
    pendingSlot = null;
  }

  function focusSearch(slot) {
    pendingSlot = slot || null;
    var input = $("DfSearch");
    if (!phone.matches) input.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus({ preventScroll: true });
  }

  // Phones: the search becomes a full-screen sheet. The field sits at the top
  // and the results fill exactly what the keyboard leaves visible.
  var phone = window.matchMedia("(max-width: 700px)");
  var searching = false;
  var pushed = false;
  // Shown before anything is typed: everyday staples.
  var STAPLES = ["01129", "08121", "01287", "09040", "15086", "16070", "11457", "42290"];

  function fitSearch() {
    if (!searching) return;
    var vv = window.visualViewport;
    var root = document.documentElement;
    root.style.setProperty("--df-vvh", (vv ? vv.height : window.innerHeight) + "px");
    root.style.setProperty("--df-vvtop", (vv ? vv.offsetTop : 0) + "px");
  }

  function enterSearchMode() {
    if (searching || !phone.matches) return;
    searching = true;
    document.documentElement.classList.add("df-searching");
    $("DfSearchCancel").hidden = false;
    fitSearch();
    try { history.pushState({ dfSearch: 1 }, ""); pushed = true; } catch (e) { pushed = false; }
    showSearch();
  }

  function exitSearchMode(viaHistory) {
    if (!searching) return;
    searching = false;
    document.documentElement.classList.remove("df-searching");
    $("DfSearchCancel").hidden = true;
    var input = $("DfSearch");
    input.value = "";
    input.blur();
    results = [];
    renderResults();
    if (viaHistory && pushed) { pushed = false; history.back(); }
  }

  function showSearch() {
    var input = $("DfSearch");
    results = input.value.trim() ? search(input.value)
      : searching ? STAPLES.map(food).filter(Boolean) : [];
    active = results.length && input.value.trim() ? 0 : -1;
    renderResults();
  }

  function wireSearch() {
    var input = $("DfSearch");
    input.addEventListener("focus", enterSearchMode);
    input.addEventListener("input", showSearch);
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown" && results.length) { active = (active + 1) % results.length; renderResults(); ev.preventDefault(); }
      else if (ev.key === "ArrowUp" && results.length) { active = (active - 1 + results.length) % results.length; renderResults(); ev.preventDefault(); }
      else if (ev.key === "Enter" && active >= 0) { choose(active); ev.preventDefault(); }
      else if (ev.key === "Escape") { if (searching) exitSearchMode(true); else { input.value = ""; results = []; renderResults(); } }
    });
    // On phones the results stay while the keyboard is down; on desktop the
    // dropdown closes when the field loses focus.
    input.addEventListener("blur", function () {
      setTimeout(function () { if (!searching) { results = []; renderResults(); } }, 150);
    });
    $("DfResults").addEventListener("touchstart", function () { if (searching) input.blur(); }, { passive: true });
    $("DfSearchCancel").addEventListener("click", function () { exitSearchMode(true); });
    window.addEventListener("popstate", function () { if (searching) { pushed = false; exitSearchMode(false); } });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", fitSearch);
      window.visualViewport.addEventListener("scroll", fitSearch);
    }
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

  // Meals: one card per meal; tap to open its foods ------------------------

  function mealItems(slot) {
    return state.items.filter(function (item) { return item.slot === slot && food(item.id); });
  }

  // An empty meal shows a faded photo of a typical dish.
  function idlePhoto(slot) {
    var img = el("img", "df-meal-photo is-idle");
    img.src = SLOT_PHOTOS[slot];
    img.alt = "";
    img.width = 400;
    img.height = 400;
    img.loading = "lazy";
    return img;
  }

  // Each food in a meal is a cut-out on its own little card. The cards
  // overlap by half; touching or hovering one bounces it to the top.
  var TILTS = [-5, 4, -2, 5, -4, 2];

  function stackCard(f, i) {
    var card = el("span", "df-stack-card");
    card.style.setProperty("--r", TILTS[i % TILTS.length] + "deg");
    card.style.zIndex = i + 1;
    if (f[10]) {
      var img = el("img", "df-stack-cut");
      img.src = f[10];
      img.alt = "";
      img.width = 200;
      img.height = 200;
      img.loading = "lazy";
      img.decoding = "async";
      card.appendChild(img);
    } else {
      card.classList.add("is-photo");
      card.appendChild(photo(f, "df-stack-photo"));
    }
    return card;
  }

  function raise(stack, card) {
    var top = 0;
    Array.prototype.forEach.call(stack.children, function (c) {
      top = Math.max(top, Number(c.style.zIndex) || 0);
      if (c !== card) c.classList.remove("is-top");
    });
    card.style.zIndex = top + 1;
    card.classList.remove("is-top");
    void card.offsetWidth; // restart the bounce
    card.classList.add("is-top");
  }

  function foodStack(items) {
    var stack = el("div", "df-stack");
    stack.setAttribute("aria-hidden", "true");
    var seen = {};
    items.forEach(function (item) {
      var f = food(item.id);
      // Foods with no picture at all stay out of the stack; they're in the list.
      if (seen[item.id] || (!f[10] && !f[2])) return;
      seen[item.id] = 1;
      stack.appendChild(stackCard(f, stack.children.length));
    });
    Array.prototype.forEach.call(stack.children, function (card) {
      card.addEventListener("pointerenter", function (ev) { if (ev.pointerType === "mouse") raise(stack, card); });
      card.addEventListener("pointerdown", function () { raise(stack, card); });
    });
    return stack;
  }

  function plusIcon() {
    var span = el("span", "df-meal-plus");
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    return span;
  }

  function foodRow(item, i) {
    var f = food(item.id);
    var li = el("li", "df-item");
    var open = el("button", "df-item-open");
    open.type = "button";
    open.setAttribute("aria-label", "Change amount of " + f[1]);
    var pic = el("span", "df-item-pic");
    pic.appendChild(photo(f, "df-item-photo"));
    open.appendChild(pic);
    var copy = el("span", "df-item-copy");
    copy.appendChild(el("span", "df-item-name", shortName(f)));
    copy.appendChild(el("span", "df-item-amount", amountText(item)));
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
    return li;
  }

  function renderMeals() {
    var root = $("DfMeals");
    clear(root);
    SLOTS.forEach(function (s) {
      var slot = s[0];
      var items = mealItems(slot);
      var isOpen = items.length && tab === slot;
      var li = el("li", "df-meal" + (items.length ? "" : " is-blank") + (isOpen ? " is-open" : ""));
      var head = el("button", "df-meal-head");
      head.type = "button";
      if (!items.length) head.appendChild(idlePhoto(slot));
      var copy = el("span", "df-meal-copy");
      copy.appendChild(el("span", "df-meal-name", s[1]));
      copy.appendChild(el("span", "df-meal-sub", items.length ? state.plan[slot] || items.map(function (it) { return shortName(food(it.id)); }).join(", ") : "Add " + s[1].toLowerCase()));
      head.appendChild(copy);
      if (items.length) {
        var kcal = el("span", "df-meal-kcal", Math.round(calories(items)));
        kcal.appendChild(el("small", "", " kcal"));
        head.appendChild(kcal);
        head.setAttribute("aria-expanded", isOpen ? "true" : "false");
        head.addEventListener("click", function () { tab = isOpen ? null : slot; renderMeals(); });
      } else {
        head.appendChild(plusIcon());
        head.addEventListener("click", function () { focusSearch(slot); });
      }
      li.appendChild(head);

      if (items.length) {
        var stack = foodStack(items);
        if (stack.children.length) li.appendChild(stack);
        var stats = el("ul", "df-meal-stats");
        ranked(items, 3).forEach(function (x) {
          var stat = el("li", "");
          stat.style.setProperty("--c", COLORS[x.i]);
          stat.appendChild(el("span", "df-meal-stat-name", data.nutrients[x.i].name));
          stat.appendChild(el("span", "df-meal-stat-value", Math.round(x.p) + "%"));
          stats.appendChild(stat);
        });
        li.appendChild(stats);
      }

      if (isOpen) {
        var body = el("div", "df-meal-body");
        var list = el("ul", "df-items");
        state.items.forEach(function (item, i) {
          if (item.slot === slot && food(item.id)) list.appendChild(foodRow(item, i));
        });
        body.appendChild(list);
        var add = el("button", "df-meal-add", "Add to " + s[1].toLowerCase());
        add.type = "button";
        add.addEventListener("click", function () { focusSearch(slot); });
        body.appendChild(add);
        li.appendChild(body);
      }
      root.appendChild(li);
    });
    $("DfClear").hidden = !state.items.length;
    $("DfOr").hidden = !!state.items.length;
  }

  // The gauge: one rounded bar per nutrient around a half circle. Each bar
  // fills from its inner edge, fading in from transparent to its own color.

  var COLORS = ["#2f6b5a", "#3f7d63", "#5b8f5e", "#7ea25a", "#a9b25a", "#d3b45a", "#e8a65a",
    "#ee955e", "#ef8566", "#e57770", "#d46f7d", "#b86c8a", "#946a94"];
  var ABBR = { "Folate": "Fol", "Iron": "Fe", "Choline": "Cho", "DHA": "DHA", "Vitamin D": "D", "Calcium": "Ca",
    "Protein": "Pro", "Vitamin B12": "B12", "Zinc": "Zn", "Vitamin C": "C", "Vitamin B6": "B6",
    "Riboflavin": "B2", "Potassium": "K" };
  var SVG = "http://www.w3.org/2000/svg";
  var segs = [];
  var shown = [];
  var anim = 0;
  var hovering = -1;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  function svg(tag, attrs, parent) {
    var node = document.createElementNS(SVG, tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function buildGauge() {
    var root = $("DfArc");
    var defs = svg("defs", {}, root);
    var count = data.nutrients.length;
    var span = 200;
    var stepAngle = span / count;
    var R = 132;
    data.nutrients.forEach(function (n, i) {
      var angle = -span / 2 + stepAngle * (i + 0.5);
      var grad = svg("linearGradient", { id: "DfGrad" + i, x1: 0, y1: 1, x2: 0, y2: 0 }, defs);
      var stops = [0, 0, 0, 1].map(function (offset) {
        return svg("stop", { offset: offset, "stop-color": COLORS[i], "stop-opacity": 0 }, grad);
      });
      var g = svg("g", { class: "df-seg", transform: "translate(160 170) rotate(" + angle.toFixed(2) + ")", tabindex: 0, role: "button" }, root);
      svg("rect", { class: "df-seg-base", x: -13, y: -R - 22, width: 26, height: 44, rx: 10 }, g);
      svg("rect", { x: -13, y: -R - 22, width: 26, height: 44, rx: 10, fill: "url(#DfGrad" + i + ")" }, g);
      var text = svg("text", { x: 0, y: -R + 4, "text-anchor": "middle", transform: "rotate(" + (-angle).toFixed(2) + " 0 " + (-R) + ")" }, g);
      text.textContent = ABBR[n.name] || n.name.slice(0, 3);
      g.addEventListener("click", function () { openNutrient(i); });
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openNutrient(i); }
      });
      g.addEventListener("pointerenter", function () { hovering = i; renderCenter(); });
      g.addEventListener("pointerleave", function () { hovering = -1; renderCenter(); });
      g.addEventListener("focus", function () { hovering = i; renderCenter(); });
      g.addEventListener("blur", function () { hovering = -1; renderCenter(); });
      segs.push({ g: g, stops: stops });
      shown.push(0);
    });
  }

  function paint(i, p) {
    var f = Math.max(0, Math.min(1, p / 100));
    var st = segs[i].stops;
    st[0].setAttribute("stop-opacity", f > 0 ? 0.22 : 0);
    st[1].setAttribute("offset", f);
    st[1].setAttribute("stop-opacity", f > 0 ? 1 : 0);
    st[2].setAttribute("offset", f);
    segs[i].g.classList.toggle("is-met", p >= 100);
    segs[i].g.classList.toggle("is-half", p >= 55 && p < 100);
  }

  function renderGauge() {
    var totals = amounts(state.items);
    var targets = totals.map(function (a, i) { return percent(i, a); });
    data.nutrients.forEach(function (n, i) {
      segs[i].g.setAttribute("aria-label", n.name + ": " + Math.round(targets[i]) + "% of the daily pregnancy reference");
    });
    var from = shown.slice();
    cancelAnimationFrame(anim);
    if (reduced.matches) {
      targets.forEach(function (p, i) { shown[i] = p; paint(i, p); });
    } else {
      var t0 = performance.now();
      var tick = function (now) {
        var done = true;
        targets.forEach(function (p, i) {
          var t = Math.max(0, Math.min(1, (now - t0 - i * 35) / 700));
          if (t < 1) done = false;
          var e = 1 - Math.pow(1 - t, 3);
          shown[i] = from[i] + (Math.min(p, 120) - Math.min(from[i], 120)) * e;
          paint(i, t >= 1 ? p : shown[i]);
        });
        if (!done) anim = requestAnimationFrame(tick);
      };
      anim = requestAnimationFrame(tick);
    }
    renderCenter();
  }

  function status(p) {
    if (p >= 100) return "is-covered";
    if (p >= 50) return "is-close";
    return p > 0 ? "is-low" : "is-none";
  }

  function renderCenter() {
    var totals = amounts(state.items);
    var value = $("DfValue");
    clear(value);
    if (hovering >= 0) {
      var n = data.nutrients[hovering];
      $("DfKicker").textContent = fmtAmount(totals[hovering]) + " of " + n.target + " " + n.unit;
      value.textContent = Math.round(percent(hovering, totals[hovering]));
      value.appendChild(el("small", "", "%"));
      $("DfLabel").textContent = n.name;
      $("DfLabel").style.color = COLORS[hovering];
      return;
    }
    var covered = totals.filter(function (a, i) { return percent(i, a) >= 100; }).length;
    $("DfKicker").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    value.textContent = covered;
    value.appendChild(el("small", "", " of " + totals.length));
    $("DfLabel").textContent = covered === totals.length ? "all nutrients met" : "nutrients met";
    $("DfLabel").style.color = "";
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
    bar.style.background = COLORS[i];
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
          openAmount({ id: id, u: 0, q: q, slot: tab || guessSlot() }, -1);
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

  // meal: [slot, name, diet, dairyFree, glutenFree, prep, items, eggFree, nutFree]
  var DIETS = {
    everything: function () { return true; },
    pescatarian: function (m) { return m[2] !== "meat"; },
    vegetarian: function (m) { return m[2] === "vegetarian" || m[2] === "vegan"; },
    vegan: function (m) { return m[2] === "vegan"; },
    dairyfree: function (m) { return !!m[3]; },
    glutenfree: function (m) { return !!m[4]; },
    eggfree: function (m) { return !!m[7]; },
    nutfree: function (m) { return !!m[8]; }
  };

  function fits(meal, prefs, prep) {
    return (DIETS[prefs.diet] || DIETS.everything)(meal) && meal[5] <= prep;
  }

  function planItems(meal, slot) {
    return meal[6].map(function (it) { return { id: it[0], q: it[1], u: it[2] || 0, slot: slot }; });
  }

  // What each meal brings, worked out once per plan.
  function mealFacts(meal) {
    var items = planItems(meal, meal[0]);
    return {
      meal: meal,
      totals: amounts(items),
      kcal: calories(items),
      ids: items.map(function (it) { return it.id; }),
      fish: meal[2] === "fish"
    };
  }

  // A day scores for coverage (the five hardest nutrients count more), for
  // each nutrient fully met, and loses points for calories outside a
  // pregnancy range, the same food twice, more than one fish meal (FDA
  // advice is 2 to 3 servings a week) and repeating the last plan.
  function scoreDay(day, avoid) {
    var score = 0;
    for (var i = 0; i < data.nutrients.length; i++) {
      var total = 0;
      for (var k = 0; k < day.length; k++) total += day[k].totals[i];
      var p = percent(i, total);
      score += Math.min(100, p) * (i < 5 ? 1.5 : 1);
      if (p >= 100) score += 15;
    }
    var kcal = 0;
    var seen = {};
    var fish = 0;
    day.forEach(function (f) {
      kcal += f.kcal;
      if (f.fish) fish++;
      if (avoid && avoid.indexOf(f.meal[1]) !== -1) score -= 40;
      f.ids.forEach(function (id) {
        if (seen[id]) score -= 25;
        seen[id] = 1;
      });
    });
    if (kcal < 1800) score -= (1800 - kcal) / 8;
    if (kcal > 2600) score -= (kcal - 2600) / 8;
    if (fish > 1) score -= 80 * (fish - 1);
    return score;
  }

  // Random starts, each improved one meal at a time until nothing helps; then
  // a random pick among the near-best days, so plans vary but stay strong.
  function planDay(prefs, avoid) {
    var pools = SLOTS.map(function (s) {
      var prep = prefs.prep;
      var pool = [];
      while (prep <= 3) {
        pool = data.meals.filter(function (m) { return m[0] === s[0] && fits(m, prefs, prep); });
        if (pool.length >= 2) break;
        prep++;
      }
      return pool.map(mealFacts);
    });
    if (pools.some(function (pool) { return !pool.length; })) return null;

    var results = [];
    for (var start = 0; start < 24; start++) {
      var day = pools.map(function (pool) { return pool[Math.floor(Math.random() * pool.length)]; });
      var score = scoreDay(day, avoid);
      for (var pass = 0; pass < 4; pass++) {
        var improved = false;
        for (var k = 0; k < pools.length; k++) {
          var keep = day[k];
          for (var c = 0; c < pools[k].length; c++) {
            day[k] = pools[k][c];
            var next = scoreDay(day, avoid);
            if (next > score + 0.01) { score = next; keep = day[k]; improved = true; }
          }
          day[k] = keep;
        }
        if (!improved) break;
      }
      results.push({ day: day.slice(), score: score });
    }
    results.sort(function (a, b) { return b.score - a.score; });
    var good = results.filter(function (r) { return r.score >= results[0].score * 0.97; });
    var chosen = good[Math.floor(Math.random() * good.length)];
    var items = [];
    chosen.day.forEach(function (f, k) { items = items.concat(planItems(f.meal, SLOTS[k][0])); });
    return { pick: chosen.day.map(function (f) { return f.meal; }), items: items };
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
    function openDesign() {
      var p = state.prefs;
      form.querySelector("input[name=diet][value=" + (DIETS[p.diet] ? p.diet : "everything") + "]").checked = true;
      form.querySelector("input[name=prep][value='" + p.prep + "']").checked = true;
      openDialog(dialog);
    }
    $("DfDesignOpen").addEventListener("click", openDesign);
    $("DfPlanLink").addEventListener("click", openDesign);
    $("DfDesignOpen").disabled = false;
    $("DfDesignCancel").addEventListener("click", function () { closeDialog(dialog); });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      state.prefs = {
        diet: form.querySelector("input[name=diet]:checked").value,
        prep: Number(form.querySelector("input[name=prep]:checked").value)
      };
      if (state.items.length) undoable("Planned a new day");
      // Planning again gives a fresh set of meals.
      applyPlan(SLOTS.map(function (s) { return state.plan[s[0]]; }));
      tab = null;
      renderMeals();
      closeDialog(dialog);
      $("DailyFit").scrollIntoView({ block: "start", behavior: "smooth" });
    });
    $("DfClear").addEventListener("click", function () {
      undoable("Cleared today");
      state.items = [];
      state.plan = {};
      commit();
    });
  }

  // Undo toast and phone add button ---------------------------------------------

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

  // Phones get a round add button once the search bar scrolls away.
  function wireFab() {
    var fab = $("DfFab");
    fab.addEventListener("click", function () { focusSearch(null); });
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      fab.hidden = entries[0].isIntersecting || window.matchMedia("(min-width: 961px)").matches;
    }).observe($("DfSearch"));
  }

  function commit() {
    save();
    renderMeals();
    renderGauge();
  }

  function start(json) {
    data = json;
    data.foods.forEach(function (f) { byId[f[0]] = f; });
    state.items = state.items.filter(function (item) { return byId[item.id]; });
    closeOnBackdrop($("DfNutrientSheet"));
    buildGauge();
    buildIndex();
    wireSearch();
    wireSheet();
    wireDesign();
    wireToast();
    wireFab();
    commit();
  }

  fetch(DATA_URL)
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(start)
    .catch(function () {
      $("DfMeals").textContent = "The calculator could not load. Refresh the page to try again.";
    });
})();
