(function () {
  "use strict";

  var SEARCH_DATA_URL = "/foodfindersearch.json";

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function normalizeBaseName(value) {
    return normalize(value).replace(/\s+\(food id \d+\)$/, "");
  }

  function createResult(food) {
    var item = document.createElement("li");
    var link = document.createElement("a");
    link.href = food.FoodUrl;
    link.textContent = food.FoodName + " nutrition in pregnancy";
    item.appendChild(link);
    return item;
  }

  function renderResults(foods, query) {
    var results = document.getElementById("FoodDirectoryResults");
    var status = document.getElementById("FoodDirectoryStatus");
    if (!results || !status) return;

    while (results.firstChild) results.removeChild(results.firstChild);

    if (!foods.length) {
      status.textContent = "No foods found for \"" + query + "\". Try a shorter or more general search.";
      status.hidden = false;
      results.hidden = true;
      return;
    }

    status.textContent = foods.length + (foods.length === 1 ? " result" : " results") + " for \"" + query + "\".";
    status.hidden = false;
    results.hidden = false;

    foods.slice(0, 50).forEach(function (food) {
      results.appendChild(createResult(food));
    });
  }

  function findMatches(foods, query) {
    var normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];

    return foods.filter(function (food) {
      return normalize(food.FoodName).indexOf(normalizedQuery) !== -1;
    });
  }

  function initAutocomplete() {
    if (!window.jQuery || !window.jQuery.fn || !window.jQuery.fn.easyAutocomplete) return;

    var $input = window.jQuery("#FoodDirectoryInput");
    if (!$input.length) return;

    $input.easyAutocomplete({
      url: SEARCH_DATA_URL,
      getValue: "FoodName",
      list: {
        match: { enabled: true },
        maxNumberOfElements: 20,
        onChooseEvent: function () {
          var selected = null;
          try { selected = $input.getSelectedItemData(); } catch (error) {}
          if (selected && selected.FoodUrl) window.location.href = selected.FoodUrl;
        }
      }
    });

    try { $input.closest("div.easy-autocomplete").removeAttr("style"); } catch (error) {}
  }

  function start() {
    initAutocomplete();

    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (error) {
      return;
    }

    var legacyQuery = String(params.get("food") || "").trim();
    var query = legacyQuery || String(params.get("q") || "").trim();
    if (!query) return;

    var input = document.getElementById("FoodDirectoryInput");
    if (input) input.value = query;

    fetch(SEARCH_DATA_URL, { cache: "force-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("Food search is temporarily unavailable.");
        return response.json();
      })
      .then(function (foods) {
        var exactMatches = foods.filter(function (food) {
          return normalizeBaseName(food.FoodName) === normalize(query);
        });

        if (legacyQuery && exactMatches.length === 1) {
          window.location.replace(exactMatches[0].FoodUrl);
          return;
        }

        renderResults(findMatches(foods, query), query);
      })
      .catch(function (error) {
        var status = document.getElementById("FoodDirectoryStatus");
        if (!status) return;
        status.textContent = error && error.message ? error.message : "Food search is temporarily unavailable.";
        status.hidden = false;
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
