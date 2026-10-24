// Everyday portions for each food, so people can log "1 cup" or "2 slices"
// instead of grams. Weights follow USDA household measures (FoodData Central
// portion tables) rounded to the nearest gram; the first matching rule wins.
//
// A unit is [name, grams, defaultQuantity?]. The first unit is the default.
// The calculator also always offers plain grams.

const R = (test, units, group, not) => ({ test, units, group, not });
const FRUIT = "Fruits and Fruit Juices";
const VEG = "Vegetables and Vegetable Products";

const RULES = [
  // Powders and supplements come before drinks so "milk powder" isn't a cup
  R(/powder|ovaltine|protein supplement|muscle milk/, [["scoop", 30], ["tbsp", 8]]),
  R(/^gelatin/, [["cup", 135]]),
  R(/mashed potato/, [["cup", 210, 0.5]]),

  // Eggs
  R(/^egg noodles/, [["cup cooked", 160]]),
  R(/^egg, yolk/, [["yolk", 17, 2]]),
  R(/^white egg|egg white/, [["egg white", 33, 2]]),
  R(/^egg, (omelet|scrambled)/, [["egg's worth", 61, 2]]),
  R(/^egg\b/, [["large egg", 50, 2]]),

  // Cheese and dairy (before milk, since names say "whole milk")
  R(/cottage cheese/, [["cup", 210, 0.5]]),
  R(/ricotta/, [["cup", 246, 0.25]]),
  R(/parmesan|romano/, [["tbsp grated", 5, 2], ["oz", 28]]),
  R(/cream cheese/, [["tbsp", 15, 2]]),
  R(/cheese/, [["slice", 21, 1], ["oz", 28], ["cup shredded", 113, 0.25]], "Dairy and Egg Products"),
  R(/frozen yogurt|ice cream|sherbet|gelato/, [["scoop (½ cup)", 66]]),
  R(/yogurt|kefir/, [["container (6 oz)", 170], ["cup", 245]]),
  R(/sour cream|whipped|^cream\b/, [["tbsp", 15, 2]]),
  R(/^butter|light butter|margarine|spread\b/, [["tbsp", 14], ["tsp", 5]]),

  // Drinks
  R(/milk chocolate|milky way|chocolate coated/, [["small bar (1.5 oz)", 43]]),
  R(/coconut milk, raw/, [["cup", 240, 0.5]]),
  R(/milk|soymilk|kefir|eggnog|smoothie|juice|shake|lemonade|punch|coffee|\btea\b|beverage|drink|water\b|soda|cola/, [["cup (8 fl oz)", 240]], null, /\b(in|with) water\b|sauce|made from/),

  // Fats, dressings, condiments, spreads
  R(/dressing|mayonnaise/, [["tbsp", 15, 2]]),
  R(/^oil\b|\boil$|oil, |^fat\b|lard|shortening|tallow|grease/, [["tbsp", 14], ["tsp", 5]]),
  R(/peanut butter|almond butter|cashew butter|sesame butter|tahini|nut butter|hazelnut spread/, [["tbsp", 16, 2]]),
  R(/hummus|dip\b/, [["tbsp", 15, 2], ["¼ cup", 62]]),
  R(/honey|syrup|molasses|jam|jelly|preserves|marmalade|agave|sugar/, [["tbsp", 20], ["tsp", 7]]),
  R(/applesauce/, [["cup", 244, 0.5]]),
  R(/dulce de leche/, [["tbsp", 19, 2]]),
  R(/croutons/, [["¼ cup", 10]]),
  R(/phyllo/, [["sheet", 19, 2]]),
  R(/salsa|sauce|ketchup|mustard|gravy|relish|vinegar/, [["tbsp", 16, 2], ["¼ cup", 62]]),

  // Breads and bakery
  R(/bagel(?! chips)/, [["bagel", 100]]),
  R(/english muffin/, [["muffin", 57]]),
  R(/pita/, [["pita", 64]]),
  R(/naan/, [["naan", 90]]),
  R(/corn tortilla/, [["tortilla", 26, 2]]),
  R(/tortillas?(?! chips)/, [["tortilla", 45]]),
  R(/rolls?\b|buns?\b|hotdog/, [["roll", 43]]),
  R(/muffin/, [["muffin", 113]]),
  R(/croissant/, [["croissant", 57]]),
  R(/biscuit/, [["biscuit", 60]]),
  R(/pancake/, [["pancake (4 inch)", 38, 2]]),
  R(/waffle/, [["waffle", 35, 2]]),
  R(/bread crumbs/, [["tbsp", 7, 2]]),
  R(/breadstick|bread sticks/, [["breadstick", 40]]),
  R(/bread/, [["slice", 30, 2]]),
  R(/crackers?|saltines|crispbread/, [["serving (5 crackers)", 15]]),
  R(/cookie|gingersnap|wafer/, [["cookie", 15, 2]]),
  R(/brownie/, [["brownie", 40]]),
  R(/doughnut/, [["doughnut", 60]]),
  R(/pie\b|cake|cheesecake|strudel|eclair|cream puff|coffeecake|sweet rolls|pastr/, [["slice", 90]]),

  // Breakfast cereals
  R(/oats?\b.*(cooked|prepared)|oatmeal, |cream of (wheat|rice).*cooked|grits.*cooked/, [["cup cooked", 234]]),
  R(/granola|muesli|alpen/, [["cup", 55, 0.5]]),
  R(/wheat germ|oat bran/, [["tbsp", 7, 2], ["¼ cup", 28]]),
  R(/./, [["bowl (1 cup)", 30]], "Breakfast Cereals"),

  // Grains, pasta, rice
  R(/rice\b.*cooked|cooked.*rice/, [["cup cooked", 195, 0.5]]),
  R(/quinoa/, [["cup cooked", 185, 0.5]]),
  R(/pasta|spaghetti|macaroni|noodles|couscous/, [["cup cooked", 140, 1]]),
  R(/./, [["cup cooked", 175, 0.5]], "Cereal Grains and Pasta"),

  // Legumes and soy
  R(/tofu(?! yogurt)/, [["slice (3 oz)", 85], ["cup", 126, 0.5]]),
  R(/tempeh/, [["slice (3 oz)", 85]]),
  R(/edamame/, [["cup", 155, 0.5]]),
  R(/meatless|veggie burger|soyburger|vegetarian (fillets|meatloaf|patties)/, [["patty or piece", 70]]),
  R(/refried/, [["cup", 240, 0.5]]),
  R(/peanuts/, [["handful (1 oz)", 28]]),
  R(/./, [["cup", 172, 0.5]], "Legumes and Legume Products"),

  // Nuts and seeds
  R(/flaxseed|chia|sesame seed|whole sesame|poppy/, [["tbsp", 9, 2]]),
  R(/coconut water/, [["cup (8 fl oz)", 240]]),
  R(/coconut meat/, [["cup shredded", 80, 0.5]]),
  R(/./, [["handful (1 oz)", 28]], "Nut and Seed Products"),

  // Meat, poultry, fish
  R(/bacon/, [["slice", 8, 2]]),
  R(/sausage|bratwurst|chorizo|frankfurter|hot dog/, [["link", 45]]),
  R(/salami|pepperoni|bologna|pastrami|luncheon|sliced|deli/, [["slice", 28, 2]]),
  R(/jerky/, [["piece (1 oz)", 28]]),
  R(/wing\b/, [["wing", 34, 3]]),
  R(/drumstick/, [["drumstick", 75, 2]]),
  R(/thigh/, [["thigh", 110]]),
  R(/sardine/, [["can (3.75 oz)", 92]]),
  R(/tuna.*canned|canned.*tuna|salmon, canned|canned.*salmon/, [["can, drained (5 oz)", 140, 0.5]]),
  R(/./, [["fillet (6 oz)", 170], ["palm-size portion (3 oz)", 85]], "Finfish and Shellfish Products"),
  R(/./, [["palm-size portion (3 oz)", 85]], "Beef Products"),
  R(/./, [["palm-size portion (3 oz)", 85]], "Pork Products"),
  R(/./, [["palm-size portion (3 oz)", 85]], "Poultry Products"),
  R(/./, [["palm-size portion (3 oz)", 85]], "Lamb, Veal, and Game Products"),
  R(/./, [["slice", 28, 2]], "Sausages and Luncheon Meats"),

  // Fruits
  R(/dried|dehydrated|raisins|prunes|dates|currants/, [["¼ cup", 40]], "Fruits and Fruit Juices"),
  R(/banana/, [["medium banana", 118]], FRUIT),
  R(/apples?\b/, [["medium apple", 182]], FRUIT),
  R(/oranges?\b/, [["medium orange", 140]], FRUIT),
  R(/tangerine|clementine|mandarin/, [["tangerine", 88, 2]], FRUIT),
  R(/grapefruit/, [["grapefruit", 246, 0.5]], FRUIT),
  R(/pears?\b/, [["medium pear", 178]], FRUIT),
  R(/peach|nectarine/, [["medium peach", 150]], FRUIT),
  R(/plums?\b/, [["plum", 66, 2]], FRUIT),
  R(/kiwi/, [["kiwi", 69, 2]], FRUIT),
  R(/apricots?\b/, [["apricot", 35, 3]], FRUIT),
  R(/figs?\b/, [["fig", 50, 2]], FRUIT),
  R(/avocado/, [["avocado", 150, 0.5]], FRUIT),
  R(/strawberr/, [["cup", 152]], FRUIT),
  R(/raspberr/, [["cup", 123]], FRUIT),
  R(/blackberr|blueberr|boysenberr|cranberr/, [["cup", 145]], FRUIT),
  R(/grapes/, [["cup", 151]], FRUIT),
  R(/cherries/, [["cup", 154]], FRUIT),
  R(/mango|papaya|pineapple|melon|cantaloupe|honeydew|watermelon|guava|lychee|litchi/, [["cup chunks", 160]], FRUIT),
  R(/pomegranate/, [["½ cup seeds", 87]], FRUIT),
  R(/lemon|lime/, [["wedge", 8, 2]], FRUIT),
  R(/olives/, [["olive", 4, 5]], FRUIT),
  R(/./, [["cup", 150]], "Fruits and Fruit Juices"),

  // Vegetables
  R(/french fried|fries/, [["medium order", 117]], VEG),
  R(/hash brown/, [["cup", 150, 0.5]], VEG),
  R(/sweet potato/, [["medium sweet potato", 114]], VEG),
  R(/potato/, [["medium potato", 173]], VEG),
  R(/carrots?, raw/, [["medium carrot", 61]], VEG),
  R(/tomato(es)?, .*raw|tomatoes, ripe, raw/, [["medium tomato", 123]], VEG),
  R(/sun-dried tomato/, [["piece", 2, 5]], VEG),
  R(/(spinach|lettuce|arugula|kale|greens|chard|watercress|cress), raw|lettuce/, [["cup", 30, 2]], VEG),
  R(/spinach|kale|collards|greens|chard/, [["cup cooked", 180, 0.5]], VEG),
  R(/corn\b.*(boiled|cooked)|sweet corn/, [["ear of corn", 90]], VEG),
  R(/garlic/, [["clove", 3, 2]], VEG),
  R(/onions?, raw/, [["medium onion", 110, 0.5]], VEG),
  R(/peppers?, raw|sweet peppers/, [["medium pepper", 119, 0.5]], VEG),
  R(/jalapeno|serrano|chili|chile/, [["pepper", 14]], VEG),
  R(/cucumber/, [["cup slices", 104, 0.5]], VEG),
  R(/zucchini|summer squash/, [["medium squash", 196, 0.5]], VEG),
  R(/asparagus/, [["spear", 16, 5]], VEG),
  R(/mushroom/, [["cup", 70]], VEG),
  R(/pickle/, [["spear", 35]], VEG),
  R(/soup|broth|chowder|bisque|stew/, [["cup", 245]], VEG),
  R(/raw/, [["cup", 90]], "Vegetables and Vegetable Products"),
  R(/./, [["cup", 156, 0.5]], "Vegetables and Vegetable Products"),

  // Ready meals
  R(/pizza/, [["slice", 107, 2]]),
  R(/cheeseburger|hamburger|fish sandwich|sandwich/, [["sandwich", 200]]),
  R(/burrito/, [["burrito", 220]]),
  R(/taco/, [["taco", 100, 2]]),
  R(/quesadilla/, [["quesadilla", 180]]),
  R(/pupusa/, [["pupusa", 120, 2]]),
  R(/empanada/, [["empanada", 100, 2]]),
  R(/tamale/, [["tamale", 140, 2]]),
  R(/nachos/, [["plate", 200, 0.5]]),
  R(/tenders|nuggets|french toast sticks|hush puppies|onion rings/, [["serving", 100]]),
  R(/breast/, [["piece", 160]]),
  R(/soup|broth|chowder|bisque|stew/, [["cup", 245]]),
  R(/./, [["cup", 145]], "Restaurant Foods"),
  R(/./, [["serving", 150]], "Fast Foods"),
  R(/./, [["cup", 245]], "Soups, Sauces, and Gravies"),

  // Snacks and sweets
  R(/\bbars?\b|power bar|clif|luna|zone perfect|south beach/, [["bar", 50]]),
  R(/popcorn/, [["cup popped", 8, 3]]),
  R(/chips|crisps|puffs|pretzel|pork skins|sticks|combos/, [["handful (1 oz)", 28]]),
  R(/chewing gum/, [["piece", 3]]),
  R(/candy|chocolate|caramels|fruit chews|skittles|starburst|reese|toblerone|payday|snickers|kit kat|m&m/, [["snack size (1.5 oz)", 43]]),
  R(/pudding/, [["snack cup", 113]]),
  R(/./, [["handful (1 oz)", 28]], "Snacks"),
  R(/./, [["serving (1.5 oz)", 43]], "Sweets"),
  R(/./, [["cup (8 fl oz)", 240]], "Beverages")
];

const FALLBACK = [["serving", 100]];

function foodPortions(label, group) {
  const text = String(label || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.group && rule.group !== group) continue;
    if (rule.not && rule.not.test(text)) continue;
    if (rule.test.test(text)) return rule.units;
  }
  return FALLBACK;
}

module.exports = { foodPortions };
