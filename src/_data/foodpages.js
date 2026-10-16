const foodData = require("../resource/pregnut_fooddata.v1.json");
const foodImages = require("./foodimages");
let foodExplanations = {};
try {
  foodExplanations = require("../resource/food_explanations.json");
} catch (e) {}

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

// The source names below are useful in the page body but too verbose as search titles.
const FOOD_TITLE_OVERRIDES = {
  // Concise names for unusually long food-data labels.
  "01243": "Fat-Free No-Sugar-Added Ice Cream | PregNut",
  "04518": "Corn Oil for Salad or Cooking | PregNut",
  "04539": "Regular Blue Cheese Dressing | PregNut",
  "04554": "Hydrogenated Soybean-Cottonseed Shortening | PregNut",
  "04652": "Partially Hydrogenated Soybean Oil | PregNut",
  "05220": "Roasted Unenhanced Turkey Breast | PregNut",
  "08090": "Dry Enriched White Corn Grits | PregNut",
  "08159": "Dry Enriched Yellow Corn Grits | PregNut",
  "08318": "Kellogg's Smart Start Antioxidants Cereal | PregNut",
  "09516": "Bolthouse Farms Strawberry Banana Smoothie | PregNut",
  "10136": "Roasted Boneless Ham (11% Fat) | PregNut",
  "11250": "Raw Butterhead Lettuce (Boston or Bibb) | PregNut",
  "11291": "Raw Spring Onions and Scallions | PregNut",
  "11296": "Oven-Heated Breaded Onion Rings | PregNut",
  "11329": "Canned Green Chili Pepper Pods | PregNut",
  "11378": "Dry Mashed Potato Flakes Without Milk | PregNut",
  "11557": "Canned Tomato Sauce with Onion, Pepper and Celery | PregNut",
  "11983": "Sweet Chowchow Pickles with Cauliflower | PregNut",
  "12117": "Raw Coconut Milk from Grated Coconut | PregNut",
  "12179": "Sweetened Shredded Dried Coconut | PregNut",
  "12529": "Salted Hulled Sesame Seeds | PregNut",
  "13840": "Roasted Beef Rib (Lean and Fat) | PregNut",
  "13930": "Broiled Top Sirloin Steak (Lean and Fat) | PregNut",
  "14044": "SlimFast 3-2-1 High-Protein Shake | PregNut",
  "14145": "Sprite Lemon-Lime Soda (Caffeine-Free) | PregNut",
  "14171": "Coconut Milk Fortified with Calcium, A, B12, D2 | PregNut",
  "14237": "Prepared Cereal Grain Coffee Substitute | PregNut",
  "15088": "Canned Atlantic Sardines in Oil (with Bone) | PregNut",
  "15089": "Canned Pacific Sardines in Tomato Sauce (Bone) | PregNut",
  "16057": "Boiled Chickpeas (Garbanzo Beans) | PregNut",
  "16063": "Boiled Black-Eyed Peas (Cowpeas) | PregNut",
  "16082": "Dry Mung Bean Cellophane Noodles | PregNut",
  "16139": "Calcium-Fortified Original or Vanilla Soymilk | PregNut",
  "16168": "Calcium-Fortified Chocolate Soymilk | PregNut",
  "16230": "Calcium-Fortified Nonfat Soymilk | PregNut",
  "18108": "Cinnamon Crumb Coffeecake from Dry Mix | PregNut",
  "18166": "Regular Chocolate Sandwich Cookies | PregNut",
  "18262": "Raisin or Apple Cinnamon English Muffins | PregNut",
  "19026": "Chocolate-Coated Peanut Butter Granola Bar | PregNut",
  "19062": "Trail Mix with Chocolate, Salted Nuts and Seeds | PregNut",
  "19156": "Starburst Original Fruit Chews | PregNut",
  "19249": "Hershey's ReeseSticks Wafer Candy | PregNut",
  "21520": "Soft Garlic Parmesan Breadsticks | PregNut",
  "25026": "Microwave Butter-Flavor Popcorn (Palm Oil) | PregNut",
  "27059": "Peanut Sauce with Soy Sauce | PregNut",
  "28332": "Gluten-Free Chocolate Sandwich Cookies | PregNut",
  "42256": "Sweetened Vegetable Oil Spread | PregNut",
  "42290": "Calcium-Fortified Nonfat Milk | PregNut",
  "23197": "Grilled Boneless Ribeye Steak | PregNut",
  "28337": "Gluten-Free White Rice Flour Bread | PregNut",
  "08104": "Enriched Quick Farina, Dry | PregNut",
  "08123": "Instant Fortified Oatmeal with Water | PregNut",
  "08121": "Cooked Plain Oatmeal with Water | PregNut",
  "21399": "Double Cheeseburger with Vegetables and Mayo | PregNut",
  "21397": "Single Cheeseburger with Vegetables and Mayo | PregNut",
  "19905": "Dark Chocolate, Mixed Cacao Strengths | PregNut",
  "42116": "Reduced-Calorie Creamy Dressing | PregNut",
  "42157": "Fat-Free Creamy Dressing | PregNut",
  "09105": "Canned Mixed Fruit Salad in Syrup | PregNut",
  "14093": "Glaceau Vitaminwater Revive Fruit Punch | PregNut",
  "17060": "Braised Lamb Stew or Kabob Meat | PregNut",
  "04659": "Industrial Coconut Confection Fat | PregNut",
  "04511": "High-Oleic Safflower Oil | PregNut",
  "11403": "Home-Prepared Oven-Heated French Fries | PregNut",
  "12166": "Tahini from Roasted Sesame Seeds | PregNut",
  "18938": "Frosted Fruit Toaster Pastries | PregNut",
  "16225": "Light Soymilk with Calcium and Vitamins A and D | PregNut",
  "19896": "Reese's Fast Break Candy Bar Nutrition | PregNut",
  "01306": "Low-Fat Ice Cream Cone with Peanuts and Sauce | PregNut",
  "01240": "Chocolate-Covered Ice Cream Cone with Nuts | PregNut",
  "17346": "Braised Deer Shoulder Roast Nutrition | PregNut",
  "16127": "Soft Tofu Set with Calcium Sulfate and Nigari | PregNut",
  "04666": "Industrial Soy and Corn Frying Shortening | PregNut",
  "09409": "Unsweetened Pineapple Juice with Added Vitamin C | PregNut",
  "08218": "Quaker Oat, Wheat, Honey and Raisin Granola | PregNut",
  "43312": "Canned Mixed Vegetables with Corn and Beans | PregNut"
};

