// src/js/top-foods.js
// Lightweight, client-side "Top foods per nutrient" view.

(function () {
  var FOODDATA_URL = "/resource/pregnut_fooddata.v1.json";
  var GLOBAL_PREFS_KEY = "pregnut.foodPrefs.v1";
  var STORAGE_KEY = "pregnut.topFoods.v1";

  var PER_GROUP_LIMIT = 5;

  var V = window.PregnutViz;

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

  var el = V.el;

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

  function renderSummary(nutrientId, targetLabel) {
    var summary = $("TopFoodsSummary");
    if (!summary) return;
    clear(summary);
    summary.appendChild(el("strong", "", nutrientId));
    summary.appendChild(document.createTextNode(
      " · % of the " + (targetLabel ? targetLabel + " " : "") + "pregnancy reference in 100 g"
    ));
    summary.appendChild(V.info(
      "Each bar fills from 0–100% of the nutrient reference amount" +
        (targetLabel ? " (" + targetLabel + ")" : "") +
        ". Foods at or above the reference show a full bar and a ✓; the number shows the exact total. " +
        "Foods are ranked within each group by the amount in 100 g. Open a food to check its preparation and safety notes.",
      "How to read this chart"
    ));
  }

  function renderJumpNav(groups) {
    var nav = $("TopFoodsJump");
    if (!nav) return;
    clear(nav);
    for (var i = 0; i < groups.length; i++) {
      var link = el("a", "", groups[i].name);
      link.href = "#food-group-" + V.slugify(groups[i].name);
      nav.appendChild(link);
    }
    nav.hidden = !groups.length;
  }

  function renderFoodGroupsByNutrient(fooddata, foods, nutrientId, root) {
    if (!root) return { groupCount: 0, itemCount: 0 };
    clear(root);
    closeAllCautions();

    if (!foods || !foods.length || !nutrientId) {
      root.textContent = "No foods available.";
      return { groupCount: 0, itemCount: 0 };
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
      return { groupCount: 0, itemCount: 0 };
    }

    var nInfo = fooddata && fooddata.nutrients ? fooddata.nutrients[nutrientId] : null;
    var targetLabel = nInfo && nInfo.rda && nInfo.rda.label ? nInfo.rda.label : "";
    renderSummary(nutrientId, targetLabel);
    renderJumpNav(groups);

    var grid = document.createDocumentFragment();
    var itemCount = 0;
    for (var gi = 0; gi < groups.length; gi++) {
      var group = groups[gi];
      var card = el("section", "viz-card viz-fade", null);
      card.id = "food-group-" + V.slugify(group.name);
      card.setAttribute("aria-label", group.name + " top foods");
      itemCount += group.items.length;

      card.appendChild(el("h3", "viz-card-title", group.name));

      var list = el("ol", "viz-list", null);
      for (var fi = 0; fi < group.items.length; fi++) {
        var item = group.items[fi];
        var tip = readingText(fooddata, item.food, nutrientId, item.pct);
        list.appendChild(V.foodRow({
          food: item.food,
          percent: item.pct,
          imageMap: imageMap,
          tip: tip
        }));
      }

      card.appendChild(list);
      grid.appendChild(card);
    }

    root.appendChild(grid);
    return { groupCount: groups.length, itemCount: itemCount };
  }

  function readUrlState() {
    try {
      var params = new URLSearchParams(window.location.search);
      var n = params.get("nutrient");
      var source = params.get("source");
      return {
        selectedNutrient: n ? String(n) : null,
        naturalOnly: source === "natural" ? true : (source === "processed" ? false : null)
      };
    } catch (e) {
      return { selectedNutrient: null, naturalOnly: null };
    }
  }

  function writeUrlState(state, push) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("nutrient", state.selectedNutrient || "Calcium");
      url.searchParams.set("source", state.naturalOnly ? "natural" : "processed");
      window.history[push ? "pushState" : "replaceState"]({}, "", url.pathname + url.search + url.hash);
    } catch (e) {}
  }

  function render(fooddata, state) {
    var chipRoot = $("NutrientChips");
    var root = $("FoodsByNutrient");
    var status = $("TopFoodsStatus");

    V.setChecked($("SourceToggle"), state.naturalOnly ? "natural" : "processed");

    var keys = [];
    for (var key in (fooddata && fooddata.nutrients ? fooddata.nutrients : {})) {
      if (!fooddata.nutrients.hasOwnProperty(key)) continue;
      if (key === "Calories") continue;
      if (!fooddata.nutrients[key] || !fooddata.nutrients[key].rda) continue;
      keys.push(key);
    }
    keys.sort(function (a, b) { return a.localeCompare(b); });

    if (!state.selectedNutrient || keys.indexOf(state.selectedNutrient) === -1) {
      state.selectedNutrient = keys[0] || null;
    }

    if (chipRoot) {
      if (!chipRoot.firstChild) {
        V.chips(chipRoot, "topfoods-nutrient", keys.map(function (k) {
          return { value: k, label: k };
        }), state.selectedNutrient, onPickNutrient);
      } else {
        V.setChecked(chipRoot, state.selectedNutrient);
      }
      V.revealSelected(chipRoot);
    }

    if (!state.selectedNutrient) {
      if (root) root.textContent = "No nutrients available.";
      if (status) status.textContent = "No nutrients available.";
      return;
    }

    var foods = filterFoods(fooddata, {
      naturalOnly: !!state.naturalOnly,
      excludeAvoid: true
    });

    var result = renderFoodGroupsByNutrient(fooddata, foods, state.selectedNutrient, root);
    if (status) {
      status.textContent = "Showing " + result.itemCount + " ranked " + state.selectedNutrient +
        " foods across " + result.groupCount + " categories · " +
        (state.naturalOnly ? "natural sources" : "processed sources") + " · per 100 grams";
    }
  }

  var onPickNutrient = function () {};

  function start(fooddata) {
    var prefs = loadJsonKey(STORAGE_KEY);
    var g = loadJsonKey(GLOBAL_PREFS_KEY);

    var state = {
      naturalOnly: typeof g.naturalOnly === "boolean" ? g.naturalOnly : !!prefs.naturalOnly,
      selectedNutrient: typeof prefs.selectedNutrient === "string" ? prefs.selectedNutrient : null
    };

    var urlState = readUrlState();
    if (urlState.selectedNutrient) state.selectedNutrient = urlState.selectedNutrient;
    if (typeof urlState.naturalOnly === "boolean") state.naturalOnly = urlState.naturalOnly;

    function persist(pushUrl) {
      saveJsonKey(STORAGE_KEY, {
        selectedNutrient: state.selectedNutrient || null
      });
      saveJsonKey(GLOBAL_PREFS_KEY, {
        naturalOnly: !!state.naturalOnly
      });
      writeUrlState(state, !!pushUrl);
    }

    onPickNutrient = function (nutrientId) {
      state.selectedNutrient = nutrientId;
      persist(true);
      render(fooddata, state);
    };

    var source = $("SourceToggle");
    if (source) {
      source.addEventListener("change", function (ev) {
        var t = ev && ev.target ? ev.target : null;
        if (!t || t.name !== "topfoods-source") return;
        state.naturalOnly = t.value === "natural";
        persist(true);
        render(fooddata, state);
      });
    }

    window.addEventListener("popstate", function () {
      var next = readUrlState();
      if (next.selectedNutrient) state.selectedNutrient = next.selectedNutrient;
      if (typeof next.naturalOnly === "boolean") state.naturalOnly = next.naturalOnly;
      render(fooddata, state);
      saveJsonKey(STORAGE_KEY, { selectedNutrient: state.selectedNutrient || null });
      saveJsonKey(GLOBAL_PREFS_KEY, { naturalOnly: !!state.naturalOnly });
    });

    render(fooddata, state);
    persist(false);

    try { document.body.classList.add("topfoods-ready"); } catch (e) {}
  }

  var imageMap = {};

  window.addEventListener("load", function () {
    Promise.all([fetchJson(FOODDATA_URL), V.loadImageMap()])
      .then(function (all) {
        imageMap = all[1] || {};
        start(all[0]);
      })
      .catch(function () {
        var root = $("FoodsByNutrient");
        var status = $("TopFoodsStatus");
        var summary = $("TopFoodsSummary");
        var message = "Food comparisons could not load. Refresh the page to try again.";
        if (status) status.textContent = message;
        if (summary) summary.textContent = message;
        if (root) root.textContent = "";
      });
  });
})();
