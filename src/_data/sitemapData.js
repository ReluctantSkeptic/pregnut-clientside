const weeklyProtocol = require("./weeklyProtocol.js");
const foodpages = require("./foodpages.js");

// Advance these dates only when the corresponding page content changes substantially.
const homepageLastmod = "2026-09-23";
const aboutLastmod = "2026-09-25";
const topFoodsLastmod = "2026-09-25";
const blogHubLastmod = "2026-09-25";
const foodPagesLastmod = "2026-09-24";
const weeklyGuideLastmod = {
  "wk1-8": "2026-09-25",
  "wk9-12": "2026-09-25",
  "wk13-16": "2026-09-25",
  "wk17-20": "2026-09-25",
  "wk21-24": "2026-09-25",
  "wk25-28": "2026-09-25",
  "wk29-32": "2026-09-25",
  "wk33-36": "2026-09-25",
  "wk37-40": "2026-09-25"
};

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
  else if (path === "/about/") lastmod = aboutLastmod;
  else if (path === "/app/") lastmod = topFoodsLastmod;
  else if (path === "/blog/") lastmod = blogHubLastmod;
  else if (path.startsWith("/weekly-guide/")) lastmod = weeklyGuideLastmod[path.split("/")[2]];
  else if (path.startsWith("/food/")) lastmod = foodPagesLastmod;
  return lastmod ? { path, lastmod } : { path };
});
