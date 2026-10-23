// Turns USDA-style names ("Cheese, Blue", "Seeds, Sesame seeds, Whole, Dried")
// into one readable line ("Blue cheese", "Whole sesame seeds, dried").
// Used by the fooddata build (food.label) and by server-rendered rankings.

// Category words that add nothing once the specific food follows.
const DROP_HEADS = new Set([
  "nuts", "seeds", "snacks", "candies", "beverages", "spices", "fast foods", "restaurant",
  "mars snackfood us", "game meat", "babyfood", "fish", "cereal", "cereals", "latino", "chinese",
  "mexican", "fast food", "kellogg"
]);

// Heads whose second part names the variety: "Cheese, Blue" -> "Blue cheese".
const VARIETY_HEADS = new Set([
  "cheese", "beans", "peppers", "squash", "lettuce", "cabbage", "tea", "oil", "salad dressing",
  "sauce", "bread", "cookies", "cake", "pie", "crackers", "tomatoes", "apples", "potatoes", "rice",
  "pasta", "noodles", "peas", "onions", "mushrooms", "radishes", "cherries", "pears", "plums",
  "peaches", "apricots", "grapes", "melons", "lentils", "muffins", "rolls", "pudding", "puddings",
  "ice cream", "ice creams", "sausage", "seaweed", "doughnuts", "popcorn", "pretzels", "tortillas",
  "chard", "corn", "beets", "lettuce", "spinach"
]);

// Single-word modifiers that read better in front: "Milk, Whole" -> "Whole milk".
const FRONT_WORDS = new Set([
  "red", "green", "yellow", "white", "black", "brown", "pink", "purple", "golden", "orange",
  "sweet", "dark", "whole", "ground", "wild", "baby", "swiss", "atlantic", "pacific", "sockeye",
  "coho", "chinook", "bluefin", "skipjack", "albacore", "italian", "french", "greek", "mexican",
  "english", "spanish", "russian", "japanese", "american", "hawaiian", "romaine", "iceberg",
  "savoy", "napa", "snap", "lima", "kidney", "navy", "pinto", "mung", "kidney", "great northern",
  "skim", "nonfat", "lowfat", "low-fat", "fat-free", "reduced-fat", "2%", "1%", "plain", "vanilla",
  "chocolate", "strawberry", "blueberry", "cranberry", "lemon", "honey", "summer", "winter",
  "butternut", "acorn", "spaghetti", "crookneck", "zucchini", "hubbard", "cottage", "cream",
  "cheddar", "mozzarella", "parmesan", "ricotta", "feta", "brie", "camembert", "gouda", "edam",
  "provolone", "muenster", "colby", "fontina", "gruyere", "limburger", "romano", "blue", "goat",
  "brick", "monterey", "neufchatel", "queso", "canola", "olive", "sunflower", "safflower",
  "coconut", "palm", "sesame", "peanut", "corn", "soybean", "flaxseed", "walnut", "avocado",
  "rye", "wheat", "oatmeal", "sourdough", "pita", "naan", "multigrain", "multi-grain",
  "whole-wheat", "whole-grain", "raisin", "banana", "pumpkin", "brown", "long-grain", "jasmine",
  "basmati", "egg", "rice", "split", "oyster", "shiitake", "portabella", "enoki", "button",
  "bartlett", "fuji", "gala", "granny", "sweet potato", "russet", "red", "herbal", "green",
  "oolong", "chamomile", "hibiscus", "ginger", "peppermint", "kale", "italian", "polish",
  "smoked", "light", "chunk"
]);

// Cuts that read better after the animal: "Chicken, Breast" -> "Chicken breast".
const MEAT_HEADS = new Set(["chicken", "beef", "pork", "turkey", "lamb", "veal", "duck", "goose", "ham", "bison", "venison", "rabbit", "ostrich", "emu"]);
const CUTS = /^(breast|wing|wings|thigh|thighs|drumstick|leg|liver|loin|tenderloin|brisket|ribs?|spareribs|chuck|sirloin|shoulder|round|rib eye|ribeye|heart|giblets|bacon|chop|chops|steak|flank|skirt|top sirloin|bottom round|top round|eye of round|t-bone|porterhouse|patty|patties|meatballs|tongue|kidneys?)$/i;

// Parts that are bookkeeping rather than description.
const NOISE = [
  /^includes?\b/i, /^including\b/i, /^excluding\b/i, /^assorted\b/i, /^nfs$/i, /^not\b/i,
  /^(regular|standard|typical|generic|commercial|unspecified|composite|all types|all varieties|all flavors)$/i,
  /^(flesh|separable lean and fat|lean and fat)$/i,
  /^(dry|moist) heat$/i, /^year round average$/i, /^(with|without) salt( added)?$/i,
  /^(salted|unsalted)$/i, /^ready-to-(eat|drink|serve)\.?$/i, /^prepared$/i,
  /^(fortified|ortified|enriched) with\b/i, /\bms \d/i, /^(b\d+|mg|ca|potas|d2|g)$/i,
  /^\d+(\.\d+)?%?$/, /\bgrams? protein per\b/i, /^fluid$/i, /^(us|usda) /i, /^shelf stable$/i, /^from roasted\b/i, /^(frozen|refrigerated) or shelf/i
];

