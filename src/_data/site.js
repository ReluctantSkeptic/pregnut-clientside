const rawUrl = process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.CF_PAGES_URL || "";
const isProduction = process.env.CF_PAGES === "1" || process.env.NODE_ENV === "production";

module.exports = {
  name: "PregNut",
  description: "Clear, evidence-forward pregnancy nutrition guidance and food comparisons.",
  author: "Yuriy Stasyuk",
  url: rawUrl.replace(/\/+$/, "") || (isProduction ? "" : "http://localhost:8080"),
  socialImage: "/resource/pregnut_acorn_hero_illustrated.webp"
};
