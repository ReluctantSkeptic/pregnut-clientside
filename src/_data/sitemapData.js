const weeklyProtocol = require("./weeklyProtocol.js");
const foodpages = require("./foodpages.js");

const paths = [
  "/",
  "/about/",
  "/app/",
  "/blog/",
  "/food/",
  "/privacy/",
  "/terms/",
  "/weekly-diet/",
  ...weeklyProtocol.periods.map((period) => `/weekly-guide/${period.id}/`),
  ...foodpages.items.map((food) => `/food/${food.slug}/`)
];

module.exports = [...new Set(paths)].sort().map((path) => ({ path }));