// Words that keep a capital mid-name.
const PROPER = /^(atlantic|pacific|swiss|italian|french|chinese|japanese|mexican|american|greek|english|spanish|russian|hawaiian|florida|alaska|california|european|asian|thai|indian|cuban|polish|irish|canadian|manhattan|new england|thousand island|caesar|monterey|cheddar|colby|gouda|edam|parmesan|romano|gruyere|limburger|camembert|brie|fontina|provolone|muenster|kellogg's|post|quaker|kashi|kraft|general mills|odwalla|lifeway|bolthouse|glaceau|powerade|sprite|snickers|twix|skittles|starburst|m&m's|reese's|kix|trix|cheerios|chex|wheaties|weetabix|payday|butterfinger|tabasco|worcestershire|kung pao|tootie|cap'n|i|ii)\b/i;

const BRAND = /^(kellogg's|post|quaker|kashi|kraft|general mills|odwalla|lifeway|bolthouse farms|familia|alpen|ralston|nature's path|uncle ben's|kretschmer|tinkyada|glaceau|mars|nestle|hershey's)$/i;

function cleanup(text) {
  return String(text || "")
    .replace(/\s*\([^)]*\)/g, "")   // parentheticals, even across commas
    .replace(/\s*\([^)]*$/g, "")    // unclosed parentheticals
    .replace(/\s+/g, " ")
    .trim();
}

function lowerFirst(part) {
  if (PROPER.test(part) || /^[A-Z0-9][A-Z0-9-]+\b/.test(part)) return part;
  return part.charAt(0).toLowerCase() + part.slice(1);
}

function upperFirst(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function foodLabel(name) {
  let parts = cleanup(name).split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return String(name || "").trim();

  // Drop generic category heads; cereal names gain "cereal" when it isn't obvious.
  const firstKey = parts[0].toLowerCase();
  if (parts.length > 1 && DROP_HEADS.has(firstKey)) {
    parts.shift();
    if (/^cereals?$/.test(firstKey) && parts[0].split(" ").length <= 3 && !/ with |cereal|granola|oat|flakes|bran|grits|farina|muesli|wheat germ/i.test(parts.join(" "))) {
      parts[0] += " cereal";
    }
  }

  // "Kellogg's, Raisin bran crunch" -> "Kellogg's raisin bran crunch"
  if (parts.length > 1 && parts[1].toLowerCase().startsWith(parts[0].toLowerCase())) {
    parts.shift();
  } else if (parts.length > 1 && BRAND.test(parts[0])) {
    parts.splice(0, 2, parts[0] + " " + lowerFirst(parts[1]));
  }

  let head = parts.shift();
  let rest = parts
    .map((p) => p.replace(/^meat and skin$/i, "with skin").replace(/^meat only$/i, "skinless").replace(/^separable lean only$/i, "lean only"))
    .filter((p) => !NOISE.some((re) => re.test(p)));
  const headKey = head.toLowerCase();
  const stem = headKey.replace(/s$/, "");
  const STATE = /^(raw|cooked|boiled|canned|dried|frozen|baked|fried|roasted|steamed|prepared|dry|fresh|unprepared|mature|immature|ripe|uncooked|homemade|home-prepared|home prepared|commercial)$/i;
  let meatCut = false;

  // "Milk, Buttermilk" -> "Buttermilk"; "Cookies, Brownies" -> "Brownies"; "Soup, Chicken broth" -> "Chicken broth".
  const nextKey = rest.length ? rest[0].toLowerCase() : "";
  if (nextKey && (nextKey.endsWith(stem) || nextKey.endsWith(stem + "s") ||
      (headKey === "soup" && /soup|broth|chowder|stew|bisque|gumbo/.test(nextKey)) ||
      (VARIETY_HEADS.has(headKey) && /^[a-z-]+[^s]s$/.test(nextKey) && nextKey !== "molasses"))) {
    head = upperFirst(rest.shift());
  } else if (headKey === "soup" && nextKey && !STATE.test(nextKey)) {
    head = rest.shift() + " soup";
  } else
  // Variety heads take their next short part in front: "Cheese, Blue" -> "Blue cheese".
  if (VARIETY_HEADS.has(headKey) && rest.length && rest[0].split(" ").length <= 3 && !STATE.test(rest[0])) {
    head = lowerFirst(rest.shift()) + " " + headKey;
  } else if (MEAT_HEADS.has(headKey) && rest.length && CUTS.test(rest[0])) {
    head = head + " " + rest.shift().toLowerCase();
    meatCut = true;
  }

  // Fold simple modifiers to the front: "Peppers, Sweet, Red" -> "Red sweet peppers".
  while (rest.length && FRONT_WORDS.has(rest[0].toLowerCase()) && !(meatCut && /^whole$/i.test(rest[0])) && !head.toLowerCase().includes(rest[0].toLowerCase())) {
    head = lowerFirst(rest.shift()) + " " + lowerFirst(head);
  }

  // "Cooked, Dry heat" and repeated words collapse; drop parts already said in the head.
  const seen = new Set([head.toLowerCase()]);
  const tail = [];
  for (const part of rest) {
    const key = part.toLowerCase();
    if (seen.has(key) || head.toLowerCase().includes(key)) continue;
    seen.add(key);
    tail.push(lowerFirst(part));
  }

  return upperFirst([head, ...tail].join(", ")).replace(/\s+,/g, ",");
}

module.exports = { foodLabel };
