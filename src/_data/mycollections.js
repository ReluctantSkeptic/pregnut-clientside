// filepath: src/_data/mycollections.js
module.exports = {
  post: mycollection =>
    collection.getFilteredByGlob("posts/**/*.md").sort((a, b) => b.date - a.date)
};
