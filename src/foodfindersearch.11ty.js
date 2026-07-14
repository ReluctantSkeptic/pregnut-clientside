const foodpages = require("./_data/foodpages.js");

module.exports = class FoodFinderSearch {
  data() {
    return {
      permalink: "/foodfindersearch.json",
      eleventyExcludeFromCollections: true
    };
  }

  render() {
    return JSON.stringify(foodpages.searchItems);
  }
};
