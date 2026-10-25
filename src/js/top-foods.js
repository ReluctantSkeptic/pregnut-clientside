// src/js/top-foods.js
// Top Foods: switch the ranked list between nutrients and between whole
// foods and all foods. Rankings are precomputed at build time
// (src/_data/topFoods.js -> /resource/top-foods.v1.json); the page arrives
// with the default list already rendered.

(function () {
  var DATA_URL = "/resource/top-foods.v1.json";
  var STORAGE_KEY = "pregnut.topFoods.v2";

  var nutrients = null;
  var state = { nutrient: null, source: "whole" };

  function $(id) { return document.getElementById(id); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function load() {
    try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") || {}; } catch (e) { return {}; }
  }

  function save() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // Older links used ?source=natural|processed.
  function readUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var source = params.get("source");
      return {
        nutrient: params.get("nutrient"),
        source: source === "all" || source === "processed" ? "all" : (source === "whole" || source === "natural" ? "whole" : null)
      };
    } catch (e) { return {}; }
  }

  function writeUrl(push) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("nutrient", state.nutrient);
      url.searchParams.set("source", state.source);
      window.history[push ? "pushState" : "replaceState"]({}, "", url.pathname + url.search + url.hash);
    } catch (e) {}
  }

  function find(key) {
    for (var i = 0; i < nutrients.length; i++) if (nutrients[i].key === key) return nutrients[i];
    return null;
  }

  function caution(food) {
    var wrap = el("span", "caution is-safety");
    var text = food.warning + ": " + (food.warningText || "Use caution.");
    var btn = el("button", "caution-trigger", "!");
    btn.type = "button";
    btn.setAttribute("aria-label", "Safety note: " + text);
    btn.setAttribute("aria-expanded", "false");
    wrap.appendChild(btn);
    var pop = el("span", "caution-popover", text);
    pop.setAttribute("role", "tooltip");
    wrap.appendChild(pop);
    return wrap;
  }

  function row(food, i) {
    var li = el("li", "tf-row");
    li.style.setProperty("--p", Math.min(100, food.percent) + "%");
    li.style.setProperty("--n", i);
    var rank = el("span", "tf-rank", i + 1);
    rank.setAttribute("aria-hidden", "true");
    li.appendChild(rank);
    if (food.image) {
      var img = el("img", "tf-pic");
      img.src = food.image;
      img.alt = "";
      img.width = 200;
      img.height = 200;
      img.decoding = "async";
      li.appendChild(img);
    } else {
      var letter = el("span", "tf-pic is-letter", food.label.charAt(0).toUpperCase());
      letter.setAttribute("aria-hidden", "true");
      li.appendChild(letter);
    }
    var copy = el("span", "tf-copy");
    var link = el("a", "tf-name", food.label);
    link.href = food.url;
    copy.appendChild(link);
    copy.appendChild(el("span", "tf-serving", food.serving + " · " + food.amount));
    li.appendChild(copy);
    if (food.warning) li.appendChild(caution(food));
    var pct = el("span", "tf-pct", food.percent);
    pct.appendChild(el("small", "", "%"));
    li.appendChild(pct);
    var bar = el("span", "tf-bar");
    bar.setAttribute("aria-hidden", "true");
    bar.appendChild(el("i"));
    li.appendChild(bar);
    return li;
  }

  function render(animate) {
    var n = find(state.nutrient) || nutrients[0];
    state.nutrient = n.key;
    if (window.PregnutCautions) window.PregnutCautions.closeAll();

    var basis = $("TopFoodsBasis");
    basis.textContent = "One typical serving, as % of the daily pregnancy reference for ";
    basis.appendChild(el("strong", "", n.sentence));
    basis.appendChild(document.createTextNode(" (" + n.target + ")."));

    var list = $("FoodsByNutrient");
    var foods = n[state.source] || [];
    var fragment = document.createDocumentFragment();
    foods.forEach(function (food, i) { fragment.appendChild(row(food, i)); });
    list.classList.remove("is-fresh");
    list.replaceChildren(fragment);
    if (animate) {
      void list.offsetWidth;
      list.classList.add("is-fresh");
    }

    var guide = $("TopFoodsGuide");
    guide.href = n.guide;
    guide.textContent = "Why " + n.sentence + " matters in pregnancy";

    $("TopFoodsStatus").textContent = foods.length + " " + (state.source === "whole" ? "whole foods" : "foods") +
      " ranked by " + n.sentence + " per serving.";

    setChecked("topfoods-nutrient", state.nutrient);
    setChecked("topfoods-source", state.source);
  }

  function setChecked(name, value) {
    var inputs = document.getElementsByName(name);
    for (var i = 0; i < inputs.length; i++) inputs[i].checked = inputs[i].value === value;
  }

  // Bring the chosen chip into view when the chips scroll sideways.
  function revealChip() {
    var input = document.querySelector('input[name="topfoods-nutrient"]:checked');
    var chips = $("NutrientChips");
    if (!input || chips.scrollWidth <= chips.clientWidth) return;
    var chip = input.parentNode;
    chips.scrollLeft = chip.offsetLeft - chips.clientWidth / 2 + chip.offsetWidth / 2;
  }

  function start(json) {
    nutrients = json;
    var saved = load();
    var fromUrl = readUrl();
    state.nutrient = fromUrl.nutrient || saved.nutrient || nutrients[0].key;
    state.source = fromUrl.source || saved.source || "whole";
    if (!find(state.nutrient)) state.nutrient = nutrients[0].key;

    var changed = state.nutrient !== nutrients[0].key || state.source !== "whole";
    if (changed) render(false);
    revealChip();
    writeUrl(false);

    $("TopFoodsControls").addEventListener("change", function (ev) {
      var t = ev.target;
      if (t.name === "topfoods-nutrient") state.nutrient = t.value;
      else if (t.name === "topfoods-source") state.source = t.value;
      else return;
      save();
      writeUrl(true);
      render(true);
    });

    window.addEventListener("popstate", function () {
      var next = readUrl();
      if (next.nutrient) state.nutrient = next.nutrient;
      if (next.source) state.source = next.source;
      render(false);
      revealChip();
    });

    $("TopFoodsControls").querySelectorAll("input").forEach(function (input) { input.disabled = false; });
  }

  fetch(DATA_URL)
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(start)
    .catch(function () {
      $("TopFoodsStatus").textContent = "Other nutrients could not load. Refresh the page to try again.";
    });
})();
