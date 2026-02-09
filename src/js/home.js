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
    var cards = document.querySelectorAll("[data-need-card]");
    if (!cards || !cards.length) return;

    for (var i = 0; i < cards.length; i++) {
      try { cards[i].style.setProperty("--i", String(i)); } catch (e) {}
    }

    function getDeckTopPx() {
      var deck = document.getElementById("NeedsDeck");
      if (!deck || !window.getComputedStyle) return 110;
      var raw = "";
      try { raw = window.getComputedStyle(deck).getPropertyValue("--deck-top") || ""; } catch (e) { raw = ""; }
      var n = parseFloat(String(raw).trim());
      return isFinite(n) ? n : 110;
    }

    function updateActiveCard() {
      var deckTop = getDeckTopPx();
      var best = null;
      var bestI = -1;

      for (var j = 0; j < cards.length; j++) {
        var c = cards[j];
        if (!c || !c.getBoundingClientRect) continue;
        var r = c.getBoundingClientRect();
        // Card is "active" once it's reached the sticky stack.
        if (r.top <= deckTop + 1) {
          var idx = -1;
          try { idx = parseInt(c.style.getPropertyValue("--i"), 10); } catch (e) { idx = -1; }
          if (!isFinite(idx)) idx = j;
          if (idx >= bestI) {
            bestI = idx;
            best = c;
          }
        }
      }

      if (!best) best = cards[0];
      for (var k = 0; k < cards.length; k++) {
        try { cards[k].classList.toggle("is-active", cards[k] === best); } catch (e) {}
      }
    }

    // Keep only one drop-shadow in the stacked deck to avoid hazy "stacked shadows".
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        updateActiveCard();
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateActiveCard();

    // No observer support: just show everything.
    if (!("IntersectionObserver" in window)) {
      for (var j = 0; j < cards.length; j++) {
        try { cards[j].classList.add("is-open"); } catch (e) {}
      }
      return;
    }

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

    // Handle lede text color change on scroll
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
  });
});
