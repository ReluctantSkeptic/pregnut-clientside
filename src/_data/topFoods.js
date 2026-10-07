const foodData = require("../resource/pregnut_fooddata.v1.json");
const { items } = require("./foodpages");

// The same default as the interactive view, available before JavaScript loads.
const nutrient = "Calcium";
const keys = Object.keys(foodData.nutrients).filter((key) => key !== "Calories" && foodData.nutrients[key].rda)
  .sort((a, b) => a.localeCompare(b));
const pages = new Map(items.map((food) => [food.id, food]));
const grouped = new Map();
for (const source of foodData.foods) {
  if (source.id === "01107" || Number(source.natSource) !== 0 || String(source.warning).toLowerCase() === "avoid") continue;
  const food = pages.get(source.id);
  const row = food.nutrientRows.find((row) => row.name === nutrient);
  if (row.percent === null) continue;
  const parts = food.name.split(",");
  const main = parts.shift().trim();
  const item = {
    ...food,
    main,
    detail: parts.join(",").trim(),
    initial: main.charAt(0).toUpperCase(),
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
})).filter((group) => group.items.length);
groups.sort((a, b) => b.items[0].row.percent - a.items[0].row.percent || a.name.localeCompare(b.name));

module.exports = {
  nutrient, keys, groups,
  target: foodData.nutrients[nutrient].rda.label,
  summary: `${nutrient} · % of the ${foodData.nutrients[nutrient].rda.label} pregnancy reference in 100 g`,
  chartHelp: `Each bar fills from 0–100% of the nutrient reference amount (${foodData.nutrients[nutrient].rda.label}). Foods at or above the reference show a full bar and a ✓; the number shows the exact total. Foods are ranked within each group by the amount in 100 g. Open a food to check its preparation and safety notes.`
};
