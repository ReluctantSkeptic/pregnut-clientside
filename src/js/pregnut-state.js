// Pure state helpers shared by the calculator, search, and contact form.
// No DOM. Loaded as a classic script; Node tests require() it.
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PregnutState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var MEAL_SLOTS = { breakfast: 1, lunch: 1, snack: 1, dinner: 1 };

  // Move along a portion grid. Values already on a step move one step.
  // Values between steps snap toward the press: more goes to the next
  // higher step, less to the next lower one, and both ends clamp.
  function nextPortionQuantity(q, dir, steps) {
    var quantity = Number(q);
    if (!steps || !steps.length || !Number.isFinite(quantity)) return q;
    var i = 0;
    while (i < steps.length - 1 && steps[i] < quantity) i++;
    if (steps[i] === quantity) {
      return steps[Math.max(0, Math.min(steps.length - 1, i + dir))];
    }
    if (quantity > steps[steps.length - 1]) return steps[steps.length - 1];
    if (dir > 0) return steps[i];
    return steps[Math.max(0, i - 1)];
  }

  // ranked is best-first. Positive scores keep the historical 3% band
  // (score >= best * 0.97). Negative scores use the same width below the
  // best so the winner itself is never excluded.
  function chooseNearBest(ranked, random) {
    if (!ranked || !ranked.length) return null;
    var best = Number(ranked[0].score);
    var floor = best >= 0 ? best * 0.97 : best - Math.abs(best) * 0.03;
    var good = [];
    for (var i = 0; i < ranked.length; i++) {
      if (Number(ranked[i].score) >= floor) good.push(ranked[i]);
    }
    if (!good.length) good.push(ranked[0]);
    var roll = typeof random === "function" ? Number(random()) : 0;
    if (!Number.isFinite(roll) || roll < 0) roll = 0;
    if (roll > 0.999999) roll = 0.999999;
    return good[Math.min(good.length - 1, Math.floor(roll * good.length))];
  }

  // Older Top Foods links and saves used natural|processed.
  function normalizeFoodSource(value) {
    if (value === "all" || value === "processed") return "all";
    if (value === "whole" || value === "natural") return "whole";
    return null;
  }

  // Drop rows that would throw or stay invisible while still counting.
  // Coerce numeric strings. Lowercase meal names from older saves.
  function sanitizeDailyItems(items, known) {
    if (!Array.isArray(items)) return [];
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item || typeof item !== "object") continue;
      if (typeof item.id !== "string" || !known(item.id)) continue;
      var slot = String(item.slot || "").toLowerCase();
      if (!MEAL_SLOTS[slot]) continue;
      var q = Number(item.q);
      var u = Number(item.u);
      if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(u)) continue;
      out.push({ id: item.id, q: q, u: u, slot: slot });
    }
    return out;
  }

  // A new calendar day starts empty. Preferences carry over.
  // Returns the same object when the day has not changed.
  function rollDailyLog(state, today) {
    if (!state || state.date === today) return state;
    return { date: today, items: [], plan: {}, prefs: state.prefs };
  }

  // previous must be the log from before prefs or items change.
  // A failed plan leaves that log untouched.
  function planEdit(previous, prefs, plan) {
    var saved = JSON.parse(JSON.stringify(previous));
    if (!plan || !Array.isArray(plan.items) || !plan.names || typeof plan.names !== "object") {
      return { ok: false, state: saved, undo: null };
    }
    return {
      ok: true,
      state: { date: saved.date, items: plan.items, plan: plan.names, prefs: prefs },
      undo: saved.items && saved.items.length ? saved : null
    };
  }

  function createGeneration() {
    var n = 0;
    return {
      bump: function () { n += 1; return n; },
      current: function () { return n; },
      isCurrent: function (token) { return token === n; }
    };
  }

  function createSubmitLock() {
    var held = false;
    return {
      tryAcquire: function () {
        if (held) return false;
        held = true;
        return true;
      },
      release: function () { held = false; }
    };
  }

  // The contact API returns {ok:true} with no id for both the honeypot and a
  // too-fast note. Only the honeypot must stay on this page: a fast note is
  // still mailed, which is what the form already did.
  function contactDelivery(httpOk, body, honeypotFilled) {
    if (!httpOk || !body || body.ok !== true) return "error";
    if (!body.id && honeypotFilled) return "quiet";
    return "send";
  }

  return {
    nextPortionQuantity: nextPortionQuantity,
    chooseNearBest: chooseNearBest,
    normalizeFoodSource: normalizeFoodSource,
    sanitizeDailyItems: sanitizeDailyItems,
    rollDailyLog: rollDailyLog,
    planEdit: planEdit,
    createGeneration: createGeneration,
    createSubmitLock: createSubmitLock,
    contactDelivery: contactDelivery
  };
});
