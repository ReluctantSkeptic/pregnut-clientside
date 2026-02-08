## 2026-02-04
- Restored About page content from the original site, including Top Foods, Search, and Recommendations sections, plus science references and disclaimer.
- Unified the color palette to a single teal accent and updated autocomplete dropdown styling to match the beige theme.
- Widened the Tableau view and set the visualization to fill its container.
- Fixed the global search bar so it redirects to the Top Foods view when the dashboard is not loaded.

## 2026-02-08
- Added a new Weekly Diet page at `/weekly-diet/` with week selector, due date support, and period-based nutrition priorities with citations.
- Built a generated JSON dataset (`src/resource/pregnut_fooddata.v1.json`) for fast in-browser ranking of top foods by % of daily target.
- Added a shared site footer disclaimer to the base layout so it appears on every page.
