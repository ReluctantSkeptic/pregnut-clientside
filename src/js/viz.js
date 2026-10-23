// src/js/viz.js
// Shared DOM builders for food rankings: one-hue bars, photo rows, chips, and info popovers.
// Data calculations stay in each page script; this file only renders.

(function () {
  var IMAGE_MAP_URL = "/resource/food-images.v1.json";
  var imageMapPromise = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function loadImageMap() {
    if (!imageMapPromise) {
      imageMapPromise = fetch(IMAGE_MAP_URL)
        .then(function (res) { return res.ok ? res.json() : {}; })
        .catch(function () { return {}; });
    }
    return imageMapPromise;
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function foodUrl(food) {
    return "/food/" + String(food && food.id ? food.id : "") + "-" + slugify(food && food.name) + "/";
  }

  // "Seaweed, Spirulina, Dried" -> { main: "Seaweed", detail: "Spirulina, Dried" }
  function splitName(name) {
    var s = String(name || "").trim();
    var idx = s.indexOf(",");
    if (idx === -1) return { main: s, detail: "" };
    return { main: s.slice(0, idx).trim() || s, detail: s.slice(idx + 1).trim() };
  }

  function formatAmount(value) {
    var n = Number(value);
    if (!isFinite(n)) return "—";
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  // Short bars can't hold their label, so it sits just past the fill instead.
  var INSIDE_MIN = 24;

  // withValue puts the percent label on the bar itself; a number sets the
  // inside threshold for narrow bars.
  function bar(percent, label, withValue) {
    var p = Number(percent);
    if (!isFinite(p)) p = 0;
    p = Math.max(0, p);
    var node = el("div", "viz-bar" + (p >= 100 ? " is-full" : "") + (withValue ? " has-value" : ""), null);
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", label || (Math.round(p) + "% of nutrient reference amount"));
    var fill = el("span", "viz-bar-fill", null);
    fill.setAttribute("aria-hidden", "true");
    node.style.setProperty("--pct", Math.min(p, 100) + "%");
    node.appendChild(fill);
    if (withValue) {
      var text = el("span", "viz-bar-value" + (p >= (typeof withValue === "number" ? withValue : INSIDE_MIN) ? " is-inside" : ""), (p >= 100 ? "✓ " : "") + Math.round(p) + "%");
      text.setAttribute("aria-hidden", "true");
      node.appendChild(text);
    }
    return node;
  }

  function value(percent, suffix) {
    var p = Math.round(Number(percent) || 0);
    var node = el("span", "viz-value", null);
    node.setAttribute("aria-hidden", "true");
    if (p >= 100) {
      var check = el("span", "viz-check", "✓");
      node.appendChild(check);
    }
    node.appendChild(document.createTextNode(p + "%" + (suffix || "")));
    return node;
  }

  function thumb(food, imageMap) {
    var src = imageMap && food ? imageMap[String(food.id)] : null;
    if (src) {
      var img = el("img", "viz-thumb", null);
      img.src = src;
      img.alt = "";
      img.width = 68;
      img.height = 68;
      img.loading = "lazy";
      img.decoding = "async";
      return img;
    }
    var initial = foodName(food).charAt(0).toUpperCase();
    var tile = el("span", "viz-thumb", initial || "·");
    tile.setAttribute("aria-hidden", "true");
    return tile;
  }

  function popover(className, triggerText, triggerLabel, message) {
    var wrap = el("span", "caution" + (className ? " " + className : ""), null);
    var btn = el("button", "caution-trigger", triggerText);
    btn.type = "button";
    btn.setAttribute("aria-label", triggerLabel);
    btn.setAttribute("aria-expanded", "false");
    var pop = el("span", "caution-popover", message);
    pop.setAttribute("role", "tooltip");
    wrap.appendChild(btn);
    wrap.appendChild(pop);
    return wrap;
  }

  function info(message, label) {
    return popover("is-info", "i", label || "About this chart", message);
  }

  function safetyNote(food) {
    var warn = String(food && food.warning ? food.warning : "").trim();
    if (!warn || warn.toLowerCase() === "0") return null;
    var wt = String(food.warningText || "").trim();
    var msg = warn + ": " + (wt || "Use caution.");
    return popover("is-safety", "!", "Safety note: " + msg, msg);
  }

  // One readable line: the build's label, else the raw database name.
  function foodName(food) {
    return String((food && (food.label || food.name)) || "");
  }

  // The share of a day's reference in plain words. Mirrored in src/_data/topFoods.js.
  function dayPhrase(percent) {
    var p = Number(percent) || 0;
    if (p >= 100) return "Covers a full day";
    if (p >= 67) return "Covers most of a day";
    if (p >= 40) return "Covers about half a day";
    if (p >= 20) return "Covers about a quarter of a day";
    return "A small part of a day";
  }

  // opts: { food, percent, imageMap, tip, amount, tag, featured }
  // featured shows a large photo and a plain-language line; it needs a photo.
  function foodRow(opts) {
    var food = opts.food;
    var row = el(opts.tag || "li", "viz-row", null);
    var photo = thumb(food, opts.imageMap);
    var featured = !!opts.featured && photo.tagName === "IMG";
    if (featured) {
      row.className += " is-featured";
      photo.width = 400;
      photo.height = 400;
      photo.loading = "eager";
    }
    row.appendChild(photo);

    var copy = el("div", "viz-copy", null);
    var name = el("p", "viz-name", null);
    var link = el("a", "", null);
    link.href = foodUrl(food);
    link.textContent = foodName(food);
    if (food && food.label && food.label !== food.name) link.title = food.name;
    name.appendChild(link);
    copy.appendChild(name);
    var caution = safetyNote(food);
    if (caution) copy.appendChild(caution);
    row.appendChild(copy);
    if (featured) row.appendChild(el("p", "viz-phrase", dayPhrase(opts.percent)));

    if (opts.amount) {
      var amount = el("span", "viz-amount", opts.amount);
      amount.setAttribute("aria-hidden", "true");
      row.appendChild(amount);
    }
    row.appendChild(bar(opts.percent, opts.tip, true));
    return row;
  }

  // Radio-button pill row. items: [{ value, label }]
  function chips(container, name, items, selected, onChange) {
    while (container.firstChild) container.removeChild(container.firstChild);
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var label = el("label", "viz-chip", null);
      var input = el("input", "", null);
      input.type = "radio";
      input.name = name;
      input.value = item.value;
      input.checked = item.value === selected;
      input.addEventListener("change", (function (v) {
        return function () { onChange(v); };
      })(item.value));
      label.appendChild(input);
      label.appendChild(el("span", "", item.label));
      container.appendChild(label);
    }
  }

  function setChecked(container, selected) {
    var inputs = container ? container.querySelectorAll("input[type=radio]") : [];
    for (var i = 0; i < inputs.length; i++) inputs[i].checked = inputs[i].value === selected;
  }

  // Center the checked chip inside its scroll row.
  function revealSelected(container) {
    var checked = container ? container.querySelector("input:checked") : null;
    var chip = checked ? checked.parentNode : null;
    if (!chip || !container.scrollTo || container.scrollWidth <= container.clientWidth) return;
    var left = chip.offsetLeft - (container.clientWidth - chip.offsetWidth) / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }

  window.PregnutViz = {
    el: el,
    loadImageMap: loadImageMap,
    foodUrl: foodUrl,
    slugify: slugify,
    splitName: splitName,
    foodName: foodName,
    dayPhrase: dayPhrase,
    formatAmount: formatAmount,
    bar: bar,
    value: value,
    thumb: thumb,
    info: info,
    safetyNote: safetyNote,
    foodRow: foodRow,
    chips: chips,
    setChecked: setChecked,
    revealSelected: revealSelected
  };
})();
