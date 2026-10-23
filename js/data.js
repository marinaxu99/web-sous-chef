// ==========================================================================
// Web Sous-Chef — fixed reference data
// Everything in this file is hand-checked. None of it comes from the AI.
// ==========================================================================

// "Basic pantry" items assumed to be in every kitchen when the toggle is on.
export const PANTRY = [
  "salt", "black pepper", "white pepper", "pepper", "oil", "cooking oil",
  "vegetable oil", "neutral oil", "sugar", "soy sauce", "water",
];

// Grams per 1 US cup. Source: King Arthur Baking ingredient weight chart
// (kingarthurbaking.com/learn/ingredient-weight-chart), scaled to 1 cup.
// Water is its physical weight (1 US cup = 236.6 ml).
export const WEIGHTS = [
  { name: "All-purpose flour", gPerCup: 120 },
  { name: "Bread flour", gPerCup: 120 },
  { name: "Granulated sugar", gPerCup: 198 },
  { name: "Brown sugar, packed", gPerCup: 213 },
  { name: "Powdered sugar", gPerCup: 113 },
  { name: "Butter", gPerCup: 227 },
  { name: "Milk", gPerCup: 227 },
  { name: "Heavy cream", gPerCup: 227 },
  { name: "Sour cream", gPerCup: 227 },
  { name: "Water", gPerCup: 237 },
  { name: "Vegetable oil", gPerCup: 198 },
  { name: "Honey", gPerCup: 336 },
  { name: "Maple syrup", gPerCup: 312 },
  { name: "Uncooked white rice", gPerCup: 198 },
  { name: "Rolled oats", gPerCup: 113 },
  { name: "Cocoa powder", gPerCup: 84 },
  { name: "Cornstarch", gPerCup: 112 },
  { name: "Table salt", gPerCup: 288 },
  { name: "Peanut butter", gPerCup: 270 },
  { name: "Chocolate chips", gPerCup: 170 },
];

// Volume units in millilitres (US customary).
export const VOLUME_ML = { cup: 236.588, tbsp: 14.787, tsp: 4.929, ml: 1, l: 1000 };
// Weight units in grams.
export const WEIGHT_G = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };

// Common oven settings (rounded dial values) with UK gas marks.
export const OVEN_PRESETS = [
  { c: 160, f: 325, gas: 3 },
  { c: 180, f: 350, gas: 4 },
  { c: 190, f: 375, gas: 5 },
  { c: 200, f: 400, gas: 6 },
  { c: 220, f: 425, gas: 7 },
  { c: 230, f: 450, gas: 8 },
];

// Well-established substitutions. Keep this list curated by hand.
export const SWAPS = [
  { out: "Buttermilk", amount: "1 cup", use: "1 cup milk + 1 tbsp lemon juice or white vinegar", note: "Stir, then let it sit 5 min until slightly thick. Good for pancakes, baking and marinades.", tags: ["buttermilk"] },
  { out: "Cornstarch", amount: "1 tbsp", use: "2 tbsp all-purpose flour", note: "For thickening sauces and gravies. Cook a little longer to lose the raw flour taste.", tags: ["cornstarch", "corn starch", "cornflour"] },
  { out: "Self-rising flour", amount: "1 cup", use: "1 cup all-purpose flour + 1½ tsp baking powder + ¼ tsp salt", note: "Whisk well before using.", tags: ["self-rising", "self raising"] },
  { out: "Baking powder", amount: "1 tsp", use: "¼ tsp baking soda + ½ tsp cream of tartar", note: "Mix just before using.", tags: ["baking powder"] },
  { out: "Brown sugar", amount: "1 cup", use: "1 cup granulated sugar + 1 tbsp molasses", note: "Mash together with a fork.", tags: ["brown sugar"] },
  { out: "Egg (in baking)", amount: "1 egg", use: "1 tbsp ground flaxseed + 3 tbsp water", note: "Let it sit 5 min to gel. Works for binding, not for whipping.", tags: ["egg", "eggs"] },
  { out: "Sour cream", amount: "1 cup", use: "1 cup plain Greek yogurt", note: "Same amount. Slightly tangier.", tags: ["sour cream"] },
  { out: "Fresh herbs", amount: "1 tbsp", use: "1 tsp dried herbs", note: "Add dried herbs earlier in cooking so they soften.", tags: ["herbs", "basil", "oregano", "thyme", "parsley"] },
  { out: "Lemon juice", amount: "1 tbsp", use: "1 tbsp lime juice", note: "Same amount.", tags: ["lemon", "lime"] },
  { out: "Rice vinegar", amount: "1 tbsp", use: "1 tbsp apple cider vinegar", note: "Same amount. Slightly fruitier.", tags: ["rice vinegar", "vinegar"] },
];

// Safe minimum internal temperatures. Source: USDA via FoodSafety.gov.
// °C values are the standard rounded conversions.
export const SAFE_TEMPS = [
  { key: "poultry", label: "Chicken, turkey, any poultry", f: 165, c: 74 },
  { key: "ground", label: "Ground meat, sausage", f: 160, c: 71 },
  { key: "whole", label: "Beef, pork, lamb: steaks, chops, roasts", f: 145, c: 63, note: "Then rest 3 min" },
  { key: "fish", label: "Fish", f: 145, c: 63, note: "Or until opaque and flakes with a fork" },
  { key: "egg-dish", label: "Egg dishes (frittata, quiche)", f: 160, c: 71 },
  { key: "leftovers", label: "Leftovers, casseroles", f: 165, c: 74 },
  { key: "shellfish", label: "Shrimp, crab, scallops", look: "Until pearly and opaque" },
];
