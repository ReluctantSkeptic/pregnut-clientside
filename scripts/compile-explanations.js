const fs = require('fs');
const path = require('path');
const { validateBatch } = require('./validate-explanations');

const outputDir = path.join(__dirname, '../src/resource/explanations/output');
const masterFile = path.join(__dirname, '../src/resource/food_explanations.json');
const foodData = require('../src/resource/pregnut_fooddata.v1.json');

const files = fs.readdirSync(outputDir).filter(f => f.startsWith('batch-') && f.endsWith('.json')).sort();
console.log(`Found ${files.length} batch files.`);

const master = {};
let totalIssues = 0;

for (const file of files) {
  const filePath = path.join(outputDir, file);
  const res = validateBatch(filePath);
  if (res.issues && res.issues.length > 0) {
    console.warn(`Issues in ${file}:`);
    res.issues.forEach(iss => console.warn(`  - ${iss}`));
    totalIssues += res.issues.length;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const [id, item] of Object.entries(data)) {
    master[id] = item;
  }
  console.log(`Loaded ${file}: ${Object.keys(data).length} foods.`);
}

console.log(`Total master entries: ${Object.keys(master).length} / ${foodData.foods.length}`);
console.log(`Total validation issues across batches: ${totalIssues}`);

fs.writeFileSync(masterFile, JSON.stringify(master, null, 2));
console.log(`Wrote master explanations file to ${masterFile}`);
