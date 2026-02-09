// src/js/food.js
// Single-food nutrient view (all nutrients, 100g portion).

(function () {
  var FOODDATA_URL = "/resource/pregnut_fooddata.v1.json";
  var GLOBAL_PREFS_KEY = "pregnut.foodPrefs.v1";

  var BAR_CAP_PERCENT = 200;

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

  function loadJsonKey(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function saveJsonKey(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
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

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function buildFoodNameNode(className, rawName) {
    // Split on first comma only, then wrap the remainder in parentheses as a subdued detail.
    var node = document.createElement("p");
    if (className) node.className = className;

    var s = String(rawName || "").trim();
    if (!s) return node;

    var idx = s.indexOf(",");
    if (idx === -1) {
      node.textContent = s;
      return node;
    }

    var main = s.slice(0, idx).trim();
    var rest = s.slice(idx + 1).trim();
    node.textContent = main || s;

    if (rest) {
      var detail = document.createElement("span");
      detail.className = className + "-detail";
      detail.textContent = "(" + rest + ")";
      node.appendChild(detail);
    }
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

  function readUrlFood() {
    try {
      var params = new URLSearchParams(window.location.search);
      var v = params.get("food");
      return v ? String(v).trim() : null;
    } catch (e) {
      return null;
    }
  }

  function normalizeName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function findFoodByName(foods, targetName) {
    var target = normalizeName(targetName);
    if (!target) return null;

    var best = null;
    for (var i = 0; i < foods.length; i++) {
      var f = foods[i];
      if (!f || !f.name) continue;
      if (normalizeName(f.name) === target) return f;
      if (!best && normalizeName(f.name).indexOf(target) !== -1) best = f;
    }
    return best;
  }

  function orderedNutrients(fooddata) {
    var keys = [];
    for (var key in (fooddata && fooddata.nutrients ? fooddata.nutrients : {})) {
      if (!fooddata.nutrients.hasOwnProperty(key)) continue;
      if (key === "Calories") continue;
      if (!fooddata.nutrients[key] || !fooddata.nutrients[key].rda) continue;
      keys.push(key);
    }
    keys.sort(function (a, b) { return a.localeCompare(b); });

    var set = {};
    for (var i = 0; i < keys.length; i++) set[keys[i]] = true;

    var out = [];
    for (var j = 0; j < NUTRIENT_ALPHA.length; j++) {
      if (set[NUTRIENT_ALPHA[j]]) out.push(NUTRIENT_ALPHA[j]);
      delete set[NUTRIENT_ALPHA[j]];
    }
    for (var k = 0; k < keys.length; k++) {
      if (set[keys[k]]) out.push(keys[k]);
    }
    return out;
  }

  function setText(id, text) {
    var node = $(id);
    if (node) node.textContent = String(text || "");
  }

  function updateHint(naturalOnly) {
    var hint = $("FoodSourceHint");
    if (!hint) return;
    hint.textContent = naturalOnly
      ? "Natural-only filter is on. This page still shows your selected food."
      : "Processed includes fortified foods; Natural is whole-food sources.";
  }

  function renderFoodCard(fooddata, food, root) {
    if (!root) return;
    clear(root);
    closeAllCautions();

    if (!food) {
      root.textContent = "Food not found. Try searching again using the top search bar.";
      return;
    }

    var item = el("article", "food-item", null);

    var head = el("div", "food-head", null);
    var headLeft = el("div", "food-head-left", null);
    headLeft.appendChild(buildFoodNameNode("food-name", food.name));
    head.appendChild(headLeft);

    var headRight = el("div", "food-head-right", null);
    headRight.appendChild(el("p", "food-meta", food.group));

    var warn = String(food.warning || "").trim();
    if (warn && warn.toLowerCase() !== "0") {
      var wt = String(food.warningText || "").trim();
      var msg = (warn ? (warn + ": ") : "") + (wt || "Use caution.");
      headRight.appendChild(buildCautionNode(msg));
    }
    head.appendChild(headRight);
    item.appendChild(head);

    var barRoot = el("div", "food-bars", null);
    var nutrients = orderedNutrients(fooddata);
    for (var i = 0; i < nutrients.length; i++) {
      var nid = nutrients[i];
      var pct = percentOfRda(fooddata, food, nid);

      var row = el("div", "bar-row", null);
      row.style.setProperty("--nutrient-color", nutrientColor(nid));
      row.appendChild(el("div", "bar-label", nid));

      var track = el("div", "bar-track", null);
      var fill = el("div", "bar-fill", null);
      var w = pct === null ? 0 : Math.min(Math.max(pct, 0), BAR_CAP_PERCENT);
      fill.style.width = String(w) + "%";
      track.appendChild(fill);
      track.appendChild(el("div", "bar-value", pct === null ? "\u2014" : (Math.round(pct) + "%")));
      row.appendChild(track);

      barRoot.appendChild(row);
    }
    item.appendChild(barRoot);
    root.appendChild(item);
  }

  function start(fooddata) {
    var foodName = readUrlFood();

    var g = loadJsonKey(GLOBAL_PREFS_KEY);
    var state = {
      naturalOnly: typeof g.naturalOnly === "boolean" ? g.naturalOnly : false
    };

    var nat = $("ToggleNaturalOnly");
    if (nat) nat.checked = !!state.naturalOnly;
    updateHint(!!state.naturalOnly);

    var root = $("FoodResult");
    if (nat) {
      nat.addEventListener("change", function () {
        state.naturalOnly = !!nat.checked;
        saveJsonKey(GLOBAL_PREFS_KEY, { naturalOnly: !!state.naturalOnly });
        updateHint(!!state.naturalOnly);
      });
    }

    if (!foodName) {
      if (root) clear(root);
      initCautionEvents();
      try { document.body.classList.add("food-ready"); } catch (e) {}
      return;
    }

    var foods = (fooddata && fooddata.foods) ? fooddata.foods : [];
    var food = findFoodByName(foods, foodName);

    setText("FoodTitle", food ? food.name : foodName);
    setText("FoodSubtitle", food ? (food.group + " \u00b7 100g portion") : "Food not found. Try searching again.");

    renderFoodCard(fooddata, food, root);

    initCautionEvents();

    try { document.body.classList.add("food-ready"); } catch (e) {}
  }

  window.addEventListener("load", function () {
    fetchJson(FOODDATA_URL)
      .then(function (fooddata) {
        start(fooddata);
      })
      .catch(function (err) {
        var root = $("FoodResult");
        if (root) root.textContent = err && err.message ? err.message : String(err);
      });
  });
})();
