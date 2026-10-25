// One typical serving per food, for ranking foods by what a person actually
// eats instead of by 100 g (which favours parmesan, spices and powders).
// Amounts follow the FDA "reference amounts customarily consumed" (RACC,
// 21 CFR 101.12) for the food's category, with a household measure to show.
// Returns [grams, label].

const RULES = [
  // Name patterns first: they override the group default.
  [/\bpowder\b|\bmix\b/, 30, "1 scoop"],
  [/\bpapad\b/, 15, "1 papad"],
  [/\bbran\b/, 40, "⅓ cup"],
  [/\bpeanuts?\b(?! butter)/, 30, "1 oz"],
  [/\bolives?\b/, 15, "5 olives"],
  [/\bgarlic\b/, 3, "1 clove"],
  [/\bbacon\b/, 16, "2 slices"],
  [/\bpaste\b/, 33, "2 tbsp"],
  [/\b(parmesan|romano|grated|topping)\b.*cheese|cheese.*\b(parmesan|romano|grated|topping)\b/, 5, "1 tbsp grated"],
  [/\bcottage cheese|ricotta\b/, 110, "½ cup"],
  [/\bcream cheese\b/, 30, "2 tbsp"],
  [/\bcheese\b/, 30, "1 oz"],
  [/\byogh?urt\b/, 170, "6 oz"],
  [/\begg(s)?\b.*\b(yolk)\b/, 17, "1 yolk"],
  [/\begg(s)?\b.*\b(white)\b/, 33, "1 white"],
  [/^egg|\begg(s)?,|\bomelet|\bscrambled\b/, 50, "1 large egg"],
  [/\bmilk\b.*\bcondensed\b/, 38, "2 tbsp"],
  [/\b(milk|kefir|buttermilk|eggnog|soymilk|almond milk|oat milk|smoothie|shake)\b/, 240, "1 cup"],
  [/\bjuice\b|\bnectar\b|\bdrink\b|\bbeverage\b|\bsoda\b|\btea\b|\bcoffee\b/, 240, "1 cup"],
  [/\b(dried|dehydrated)\b.*\b(fruit|apricots|figs|dates|prunes|raisins|cranberries|apples|peaches|pears|mango)\b|\braisins\b|\bprunes\b|\bdates\b/, 40, "¼ cup"],
  [/\bcanned\b.*\b(tuna|salmon|sardines?|mackerel|anchov\w*|crab|clams?|oysters?)\b|\b(tuna|salmon|sardines?|mackerel|anchov\w*|crab|clams?|oysters?)\b.*\bcanned\b/, 55, "2 oz drained"],
  [/\b(herb|spice|parsley|basil|cilantro|dill|thyme|oregano|rosemary|mint|chives|seasoning)\b/, 2, "1 tbsp fresh"],
  [/\b(seaweed|kelp|wakame|nori|spirulina|agar)\b/, 10, "1 tbsp dried"],
  [/\b(peanut|almond|cashew|sunflower|sesame) butter\b|\btahini\b/, 32, "2 tbsp"],
  [/\b(sun-dried|sundried)\b/, 10, "2 pieces"],
  [/\b(chili|chile|jalapeno|hot) pepper/, 15, "1 pepper"],
  [/\bbar\b/, 40, "1 bar"],
  [/\bbagel\b/, 110, "1 bagel"],
  [/\b(bread|roll|bun|muffin|biscuit|pita|naan)\b/, 50, "1 slice or roll"],
  [/\btortilla\b/, 55, "1 tortilla"],
  [/\b(cracker|cookie|crisp|chips?|pretzel|popcorn)\b/, 30, "1 oz"],
  [/\bwaffle|\bpancake/, 85, "1 waffle"],
  [/\b(oatmeal|porridge|grits|cream of wheat)\b/, 240, "1 cup cooked"],
  [/\b(rice|pasta|noodles?|spaghetti|macaroni|vermicelli|quinoa|couscous|barley|bulgur|millet)\b/, 140, "1 cup cooked"],
  [/\bsoup\b|^chili with\b/, 245, "1 cup"],
  [/\b(sauce|gravy|salsa|dip)\b/, 60, "¼ cup"],
  [/\b(dressing|mayonnaise)\b/, 30, "2 tbsp"],
  [/\b(oil|butter|margarine|ghee|lard)\b/, 14, "1 tbsp"],
  [/\b(potato|potatoes|yam|sweet potato)\b/, 110, "1 medium"],
  [/\b(lettuce|spinach, raw|arugula|greens, raw|kale, raw)\b/, 85, "2 cups raw"],
  [/\b(tofu|tempeh|natto|edamame)\b/, 85, "3 oz"]
];

const GROUPS = {
  "Dairy and Egg Products": [240, "1 cup"],
  "Fruits and Fruit Juices": [140, "1 cup"],
  "Vegetables and Vegetable Products": [85, "½ cup"],
  "Legumes and Legume Products": [90, "½ cup cooked"],
  "Nut and Seed Products": [30, "1 oz"],
  "Finfish and Shellfish Products": [85, "3 oz cooked"],
  "Poultry Products": [85, "3 oz cooked"],
  "Beef Products": [85, "3 oz cooked"],
  "Pork Products": [85, "3 oz cooked"],
  "Lamb, Veal, and Game Products": [85, "3 oz cooked"],
  "Sausages and Luncheon Meats": [55, "2 oz"],
  "Cereal Grains and Pasta": [140, "1 cup cooked"],
  "Breakfast Cereals": [40, "1 cup"],
  "Baked Products": [55, "1 piece"],
  "Snacks": [30, "1 oz"],
  "Sweets": [40, "1 piece"],
  "Beverages": [240, "1 cup"],
  "Fats and Oils": [14, "1 tbsp"],
  "Soups, Sauces, and Gravies": [245, "1 cup"],
  "Fast Foods": [140, "1 serving"],
  "Restaurant Foods": [140, "1 serving"]
};

// The "Whole foods" view: everyday foods from whole-food groups, without the
// treats, supplements and dry ingredients those groups also contain.
const WHOLE_GROUPS = new Set([
  "Dairy and Egg Products", "Fruits and Fruit Juices", "Vegetables and Vegetable Products",
  "Legumes and Legume Products", "Nut and Seed Products", "Finfish and Shellfish Products",
  "Poultry Products", "Beef Products", "Pork Products", "Lamb, Veal, and Game Products",
  "Cereal Grains and Pasta"
]);
const NOT_WHOLE = /\b(supplement|powder|ice cream|dulce de leche|dessert|pudding|sour cream|whipped|creamer|frozen yogh?urt|dehydrated|dry form|flakes|candied|syrup|sweetened|chips|luncheon|bolthouse|lifeway|vegetarian|meatless)\b|\bmushrooms?, dried|shiitake.*dried|\bmix\b|^chili with|made from soy/;

function isWholeFood(label, group) {
  return WHOLE_GROUPS.has(group) && !NOT_WHOLE.test(String(label || "").toLowerCase());
}

function foodServing(label, group) {
  const text = String(label || "").toLowerCase();
  if (group === "Fruits and Fruit Juices" && /\b(dried|dehydrated)\b/.test(text)) return [40, "¼ cup"];
  for (const [re, grams, name] of RULES) {
    if (re.test(text)) return [grams, name];
  }
  return GROUPS[group] || [100, "100 g"];
}

module.exports = { foodServing, isWholeFood };
