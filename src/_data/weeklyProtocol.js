const protocol = require("../resource/weekly_protocol.v1.json");
const nutrientGuidance = require("./nutrientGuidance.js");
const sources = new Map(protocol.sources.map((source) => [source.id, source]));
const guides = new Map(nutrientGuidance
  .filter((nutrient) => nutrient.guide)
  .map((nutrient) => [nutrient.id, { label: nutrient.label, url: nutrient.guide }]));

function resolveCitations(ids) {
  return (ids || []).map((id) => sources.get(id)).filter(Boolean);
}

module.exports = {
  ...protocol,
  periods: protocol.periods.map((period) => ({
    ...period,
    citations: resolveCitations(period.citations),
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
