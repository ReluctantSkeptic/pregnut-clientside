// Marks foods that are real but odd to recommend in a "top foods" list:
// unusual animals, ingredients nobody eats 100 g of, and supplement-like
// items. Flagged foods keep their pages and stay searchable; rankings skip them.

const UNCOMMON = [
  // Unusual animals and their eggs
  /\b(dove|quail|pheasant|squab|ostrich|emu|goose|deer|venison|moose|elk|caribou|bear|beaver|squirrel|rabbit|boar|frog|caviar|roe)\b/i, /\bturtle\b(?! beans)/i, /egg, duck/i,
  // Ingredients rather than foods
  /^(?!.*\b(bread|pasta|made with)\b).*\bflour\b/i, /protein isolate/i, /\bwhey\b.*\bdried\b|\bdried\b.*\bwhey\b/i, /egg substitute/i,
  /gelatins?, dry powder/i, /baking chocolate|chocolate, baking/i, /cocoa, dry powder/i,
  /butter replacement/i, /dry mix/i, /tapioca, pearl/i, /\bunprepared\b/i,
  /^(spaghetti|pasta|noodles|macaroni|vermicelli)\b.*\bdry\b/i, /^cereals?,.*\bdry$/i,
  /mature seeds, raw|^lentils, raw/i,
  // Fats eaten by the spoonful at most
  /^(fat,|lard|animal fat|shortening|oil,)/i, /separable fat/i,
  // Condiments and sweeteners
  /^(worcestershire|fish sauce|sauce, fish|hoisin|teriyaki|tabasco|pepper sauce|horseradish|soy sauce|oyster sauce|steak sauce|chili sauce|sauce, chili)/i,
  /peppers, hot, chili, mature red, canned|cocktail sauce|sauce, cocktail|tomato chili sauce|fish broth|aloe vera/i, /breaded, uncooked|uncooked, breaded/i, /chewing gum/i, /^molasses$|agave|^syrups?,|sweetener, syrup/i,
  // Supplement-like or rarely eaten produce
  /spirulina|\bagar\b|irish ?moss/i, /hot chil[ei] peppers?, sun-dried|peppers, hot chile, sun-dried/i,
  /drumstick leaves|\bjute\b|lambsquarters|chrysanthemum|soybean, curd cheese|curd cheese, soybean/i, /litchis, dried/i
];

function isUncommon(name, label) {
  const text = [name, label].filter(Boolean);
  return UNCOMMON.some((re) => text.some((t) => re.test(t)));
}

module.exports = { isUncommon };
