const foodImages = require("./_data/foodimages.js");

module.exports = class FoodImages {
  data() {
    return {
      permalink: "/resource/food-images.v1.json",
      eleventyExcludeFromCollections: true
    };
  }

  render() {
    return JSON.stringify(Object.fromEntries(foodImages));
  }
};
