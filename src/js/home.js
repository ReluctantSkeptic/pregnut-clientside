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

    // RealFood reference: sequential 20% scroll segments, bottom-origin rotation,
    // and a mass-1 spring with stiffness 400 / damping 25 for the 1.03 hover scale.
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    var portrait = window.matchMedia("(max-width: 800px)");
    var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    var poses = [[12, -20, -5], [-10, -28, 4], [8, -36, -3], [-6, -44, 2]];
    var stacks = Array.from(document.querySelectorAll(".nutrient-stack-section"), function (section) {
      var items = Array.from(section.querySelectorAll(".need-card"));
      var state = { section: section, items: items, scales: items.map(function () { return 1; }), velocities: items.map(function () { return 0; }), hover: -1, progress: null, titles: section.querySelectorAll("[data-stack-link]") };
      items.forEach(function (card, i) {
        card.addEventListener("pointerenter", function () { if (finePointer.matches) { state.hover = i; requestTick(); } });
        card.addEventListener("pointerleave", function () { state.hover = -1; requestTick(); });
        card.addEventListener("focusin", function () { state.hover = i; requestTick(); });
        card.addEventListener("focusout", function () { state.hover = -1; requestTick(); });
      });
      section.querySelectorAll("[data-stack-link]").forEach(function (link, i) {
        link.addEventListener("pointerenter", function () { if (finePointer.matches) { state.hover = i; requestTick(); } });
        link.addEventListener("pointerleave", function () { state.hover = -1; requestTick(); });
      });
      return state;
    });
    var frame = 0;
    var lastTime = 0;
    function clamp(value) { return Math.max(0, Math.min(1, value)); }
    function render(time) {
      frame = 0;
      var dt = Math.min((time - lastTime) / 1000 || 1 / 60, 1 / 30);
      lastTime = time;
      var moving = false;
      stacks.forEach(function (state) {
        var rect = state.section.getBoundingClientRect();
        var targetProgress = clamp((window.innerHeight - rect.top) / rect.height);
        if (state.progress === null || reduced.matches || portrait.matches) state.progress = targetProgress;
        state.progress += (targetProgress - state.progress) * (1 - Math.exp(-dt / .075));
        if (Math.abs(targetProgress - state.progress) > .0001) moving = true;
        else state.progress = targetProgress;
        var progress = state.progress;
        var segment = .8 / state.items.length;
        var active = Math.min(state.items.length - 1, Math.max(0, Math.floor(progress / segment)));
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
          if (reduced.matches) { card.style.transform = "none"; return; }
          if (portrait.matches) {
            card.style.transform = "scale(" + (1 - progress * (.12 - i * .03)).toFixed(5) + ")";
          } else {
            var phase = clamp((progress - i * segment) / segment);
            phase = phase * phase * (3 - 2 * phase);
            var pose = poses[i];
            var y = 600 * (1 - phase) + pose[1] * phase;
            card.style.transform = "translate(" + (pose[0] * phase).toFixed(3) + "px," + y.toFixed(3) + "px) rotate(" + (pose[2] * phase).toFixed(3) + "deg) scale(" + scale.toFixed(5) + ")";
          }
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