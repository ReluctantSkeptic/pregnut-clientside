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

    var deck = document.getElementById("NeedsDeck");
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var positions = [];
    var ticking = false;

    function measureDeck() {
      deck.classList.add("is-measuring");
      var deckTop = deck.getBoundingClientRect().top + window.scrollY;
      positions = Array.from(cards, function (card, index) {
        // A tall card may travel above the header so its bottom is readable.
        var pin = Math.min(104 + Math.min(index, 4) * 8, window.innerHeight - card.offsetHeight - 96);
        card.style.setProperty("--pin-top", pin + "px");
        return { start: deckTop + card.offsetTop, pin: pin, height: card.offsetHeight };
      });
      deck.classList.remove("is-measuring");
      updateDeck();
    }

    function updateDeck() {
      ticking = false;
      var scroll = window.scrollY;
      cards.forEach(function (card, index) {
        var position = positions[index];
        if (!position) return;
        var next = positions[index + 1];
        var progress = next ? Math.max(0, Math.min(1,
          (scroll + position.pin + position.height - next.start) / position.height)) : 0;
        var eased = progress * progress * (3 - 2 * progress);
        var depth = reducedMotion.matches ? 0 : eased;
        card.style.setProperty("--stack-scale", (1 - depth * .035).toFixed(4));
        card.style.setProperty("--stack-tilt", (depth * (index % 2 ? .45 : -.45)).toFixed(3) + "deg");
        card.classList.toggle("is-stacked", progress > .85);
        card.classList.toggle("is-active", scroll >= position.start - position.pin && progress < .85);
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateDeck);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measureDeck);
    reducedMotion.addEventListener("change", measureDeck);
    if ("ResizeObserver" in window) {
      var deckResize = new ResizeObserver(measureDeck);
      cards.forEach(function (card) { deckResize.observe(card); });
    }
    if (document.fonts) document.fonts.ready.then(measureDeck);
    measureDeck();
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
