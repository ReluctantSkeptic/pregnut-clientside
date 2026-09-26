const foodData = require("../resource/pregnut_fooddata.v1.json");
const protocol = require("../resource/weekly_protocol.v1.json");

const examples = new Map([
  ["01129", "Boiled egg"],
  ["15086", "Cooked salmon"],
  ["05064", "Roast chicken"],
  ["16057", "Boiled chickpeas"],
  ["16070", "Boiled lentils"]
]);

const foods = [...examples].map(([id, label]) => {
  const food = foodData.foods.find((item) => item.id === id);
  if (!food || String(food.warning || "").toLowerCase() === "avoid") {
    throw new Error("Homepage example is missing or marked Avoid: " + id);
  }
  return { label, nutrients: food.nutrients };
});

function rankRows(amountForFood, suffix = "") {
  const scored = foods.map((food) => ({ label: food.label, amount: amountForFood(food) }));
  scored.sort((a, b) => b.amount - a.amount);
  const max = scored[0].amount;
  if (!(max > 0)) throw new Error("Homepage preview has no nutrient data");
  return scored.map(({ label, amount }) => ({
    label,
    value: Math.round(amount) + suffix,
    fill: Number((amount / max).toFixed(4))
  }));
}

const week = 15;
const period = protocol.periods.find((item) => week >= item.weeks.start && week <= item.weeks.end);
if (!period) throw new Error("Homepage sample week has no matching period");

const cholineRda = Number(foodData.nutrients.Choline.rda.value);
const weights = { high: 1, medium: 0.6, supporting: 0.35 };

function weeklyScore(food) {
  return period.nutrients.reduce((score, nutrient) => {
    const rda = Number(foodData.nutrients[nutrient.id]?.rda?.value);
    const amount = Number(food.nutrients[nutrient.id]);
    if (!(rda > 0) || !Number.isFinite(amount)) return score;
    return score + Math.min(100, amount / rda * 100) * (weights[nutrient.priority] || weights.supporting);
  }, 0);
}

module.exports = {
  topRows: rankRows((food) => food.nutrients.Choline / cholineRda * 100, "%"),
  weeklyRows: rankRows(weeklyScore),
  weekLabel: "Week " + week,
  periodLabel: "Weeks " + period.weeks.start + "–" + period.weeks.end + " · " + period.title,
  periods: protocol.periods.map((item) => ({
    active: item === period,
    width: item.weeks.end - item.weeks.start + 1
  }))
};