// Search-intent titles and descriptions for food pages where Search Console shows
// "is X safe during pregnancy" queries at positions 4-11 with no clicks (2026-10-12).
// Used for <title> and meta description only; the on-page heading is unchanged.
const FOOD_SEARCH_OVERRIDES = {
  "01020": {
    title: "Is Fontina Cheese Safe During Pregnancy? | PregNut",
    description: "Fontina is a safer choice in pregnancy when made with pasteurized milk; FDA notes some specialty cheeses are not. Label checks and nutrients per 100 g."
  },
  "01035": {
    title: "Is Provolone Safe During Pregnancy? | PregNut",
    description: "Provolone is a safer choice in pregnancy when made with pasteurized milk. CDC says heat deli-sliced cheese to 165°F. Label tips and nutrients per 100 g."
  },
  "01040": {
    title: "Is Swiss Cheese Safe During Pregnancy? | PregNut",
    description: "CDC lists pasteurized Swiss as a safer hard cheese in pregnancy. When deli-sliced Swiss needs heating to 165°F, plus calcium and B12 per 100 g."
  },
  "01043": {
    title: "Can You Eat Pimento Cheese While Pregnant? | PregNut",
    description: "Pimento cheese made with pasteurized cheese and store-bought mayo fits CDC and FDA safer choices in pregnancy. What to ask about house-made spreads."
  },
  "11603": {
    title: "Can You Eat Jicama While Pregnant? | PregNut",
    description: "Yes, you can eat jicama while pregnant once it is washed. FDA says to wash produce even if you peel it. Washing steps, plus vitamin C per 100 g."
  },
  "18320": {
    title: "Can You Eat Lemon Meringue Pie When Pregnant? | PregNut",
    description: "FDA lists homemade meringue among raw-egg foods to avoid in pregnancy. Why baked store-bought pie is the safer choice, and the 160°F rule for homemade."
  },
  "19912": {
    title: "Is Agave Syrup Safe During Pregnancy? | PregNut",
    description: "Agave syrup is not on CDC's list of riskier foods in pregnancy, but it counts as added sugar. How much to limit, plus calories per 100 g."
  },
  // 2026-10-14 GSC safety-intent food pages (pos ~4-11, 0 clicks)
  "20137": {
    title: "Is Quinoa Safe During Pregnancy? | PregNut",
    description: "Yes, cooked quinoa is fine in pregnancy. ACOG lists quinoa as a whole grain. Cooking tips, plus protein and iron per 100 g."
  },
  "06971": {
    title: "Is Worcestershire Sauce Safe During Pregnancy? | PregNut",
    description: "Worcestershire sauce is fine in ordinary cooking amounts in pregnancy. CDC does not list it as riskier. Sodium note and nutrients per 100 g."
  },
  "11955": {
    title: "Can You Eat Sun-Dried Tomatoes While Pregnant? | PregNut",
    description: "Yes, you can eat sun-dried tomatoes while pregnant; CDC does not list them as a riskier food. Oil-packed jar storage, plus iron and vitamin C per 100 g."
  },
  "01025": {
    title: "Is Monterey Jack Cheese Safe During Pregnancy? | PregNut",
    description: "Monterey Jack is a safer choice in pregnancy when made with pasteurized milk. CDC deli-slice 165°F rule, label checks, and calcium per 100 g."
  },
  "01034": {
    title: "Is Port Salut Cheese Safe During Pregnancy? | PregNut",
    description: "Choose Port Salut made with pasteurized milk in pregnancy. CDC's safer choice for soft cheese is heating it until steaming hot. Calcium per 100 g."
  },
  "01011": {
    title: "Is Colby Jack Cheese Safe During Pregnancy? | PregNut",
    description: "Colby and Colby Jack are safer in pregnancy when made with pasteurized milk. Label checks, deli 165°F tip, and calcium per 100 g."
  },
  "01057": {
    title: "Is Eggnog Safe During Pregnancy? | PregNut",
    description: "CDC lists homemade eggnog as riskier in pregnancy. Why pasteurized, alcohol-free store eggnog is the safer choice, plus calcium per 100 g."
  },
  "04706": {
    title: "Can You Have Honey Mustard While Pregnant? | PregNut",
    description: "Yes, bottled honey mustard dressing is fine in pregnancy. FDA says commercial dressings use pasteurized eggs. Homemade raw-egg sauces differ."
  },
  "04017": {
    title: "Can You Eat Thousand Island Dressing While Pregnant? | PregNut",
    description: "Bottled Thousand Island dressing is fine in pregnancy. FDA says commercial dressings use pasteurized eggs. When to ask about house-made sauces."
  },
  // 2026-10-15 GSC zero-click food pages (pos ~4-11)
  "08020": {
    title: "Are Kellogg's Corn Flakes Safe During Pregnancy? | PregNut",
    description: "Yes, corn flakes fit a pregnancy diet. This fortified cereal lists 583 mcg DFE folate and 28.9 mg iron per 100 g; check your box label for your serving."
  },
  "05140": {
    title: "Can You Eat Duck While Pregnant? | PregNut",
    description: "Fully cooked duck is a safer choice in pregnancy; CDC says cook poultry to 165°F. Roasted duck with skin: nutrients per 100 g."
  },
  "11333": {
    title: "Can You Eat Raw Green Peppers While Pregnant? | PregNut",
    description: "Yes, raw green peppers are fine in pregnancy once washed. FDA says rinse produce under running water, no soap. Nutrients per 100 g."
  },
  "11109": {
    title: "Can You Eat Raw Cabbage While Pregnant? | PregNut",
    description: "Yes, raw cabbage is fine in pregnancy once washed. FDA says rinse produce under running water, no soap. Nutrients per 100 g."
  },
  // 2026-10-16 GSC zero-click food pages (pos ~3-16), claims in food_explanations.json
  "18326": {
    title: "Can You Eat Pumpkin Pie While Pregnant? | PregNut",
    description: "Yes, baked pumpkin pie is fine in pregnancy. FDA says cook egg dishes to 160°F and refrigerate leftovers within 2 hours. Nutrients per 100 g."
  },
  "15175": {
    title: "Can You Eat Squid or Calamari While Pregnant? | PregNut",
    description: "Yes, cooked squid is an FDA Best Choice for mercury: 2 to 3 four-ounce servings a week in pregnancy. Skip raw squid sushi. Nutrients per 100 g."
  },
  "15036": {
    title: "Is Halibut Safe During Pregnancy? | PregNut",
    description: "Halibut is an FDA Good Choice: 1 four-ounce serving a week in pregnancy, vs 2 to 3 for Best Choices. Cook to 145°F. Nutrients per 100 g."
  },
  "15035": {
    title: "Can You Eat Smoked Haddock While Pregnant? | PregNut",
    description: "Only in a cooked dish. CDC lists refrigerated smoked seafood as riskier in pregnancy unless cooked, e.g. in a casserole. Nutrients per 100 g."
  },
  "01140": {
    title: "Are Quail Eggs Safe During Pregnancy? | PregNut",
    description: "Yes, when fully cooked. CDC says cook eggs until the yolks and whites are firm in pregnancy. Choline, B12 and protein per 100 g."
  },
  "09040": {
    title: "Raw Banana in Pregnancy: Safe? Potassium & B6 | PregNut",
    description: "Yes. NIH lists 422 mg potassium in a medium banana; the pregnancy AI is 2,900 mg a day. FDA says wash produce before peeling. Nutrients per 100 g."
  }
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
    ? `: ${top.name} ${amount} ${top.unit} per 100 g in historical USDA-based data. See safety notes.`
    : ": historical USDA-based nutrient data per 100 g. See source limits and safety notes.";
  const maxNameLength = 155 - detail.length;
  if (name.length <= maxNameLength) return name + detail;
  const prefix = name.slice(0, maxNameLength - 1);
  const lastSpace = prefix.lastIndexOf(" ");
  const shortName = lastSpace > maxNameLength - 15 ? prefix.slice(0, lastSpace) : prefix;
  return shortName.replace(/[\s,;]+$/, "") + "…" + detail;
}

