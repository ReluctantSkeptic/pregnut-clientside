# PregNut (Client)

Static Eleventy site for pregnancy nutrition exploration.

## Requirements

- Node.js >= 18 (Eleventy v3 requires Node 18+)

## Local Development

```bash
npm install
npm run start
```

Build output is written to `_site/`.

## Data

The weekly tracker ranks foods by "% of daily target per 100g" using a generated JSON dataset:

- Source CSVs: `database/FoodList.csv`, `database/NutrientList.csv`, `database/daily requirements.csv`
- Generator: `scripts/build-fooddata.js`
- Output: `src/resource/pregnut_fooddata.v1.json`

The week-by-week time period protocol and citations live in:

- `src/resource/weekly_protocol.v1.json`

## Pages

- `/` Home
- `/app/` Top Foods (Tableau Public embed)
- `/weekly-diet/` Weekly tracker (period-based priorities + ranked foods)
- `/blog/` Blog listing and posts
- `/about/` About + references + disclaimer

