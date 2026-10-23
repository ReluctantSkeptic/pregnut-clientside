const foodData = require("../resource/pregnut_fooddata.v1.json");
const { items } = require("./foodpages");

// The same default as the interactive view, available before JavaScript loads.
const nutrient = "Calcium";
const keys = Object.keys(foodData.nutrients).filter((key) => key !== "Calories" && foodData.nutrients[key].rda)
  .sort((a, b) => a.localeCompare(b));
// Mirrors PregnutViz.dayPhrase in src/js/viz.js.
function dayPhrase(p) {
  if (p >= 100) return "Covers a full day";
  if (p >= 67) return "Covers most of a day";
  if (p >= 40) return "Covers about half a day";
  if (p >= 20) return "Covers about a quarter of a day";
  return "A small part of a day";
}
const pages = new Map(items.map((food) => [food.id, food]));
const grouped = new Map();
for (const source of foodData.foods) {
  if (source.id === "01107" || Number(source.natSource) !== 0 || String(source.warning).toLowerCase() === "avoid" || source.uncommon) continue;
  const food = pages.get(source.id);
  const row = food.nutrientRows.find((row) => row.name === nutrient);
  if (row.percent === null) continue;
  const item = {
    ...food,
    label: source.label || food.name,
    row,
    tip: `${row.value} ${row.unit} in 100 g · ${row.displayPercent}% of ${row.target} reference`
  };
  const name = String(food.group || "").trim() || "Other";
  if (!grouped.has(name)) grouped.set(name, []);
  grouped.get(name).push(item);
}
const groups = [...grouped].map(([name, foods]) => ({
  name,
  id: "food-group-" + name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
  items: foods.sort((a, b) => b.row.percent - a.row.percent).slice(0, 5)
    .map((food, i) => ({ ...food, featured: i === 0 && Boolean(food.image) && food.row.percent >= 20, phrase: dayPhrase(food.row.percent) }))
})).filter((group) => group.items.length);
groups.sort((a, b) => b.items[0].row.percent - a.items[0].row.percent || a.name.localeCompare(b.name));

module.exports = {
  nutrient, keys, groups,
  target: foodData.nutrients[nutrient].rda.label
};
