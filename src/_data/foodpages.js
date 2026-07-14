const foodData = require("../resource/pregnut_fooddata.v1.json");

const NUTRIENT_COLORS = [
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

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toMicrograms(unit) {
  const normalized = String(unit || "").toLowerCase();
  if (normalized === "mcg" || normalized === "µg") return 1;
  if (normalized === "mg") return 1000;
  if (normalized === "g") return 1000000;
  return null;
}

function convertValue(value, fromUnit, toUnit) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (fromUnit === toUnit) return number;

  const fromMicrograms = toMicrograms(fromUnit);
  const toMicrogramsValue = toMicrograms(toUnit);
  if (fromMicrograms === null || toMicrogramsValue === null) return null;

  return (number * fromMicrograms) / toMicrogramsValue;
}

function nutrientRows(food) {
  return Object.entries(foodData.nutrients || {})
    .filter(([name, info]) => name !== "Calories" && info && info.rda)
    .map(([name, info], index) => {
      const value = food.nutrients && food.nutrients[name];
      const convertedValue = convertValue(value, info.unit, info.rda.unit);
      const targetValue = Number(info.rda.value);
      const percent = convertedValue !== null && targetValue > 0
        ? (convertedValue / targetValue) * 100
        : null;

      return {
        name,
        value,
        unit: info.unit,
        target: info.rda.label,
        percent,
        displayPercent: percent === null ? null : Math.round(percent),
        barPercent: percent === null ? 0 : Math.min(Math.max(percent, 0), 100),
        isOver100: percent !== null && percent > 100,
        color: NUTRIENT_COLORS[index] || "#9EC3E6"
      };
    });
}

const foodNameCounts = new Map();
for (const food of foodData.foods || []) {
  foodNameCounts.set(food.name, (foodNameCounts.get(food.name) || 0) + 1);
}

const items = (foodData.foods || [])
  .map((food) => {
    const slug = `${food.id}-${slugify(food.name)}`;
    const hasDuplicateName = foodNameCounts.get(food.name) > 1;
    return {
      ...food,
      pageName: hasDuplicateName ? `${food.name} (Food ID ${food.id})` : food.name,
      slug,
      url: `/food/${slug}/`,
      nutrientRows: nutrientRows(food),
      calories: food.nutrients && food.nutrients.Calories
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

const itemsByGroup = new Map();
for (const food of items) {
  if (!itemsByGroup.has(food.group)) itemsByGroup.set(food.group, []);
  itemsByGroup.get(food.group).push(food);
}

for (const food of items) {
  food.relatedFoods = itemsByGroup.get(food.group)
    .filter((candidate) => candidate.id !== food.id)
    .slice(0, 6)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.pageName,
      url: candidate.url
    }));
}

const groups = [...itemsByGroup.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, foods]) => ({
    name,
    foods: foods.map((food) => ({
      id: food.id,
      name: food.pageName,
      url: food.url
    }))
  }));

const searchItems = items.map((food) => ({
  FoodId: food.id,
  FoodName: food.pageName,
  FoodUrl: food.url
}));

module.exports = {
  count: items.length,
  groups,
  items,
  searchItems
};
