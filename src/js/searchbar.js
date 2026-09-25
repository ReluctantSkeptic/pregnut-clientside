// Load food suggestions only when a visitor uses a search field.
(function () {
  var autocompletePromise;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  window.loadFoodAutocomplete = function () {
    if (!autocompletePromise) {
      var stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "/style/easy-autocomplete.css";
      document.head.appendChild(stylesheet);
      autocompletePromise = loadScript("/js/jquery.min.js")
        .then(function () { return loadScript("/js/jquery.easy-autocomplete.min.js"); });
    }
    return autocompletePromise;
  };

  function start() {
    var input = document.getElementById("FoodFinderInput");
    var status = document.getElementById("FoodFinderStatus");

    function clearSearchError() {
      input.removeAttribute("aria-invalid");
      status.hidden = true;
      status.textContent = "";
    }

    function submitFoodSearch() {
      var value = input.value.trim();
      if (!value) {
        input.setAttribute("aria-invalid", "true");
        status.textContent = "Enter a food name to search.";
        status.hidden = false;
        input.focus();
        return;
      }

      clearSearchError();
      var selected = null;
      if (window.jQuery && window.jQuery.fn.easyAutocomplete) {
        try { selected = window.jQuery(input).getSelectedItemData(); } catch (error) {}
      }
      if (selected && selected.FoodUrl && String(selected.FoodName || "").trim() === value) {
        window.location.href = selected.FoodUrl;
        return;
      }
      window.location.href = "/food/?q=" + encodeURIComponent(value);
    }

    if (input) {
      input.addEventListener("focus", function () {
        if (input.dataset.autocompleteReady) return;
        window.loadFoodAutocomplete().then(function () {
          if (input.dataset.autocompleteReady) return;
          var $input = window.jQuery(input);
          $input.easyAutocomplete({
            url: "/foodfindersearch.json",
            getValue: "FoodName",
            list: {
              match: { enabled: true },
              maxNumberOfElements: 20,
              onChooseEvent: submitFoodSearch
            }
          });
          $input.closest("div.easy-autocomplete").removeAttr("style");
          input.dataset.autocompleteReady = "true";
          if (input.value.trim()) $input.trigger("keyup");
        }).catch(function () { /* Search still works without suggestions. */ });
      });
      input.addEventListener("input", clearSearchError);
      input.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        submitFoodSearch();
      });
    }

    var button = document.getElementById("FoodFinderSearchButton");
    if (button) button.addEventListener("click", submitFoodSearch);

    var details = document.getElementById("NavCollapse");
    if (!details) return;
    var summary = details.querySelector("summary.nav-pill");
    var mq = window.matchMedia("(max-width: 900px)");

    function syncNavAria() {
      if (summary) summary.setAttribute("aria-expanded", String(details.open));
    }

    function applyNavMode() {
      details.open = !mq.matches;
      syncNavAria();
    }

    details.addEventListener("toggle", syncNavAria);
    if (mq.addEventListener) mq.addEventListener("change", applyNavMode);
    else mq.addListener(applyNavMode);
    applyNavMode();

    details.querySelectorAll("a.nav-link").forEach(function (link) {
      link.addEventListener("click", function () {
        if (mq.matches) details.open = false;
      });
    });

    document.addEventListener("keydown", function (event) {
      if (details.open && mq.matches && event.key === "Escape") details.open = false;
    });
    document.addEventListener("click", function (event) {
      if (details.open && mq.matches && !details.contains(event.target)) details.open = false;
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
