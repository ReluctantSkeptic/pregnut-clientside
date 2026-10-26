// /food/?q=...: full search results, ranked the same way as the suggestions
// (searchbar.js), with each food's photo.
(function () {
  "use strict";

  var SHOWN = 40;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function row(food) {
    var item = el("li", "food-result");
    var link = el("a", "food-result-link");
    link.href = food.url;
    if (food.image) {
      var img = el("img", "food-result-pic");
      img.src = food.image;
      img.alt = "";
      img.width = 80;
      img.height = 80;
      img.loading = "lazy";
      img.decoding = "async";
      link.appendChild(img);
    } else {
      var letter = el("span", "food-result-pic is-letter", food.label.charAt(0).toUpperCase());
      letter.setAttribute("aria-hidden", "true");
      link.appendChild(letter);
    }
    link.appendChild(el("span", "food-result-name", food.label));
    item.appendChild(link);
    return item;
  }

  function render(foods, query) {
    var results = document.getElementById("FoodDirectoryResults");
    var status = document.getElementById("FoodDirectoryStatus");
    if (!results || !status) return;
    results.textContent = "";
    if (!foods.length) {
      status.textContent = "No foods match “" + query + "”. Try a simpler word, like “beans”.";
      status.hidden = false;
      results.hidden = true;
      return;
    }
    status.textContent = foods.length >= SHOWN
      ? "Top " + SHOWN + " matches for “" + query + "”."
      : foods.length + (foods.length === 1 ? " match" : " matches") + " for “" + query + "”.";
    status.hidden = false;
    results.hidden = false;
    foods.forEach(function (food) { results.appendChild(row(food)); });
  }

  function start() {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    var legacy = String(params.get("food") || "").trim();
    var query = legacy || String(params.get("q") || "").trim();
    if (!query || !window.PregnutSearch) return;

    var input = document.getElementById("FoodDirectoryInput");
    if (input) input.value = query;
    var status = document.getElementById("FoodDirectoryStatus");

    window.PregnutSearch.load()
      .then(function () {
        var foods = window.PregnutSearch.search(query, SHOWN);
        // Old ?food= links named one food exactly: go straight to it.
        var exact = foods.filter(function (f) { return normalize(f.label) === normalize(query); });
        if (legacy && exact.length === 1) { window.location.replace(exact[0].url); return; }
        render(foods, query);
      })
      .catch(function () {
        if (!status) return;
        status.textContent = "Food search is temporarily unavailable. Refresh to try again.";
        status.hidden = false;
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
