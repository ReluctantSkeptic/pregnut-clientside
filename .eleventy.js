
module.exports = function(eleventyConfig) {
   const site = require("./src/_data/site.js");
   const sitemapData = require("./src/_data/sitemapData.js");

   eleventyConfig.addGlobalData("site", site);
   eleventyConfig.addGlobalData("sitemapData", { items: sitemapData });


   eleventyConfig.amendLibrary("md", (markdown) => {
     markdown.core.ruler.push("heading-ids", (state) => {
       const counts = new Map();
       state.tokens.forEach((token, index) => {
         if (token.type !== "heading_open" || !/^h[23]$/.test(token.tag)) return;
         const inline = state.tokens[index + 1];
         const label = (inline.children || [])
           .filter((child) => child.type === "text" || child.type === "code_inline")
           .map((child) => child.content)
           .join("");
         const base = label.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
           .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
         const count = (counts.get(base) || 0) + 1;
         counts.set(base, count);
         token.attrSet("id", count === 1 ? base : `${base}-${count}`);
       });
     });
   });

   // Passthroughs
   eleventyConfig.addPassthroughCopy("src/js");
   eleventyConfig.addPassthroughCopy("src/style");
   eleventyConfig.addPassthroughCopy("src/resource");
   eleventyConfig.addPassthroughCopy("src/favicon.svg");
   eleventyConfig.addPassthroughCopy("src/_redirects");

   eleventyConfig.addFilter("isoDate", (dateObj) => {
     if (!dateObj) return "";
     const date = new Date(dateObj);
     return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
   });

   eleventyConfig.addFilter("formatNumber", (value) => {
     if (value === null || value === undefined || value === "") return "—";
     const number = Number(value);
     if (!Number.isFinite(number)) return "—";
     return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
   });

   eleventyConfig.addFilter("jsonLd", (value) => JSON.stringify(value).replace(/</g, "\\u003c"));

   eleventyConfig.on("eleventy.before", () => {
     if ((process.env.CF_PAGES === "1" || process.env.NODE_ENV === "production") && !site.url) {
       throw new Error("SITE_URL must be set for production builds so canonical URLs and the sitemap are valid.");
     }
   });

   eleventyConfig.addFilter("readableDate", (dateObj) => {
     const value = String(dateObj || "");
     const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
       ? new Date(`${value}T12:00:00`)
       : new Date(dateObj);
     return date.toLocaleDateString("en-US", {
       year: "numeric",
       month: "long",
       day: "numeric",
       timeZone: "UTC"
     });
   });
 
 return {
     dir: {
       input: "src",
       includes: "_includes",
       layouts: "_includes/layouts",
       data: "_data"
     },
     htmlTemplateEngine: "njk",
     markdownTemplateEngine: "njk"
  };
}
