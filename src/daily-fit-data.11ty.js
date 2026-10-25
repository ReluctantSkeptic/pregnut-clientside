// Data for the Daily Fit calculator (/pregnancy-nutrition-calculator/):
// every food with its photo, portions and per-100 g nutrients, the meal
// library, and the best everyday foods for each nutrient per real portion.

const foodData = require("./resource/pregnut_fooddata.v1.json");
const foodImages = require("./_data/foodimages.js");
const fs = require("fs");
const path = require("path");
const meals = require("./_data/dailyFitMeals.js");
const { foodPortions } = require("../scripts/food-portions.js");

// Display order: the nutrients that are hardest to get in pregnancy first.
const NUTRIENTS = [
  ["Folate (DFE)", "Folate", "/blog/folate-folic-acid-pregnancy/"],
  ["Iron", "Iron", "/blog/iron-foods-pregnancy/"],
  ["Choline", "Choline", "/blog/choline-foods-pregnancy/"],
  ["DHA", "DHA", "/blog/low-mercury-fish-pregnancy/"],
  ["Vitamin D", "Vitamin D", "/blog/vitamin-d-foods-pregnancy/"],
  ["Calcium", "Calcium", "/blog/calcium-without-dairy-pregnancy/"],
  ["Protein", "Protein", "/blog/vegetarian-protein-pregnancy/"],
  ["Vitamin B-12", "Vitamin B12", "/blog/vegetarian-b12-pregnancy/"],
  ["Zinc", "Zinc", "/blog/zinc-foods-pregnancy/"],
  ["Vitamin C", "Vitamin C", "/blog/vitamin-c-without-citrus-pregnancy/"],
  ["Vitamin B-6", "Vitamin B6", "/blog/vitamin-b6-foods-pregnancy/"],
  ["Riboflavin", "Riboflavin", "/blog/riboflavin-without-dairy-pregnancy/"],
  ["Potassium", "Potassium", "/blog/potassium-foods-pregnancy/"]
];

// Words people type that the database names differently.
const ALIASES = {
  "08121": "oatmeal porridge oats", "08123": "oatmeal instant", "42290": "milk skim cow",
  "20037": "rice", "20055": "rice white sticky", "16098": "pb peanut butter", "16397": "pb",
  "01287": "greek yogurt", "01256": "greek", "01293": "greek", "01116": "yogurt", "01129": "egg eggs boiled",
  "01132": "egg eggs", "01128": "egg eggs", "05064": "chicken breast grilled", "05013": "chicken",
  "15086": "salmon fish", "15237": "fish", "15016": "fish", "15262": "fish", "09040": "banana bananas",
  "09003": "apple apples", "18075": "bread toast", "16015": "beans", "01009": "cheese",
  "16127": "tofu", "16070": "dal", "16057": "garbanzo", "21299": "pizza", "09316": "strawberry",
  "11457": "salad greens", "11251": "salad lettuce", "11212": "soybeans", "23220": "hamburger mince beef"
};
// Treats rank below everyday foods in search.
const TREAT_GROUPS = new Set(["Sweets", "Snacks", "Fast Foods", "Fats and Oils"]);

// Staples without their own photo borrow the matching 100 g portion photo.
const PORTION_PHOTOS = {
  broccoli: ["11090", "11091"], "cooked-rice": ["20037", "20055"], oatmeal: ["08121", "08123"],
  yogurt: ["01116", "01117", "01118", "01287", "01256", "01293"], milk: ["42290", "01089"],
  eggs: ["01129", "01131", "01132", "01128"], lentils: ["16070"], spinach: ["11457", "11458"],
  almonds: ["12061", "12062", "12563"], avocado: ["09037"], salmon: ["15086", "15237", "15247"],
  chicken: ["05064", "05013", "05009", "05060"], beef: ["23220", "13317"], cheddar: ["01009", "01270"],
  bread: ["18075", "18064"], banana: ["09040"], apple: ["09003", "09004"], blueberries: ["09050"]
};
const portionPhoto = new Map();
const largePhoto = new Map();
for (const [name, ids] of Object.entries(PORTION_PHOTOS)) {
  for (const id of ids) {
    portionPhoto.set(id, `/resource/portions/portion-${name}-100g-600.webp`);
    largePhoto.set(id, `/resource/portions/portion-${name}-100g.webp`);
  }
}

const WHOLE_GROUPS = new Set([
  "Vegetables and Vegetable Products", "Fruits and Fruit Juices", "Legumes and Legume Products",
  "Nut and Seed Products", "Finfish and Shellfish Products", "Poultry Products", "Beef Products",
  "Pork Products", "Dairy and Egg Products", "Cereal Grains and Pasta", "Breakfast Cereals"
]);

