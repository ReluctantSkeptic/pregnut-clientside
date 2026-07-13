// Viewport-safe caution popovers shared by food comparison pages.

(function () {
  var initialized = false;

  function getPopover(wrap) {
    if (!wrap) return null;
    return wrap.__pregnutPopover || wrap.querySelector(".caution-popover");
  }

  function resetPopover(wrap) {
    var pop = getPopover(wrap);
    if (!pop) return;

    pop.removeAttribute("data-open");
    pop.removeAttribute("data-placement");
    pop.style.removeProperty("left");
    pop.style.removeProperty("top");
    pop.style.removeProperty("width");
    pop.style.removeProperty("--arrow-left");
    wrap.appendChild(pop);
    wrap.__pregnutPopover = null;
  }

  function closeAll() {
    var open = document.querySelectorAll('.caution[data-open="1"]');
    for (var i = 0; i < open.length; i++) {
      var wrap = open[i];
      wrap.removeAttribute("data-open");
      var btn = wrap.querySelector(".caution-trigger");
      if (btn) btn.setAttribute("aria-expanded", "false");
      resetPopover(wrap);
    }
  }

  function positionPopover(wrap) {
    var pop = getPopover(wrap);
    var btn = wrap ? wrap.querySelector(".caution-trigger") : null;
    if (!pop || !btn || wrap.getAttribute("data-open") !== "1") return;

    var margin = 12;
    var gap = 10;
    var viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    var viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    var width = Math.min(320, Math.max(220, viewportWidth - (margin * 2)));
    var triggerRect = btn.getBoundingClientRect();
    var left = triggerRect.left + (triggerRect.width / 2) - (width / 2);
    left = Math.max(margin, Math.min(left, viewportWidth - width - margin));

    pop.style.width = width + "px";
    pop.style.left = left + "px";
    pop.style.top = triggerRect.bottom + gap + "px";
    pop.style.setProperty(
      "--arrow-left",
      Math.max(16, Math.min(triggerRect.left + (triggerRect.width / 2) - left, width - 16)) + "px"
    );
    pop.setAttribute("data-placement", "below");

    var popHeight = pop.getBoundingClientRect().height;
    if (triggerRect.bottom + gap + popHeight > viewportHeight - margin && triggerRect.top > popHeight + gap + margin) {
      pop.style.top = Math.max(margin, triggerRect.top - popHeight - gap) + "px";
      pop.setAttribute("data-placement", "above");
    }
  }

  function openPopover(wrap) {
    var pop = wrap ? wrap.querySelector(".caution-popover") : null;
    var btn = wrap ? wrap.querySelector(".caution-trigger") : null;
    if (!pop || !btn) return;

    closeAll();
    wrap.__pregnutPopover = pop;
    document.body.appendChild(pop);
    wrap.setAttribute("data-open", "1");
    pop.setAttribute("data-open", "1");
    btn.setAttribute("aria-expanded", "true");
    positionPopover(wrap);
  }

  function positionOpenPopover() {
    var wrap = document.querySelector('.caution[data-open="1"]');
    if (wrap) positionPopover(wrap);
  }

  function init() {
    if (initialized) return;
    initialized = true;

    document.addEventListener("click", function (event) {
      var target = event && event.target ? event.target : null;
      if (!target || !target.closest) return;

      var trigger = target.closest(".caution-trigger");
      if (trigger) {
        event.preventDefault();
        event.stopPropagation();
        var wrap = trigger.closest(".caution");
        if (!wrap) return;
        if (wrap.getAttribute("data-open") === "1") closeAll();
        else openPopover(wrap);
        return;
      }

      if (!target.closest(".caution-popover")) closeAll();
    });

    document.addEventListener("keydown", function (event) {
      if (event && event.key === "Escape") closeAll();
    });

    window.addEventListener("resize", positionOpenPopover);
    window.addEventListener("scroll", positionOpenPopover, { passive: true, capture: true });
  }

  window.PregnutCautions = {
    closeAll: closeAll,
    init: init
  };

  init();
})();
