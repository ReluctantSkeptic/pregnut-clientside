// /resource/search.v1.json: the food search index behind every search box.
// Each entry: [label, url, image, rank, aliases]. Rank puts everyday foods
// with photos ahead of treats, odd items and foods to avoid.

const foodData = require("./resource/pregnut_fooddata.v1.json");
const foodImages = require("./_data/foodimages.js");
const { searchItems } = require("./_data/foodpages.js");
const ALIASES = require("../scripts/food-aliases.js");
const { isWholeFood } = require("../scripts/food-serving.js");

const TREATS = new Set(["Sweets", "Snacks", "Fast Foods", "Restaurant Foods", "Fats and Oils"]);

// foodimages already resolves each photo to its cut-out.
function picture(id) {
  return foodImages.get(String(id)) || "";
}

module.exports = class SearchIndex {
  data() {
    return { permalink: "/resource/search.v1.json", eleventyExcludeFromCollections: true };
  }

  render() {
    const byId = new Map(foodData.foods.map((f) => [f.id, f]));
    const rows = searchItems.map((item) => {
      const f = byId.get(item.FoodId) || {};
      const label = f.label || item.FoodName;
      const image = picture(item.FoodId);
      const rank = (image ? 1 : 0) + (isWholeFood(label, f.group) ? 1 : 0) - (TREATS.has(f.group) ? 2 : 0) -
        (f.uncommon ? 3 : 0) - (String(f.warning || "").toLowerCase() === "avoid" ? 2 : 0);
      return [label, item.FoodUrl, image, rank, ALIASES[item.FoodId] || ""];
    });
    return JSON.stringify(rows);
  }
};
