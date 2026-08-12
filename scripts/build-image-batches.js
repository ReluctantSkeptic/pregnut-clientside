const fs = require("fs");
const path = require("path");

const data = require("../src/resource/pregnut_fooddata.v1.json");
const outputDir = path.join(__dirname, "../.codex/image-batches");
fs.mkdirSync(outputDir, { recursive: true });

const commonTerms = [
  "chicken", "egg", "milk", "yogurt", "cheese", "beef", "turkey", "salmon",
  "rice", "bread", "banana", "apple", "avocado", "spinach", "broccoli", "bean",
  "potato", "oat", "almond", "peanut", "tofu", "coffee", "protein", "pasta"
];
const nutrients = Object.keys(data.nutrients)
  .filter((name) => name !== "Calories" && data.nutrients[name] && data.nutrients[name].rda)
  .sort((a, b) => a.localeCompare(b));
const ranked = new Map();
for (const food of data.foods) {
  if (String(food.warning || "").toLowerCase() === "avoid") continue;
  ranked.set(food.id, { food, appearances: 0, bestRank: 999, score: 0 });
}

for (const naturalOnly of [false, true]) {
  for (const nutrient of nutrients) {
    const groups = new Map();
    const info = data.nutrients[nutrient];
    for (const food of data.foods) {
      if (!ranked.has(food.id) || Number(food.natSource) !== (naturalOnly ? 1 : 0)) continue;
      let value = food.nutrients && food.nutrients[nutrient];
      if (value == null) continue;
      const multiplier = { mcg: 1, mg: 1000, g: 1000000 };
      if (info.unit !== info.rda.unit) {
        if (!multiplier[info.unit] || !multiplier[info.rda.unit]) continue;
        value *= multiplier[info.unit] / multiplier[info.rda.unit];
      }
      const group = food.group || "Other";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push({ food, value: value / Number(info.rda.value) });
    }
    for (const entries of groups.values()) {
      entries.sort((a, b) => b.value - a.value);
      entries.slice(0, 5).forEach(({ food }, index) => {
        const row = ranked.get(food.id);
        row.appearances += 1;
        row.bestRank = Math.min(row.bestRank, index + 1);
      });
    }
  }
}

for (const row of ranked.values()) {
  const name = row.food.name.toLowerCase();
  const commonBoost = commonTerms.some((term) => name.includes(term)) ? 8 : 0;
  row.score = row.appearances * 10 + (6 - Math.min(row.bestRank, 5)) * 2 + commonBoost;
}

const existing = new Set(fs.readdirSync(path.join(__dirname, "../src/resource/portions/top-foods"))
  .filter((file) => /\.webp$/i.test(file))
  .map((file) => file.split("-", 1)[0]));
const rows = [...ranked.values()]
  .filter((row) => !existing.has(row.food.id))
  .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name));

for (let batch = 1; batch <= 5; batch += 1) {
  const items = rows.slice((batch - 1) * 100, batch * 100).map((row) => ({
    id: row.food.id,
    name: row.food.name,
    group: row.food.group,
    natSource: row.food.natSource,
    score: row.score,
    appearances: row.appearances
  }));
  fs.writeFileSync(path.join(outputDir, `batch-${batch}.json`), JSON.stringify(items, null, 2) + "\n");
  console.log(`batch-${batch}: ${items.length} items`);
}
console.log(`ranked remaining: ${rows.length}`);
