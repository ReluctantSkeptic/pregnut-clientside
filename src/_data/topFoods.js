// Top Foods rankings, computed at build time for every nutrient and both
// views. Foods are ranked per typical serving (FDA reference amounts, see
// scripts/food-serving.js), not per 100 g, and the default view is whole
// foods. The page renders the default from this data and the script fetches
// /resource/top-foods.v1.json (same data) to switch nutrients.

const path = require("path");
const fs = require("fs");
const foodData = require("../resource/pregnut_fooddata.v1.json");
const foodImages = require("./foodimages.js");
const { items } = require("./foodpages");
const { foodServing, isWholeFood } = require("../../scripts/food-serving.js");

// Pregnancy importance first, as in Daily Fit.
const NUTRIENTS = [
  ["Folate (DFE)", "Folate"], ["Iron", "Iron"], ["Choline", "Choline"], ["DHA", "DHA"],
  ["Vitamin D", "Vitamin D"], ["Calcium", "Calcium"], ["Protein", "Protein"],
  ["Vitamin B-12", "Vitamin B12"], ["Zinc", "Zinc"], ["Vitamin C", "Vitamin C"],
  ["Vitamin B-6", "Vitamin B6"], ["Riboflavin", "Riboflavin"], ["Potassium", "Potassium"]
];
const LIMIT = 12;
const PER_KIND = 2;

const pages = new Map(items.map((food) => [food.id, food]));
const guides = new Map(require("./nutrientGuidance.js").map((n) => [n.id, n.guide]));

// foodimages already resolves each photo to its cut-out.
function picture(id) {
  return foodImages.get(String(id)) || "";
}

// "Atlantic salmon, farmed" and "Wild coho salmon" are both salmon: keep the
// list varied by allowing two of each kind.
function kind(label) {
  return label.toLowerCase()
    .replace(/^(raw|cooked|boiled|canned|fresh|frozen|dried|lowfat|low-fat|nonfat|plain|whole|light|red|green|yellow|atlantic|wild|pacific|farmed|sockeye|coho)\s+/g, "")
    .split(/[ ,]/)[0].replace(/(es|s)$/, "");
}

function amount(n) {
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}

// Boiled spinach looks like raw spinach: a food without a photo borrows one
// from the same kind of food, or from the 100 g portion photos.
const cutouts = new Set(fs.readdirSync(path.join(__dirname, "../resource/portions/cutouts")));
const kindPicture = new Map(["yogurt", "milk", "egg", "lentil", "almond", "avocado", "salmon", "chicken",
  "beef", "bread", "banana", "apple", "broccoli", "spinach", "oatmeal", "blueberrie"]
  .map((k) => [k, `/resource/portions/cutouts/portion-${k === "blueberrie" ? "blueberries" : k === "egg" ? "eggs" : k === "lentil" ? "lentils" : k === "almond" ? "almonds" : k}-100g-600.webp`])
  .filter(([, src]) => cutouts.has(path.basename(src))));
for (const f of foodData.foods) {
  const k = kind(f.label || f.name);
  if (!kindPicture.has(k) && picture(f.id)) kindPicture.set(k, picture(f.id));
}

const pool = foodData.foods.filter((f) => f.id !== "01107" && !f.uncommon &&
  String(f.warning || "").toLowerCase() !== "avoid" && pages.has(f.id));

function rank(key, wholeOnly) {
  const info = foodData.nutrients[key];
  const target = info.rda.value;
  const rows = [];
  for (const f of pool) {
    if (wholeOnly && !isWholeFood(f.label, f.group)) continue;
    const per100 = Number(f.nutrients[key]);
    if (!(per100 > 0)) continue;
    const [grams, serving] = foodServing(f.label, f.group);
    const value = per100 * grams / 100;
    rows.push({ f, grams, serving, value, percent: value / target * 100 });
  }
  rows.sort((a, b) => b.percent - a.percent);
  const seen = new Map();
  const out = [];
  for (const row of rows) {
    const k = kind(row.f.label || row.f.name);
    if ((seen.get(k) || 0) >= PER_KIND) continue;
    seen.set(k, (seen.get(k) || 0) + 1);
    const page = pages.get(row.f.id);
    out.push({
      id: row.f.id,
      label: row.f.label || row.f.name,
      url: page.url,
      image: picture(row.f.id) || kindPicture.get(k) || "",
      serving: row.serving,
      grams: row.grams,
      amount: amount(row.value) + " " + info.unit,
      percent: Math.round(row.percent),
      warning: row.f.warning && row.f.warning !== "0" ? row.f.warning : "",
      warningText: row.f.warningText || ""
    });
    if (out.length >= LIMIT) break;
  }
  return out;
}

const nutrients = NUTRIENTS.map(([key, name]) => {
  const info = foodData.nutrients[key];
  return {
    key,
    name,
    // "Vitamin B12" -> "vitamin B12"; "DHA" stays.
    sentence: /^[A-Z]{2,}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1),
    target: info.rda.value + " " + info.rda.unit,
    guide: guides.get(key) || "/blog/",
    whole: rank(key, true),
    all: rank(key, false)
  };
});

module.exports = {
  nutrients,
  initial: nutrients[0]
};
