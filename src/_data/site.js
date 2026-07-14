const rawUrl = process.env.SITE_URL || "https://pregnut.com";

module.exports = {
  name: "PregNut",
  description: "Clear, evidence-forward pregnancy nutrition guidance and food comparisons.",
  author: "Yuriy Stasyuk",
  url: rawUrl.replace(/\/+$/, ""),
  socialImage: "/resource/pregnut_acorn_hero_illustrated.webp"
};
