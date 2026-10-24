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

    // Phones: the sticky CTA appears once the hero buttons scroll away and
    // steps aside for the closing band and footer.
    (function initMobileCta() {
      var cta = document.getElementById("HomeMobileCta");
      var actions = document.querySelector(".home-actions");
      var endings = document.querySelectorAll(".home-closer, .site-footer");
      if (!cta || !actions || !("IntersectionObserver" in window)) return;
      var heroVisible = true;
      var endVisible = new Set();
      function update() { cta.classList.toggle("is-visible", !heroVisible && !endVisible.size); }
      new IntersectionObserver(function (entries) { heroVisible = entries[0].isIntersecting; update(); }).observe(actions);
      // The closing band and footer carry their own buttons.
      var endObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) endVisible.add(entry.target); else endVisible.delete(entry.target);
        });
        update();
      });
      endings.forEach(function (node) { endObserver.observe(node); });
      cta.classList.add("is-managed");
    })();

    var cards = document.querySelectorAll("[data-need-card]");
    if (!cards || !cards.length) return;

    // One deck, one motion: every card rises over the same equal slice of the
    // scroll and settles in the same spot; cards underneath step back by the
    // same amount per card on top, so the pile always reads the same way.
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    var portrait = window.matchMedia("(max-width: 800px)");
    var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    var DEPTH = 3;
    var STEP_Y = 16;
    var STEP_SCALE = .045;
    var stacks = Array.from(document.querySelectorAll(".nutrient-stack-section"), function (section) {
      var items = Array.from(section.querySelectorAll(".need-card"));
      var state = { section: section, items: items, scales: items.map(function () { return 1; }), velocities: items.map(function () { return 0; }), hover: -1, progress: null, titles: section.querySelectorAll("[data-stack-link]") };
      items.forEach(function (card, i) {
        card.addEventListener("pointerenter", function () { if (finePointer.matches) { state.hover = i; requestTick(); } });
        card.addEventListener("pointerleave", function () { state.hover = -1; requestTick(); });
        card.addEventListener("focusin", function () { state.hover = i; requestTick(); });
        card.addEventListener("focusout", function () { state.hover = -1; requestTick(); });
      });
      return state;
    });
    var frame = 0;
    var lastTime = 0;
    function clamp(value) { return Math.max(0, Math.min(1, value)); }
    function ease(t) { return t * t * (3 - 2 * t); }
    function render(time) {
      frame = 0;
      var dt = Math.min((time - lastTime) / 1000 || 1 / 60, 1 / 30);
      lastTime = time;
      var moving = false;
      stacks.forEach(function (state) {
        var count = state.items.length;
        var phases;
        var active;
        if (portrait.matches) {
          // Phone: cards are sticky in CSS; a card's phase is how far the
          // next one has slid over it.
          phases = state.items.map(function (card) {
            var rect = card.getBoundingClientRect();
            return ease(clamp((window.innerHeight - rect.top) / (window.innerHeight * .6)));
          });
        } else {
          var rect = state.section.getBoundingClientRect();
          var targetProgress = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight));
          if (state.progress === null || reduced.matches) state.progress = targetProgress;
          state.progress += (targetProgress - state.progress) * (1 - Math.exp(-dt / .075));
          if (Math.abs(targetProgress - state.progress) > .0001) moving = true;
          else state.progress = targetProgress;
          // The first card is already in place; the rest share the scroll
          // equally, leaving a short hold on the last card.
          var segment = .92 / Math.max(1, count - 1);
          phases = state.items.map(function (card, i) {
            return i === 0 ? 1 : ease(clamp((state.progress - (i - 1) * segment) / segment));
          });
        }
        active = 0;
        phases.forEach(function (phase, i) { if (phase > .5) active = i; });
        state.titles.forEach(function (title, i) {
          title.classList.toggle("is-current", i === active);
          if (i === active) title.setAttribute("aria-current", "step");
          else title.removeAttribute("aria-current");
        });
        state.items.forEach(function (card, i) {
          var target = state.hover === i && !portrait.matches && !reduced.matches ? 1.03 : 1;
          var scale = state.scales[i];
          var velocity = state.velocities[i];
          velocity += (400 * (target - scale) - 25 * velocity) * dt;
          scale += velocity * dt;
          if (Math.abs(target - scale) < .00001 && Math.abs(velocity) < .0001) { scale = target; velocity = 0; }
          else moving = true;
          state.scales[i] = scale;
          state.velocities[i] = velocity;
          if (reduced.matches) { card.style.transform = "none"; card.style.opacity = ""; card.style.visibility = ""; return; }
          // How many cards (fractionally) sit on top of this one.
          var depth = 0;
          for (var j = i + 1; j < count; j++) depth += phases[j];
          var back = Math.min(depth, DEPTH);
          var fade = clamp(DEPTH + 1 - depth);
          if (portrait.matches) {
            card.style.transform = "translateY(" + (-back * STEP_Y * .5).toFixed(3) + "px) scale(" + (1 - back * STEP_SCALE * .6).toFixed(5) + ")";
            card.style.opacity = fade.toFixed(3);
            card.style.visibility = "";
            return;
          }
          var rise = (1 - phases[i]) * 110;
          card.style.transform = "translateY(calc(" + rise.toFixed(3) + "vh - " + (back * STEP_Y).toFixed(3) + "px)) scale(" + ((1 - back * STEP_SCALE) * scale).toFixed(5) + ")";
          card.style.opacity = fade.toFixed(3);
          card.style.visibility = phases[i] > 0 && fade > 0 ? "visible" : "hidden";
        });
      });
      if (moving) requestTick();
    }
    function requestTick() { if (!frame) frame = requestAnimationFrame(render); }
    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", requestTick);
    reduced.addEventListener("change", requestTick);
    portrait.addEventListener("change", requestTick);
    requestTick();
  });
})();