// src/js/searchbar.js

$(function () {
  var $input = $("#FoodFinderInput");
  if ($input.length && $.fn.easyAutocomplete) {
    var foodFinderInit = {
      url: "/foodfindersearch.json",
      getValue: "FoodName",
      list: {
        match: { enabled: true },
        maxNumberOfElements: 20
      }
    };
    $input.easyAutocomplete(foodFinderInit);
    $("div.easy-autocomplete").removeAttr("style");
  }

  // Mobile navbar: pill row expands a menu (details/summary).
  var $navDetails = $("#NavCollapse");
  if ($navDetails.length) {
    var details = $navDetails.get(0);
    var $summary = $navDetails.find("summary.nav-pill").first();
    var mq = null;
    try { mq = window.matchMedia ? window.matchMedia("(max-width: 900px)") : null; } catch (e) { mq = null; }

    function isMobileNav() {
      try { return mq ? !!mq.matches : false; } catch (e) { return false; }
    }

    function applyNavMode() {
      if (!details) return;
      // Desktop: keep nav always visible; Mobile: collapse into the pill trigger.
      details.open = !isMobileNav();
      syncNavAria();
    }

    function syncNavAria() {
      if (!$summary.length || !details) return;
      var open = !!details.open;
      $summary.attr("aria-expanded", open ? "true" : "false");
    }

    details.addEventListener("toggle", syncNavAria);
    if (mq) {
      try {
        if (mq.addEventListener) mq.addEventListener("change", applyNavMode);
        else if (mq.addListener) mq.addListener(applyNavMode);
      } catch (e) {}
    }
    applyNavMode();

    // Close after selecting a link (mobile only).
    $navDetails.find("a.nav-link").on("click", function () {
      try {
        if (isMobileNav()) {
          details.open = false;
          syncNavAria();
        }
      } catch (e) {}
    });

    // Close on Escape and on outside click for a crisp mobile experience.
    document.addEventListener("keydown", function (ev) {
      if (!details.open) return;
      if (!isMobileNav()) return;
      if (ev && ev.key === "Escape") {
        details.open = false;
        syncNavAria();
      }
    });

    document.addEventListener("click", function (ev) {
      if (!details.open) return;
      if (!isMobileNav()) return;
      if (details.contains(ev.target)) return;
      details.open = false;
      syncNavAria();
    });
  }

  $("#FoodFinderSearchButton").on("click", function () {
    var value = $input.val();
    if (!value) {
      return;
    }
    window.location.href = "/food/?food=" + encodeURIComponent(value);
  });

  $input.on("keydown", function (ev) {
    if (ev && ev.key === "Enter") {
      ev.preventDefault();
      $("#FoodFinderSearchButton").trigger("click");
    }
  });
});
