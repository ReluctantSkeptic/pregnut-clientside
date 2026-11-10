const test = require("node:test");
const assert = require("node:assert/strict");
const state = require("../src/js/pregnut-state.js");

const STEPS = [0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
const COUNT_STEPS = [0.5, 1, 2, 3, 4, 5, 6, 8, 10];

// The previous stepper. Kept so on-grid amounts stay exactly the same.
function legacyStep(q, dir, steps) {
  var i = 0;
  while (i < steps.length - 1 && steps[i] < q) i++;
  if (steps[i] !== q && dir < 0) i++;
  return steps[Math.max(0, Math.min(steps.length - 1, i + dir))];
}

test("portion steps on the grid match the previous stepper", function () {
  [STEPS, COUNT_STEPS].forEach(function (steps) {
    steps.forEach(function (q) {
      [1, -1].forEach(function (dir) {
        assert.equal(state.nextPortionQuantity(q, dir, steps), legacyStep(q, dir, steps));
      });
    });
  });
});

test("portion steps between marks move toward the press", function () {
  assert.equal(state.nextPortionQuantity(1.25, 1, STEPS), 1.5);
  assert.equal(state.nextPortionQuantity(1.25, -1, STEPS), 1);
  assert.equal(legacyStep(1.25, 1, STEPS), 2);
  assert.equal(legacyStep(1.25, -1, STEPS), 1.5);
  assert.equal(state.nextPortionQuantity(1.5, 1, COUNT_STEPS), 2);
  assert.equal(state.nextPortionQuantity(1.5, -1, COUNT_STEPS), 1);
  assert.equal(state.nextPortionQuantity(0.1, -1, STEPS), 0.125);
  assert.equal(state.nextPortionQuantity(12, 1, STEPS), 10);
});

test("a negative plan score still picks a near-best day", function () {
  var ranked = [{ score: -10, id: "best" }, { score: -10.2, id: "close" }, { score: -40, id: "bad" }];
  assert.equal(state.chooseNearBest(ranked, function () { return 0; }).id, "best");
  var picks = new Set();
  [0, 0.49, 0.5, 0.99].forEach(function (roll) {
    picks.add(state.chooseNearBest(ranked, function () { return roll; }).id);
  });
  assert.deepEqual([...picks].sort(), ["best", "close"]);
});

test("positive plan scores keep the 3 percent band", function () {
  var ranked = [{ score: 100, id: "a" }, { score: 97, id: "b" }, { score: 96.9, id: "c" }];
  assert.equal(state.chooseNearBest(ranked, function () { return 0; }).id, "a");
  assert.equal(state.chooseNearBest(ranked, function () { return 0.99; }).id, "b");
});

test("food source names from older saves still resolve", function () {
  assert.equal(state.normalizeFoodSource("natural"), "whole");
  assert.equal(state.normalizeFoodSource("processed"), "all");
  assert.equal(state.normalizeFoodSource("whole"), "whole");
  assert.equal(state.normalizeFoodSource("all"), "all");
  assert.equal(state.normalizeFoodSource("nope"), null);
  assert.equal(state.normalizeFoodSource(null), null);
});

test("corrupt calculator rows are dropped and valid rows are kept", function () {
  var known = function (id) { return id === "01129"; };
  var items = state.sanitizeDailyItems([
    null,
    { id: "01129" },
    { id: "missing", q: 1, u: 0, slot: "lunch" },
    { id: "01129", q: "1.5", u: "0", slot: "Breakfast" },
    { id: "01129", q: 2, u: -1, slot: "dinner" },
    { id: "01129", q: 0, u: 0, slot: "snack" }
  ], known);
  assert.deepEqual(items, [
    { id: "01129", q: 1.5, u: 0, slot: "breakfast" },
    { id: "01129", q: 2, u: -1, slot: "dinner" }
  ]);
});

test("a new calendar day clears foods and keeps preferences", function () {
  var saved = { date: "2026-11-9", items: [{ id: "01129" }], plan: { breakfast: "Eggs" }, prefs: { diet: "vegan" } };
  assert.equal(state.rollDailyLog(saved, "2026-11-9"), saved);
  var next = state.rollDailyLog(saved, "2026-11-10");
  assert.deepEqual(next.items, []);
  assert.deepEqual(next.plan, {});
  assert.equal(next.prefs.diet, "vegan");
  assert.equal(next.date, "2026-11-10");
  assert.equal(saved.items.length, 1);
});

test("undo of a new plan restores the previous diet and foods", function () {
  var previous = { date: "2026-11-10", items: [{ id: "meat" }], plan: { dinner: "Steak" }, prefs: { diet: "everything" } };
  var failed = state.planEdit(previous, { diet: "vegan" }, null);
  assert.equal(failed.ok, false);
  assert.equal(failed.state.prefs.diet, "everything");
  assert.equal(failed.state.items[0].id, "meat");
  var planned = state.planEdit(previous, { diet: "vegan" }, { items: [{ id: "beans" }], names: { dinner: "Lentils" } });
  assert.equal(planned.ok, true);
  assert.equal(planned.state.prefs.diet, "vegan");
  assert.equal(planned.state.items[0].id, "beans");
  assert.equal(planned.undo.prefs.diet, "everything");
  assert.equal(planned.undo.items[0].id, "meat");
  var first = state.planEdit({ date: "2026-11-10", items: [], plan: {}, prefs: { diet: "everything" } }, { diet: "vegan" }, { items: [{ id: "beans" }], names: {} });
  assert.equal(first.undo, null);
});

test("a blur that started before the latest focus does not close search", function () {
  var gen = state.createGeneration();
  gen.bump();
  var stale = gen.current();
  gen.bump();
  assert.equal(gen.isCurrent(stale), false);
  assert.equal(gen.isCurrent(gen.current()), true);
});

test("a contact submit cannot start twice until it finishes", function () {
  var lock = state.createSubmitLock();
  assert.equal(lock.tryAcquire(), true);
  assert.equal(lock.tryAcquire(), false);
  lock.release();
  assert.equal(lock.tryAcquire(), true);
});

test("contact honeypot stays quiet and a fast note is still sent", function () {
  assert.equal(state.contactDelivery(true, { ok: true }, true), "quiet");
  assert.equal(state.contactDelivery(true, { ok: true }, false), "send");
  assert.equal(state.contactDelivery(true, { ok: true, id: "abc" }, false), "send");
  assert.equal(state.contactDelivery(false, { ok: false, error: "no" }, false), "error");
  assert.equal(state.contactDelivery(true, { ok: false }, false), "error");
});
