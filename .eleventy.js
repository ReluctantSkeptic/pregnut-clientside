
module.exports = function(eleventyConfig) {
   // Passthroughs
   eleventyConfig.addPassthroughCopy("src/js");
   eleventyConfig.addPassthroughCopy("src/style");
   eleventyConfig.addPassthroughCopy("src/resource");
   eleventyConfig.addPassthroughCopy("src/foodfindersearch.json");
 
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