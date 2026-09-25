const weeklyProtocol = require("./weeklyProtocol.js");
const foodpages = require("./foodpages.js");

// Advance these dates only when the corresponding page content changes substantially.
const homepageLastmod = "2026-09-23";
const topFoodsLastmod = "2026-09-25";
const blogHubLastmod = "2026-09-25";
const foodPagesLastmod = "2026-09-24";

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
  ...foodpages.items.filter((food) => food.topNutrients.length >= 3 && !food.isHumanMilk).map((food) => `/food/${food.slug}/`)
];

module.exports = [...new Set(paths)].sort().map((path) => {
  let lastmod;
  if (path === "/") lastmod = homepageLastmod;
  else if (path === "/app/") lastmod = topFoodsLastmod;
  else if (path === "/blog/") lastmod = blogHubLastmod;
  else if (path.startsWith("/food/")) lastmod = foodPagesLastmod;
  return lastmod ? { path, lastmod } : { path };
});
