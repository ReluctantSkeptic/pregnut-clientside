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

      // Prevent empty submits (keeps the interaction feeling deliberate).
      try {
        var form = input.closest ? input.closest("form") : null;
        if (form && form.addEventListener) {
          form.addEventListener("submit", function (ev) {
            var v = String(input.value || "").trim();
            if (!v) {
              try { ev.preventDefault(); } catch (e) {}
              try { input.focus(); } catch (e) {}
            }
          });
        }
      } catch (e) {}

      try {
        if (window.jQuery && window.jQuery.fn && window.jQuery.fn.easyAutocomplete) {
          var $ = window.jQuery;
          var $input = $("#HomeFoodSearchInput");

          $input.easyAutocomplete({
            url: "/foodfindersearch.json",
            getValue: "FoodName",
            list: {
              match: { enabled: true },
              maxNumberOfElements: 18
            }
          });

          // Remove inline sizing set by the plugin so CSS can own the layout.
          try {
            var $wrap = $input.closest("div.easy-autocomplete");
            if ($wrap && $wrap.length) $wrap.removeAttr("style");
          } catch (e) {}
        }
      } catch (e) {}
    })();

    // Feature previews: mini "live" snapshots (no images) for Top Foods + Weekly Diet.
    (function initHomePreviews() {
      var topRoot = document.querySelector('[data-home-preview="topfoods"]');
      var weeklyRoot = document.querySelector('[data-home-preview="weekly"]');
      if (!topRoot && !weeklyRoot) return;

      function fetchJson(url) {
        return fetch(url, { cache: "force-cache" }).then(function (res) {
          if (!res.ok) throw new Error("Failed to load " + url + " (" + res.status + ")");
          return res.json();
        });
      }

      var protocolPromise = null;
      var fooddataPromise = null;
      function getProtocol() {
        if (!protocolPromise) protocolPromise = fetchJson("/resource/weekly_protocol.v1.json");
        return protocolPromise;
      }
      function getFooddata() {
        if (!fooddataPromise) fooddataPromise = fetchJson("/resource/pregnut_fooddata.v1.json");
        return fooddataPromise;
      }

      function shortFoodName(name) {
        var s = String(name || "").trim();
        if (!s) return "";
        var parts = s.split(",").map(function (p) { return String(p || "").trim(); }).filter(Boolean);
        if (parts.length <= 1) return s;
        return parts.slice(0, 2).join(", ");
      }

      function formatWeeks(start, end) {
        if (start === end) return "Week " + start;
        return "Weeks " + start + "\u2013" + end;
      }

      function clear(el) {
        while (el && el.firstChild) el.removeChild(el.firstChild);
      }

      function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
      }

      // Matches weekly-diet.js pastel palette for nutrient chips/bars.
      var NUTRIENT_ALPHA = [
        "Calcium",
        "Choline",
        "DHA",
        "Folate (DFE)",
        "Iron",
        "Potassium",
        "Protein",
        "Riboflavin",
        "Vitamin B-12",
        "Vitamin B-6",
        "Vitamin C",
        "Vitamin D",
        "Zinc"
      ];
      var PASTEL_RAINBOW = [
        "#9EC3E6",
        "#8ADDD7",
        "#BFE9F2",
        "#B7E3A1",
        "#D8E08A",
        "#F3D68A",
        "#F5B47A",
        "#EB8A86",
        "#F7B0CF",
        "#F49BB7",
        "#E7C6F5",
        "#CDB7F3",
        "#9AAFD6"
      ];
      var NUTRIENT_COLOR = (function () {
        var map = {};
        for (var i = 0; i < NUTRIENT_ALPHA.length; i++) {
          map[NUTRIENT_ALPHA[i]] = PASTEL_RAINBOW[i] || "#9EC3E6";
        }
        return map;
      })();
      function nutrientColor(nutrientId) {
        return NUTRIENT_COLOR[nutrientId] || "rgba(31, 122, 122, 0.70)";
      }

      function niceNutrientLabel(id) {
        var s = String(id || "");
        if (s === "Folate (DFE)") return "Folate";
        if (s.indexOf("Vitamin ") === 0) return s.replace("Vitamin ", "Vit ");
        return s;
      }

      function renderPreviewRows(rowsRoot, rows, opts) {
        if (!rowsRoot) return;
        clear(rowsRoot);
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i];
          var row = el("div", "home-preview-row" + (opts && opts.kind === "nutrient" ? " is-nutrient" : ""), null);
          if (r && r.p !== null && r.p !== undefined) {
            try { row.style.setProperty("--p", String(r.p)); } catch (e) {}
          }
          if (r && r.c) {
            try { row.style.setProperty("--c", String(r.c)); } catch (e) {}
          }
          row.appendChild(el("span", "home-preview-label", r.label || ""));
          row.appendChild(el("span", "home-preview-bar", ""));
          row.appendChild(el("span", "home-preview-value", r.value || ""));
          rowsRoot.appendChild(row);
        }
      }

      function initTopFoodsPreview() {
        if (!topRoot) return Promise.resolve();
        var titleEl = topRoot.querySelector("[data-home-preview-title]");
        var rowsRoot = topRoot.querySelector("[data-home-preview-rows]");

        var nutrientId = "Choline";
        var naturalOnly = true;

        return getFooddata()
          .then(function (fooddata) {
            if (!fooddata || !fooddata.nutrients || !fooddata.foods) return;
            var nInfo = fooddata.nutrients[nutrientId];
            if (!nInfo || !nInfo.rda || !nInfo.rda.value) return;
            var rda = Number(nInfo.rda.value);
            if (!isFinite(rda) || rda <= 0) return;

            var foods = fooddata.foods.slice();
            foods = foods.filter(function (f) {
              if (!f || !f.nutrients) return false;
              if (String(f.warning || "").toLowerCase() === "avoid") return false;
              if (naturalOnly && Number(f.natSource) !== 1) return false;
              var v = f.nutrients[nutrientId];
              return typeof v === "number" && isFinite(v) && v > 0;
            });

            foods.sort(function (a, b) {
              return (b.nutrients[nutrientId] || 0) - (a.nutrients[nutrientId] || 0);
            });
            var top = foods.slice(0, 5);
            if (!top.length) return;

            var pcts = top.map(function (f) {
              return (Number(f.nutrients[nutrientId]) / rda) * 100;
            });
            var maxPct = Math.max.apply(Math, pcts);
            if (!isFinite(maxPct) || maxPct <= 0) maxPct = 100;

            if (titleEl) titleEl.textContent = nutrientId;

            var rows = [];
            for (var i = 0; i < top.length; i++) {
              var f = top[i];
              var pct = pcts[i];
              var fill = Math.max(0, Math.min(1, pct / maxPct));
              rows.push({
                label: shortFoodName(f.name),
                value: Math.round(pct) + "%",
                p: fill
              });
            }
            renderPreviewRows(rowsRoot, rows, { kind: "food" });
          })
          .catch(function () {
            // Keep fallback sample markup.
          });
      }

      function initWeeklyPreview() {
        if (!weeklyRoot) return Promise.resolve();
        var weekEl = weeklyRoot.querySelector("[data-home-preview-week]");
        var periodEl = weeklyRoot.querySelector("[data-home-preview-period]");
        var timelineEl = weeklyRoot.querySelector("[data-home-preview-timeline]");
        var nutrientsRoot = weeklyRoot.querySelector("[data-home-preview-nutrients]");

        var sampleWeek = 15;
        var PRIORITY_WEIGHT = { high: 1.0, medium: 0.6, supporting: 0.35 };

        function priorityWeight(p) {
          var s = String(p || "").toLowerCase();
          return PRIORITY_WEIGHT[s] || PRIORITY_WEIGHT.supporting;
        }

        function percentOfRda(fooddata, food, nutrientId) {
          if (!fooddata || !fooddata.nutrients || !food) return null;
          var nInfo = fooddata.nutrients[nutrientId];
          if (!nInfo || !nInfo.rda || !nInfo.rda.value) return null;
          var rda = Number(nInfo.rda.value);
          if (!isFinite(rda) || rda <= 0) return null;
          var v = food.nutrients && typeof food.nutrients[nutrientId] === "number" ? food.nutrients[nutrientId] : null;
          if (v === null || v === undefined) return null;
          var n = Number(v);
          if (!isFinite(n)) return null;
          return (n / rda) * 100;
        }

        function scoreFood(fooddata, food, period) {
          var score = 0;
          var nuts = period && period.nutrients ? period.nutrients : [];
          for (var i = 0; i < nuts.length; i++) {
            var n = nuts[i];
            if (!n || !n.id) continue;
            var pct = percentOfRda(fooddata, food, n.id);
            if (pct === null) continue;
            // Same mental model as the app: extra above 100% doesn't keep stacking the score.
            score += Math.min(100, pct) * priorityWeight(n.priority);
          }
          return score;
        }

        return Promise.all([getProtocol(), getFooddata()])
          .then(function (all) {
            var protocol = all[0];
            var fooddata = all[1];
            if (!protocol || !protocol.periods || !protocol.periods.length) return;
            if (!fooddata || !fooddata.foods || !fooddata.nutrients) return;

            var periods = protocol.periods;
            var period = null;
            for (var i = 0; i < periods.length; i++) {
              var p = periods[i];
              if (sampleWeek >= p.weeks.start && sampleWeek <= p.weeks.end) { period = p; break; }
            }
            if (!period) period = periods[0];

            if (weekEl) weekEl.textContent = "Week " + sampleWeek;
            if (periodEl) periodEl.textContent = formatWeeks(period.weeks.start, period.weeks.end) + " \u00b7 " + period.title;

            if (timelineEl) {
              clear(timelineEl);
              for (var t = 0; t < periods.length; t++) {
                var segP = periods[t];
                var seg = el("div", "home-preview-seg" + (segP === period ? " is-active" : ""), "");
                var w = (segP.weeks.end - segP.weeks.start + 1);
                try { seg.style.setProperty("--w", String(Math.max(1, w))); } catch (e) {}
                timelineEl.appendChild(seg);
              }
            }

            // Snapshot: top picks for this period (overall score).
            var foods = fooddata.foods.slice();
            foods = foods.filter(function (f) {
              if (!f || !f.nutrients) return false;
              if (String(f.warning || "").toLowerCase() === "avoid") return false;
              return true;
            });
            foods.sort(function (a, b) {
              return scoreFood(fooddata, b, period) - scoreFood(fooddata, a, period);
            });
            var top = foods.slice(0, 5);
            if (!top.length) return;

            var scores = top.map(function (f) { return scoreFood(fooddata, f, period); });
            var maxScore = Math.max.apply(Math, scores);
            if (!isFinite(maxScore) || maxScore <= 0) maxScore = 1;

            var rows = [];
            for (var r = 0; r < top.length; r++) {
              var f = top[r];
              var sc = scores[r];
              rows.push({
                label: shortFoodName(f.name),
                value: String(Math.round(sc)),
                p: Math.max(0, Math.min(1, sc / maxScore))
              });
            }
            renderPreviewRows(nutrientsRoot, rows, { kind: "food" });
          })
          .catch(function () {
            // Keep fallback sample markup.
          });
      }

      try {
        Promise.all([initTopFoodsPreview(), initWeeklyPreview()]).catch(function () {});
      } catch (e) {}
    })();

    // Handle lede text color change on scroll.
    var lede = document.querySelector(".home-lede");
    if (lede && window.requestAnimationFrame) {
      function updateLedeColor() {
        var rect = lede.getBoundingClientRect();
        var heroHeight = window.innerHeight;
        // When lede is near top of viewport, darken it
        // Transition happens as we scroll past the hero image
        var progress = Math.max(0, Math.min(1, 1 - (rect.top / heroHeight)));
        if (progress > 0.3) {
          try { lede.classList.add("is-dark"); } catch (e) {}
        } else {
          try { lede.classList.remove("is-dark"); } catch (e) {}
        }
      }

      var ledeTicking = false;
      window.addEventListener("scroll", function () {
        if (ledeTicking) return;
        ledeTicking = true;
        window.requestAnimationFrame(function () {
          ledeTicking = false;
          updateLedeColor();
        });
      }, { passive: true });
      updateLedeColor();
    }

    var cards = document.querySelectorAll("[data-need-card]");
    if (!cards || !cards.length) return;

    for (var i = 0; i < cards.length; i++) {
      try { cards[i].style.setProperty("--i", String(i)); } catch (e) {}

      // Stable per-load randomness so cards feel like a paper pile that "orders" as they stack.
      try {
        cards[i].dataset.pileRot = (Math.random() * 12 - 6).toFixed(3); // deg, [-6, 6]
        cards[i].dataset.pileX = (Math.random() * 18 - 9).toFixed(3); // px, [-9, 9]
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

    function updateActiveCard() {
      var deckTop = getDeckTopPx();
      var deckPeek = getDeckPeekPx();
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
        var stackTop = deckTop + (deckPeek * idx);
        if (r.top <= stackTop + 1 && idx >= bestI) {
          bestI = idx;
          best = c;
        }
      }

      if (!best) best = cards[0];
      for (var k = 0; k < cards.length; k++) {
        try { cards[k].classList.toggle("is-active", cards[k] === best); } catch (e) {}
      }
    }

    // Keep only one drop-shadow in the stacked deck to avoid hazy "stacked shadows".
    var ticking = false;
    
    function updateTilt() {
      var deckTop = getDeckTopPx();
      var deckPeek = getDeckPeekPx();
      var reduceMotion = false;
      try {
        reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch (e) { reduceMotion = false; }
      
      for (var j = 0; j < cards.length; j++) {
        var card = cards[j];
        if (!card || !card.getBoundingClientRect) continue;
        
        var rect = card.getBoundingClientRect();
        var idx = -1;
        try { idx = parseInt(card.style.getPropertyValue("--i"), 10); } catch (e) { idx = -1; }
        if (!isFinite(idx)) idx = j;

        var tiltAngle = 0;
        var shiftX = 0;
        
        // Once a card has reached its sticky position, it becomes "ordered" (straight).
        var stackTop = deckTop + (deckPeek * idx);

        if (!reduceMotion && rect.top > stackTop + 1 && !card.classList.contains("is-active")) {
          var distanceFromStack = rect.top - stackTop;
          var maxDistance = window.innerHeight * 0.45;
          var progress = Math.max(0, Math.min(1, distanceFromStack / maxDistance));

          var baseRot = 0;
          var baseX = 0;
          try { baseRot = parseFloat(card.dataset.pileRot || "0"); } catch (e) { baseRot = 0; }
          try { baseX = parseFloat(card.dataset.pileX || "0"); } catch (e) { baseX = 0; }
          if (!isFinite(baseRot)) baseRot = 0;
          if (!isFinite(baseX)) baseX = 0;

          tiltAngle = progress * baseRot;
          shiftX = progress * baseX;
        }
        
        try {
          card.style.transform =
            "translateX(" + shiftX.toFixed(2) + "px) rotate(" + tiltAngle.toFixed(2) + "deg)";
        } catch (e) {}
      }
    }
    
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        updateActiveCard();
        updateTilt();
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateActiveCard();
    updateTilt();

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
