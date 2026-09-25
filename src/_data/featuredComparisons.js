const { items } = require("./foodpages");

const examples = [
  { id: "01129", label: "Hard-boiled egg", nutrient: "Choline" },
  { id: "16070", label: "Boiled lentils", nutrient: "Folate (DFE)" },
  { id: "16109", label: "Boiled soybeans", nutrient: "Iron" },
  { id: "15086", label: "Cooked sockeye salmon", nutrient: "DHA" }
];

module.exports = examples.map(({ id, label, nutrient }) => {
  const food = items.find((item) => item.id === id);
  const row = food && food.nutrientRows.find((item) => item.name === nutrient);
  if (!row || !Number.isFinite(Number(row.value))) {
    throw new Error(`Missing ${nutrient} data for food ${id}`);
  }
  return { label, nutrient, value: row.value, unit: row.unit, url: food.url };
});
