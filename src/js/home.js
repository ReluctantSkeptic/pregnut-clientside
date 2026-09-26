// src/js/home.js
// Landing page interactions (scroll-triggered "needs" cards).

(function () {
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
      return;
    }
    fn();
  }

  onReady(function () {
    // Centered landing-page search (separate from the navbar search).
    // Uses the same dataset + autocomplete plugin when available.
    (function initHomeSearch() {
      var input = document.getElementById("HomeFoodSearchInput");
      if (!input) return;

      var form = input.closest ? input.closest("form") : null;
      var status = document.getElementById("HomeFoodSearchStatus");

      function openSelectedFood($input) {
        var selected = null;
        try { selected = $input.getSelectedItemData(); } catch (e) {}
        if (!selected || !selected.FoodUrl) return;
        window.location.href = selected.FoodUrl;
      }

      // Prevent empty submits (keeps the interaction feeling deliberate).
      try {
        if (form && form.addEventListener) {
          form.addEventListener("submit", function (ev) {
            var v = String(input.value || "").trim();
            if (!v) {
              try { ev.preventDefault(); } catch (e) {}
              input.setAttribute("aria-invalid", "true");
              if (status) {
                status.textContent = "Enter a food name to search.";
                status.hidden = false;
              }
              try { input.focus(); } catch (e) {}
            }
          });
          input.addEventListener("input", function () {
            input.removeAttribute("aria-invalid");
            if (status) status.hidden = true;
          });
        }
      } catch (e) {}

      input.addEventListener("focus", function () {
        if (input.dataset.autocompleteReady) return;
        window.loadFoodAutocomplete().then(function () {
          if (input.dataset.autocompleteReady) return;
          var $ = window.jQuery;
          var $input = $("#HomeFoodSearchInput");

          $input.easyAutocomplete({
            url: "/foodfindersearch.json",
            getValue: "FoodName",
            list: {
              match: { enabled: true },
              maxNumberOfElements: 18,
              onChooseEvent: function () { openSelectedFood($input); }
            }
          });

          // Remove inline sizing set by the plugin so CSS can own the layout.
          try {
            var $wrap = $input.closest("div.easy-autocomplete");
            if ($wrap && $wrap.length) $wrap.removeAttr("style");
          } catch (e) {}
          input.dataset.autocompleteReady = "true";
          if (input.value.trim()) $input.trigger("keyup");
        }).catch(function () { /* The form still submits without suggestions. */ });
      });
    })();

    var cards = document.querySelectorAll("[data-need-card]");
    if (!cards || !cards.length) return;

    var nutrientIconIndex = {
      "Calcium": 0,
      "Choline": 1,
      "DHA": 2,
      "Folate (DFE)": 3,
      "Iodine": 4,
      "Iron": 5,
      "Potassium": 6,
      "Protein": 7,
      "Riboflavin": 8,
      "Vitamin B-6": 9,
      "Vitamin B-12": 10,
      "Vitamin C": 11,
      "Vitamin D": 12,
      "Zinc": 13
    };

    for (var i = 0; i < cards.length; i++) {
      try {
        cards[i].style.setProperty("--i", String(i));

        var nutrientId = cards[i].getAttribute("data-nutrient") || "";
        var iconIndex = Object.prototype.hasOwnProperty.call(nutrientIconIndex, nutrientId)
          ? nutrientIconIndex[nutrientId]
          : i;
        var cover = cards[i].querySelector(".need-card-cover");
        if (cover && !cover.querySelector(".need-card-icon")) {
          var icon = document.createElement("span");
          icon.className = "need-card-icon";
          icon.setAttribute("aria-hidden", "true");
          icon.style.setProperty("--icon-col", String(iconIndex % 4));
          icon.style.setProperty("--icon-row", String(Math.floor(iconIndex / 4)));
          cover.insertBefore(icon, cover.firstChild);
        }
      } catch (e) {}
    }

    function getDeckTopPx() {
      var deck = document.getElementById("NeedsDeck");
      if (!deck || !window.getComputedStyle) return 110;
      var raw = "";
      try { raw = window.getComputedStyle(deck).getPropertyValue("--deck-top") || ""; } catch (e) { raw = ""; }
      var n = parseFloat(String(raw).trim());
      return isFinite(n) ? n : 110;
    }

    function getDeckPeekPx() {
      var deck = document.getElementById("NeedsDeck");
      if (!deck || !window.getComputedStyle) return 16;
      var raw = "";
      try { raw = window.getComputedStyle(deck).getPropertyValue("--deck-peek") || ""; } catch (e) { raw = ""; }
      var n = parseFloat(String(raw).trim());
      return isFinite(n) ? n : 16;
    }

    function getDeckMaxOffsetPx() {
      var deck = document.getElementById("NeedsDeck");
      if (!deck || !window.getComputedStyle) return 75;
      var raw = "";
      try { raw = window.getComputedStyle(deck).getPropertyValue("--deck-max-offset") || ""; } catch (e) { raw = ""; }
      var n = parseFloat(String(raw).trim());
      return isFinite(n) ? n : 75;
    }

    function updateActiveCard() {
      var deckTop = getDeckTopPx();
      var deckPeek = getDeckPeekPx();
      var deckMaxOffset = getDeckMaxOffsetPx();
      var best = null;
      var bestI = -1;

      for (var j = 0; j < cards.length; j++) {
        var c = cards[j];
        if (!c || !c.getBoundingClientRect) continue;
        var r = c.getBoundingClientRect();

        var idx = -1;
        try { idx = parseInt(c.style.getPropertyValue("--i"), 10); } catch (e) { idx = -1; }
        if (!isFinite(idx)) idx = j;

        // Card is "active" once it's reached its sticky stack position.
        var stackTop = deckTop + Math.min(deckPeek * idx, deckMaxOffset);
        if (r.top <= stackTop + 1 && idx >= bestI) {
          bestI = idx;
          best = c;
        }
      }

      if (!best) {
        best = cards[0];
        bestI = 0;
      }
      for (var k = 0; k < cards.length; k++) {
        try { cards[k].classList.toggle("is-active", cards[k] === best); } catch (e) {}
      }
      return bestI;
    }

    function updateStackMotion(activeIndex) {
      var supportsStack = true;
      var reduceMotion = false;
      try {
        supportsStack = !window.matchMedia || window.matchMedia("(min-width: 981px)").matches;
        reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch (e) {}

      var deckTop = getDeckTopPx();
      var deckPeek = getDeckPeekPx();
      var deckMaxOffset = getDeckMaxOffsetPx();
      var motionDistance = Math.max(280, (window.innerHeight || 720) * 0.48);

      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        if (!card) continue;

        if (!supportsStack || reduceMotion) {
          card.style.setProperty("--card-lift", "0px");
          card.style.setProperty("--card-shift", "0px");
          card.style.setProperty("--card-tilt", "0deg");
          card.style.setProperty("--card-pitch", "0deg");
          card.style.setProperty("--card-depth", "0px");
          card.style.setProperty("--card-scale", "1");
          card.style.setProperty("--card-opacity", "1");
          card.style.setProperty("--card-z", String(i + 1));
          card.classList.remove("is-stacked");
          continue;
        }

        var rect = card.getBoundingClientRect();
        var previousLift = parseFloat(card.style.getPropertyValue("--card-lift") || "0");
        if (!isFinite(previousLift)) previousLift = 0;

        var stackTop = deckTop + Math.min(deckPeek * i, deckMaxOffset);
        var naturalTop = rect.top - previousLift;
        var approach = 1 - Math.max(0, Math.min(1, (naturalTop - stackTop) / motionDistance));
        if (i <= activeIndex) approach = 1;

        var depth = Math.max(0, activeIndex - i);
        var scale = 1 - (Math.min(depth, 4) * 0.009) - ((1 - approach) * 0.014);
        var lift = (1 - approach) * 24;
        var direction = i % 2 === 0 ? -1 : 1;
        var shift = (1 - approach) * direction * 4;
        var tilt = (1 - approach) * direction * 0.24;
        var pitch = (1 - approach) * 0.72;
        var depthOffset = -Math.min(depth, 4) * 4;
        // Keep the card surface opaque while it approaches the stack so its icon
        // never sits over ghosted body copy from the card underneath.
        var opacity = 1;

        card.style.setProperty("--card-lift", lift.toFixed(2) + "px");
        card.style.setProperty("--card-shift", shift.toFixed(2) + "px");
        card.style.setProperty("--card-tilt", tilt.toFixed(3) + "deg");
        card.style.setProperty("--card-pitch", pitch.toFixed(3) + "deg");
        card.style.setProperty("--card-depth", depthOffset.toFixed(2) + "px");
        card.style.setProperty("--card-scale", scale.toFixed(4));
        card.style.setProperty("--card-opacity", opacity.toFixed(3));
        card.style.setProperty("--card-z", String(i + 1));
        card.style.setProperty("--stack-depth", String(depth));
        card.classList.toggle("is-stacked", depth > 0);
      }
    }

    // Keep one stable drop-shadow in the stacked deck.
    var ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        var activeIndex = updateActiveCard();
        updateStackMotion(activeIndex);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    var initialActiveIndex = updateActiveCard();
    updateStackMotion(initialActiveIndex);

    // No observer support: just show everything.
    if (!("IntersectionObserver" in window)) {
      for (var j = 0; j < cards.length; j++) {
        try { cards[j].classList.add("is-open"); } catch (e) {}
      }
    } else {
      var io = new IntersectionObserver(function (entries) {
        for (var k = 0; k < entries.length; k++) {
          var ent = entries[k];
          if (!ent || !ent.target) continue;
          if (ent.isIntersecting || (ent.intersectionRatio && ent.intersectionRatio >= 0.35)) {
            try { ent.target.classList.add("is-open"); } catch (e) {}
            try { io.unobserve(ent.target); } catch (e) {}
          }
        }
      }, { threshold: [0, 0.2, 0.35, 0.5] });

      for (var c = 0; c < cards.length; c++) {
        io.observe(cards[c]);
      }
    }
  });
})();
