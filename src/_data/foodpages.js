const foodData = require("../resource/pregnut_fooddata.v1.json");

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const priorityIds = new Set();
for (const [nutrientId, nutrientInfo] of Object.entries(foodData.nutrients || {})) {
  if (!nutrientInfo || !nutrientInfo.rda) continue;

  foodData.foods
    .filter((food) => String(food.warning || "").toLowerCase() !== "avoid")
    .filter((food) => Number(food.nutrients && food.nutrients[nutrientId]) > 0)
    .sort((a, b) => Number(b.nutrients[nutrientId]) - Number(a.nutrients[nutrientId]))
    .slice(0, 10)
    .forEach((food) => priorityIds.add(food.id));
}

const nutrientRows = (food) => Object.entries(foodData.nutrients || {})
  .filter(([name, info]) => name !== "Calories" && info && info.rda)
  .map(([name, info]) => ({
    name,
    value: food.nutrients && food.nutrients[name],
    unit: info.unit,
    target: info.rda.label
  }));

const items = foodData.foods
  .filter((food) => priorityIds.has(food.id))
  .map((food) => ({
    ...food,
    slug: `${food.id}-${slugify(food.name)}`,
    nutrientRows: nutrientRows(food),
    calories: food.nutrients && food.nutrients.Calories
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

module.exports = {
  count: items.length,
  items
};
