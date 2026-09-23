const foodData = require("../resource/pregnut_fooddata.v1.json");

const entries = [
  { id: "Calcium", label: "Calcium", role: "Builds and maintains bones and teeth, including the developing baby's skeleton.", source: "https://ods.od.nih.gov/factsheets/Pregnancy-HealthProfessional/", guide: "/blog/calcium-without-dairy-pregnancy/" },
  { id: "Choline", label: "Choline", role: "Helps form cell membranes and supports fetal nervous system development.", source: "https://ods.od.nih.gov/factsheets/Pregnancy-HealthProfessional/", guide: "/blog/choline-foods-pregnancy/" },
  { id: "DHA", label: "DHA", role: "An omega-3 fatty acid involved in fetal brain and eye development. PregNut's 300 mg amount is a comparison benchmark, not a U.S. RDA for DHA.", source: "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/", guide: "/blog/low-mercury-fish-pregnancy/" },
  { id: "Folate (DFE)", label: "Folate and folic acid", role: "Folate supports cell division. Folic acid taken before and early in pregnancy helps prevent neural tube defects.", source: "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/", guide: "/blog/folate-folic-acid-pregnancy/" },
  { id: "Iodine", label: "Iodine", role: "Needed to make thyroid hormones that support fetal brain development.", source: "https://ods.od.nih.gov/factsheets/Pregnancy-HealthProfessional/", guide: "/blog/iodine-without-dairy-pregnancy/" },
  { id: "Iron", label: "Iron", role: "Helps red blood cells carry oxygen to the pregnant person and developing baby.", source: "https://ods.od.nih.gov/factsheets/Pregnancy-HealthProfessional/", guide: "/blog/iron-foods-pregnancy/" },
  { id: "Potassium", label: "Potassium", role: "Supports normal cell function, fluid balance, and nerve and muscle activity.", source: "https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/", guide: "/blog/potassium-foods-pregnancy/" },
  { id: "Protein", label: "Protein", role: "Supplies amino acids for maternal and fetal tissue growth. PregNut's 70 g amount is a comparison benchmark; individual needs vary.", source: "https://www.acog.org/womens-health/faqs/healthy-eating-during-pregnancy", guide: "/blog/vegetarian-protein-pregnancy/" },
  { id: "Riboflavin", label: "Vitamin B2 (riboflavin)", role: "Helps turn food into energy and supports cell growth and function.", source: "https://ods.od.nih.gov/factsheets/Riboflavin-Consumer/" },
  { id: "Vitamin B-6", label: "Vitamin B6", role: "Helps the body use protein and supports nervous system development and function.", source: "https://ods.od.nih.gov/factsheets/Pregnancy-HealthProfessional/" },
  { id: "Vitamin B-12", label: "Vitamin B12", role: "Supports nerve function, red blood cell formation, and DNA synthesis.", source: "https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/", guide: "/blog/vegetarian-b12-pregnancy/" },
  { id: "Vitamin C", label: "Vitamin C", role: "Helps make collagen and improves absorption of iron from plant foods.", source: "https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/" },
  { id: "Vitamin D", label: "Vitamin D", role: "Helps the body absorb calcium and supports bone development.", source: "https://ods.od.nih.gov/factsheets/VitaminD-Consumer/", guide: "/blog/vitamin-d-foods-pregnancy/" },
  { id: "Zinc", label: "Zinc", role: "Supports cell growth and metabolism, including fetal growth and development.", source: "https://ods.od.nih.gov/factsheets/Pregnancy-HealthProfessional/" }
];

module.exports = entries.map((entry) => ({
  ...entry,
  amount: entry.id === "Iodine" ? "220 mcg" : foodData.nutrients[entry.id].rda.label
}));
