// src/js/top-foods.js
// Lightweight, client-side "Top foods per nutrient" view.

(function () {
  var FOODDATA_URL = "/resource/pregnut_fooddata.v1.json";
  var GLOBAL_PREFS_KEY = "pregnut.foodPrefs.v1";
  var STORAGE_KEY = "pregnut.topFoods.v1";

  var BAR_CAP_PERCENT = 200;
  var PER_GROUP_LIMIT = 5;

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

  function renderFoodGroupsByNutrient(fooddata, foods, nutrientId, root) {
    if (!root) return;
    clear(root);
    closeAllCautions();

    if (!foods || !foods.length || !nutrientId) {
      root.textContent = "No foods available.";
      return;
    }

    var groupMap = {};
    for (var i = 0; i < foods.length; i++) {
      var food = foods[i];
      if (!food) continue;
      var pct = percentOfRda(fooddata, food, nutrientId);
      if (pct === null) continue;

      var g = String(food.group || "").trim();
      if (!g) g = "Other";
      if (!groupMap[g]) groupMap[g] = [];
      groupMap[g].push({ food: food, pct: pct });
    }

    var groups = [];
    for (var name in groupMap) {
      if (!groupMap.hasOwnProperty(name)) continue;
      var arr = groupMap[name];
      arr.sort(function (a, b) { return (b.pct - a.pct); });
      var top = arr.slice(0, PER_GROUP_LIMIT);
      if (!top.length) continue;
      groups.push({ name: name, items: top, maxPct: top[0].pct });
    }

    groups.sort(function (a, b) {
      var d = b.maxPct - a.maxPct;
      if (d) return d;
      return a.name.localeCompare(b.name);
    });

    if (!groups.length) {
      root.textContent = "No data available for this nutrient.";
      return;
    }

    var grid = el("div", "food-group-grid", null);
    for (var gi = 0; gi < groups.length; gi++) {
      var group = groups[gi];
      var card = el("section", "food-group-card", null);
      card.setAttribute("aria-label", group.name + " top foods");

      var head = el("div", "food-group-head", null);
      head.appendChild(el("h3", "food-group-title", group.name));
      head.appendChild(el("p", "food-group-meta", "Top " + String(group.items.length) + " foods"));
      card.appendChild(head);

      var box = el("div", "food-box", null);
      for (var fi = 0; fi < group.items.length; fi++) {
        var item = group.items[fi];
        var foodItem = item.food;
        var pctItem = item.pct;

        var row = el("div", "food-row", null);

        var main = el("div", "food-row-main", null);
        main.appendChild(buildFoodNameNode("food-row-name", foodItem.name));
        var barCaution = null;
        var warn = String(foodItem.warning || "").trim();
        if (warn && warn.toLowerCase() !== "0") {
          var wt = String(foodItem.warningText || "").trim();
          var msg = (warn ? (warn + ": ") : "") + (wt || "Use caution.");
          barCaution = buildCautionNode(msg);
        }

        var bars = el("div", "food-row-bars", null);
        bars.style.setProperty("--nutrient-color", nutrientColor(nutrientId));

        var track = el("div", "bar-track", null);
        var fill = el("div", "bar-fill", null);
        var w = Math.min(Math.max(pctItem, 0), BAR_CAP_PERCENT);
        fill.style.width = String(w) + "%";
        track.appendChild(fill);
        bars.appendChild(track);

        var overlay = el("div", "bar-overlay", null);
        if (barCaution) overlay.appendChild(barCaution);
        overlay.appendChild(el("div", "bar-overlay-value", Math.round(pctItem) + "%"));
        bars.appendChild(overlay);

        row.appendChild(main);
        row.appendChild(bars);
        box.appendChild(row);
      }

      card.appendChild(box);
      grid.appendChild(card);
    }

    root.appendChild(grid);
  }

  function readUrlNutrient() {
    try {
      var params = new URLSearchParams(window.location.search);
      var n = params.get("nutrient");
      return n ? String(n) : null;
    } catch (e) {
      return null;
    }
  }

  function render(fooddata, state) {
    var select = $("NutrientSelect");
    var nat = $("ToggleNaturalOnly");
    var root = $("FoodsByNutrient");

    if (nat) nat.checked = !!state.naturalOnly;

    var keys = [];
    for (var key in (fooddata && fooddata.nutrients ? fooddata.nutrients : {})) {
      if (!fooddata.nutrients.hasOwnProperty(key)) continue;
      if (key === "Calories") continue;
      if (!fooddata.nutrients[key] || !fooddata.nutrients[key].rda) continue;
      keys.push(key);
    }
    keys.sort(function (a, b) { return a.localeCompare(b); });

    if (select) {
      if (!select.options || !select.options.length) {
        clear(select);
        for (var i = 0; i < keys.length; i++) {
          var opt = document.createElement("option");
          opt.value = keys[i];
          opt.textContent = keys[i];
          select.appendChild(opt);
        }
      }

      if (state.selectedNutrient && keys.indexOf(state.selectedNutrient) !== -1) {
        select.value = state.selectedNutrient;
      } else {
        var first = keys[0] || null;
        if (first) {
          state.selectedNutrient = first;
          select.value = first;
        }
      }
    }

    if (!state.selectedNutrient) {
      if (root) root.textContent = "No nutrients available.";
      return;
    }

    var foods = filterFoods(fooddata, {
      naturalOnly: !!state.naturalOnly,
      excludeAvoid: true
    });

    renderFoodGroupsByNutrient(fooddata, foods, state.selectedNutrient, root);
  }

  function start(fooddata) {
    var prefs = loadJsonKey(STORAGE_KEY);
    var g = loadJsonKey(GLOBAL_PREFS_KEY);

    var state = {
      naturalOnly: typeof g.naturalOnly === "boolean" ? g.naturalOnly : !!prefs.naturalOnly,
      selectedNutrient: typeof prefs.selectedNutrient === "string" ? prefs.selectedNutrient : null
    };

    var urlN = readUrlNutrient();
    if (urlN) state.selectedNutrient = urlN;

    function persist() {
      saveJsonKey(STORAGE_KEY, {
        selectedNutrient: state.selectedNutrient || null
      });
      saveJsonKey(GLOBAL_PREFS_KEY, {
        naturalOnly: !!state.naturalOnly
      });
    }

    var select = $("NutrientSelect");
    if (select) {
      select.addEventListener("change", function () {
        state.selectedNutrient = select.value;
        persist();
        render(fooddata, state);
      });
    }

    var nat = $("ToggleNaturalOnly");
    if (nat) {
      nat.addEventListener("change", function () {
        state.naturalOnly = !!nat.checked;
        persist();
        render(fooddata, state);
      });
    }

    initCautionEvents();
    render(fooddata, state);
    persist();

    try { document.body.classList.add("topfoods-ready"); } catch (e) {}
  }

  window.addEventListener("load", function () {
    fetchJson(FOODDATA_URL)
      .then(function (fooddata) {
        start(fooddata);
      })
      .catch(function (err) {
        var root = $("FoodsByNutrient");
        if (root) root.textContent = err && err.message ? err.message : String(err);
      });
  });
})();
