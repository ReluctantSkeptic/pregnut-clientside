const fs = require('fs');

const BANNED_PATTERNS = [
  /\bpowerhouse\b/i,
  /\bsuperfood\b/i,
  /\bcrucial role\b/i,
  /\bvital role\b/i,
  /\bpivotal role\b/i,
  /\btestament to\b/i,
  /\brich tapestry\b/i,
  /\bboasts?\b/i,
  /\bstands as\b/i,
  /—|–/, // em/en dash
  /\bensuring optimal\b/i,
  /\bfostering optimal\b/i,
  /\bcultivating\b/i,
  /\bIn conclusion\b/i,
  /\bIt is important to remember\b/i,
  /\bAlways consult your (doctor|healthcare provider)\b/i,
  /\bExperts recommend\b/i,
  /\bStudies show\b/i
];

function validateBatch(filePath) {
  if (!fs.existsSync(filePath)) return { error: 'File does not exist' };
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const issues = [];
  
  for (const [id, item] of Object.entries(data)) {
    if (!item.verdict || !item.explanation || !item.sources) {
      issues.push(`ID ${id}: missing required fields`);
      continue;
    }
    const text = item.explanation.trim();
    const clean = text.replace(/e\.g\.|i\.e\.|U\.S\.|vs\.|Dr\.|oz\.|lb\.|approx\./gi, 'abbr');
    const sentences = clean.split(/[.!?]+(?:\s+|$)/).filter(s => s.trim().length > 0);
    if (sentences.length < 3 || sentences.length > 5) {
      issues.push(`ID ${id}: sentence count is ${sentences.length} (expected 3-4)`);
    }
    
    for (const pat of BANNED_PATTERNS) {
      if (pat.test(item.explanation)) {
        issues.push(`ID ${id}: contains banned AI pattern ${pat}`);
      }
    }
    
    if (!Array.isArray(item.sources) || item.sources.length < 1) {
      issues.push(`ID ${id}: missing sources`);
    }
  }
  return { count: Object.keys(data).length, issues };
}

module.exports = { validateBatch, BANNED_PATTERNS };
