const weeklyProtocol = require("./weeklyProtocol.js");
const foodpages = require("./foodpages.js");

// Advance these dates only when the corresponding page content changes substantially.
const blogHubLastmod = "2026-09-23";
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
  ...foodpages.items.map((food) => `/food/${food.slug}/`)
];

module.exports = [...new Set(paths)].sort().map((path) => {
  const lastmod = path === "/blog/" ? blogHubLastmod : path.startsWith("/food/") ? foodPagesLastmod : null;
  return lastmod ? { path, lastmod } : { path };
});
