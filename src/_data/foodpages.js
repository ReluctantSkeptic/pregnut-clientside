const foodData = require("../resource/pregnut_fooddata.v1.json");
const foodImages = require("./foodimages");

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

const NUTRIENT_GUIDES = {
  Calcium: { title: "Calcium without dairy during pregnancy", url: "/blog/calcium-without-dairy-pregnancy/" },
  Choline: { title: "Choline foods during pregnancy", url: "/blog/choline-foods-pregnancy/" },
  DHA: { title: "Lower-mercury fish during pregnancy", url: "/blog/low-mercury-fish-pregnancy/" },
  "Folate (DFE)": { title: "Folate and folic acid during pregnancy", url: "/blog/folate-folic-acid-pregnancy/" },
  Iron: { title: "Iron foods during pregnancy", url: "/blog/iron-foods-pregnancy/" },
  Potassium: { title: "Potassium foods during pregnancy", url: "/blog/potassium-foods-pregnancy/" },
  Protein: { title: "Vegetarian protein during pregnancy", url: "/blog/vegetarian-protein-pregnancy/" },
  Riboflavin: { title: "Riboflavin foods during pregnancy without dairy", url: "/blog/riboflavin-without-dairy-pregnancy/" },
  "Vitamin B-6": { title: "Vitamin B6 foods during pregnancy", url: "/blog/vitamin-b6-foods-pregnancy/" },
  "Vitamin B-12": { title: "Vitamin B12 during vegetarian or vegan pregnancy", url: "/blog/vegetarian-b12-pregnancy/" },
  "Vitamin C": { title: "Vitamin C foods during pregnancy without citrus", url: "/blog/vitamin-c-without-citrus-pregnancy/" },
  "Vitamin D": { title: "Vitamin D foods during pregnancy", url: "/blog/vitamin-d-foods-pregnancy/" },
  Zinc: { title: "Zinc foods during pregnancy without meat", url: "/blog/zinc-foods-pregnancy/" }
};

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

function metaDescription(name, topNutrients) {
  const top = topNutrients[0];
  const amount = top ? Number(top.value).toFixed(2).replace(/\.0+$|0+$/, "") : "";
  const detail = top
    ? `: ${top.name} ${amount} ${top.unit} per 100 g. See nutrient references and food safety.`
    : ": nutrient amounts per 100 g, reference comparisons, and food safety.";
  const maxNameLength = 155 - detail.length;
  if (name.length <= maxNameLength) return name + detail;
  const prefix = name.slice(0, maxNameLength - 1);
  const lastSpace = prefix.lastIndexOf(" ");
  const shortName = lastSpace > maxNameLength - 15 ? prefix.slice(0, lastSpace) : prefix;
  return shortName.replace(/[\s,;]+$/, "") + "…" + detail;
}

function seoTitle(name) {
  const brand = " | PregNut";
  for (const context of [" Nutrition in Pregnancy", " Nutrition", ""]) {
    const title = name + context + brand;
    if (title.length <= 65) return title;
  }
  return name;
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
    const pageName = hasDuplicateName ? `${food.name} (Food ID ${food.id})` : food.name;
    const rows = nutrientRows(food);
    const chartRows = rows
      .slice()
      .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.name.localeCompare(b.name));
    const topNutrients = chartRows.filter((row) => row.percent > 0).slice(0, 3);
    return {
      ...food,
      pageName,
      slug,
      url: `/food/${slug}/`,
      nutrientRows: rows,
      chartRows,
      topNutrients,
      metaDescription: metaDescription(pageName, topNutrients),
      seoTitle: seoTitle(pageName),
      guideLinks: topNutrients.map((row) => NUTRIENT_GUIDES[row.name]).filter(Boolean),
      isCheese: food.group === "Dairy and Egg Products" && food.name.startsWith("Cheese,"),
      isEgg: food.name.startsWith("Egg,"),
      isJuice: /\bjuice\b/i.test(food.name) && !/\bin juice\b/i.test(food.name) && Boolean(food.warningText && food.warningText.startsWith("Choose pasteurized juice or cider.")),
      isSeedSprout: /\bSprouted\b/i.test(food.name),
      isProteinPowder: food.name.startsWith("Protein powder") || food.name.startsWith("Protein supplement,"),
      calories: food.nutrients && food.nutrients.Calories,
      image: foodImages.has(String(food.id))
        ? {
            src: foodImages.get(String(food.id)),
            alt: `100 grams of ${hasDuplicateName ? `${food.name} (Food ID ${food.id})` : food.name}`,
            width: 400,
            height: 400
          }
        : null
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

const itemsByGroup = new Map();
for (const food of items) {
  if (!itemsByGroup.has(food.group)) itemsByGroup.set(food.group, []);
  itemsByGroup.get(food.group).push(food);
}

for (const groupFoods of itemsByGroup.values()) {
  groupFoods.forEach((food, index) => {
    food.relatedFoods = groupFoods
      .slice(Math.max(0, index - 3), index + 4)
      .filter((candidate) => candidate.id !== food.id)
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.pageName,
        url: candidate.url
      }));
  });
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
