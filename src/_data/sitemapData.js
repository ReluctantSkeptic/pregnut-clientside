const weeklyProtocol = require("./weeklyProtocol.js");
const foodpages = require("./foodpages.js");

// Advance these dates only when the corresponding page content changes substantially.
const homepageLastmod = "2026-09-23";
const blogHubLastmod = "2026-09-24";
const foodPagesLastmod = "2026-09-23";

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
  ...foodpages.items.filter((food) => food.topNutrients.length > 0).map((food) => `/food/${food.slug}/`)
];

module.exports = [...new Set(paths)].sort().map((path) => {
  let lastmod;
  if (path === "/") lastmod = homepageLastmod;
  else if (path === "/blog/") lastmod = blogHubLastmod;
  else if (path.startsWith("/food/")) lastmod = foodPagesLastmod;
  return lastmod ? { path, lastmod } : { path };
});
