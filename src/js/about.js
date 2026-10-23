// src/js/about.js
// Scroll motion for the About story. Everything is readable without it, and
// nothing here runs when the reader prefers reduced motion.

(function () {
  if (!window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var body = document.body;
  var reads = [];

  // Wrap each word in a span, keeping inline elements such as <em>.
  function splitWords(root) {
    var words = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        var span = document.createElement("span");
        span.className = "w";
        span.textContent = part;
        words.push(span);
        frag.appendChild(span);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return words;
  }

  document.querySelectorAll("[data-split]").forEach(function (el) {
    splitWords(el).forEach(function (w, i) { w.style.setProperty("--i", i); });
  });

  document.querySelectorAll("[data-read]").forEach(function (el) {
    reads.push({ el: el, words: splitWords(el), lit: -1 });
  });

  // Reveal blocks once, staggered among their siblings.
  var revealed = document.querySelectorAll("[data-reveal]");
  revealed.forEach(function (el) {
    var siblings = el.parentNode.querySelectorAll(":scope > [data-reveal]");
    el.style.setProperty("--i", Array.prototype.indexOf.call(siblings, el));
  });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    revealed.forEach(function (el) { io.observe(el); });
  } else {
    revealed.forEach(function (el) { el.classList.add("is-in"); });
  }

  body.classList.add("ab-motion");

  var phones = document.querySelectorAll(".ab-phone");
  var portions = document.querySelector(".ab-portions");
  var track = portions ? portions.querySelector(".ab-portion-track") : null;
  var wide = window.matchMedia("(min-width: 861px)");
  var travel = 0;

  // Desktop: the 100 g strip moves sideways while the section is pinned.
  function layoutPortions() {
    if (!portions || !track) return;
    portions.classList.toggle("ab-pinned", wide.matches);
    portions.style.height = "";
    travel = 0;
    if (!wide.matches) return;
    travel = Math.max(0, track.scrollWidth - window.innerWidth);
    portions.style.height = (window.innerHeight + travel) + "px";
  }

  function update() {
    var vh = window.innerHeight;

    reads.forEach(function (r) {
      var rect = r.el.getBoundingClientRect();
      var progress = (vh * 0.82 - rect.top) / (rect.height + vh * 0.3);
      var lit = Math.round(Math.min(1, Math.max(0, progress)) * r.words.length);
      if (lit === r.lit) return;
      r.words.forEach(function (w, i) { w.classList.toggle("is-lit", i < lit); });
      r.lit = lit;
    });

    if (wide.matches) {
      phones.forEach(function (phone, i) {
        var rect = phone.getBoundingClientRect();
        var offset = (rect.top + rect.height / 2 - vh / 2) / vh;
        phone.style.setProperty("--drift", (offset * [-24, 36, -12][i % 3]).toFixed(1) + "px");
      });
    }

    if (travel) {
      var top = portions.getBoundingClientRect().top;
      var p = Math.min(1, Math.max(0, -top / travel));
      track.style.setProperty("--x", (-p * travel).toFixed(1) + "px");
    }
  }

  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () {
      queued = false;
      update();
    });
  }

  // Keep keyboard focus visible inside the pinned strip.
  if (track) {
    track.addEventListener("focusin", function (ev) {
      if (!travel) return;
      var card = ev.target.closest(".ab-portion");
      if (!card) return;
      var x = Math.min(travel, Math.max(0, card.offsetLeft - 56));
      var sectionTop = portions.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, sectionTop + x);
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { layoutPortions(); update(); });
  window.addEventListener("load", function () { layoutPortions(); update(); });
  layoutPortions();
  update();
})();
