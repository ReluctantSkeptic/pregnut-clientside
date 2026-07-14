const weeklyProtocol = require("./weeklyProtocol.js");
const foodpages = require("./foodpages.js");

const paths = [
  "/",
  "/about/",
  "/app/",
  "/blog/",
  "/food/",
  "/weekly-diet/",
  "/blog/melatonin-during-pregnancy/",
  ...weeklyProtocol.periods.map((period) => `/weekly-guide/${period.id}/`),
  ...foodpages.items.map((food) => `/food/${food.slug}/`)
];

module.exports = [...new Set(paths)].sort().map((path) => ({
  path,
  lastmod: path === "/blog/melatonin-during-pregnancy/" ? "2025-05-17" : ""
}));
