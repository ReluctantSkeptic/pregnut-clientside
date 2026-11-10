const protocol = require("../resource/weekly_protocol.v1.json");
const nutrientGuidance = require("./nutrientGuidance.js");
const sources = new Map(protocol.sources.map((source) => [source.id, source]));
const guides = new Map(nutrientGuidance
  .filter((nutrient) => nutrient.guide)
  .map((nutrient) => [nutrient.id, { label: nutrient.label, url: nutrient.guide }]));

function resolveCitations(ids) {
  return (ids || []).map((id) => sources.get(id)).filter(Boolean);
}

function allCitations(period) {
  const ids = [
    ...(period.citations || []),
    ...(period.notes || []).flatMap((note) => note.citations || []),
    ...(period.nutrients || []).flatMap((nutrient) => nutrient.citations || [])
  ];
  return resolveCitations([...new Set(ids)]);
}

// Same order weekly-diet.js paints after it loads, so the server-rendered
// list does not jump when the script replaces it.
function rankedSources(period) {
  const index = new Map(protocol.sources.map((source, i) => [source.id, i + 1]));
  const ids = [];
  function cite(list) {
    for (const item of list || []) {
      const id = typeof item === "string" ? item : item && item.id;
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  cite(period.citations);
  for (const note of period.notes || []) cite(note.citations);
  for (const nutrient of period.nutrients || []) cite(nutrient.citations);
  ids.sort((a, b) => (index.get(a) || 0) - (index.get(b) || 0));
  return ids.map((id) => sources.get(id)).filter((source) => source && source.url);
}

module.exports = {
  ...protocol,
  periods: protocol.periods.map((period) => ({
    ...period,
    citations: resolveCitations(period.citations),
    allCitations: allCitations(period),
    rankedSources: rankedSources(period),
    notes: (period.notes || []).map((note) => ({
      ...note,
      citations: resolveCitations(note.citations)
    })),
    nutrients: (period.nutrients || []).map((nutrient) => ({
      ...nutrient,
      citations: resolveCitations(nutrient.citations),
      guide: guides.get(nutrient.id) || null
    }))
  }))
};