function seoTitle(name, isAvoid = false) {
  const brand = " | PregNut";
  const contexts = isAvoid
    ? [" Safety in Pregnancy", " Pregnancy Safety", " Safety", ""]
    : [" Nutrition in Pregnancy", " Nutrition", ""];
  for (const context of contexts) {
    const title = name + context + brand;
    if (title.length <= 65) return title;
  }
  return name;
}

// Short, human-friendly heading. Reuses the curated search-title overrides when present.
function displayName(food, pageName) {
  const override = FOOD_TITLE_OVERRIDES[food.id];
  if (!override) return pageName;
  return override.replace(/\s*\|\s*PregNut$/, "").replace(/\s+Nutrition$/, "");
}

function lowerNutrient(name) {
  // Keep acronyms and lettered vitamins readable ("DHA", "Vitamin C" -> "vitamin C").
  if (/^[A-Z0-9-]+$/.test(name)) return name;
  return name.replace(/\s*\(DFE\)$/, "").replace(/^Vitamin/, "vitamin").replace(/^(Folate|Calcium|Choline|Iron|Potassium|Protein|Riboflavin|Zinc|Magnesium|Iodine|Thiamin|Niacin|Fiber)/, (m) => m.toLowerCase());
}

function joinList(parts) {
  if (parts.length <= 1) return parts.join("");
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

// One plain-English sentence describing the strongest contributions.
function summaryText(topNutrients) {
  if (!topNutrients.length) return "100 g has little or none of the pregnancy nutrients tracked here.";
  const parts = topNutrients.map((row) => `${row.displayPercent}% of daily ${lowerNutrient(row.name)}`);
  return `100 g gives about ${joinList(parts)} needed in pregnancy.`;
}

const TOPIC_GUIDES = {
  cheese: { title: "Cheese and pasteurization", url: "/blog/soft-cheese-pregnancy/" },
  dairy: { title: "Milk and yogurt pasteurization", url: "/blog/raw-milk-pregnancy/" },
  egg: { title: "Egg doneness and safety", url: "/blog/eggs-during-pregnancy/" },
  juice: { title: "Juice and smoothie safety", url: "/blog/juice-pasteurization-pregnancy/" },
  sprout: { title: "Sprouts during pregnancy", url: "/blog/sprouts-during-pregnancy/" },
  produce: { title: "Washing fresh produce", url: "/blog/wash-produce-pregnancy/" },
  deli: { title: "Deli meat and reheating", url: "/blog/deli-meat-pregnancy/" },
  fish: { title: "Lower-mercury fish", url: "/blog/low-mercury-fish-pregnancy/" },
  smokedFish: { title: "Smoked salmon and lox", url: "/blog/smoked-salmon-pregnancy/" },
  protein: { title: "Protein powder labels", url: "/blog/protein-powder-pregnancy/" },
  liver: { title: "Vitamin A foods without liver", url: "/blog/vitamin-a-foods-without-liver-pregnancy/" },
  safety: { title: "Pregnancy food-safety checklist", url: "/blog/food-safety-pregnancy/" }
};

// Food-specific guides (2026-10-16 posts): shown first on the matching food pages.
const FOOD_GUIDES = {
  "07072": { title: "Salami and prosciutto", url: "/blog/salami-prosciutto-pregnancy/" },
  "15237": { title: "Salmon: how much and how to cook it", url: "/blog/salmon-pregnancy/" },
  "15247": { title: "Salmon: how much and how to cook it", url: "/blog/salmon-pregnancy/" },
  "15086": { title: "Salmon: how much and how to cook it", url: "/blog/salmon-pregnancy/" },
  "15084": { title: "Salmon: how much and how to cook it", url: "/blog/salmon-pregnancy/" },
  "15148": { title: "Lobster and lobster rolls", url: "/blog/lobster-pregnancy/" },
  "01019": { title: "Feta cheese and pasteurization", url: "/blog/feta-cheese-pregnancy/" },
  "01004": { title: "Blue cheese and dressing", url: "/blog/blue-cheese-pregnancy/" },
  "04539": { title: "Blue cheese and dressing", url: "/blog/blue-cheese-pregnancy/" },
  "42192": { title: "Blue cheese and dressing", url: "/blog/blue-cheese-pregnancy/" },
  "42153": { title: "Blue cheese and dressing", url: "/blog/blue-cheese-pregnancy/" }
};

function readingLinks(food, flags, topNutrients) {
  const links = [];
  if (FOOD_GUIDES[food.id]) links.push(FOOD_GUIDES[food.id]);
  if (food.id === "05028" || food.id === "13327") links.push(TOPIC_GUIDES.liver);
  if (flags.isCheese) links.push(TOPIC_GUIDES.cheese);
  if (flags.isMilkOrYogurt) links.push(TOPIC_GUIDES.dairy);
  if (flags.isEgg) links.push(TOPIC_GUIDES.egg);
  if (flags.isJuice) links.push(TOPIC_GUIDES.juice);
  if (flags.isSeedSprout) links.push(TOPIC_GUIDES.sprout);
  if (flags.isFreshProduce) links.push(TOPIC_GUIDES.produce);
  if (food.group === "Sausages and Luncheon Meats") links.push(TOPIC_GUIDES.deli);
  if (flags.isSmokedFish) links.push(TOPIC_GUIDES.smokedFish);
  else if (food.group === "Finfish and Shellfish Products") links.push(TOPIC_GUIDES.fish);
  if (flags.isProteinPowder) links.push(TOPIC_GUIDES.protein);
  for (const row of topNutrients) {
    if (NUTRIENT_GUIDES[row.name]) links.push(NUTRIENT_GUIDES[row.name]);
  }
  const seen = new Set();
  return links.filter((link) => !seen.has(link.url) && seen.add(link.url)).slice(0, 3);
}

function toolLinks(topNutrients) {
  const links = topNutrients.slice(0, 1).map((row) => ({
    title: `Top foods for ${lowerNutrient(row.name)}`,
    url: `/app/?nutrient=${encodeURIComponent(row.name)}`
  }));
  links.push({ title: "Nutrients by pregnancy week", url: "/weekly-diet/" });
  return links;
}

function nutrientRows(food) {
  return Object.entries(foodData.nutrients || {})
    .filter(([name, info]) => name !== "Calories" && info && info.rda)
    .map(([name, info]) => {
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
        isOver100: percent !== null && percent > 100
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
    const isHumanMilk = food.id === "01107";
    const isRawPulse = food.id === "16069" || food.id === "16085";
    const isRawFlour = food.id === "16115";
    const isAvoid = String(food.warning || "").toLowerCase() === "avoid";
    const rows = nutrientRows(food);
    const chartRows = rows
      .slice()
      .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.name.localeCompare(b.name));
    const topNutrients = chartRows.filter((row) => row.percent > 0).slice(0, 3);
    let pageDescription = metaDescription(pageName, topNutrients);
    if (isRawPulse || isRawFlour) pageDescription = `${pageName}: historical USDA-based nutrients per 100 g before cooking. Uncooked ingredient data; see preparation guidance.`;
    if (isAvoid) pageDescription = `Avoid ${pageName} during pregnancy. See the safety reason, source guidance, and historical nutrients per 100 g.`;
    const flags = {
      isCheese: food.group === "Dairy and Egg Products" && food.name.startsWith("Cheese,"),
      isMilkOrYogurt: food.group === "Dairy and Egg Products" && /^(Milk|Yogurt),/.test(food.name) && !/^Milk, (Human|Imitation)/.test(food.name),
      isSmokedFish: food.group === "Finfish and Shellfish Products" && /\bSmoked\b/i.test(food.name),
      isEgg: food.name.startsWith("Egg,"),
      isJuice: /\bjuice\b/i.test(food.name) && !/\b(?:in|with) (?:\w+ )?juice\b/i.test(food.name),
      isFreshProduce: /\bRaw\b/i.test(food.name) && Boolean(food.warningText && food.warningText.startsWith("Wash fresh")),
      isSeedSprout: /\bSprouted\b/i.test(food.name),
      isProteinPowder: food.name.startsWith("Protein powder") || food.name.startsWith("Protein supplement,")
    };
    return {
      ...food,
      ...flags,
      pageName,
      displayName: displayName(food, pageName),
      slug,
      url: `/food/${slug}/`,
      nutrientRows: rows,
      chartRows,
      topNutrients,
      summary: summaryText(topNutrients),
      guidance: foodExplanations[food.id] || null,
      metaDescription: (FOOD_SEARCH_OVERRIDES[food.id] && FOOD_SEARCH_OVERRIDES[food.id].description) || pageDescription,
      seoTitle: isHumanMilk ? "Human Milk Nutrient Data | PregNut" : ((FOOD_SEARCH_OVERRIDES[food.id] && FOOD_SEARCH_OVERRIDES[food.id].title) || FOOD_TITLE_OVERRIDES[food.id] || seoTitle(pageName, isAvoid)),
      readingLinks: readingLinks(food, flags, topNutrients),
      toolLinks: toolLinks(topNutrients),
      isAvoid,
      isHumanMilk,
      isRawPulse,
      isRawFlour,
      calories: food.nutrients && food.nutrients.Calories,
      image: foodImages.has(String(food.id))
        ? {
            src: foodImages.get(String(food.id)),
            alt: `Illustration of ${hasDuplicateName ? `${food.name} (Food ID ${food.id})` : food.name}`,
            width: 400,
            height: 400
          }
        : null
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

const itemsByGroup = new Map();
const listedItems = items.filter((food) => !food.isHumanMilk);
for (const food of listedItems) {
  if (!itemsByGroup.has(food.group)) itemsByGroup.set(food.group, []);
  itemsByGroup.get(food.group).push(food);
}

for (const groupFoods of itemsByGroup.values()) {
  groupFoods.forEach((food, index) => {
    food.relatedFoods = groupFoods
      .slice(Math.max(0, index - 3), index + 4)
      .filter((candidate) => candidate.id !== food.id && String(candidate.warning || "").toLowerCase() !== "avoid")
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

const searchItems = listedItems.map((food) => ({
  FoodId: food.id,
  FoodName: food.pageName,
  FoodUrl: food.url
}));

module.exports = {
  count: listedItems.length,
  groups,
  items,
  searchItems
};
