// /resource/top-foods.v1.json: the precomputed Top Foods rankings the page
// switches between (see src/_data/topFoods.js).

module.exports = class TopFoodsData {
  data() {
    return { permalink: "/resource/top-foods.v1.json", eleventyExcludeFromCollections: true };
  }

  render({ topFoods }) {
    return JSON.stringify(topFoods.nutrients);
  }
};