const mealIds = new Set(meals.flatMap((meal) => meal.items.map((item) => item[0])));

const labels = new Map(foodData.foods.map((f) => [f.id, (f.label || f.name).toLowerCase()]));
function kind(id) {
  const word = labels.get(id).replace(/^(mashed|lowfat|nonfat|plain|ground|sockeye|pink|atlantic|light)\s+/, "").split(/[ ,]/)[0];
  return word.replace(/(es|s)$/, "");
}

// Background-free versions of the food photos, used for the meal stacks.
const CUTOUT_DIR = path.join(__dirname, "resource/portions/cutouts");
const cutouts = new Set(fs.existsSync(CUTOUT_DIR) ? fs.readdirSync(CUTOUT_DIR) : []);
// Completed replacements already have alpha; share the same optimized asset.
const regeneratedCutouts = new Set(require("../docs/food-image-regeneration.json").batches
  .flatMap((batch) => batch.foods.filter((food) => food.status === "complete").map((food) => food.file)));
function cutout(image) {
  const name = path.basename(image || "");
  if (regeneratedCutouts.has(name)) return `/resource/portions/top-foods/${name}`;
  return name && cutouts.has(name) ? `/resource/portions/cutouts/${name}` : "";
}

// Foods without a photo of their own that look the same as one that has.
const BORROWED_CUTOUTS = {
  "11458": "11457-spinach-raw.webp", "09298": "09297-raisins-golden-seedless.webp",
  "19297": "19920-jams-preserves-marmalades-sweetened-with-fruit-juice.webp",
  "11674": "11364-potatoes-baked-skin.webp", "11091": "11090-broccoli-raw.webp",
  "08029": "08028-cereal-kellogg-s-all-bran-complete-wheat-flakes.webp"
};

function round(n) {
  return Math.round(n * 1000) / 1000;
}

module.exports = class DailyFitData {
  data() {
    return { permalink: "/resource/daily-fit.v1.json", eleventyExcludeFromCollections: true };
  }

  render() {
    const foods = [];
    const helperPool = [];
    for (const food of foodData.foods) {
      if (food.id === "01107") continue;
      const label = food.label || food.name;
      const portions = foodPortions(label, food.group);
      const values = NUTRIENTS.map(([key]) => round(Number(food.nutrients[key]) || 0));
      values.push(Math.round(Number(food.nutrients.Calories) || 0));
      const warning = String(food.warning || "").toLowerCase();
      const level = warning === "avoid" ? 2 : warning && warning !== "0" ? 1 : 0;
      const image = foodImages.get(String(food.id)) || portionPhoto.get(food.id) || "";
      const largeImage = regeneratedCutouts.has(path.basename(image)) ? "" : largePhoto.get(food.id) || "";
      // Search rank: staples used in meals first, then foods with photos.
      const rank = (mealIds.has(food.id) ? 2 : 0) + (image ? 1 : 0) - (TREAT_GROUPS.has(food.group) ? 2 : 0) -
        (food.uncommon ? 3 : 0) - (level === 2 ? 2 : 0);
      foods.push([food.id, label, image, level, level ? food.warningText || "" : "", values, portions, rank,
        ALIASES[food.id] || "", largeImage, cutout(image) || cutout(BORROWED_CUTOUTS[food.id])]);
      if (mealIds.has(food.id) && level < 2 && WHOLE_GROUPS.has(food.group)) helperPool.push({ food, portions, values });
    }

    // For each nutrient, the everyday staples (those used in the meal library)
    // that give the most in one usual portion.
    const helpers = NUTRIENTS.map(([key], i) => {
      const target = foodData.nutrients[key].rda.value;
      return helperPool
        .map(({ food, portions, values }) => {
          const [, grams, qty = 1] = portions[0];
          return { id: food.id, pct: (values[i] * grams * qty) / 100 / target * 100 };
        })
        .sort((a, b) => b.pct - a.pct)
        // One of each kind: a single egg, a single potato, a single tofu.
        .filter((h, j, list) => list.findIndex((o) => kind(o.id) === kind(h.id)) === j)
        .slice(0, 5)
        .map((h) => h.id);
    });

    return JSON.stringify({
      nutrients: NUTRIENTS.map(([key, name, guide]) => ({
        name, guide, unit: foodData.nutrients[key].rda.unit, target: foodData.nutrients[key].rda.value
      })),
      foods,
      helpers,
      meals: meals.map((m) => [m.slot, m.name, m.diet, m.df ? 1 : 0, m.gf ? 1 : 0, m.prep, m.items])
    });
  }
};
