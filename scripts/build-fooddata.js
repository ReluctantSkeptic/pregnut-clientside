/* eslint-disable no-console */
// Builds a compact JSON dataset for fast in-browser ranking of foods by %RDA per 100g.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const INPUT_FOODLIST = path.join(ROOT, "database", "FoodList.csv");
const INPUT_NUTRIENTS = path.join(ROOT, "database", "NutrientList.csv");
const INPUT_RDA = path.join(ROOT, "database", "daily requirements.csv");
const OUTPUT_JSON = path.join(ROOT, "src", "resource", "pregnut_fooddata.v1.json");

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function parseCsv(text) {
  // Minimal CSV parser that supports quoted fields and escaped quotes ("").
  const rows = [];
  const lines = stripBom(text).split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "\"") {
        const next = line[i + 1];
        if (inQuotes && next === "\"") {
          cur += "\"";
          i++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    rows.push(out);
  }
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = row[j] !== undefined && row[j] !== null ? row[j] : "";
    }
    out.push(obj);
  }
  return out;
}

function parseRdaValue(rdaLabel) {
  const s = String(rdaLabel || "").trim();
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*([A-Za-z]+)$/);
  if (!m) return null;
  return { value: Number(m[1]), unit: m[2], label: s };
}

function main() {
  // In some deployments, the canonical CSVs may not be present (for example if you
  // commit only the generated JSON). If inputs are missing, keep the build green
  // as long as the JSON already exists.
  if (!fs.existsSync(INPUT_FOODLIST) || !fs.existsSync(INPUT_NUTRIENTS) || !fs.existsSync(INPUT_RDA)) {
    if (fs.existsSync(OUTPUT_JSON)) {
      console.warn(
        "Fooddata CSV inputs missing; keeping existing JSON:",
        path.relative(ROOT, OUTPUT_JSON)
      );
      return;
    }
    throw new Error("Missing CSV inputs and no existing generated JSON found.");
  }

  const foodRows = rowsToObjects(parseCsv(fs.readFileSync(INPUT_FOODLIST, "utf8")));
  const nutrientRows = rowsToObjects(parseCsv(fs.readFileSync(INPUT_NUTRIENTS, "utf8")));
  const rdaRows = parseCsv(fs.readFileSync(INPUT_RDA, "utf8"));

  const foodsById = {};
  for (const r of foodRows) {
    const id = r.NDB_No;
    foodsById[id] = {
      id,
      name: r.FoodName,
      group: r.FoodGroup,
      natSource: Number(r.NatSource || 0),
      warning: r.Warning || "",
      warningText: r.WarningText || "",
      nutrients: {},
    };
  }

  const nutrientUnits = {};
  for (const r of nutrientRows) {
    const id = r.NDB_No;
    const nutrient = r.Nutrient;
    const val = Number(r.Nutr_Val);
    const unit = r.Units;
    if (!foodsById[id]) continue;
    foodsById[id].nutrients[nutrient] = Number.isFinite(val) ? val : null;
    nutrientUnits[nutrient] = unit;
  }

  // Parse daily requirements (until the legacy source list begins).
  const rdaByNutrient = {};

  // rdaRows is raw 2D array. Find header row for nutrient table.
  const header = rdaRows[0] || [];
  const idxNutrient = header.indexOf("Nutrient");
  const idxRda = header.indexOf("RDA");

  for (let i = 1; i < rdaRows.length; i++) {
    const row = rdaRows[i];
    const nutrient = (row[idxNutrient] || "").trim();
    if (nutrient === "SourceId") break;
    if (!nutrient) continue;
    const rdaLabel = (row[idxRda] || "").trim();
    const parsed = parseRdaValue(rdaLabel);
    if (parsed) rdaByNutrient[nutrient] = parsed;
  }

  const foods = Object.values(foodsById).map((f) => {
    // Normalize odd warning values like "0"
    if (f.warning === "0") f.warning = "";
    return f;
  });

  foods.sort((a, b) => a.name.localeCompare(b.name));

  const out = {
    version: "v1",
    generatedAt: new Date().toISOString(),
    nutrients: {},
    foods,
    // Keep the v1 fields without publishing unreviewed legacy benefit copy or links.
    sources: [],
  };

  for (const nutrient of Object.keys(nutrientUnits).sort()) {
    out.nutrients[nutrient] = {
      unit: nutrientUnits[nutrient],
      rda: rdaByNutrient[nutrient] || null,
      benefits: null,
    };
  }

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("Wrote", OUTPUT_JSON);
}

main();
