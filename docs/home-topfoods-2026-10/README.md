# Home and Top Foods, October 2026

What changed on `/` and `/app/`, why, and how it was measured. Images in this folder compare the same widths before and after.

## Jobs

- **Home:** within 10 seconds a pregnant visitor knows PregNut tells her what to eat for her week, and is one tap from the weekly guide, the calculator, or a food.
- **Top Foods:** pick a nutrient and see, at a glance, the everyday foods that give the most of it in a normal serving, so one can go on today's plate.

## Element inventory

### Home

| Element | Reason it exists | Decision |
|---|---|---|
| H1 "Pregnancy nutrition, week by week." | The promise | Keep |
| Lede "Clear, source-linked food guidance…" | The trust claim the H1 can't carry | Keep |
| Two hero buttons | The two main jobs | Keep |
| Food gallery (9 foods, captions) | Shows the subject is real food; each opens its food page | Keep |
| Sticky phone CTA | Thumb-reach path once the hero scrolls away | Keep |
| H2 "Start with your week—or what's on your plate." | None; restates the hero buttons | Cut |
| "Search" heading in the search card | None; the field says what it is | Cut |
| "Every value is per 100 g. See what 100 g looks like." | Not needed to search | Cut |
| Search field | Name lookup is a core job; phones have no header search | Keep, restyled |
| Daily Fit preview (old tabs and stat cards) | Misrepresented the redesigned calculator | Replaced with the real half-circle |
| "Check today's nutrients ↗", "Open Top Foods ↗", "Open Weekly Guide ↗" | Each restated its card title | Cut; each card is one link |
| Top Foods and Weekly Guide previews | Show the product instead of describing it | Keep |
| H2 "What nutrients are important during pregnancy?" | The question people search | Keep |
| "Daily reference amounts… Browse all guides" | Explains the numbers on the cards | First sentence kept; link cut (every card links its guide) |
| Food-safety link run (8 links) | Unrelated to the cards beside it | Cut |
| "Reference amount" label on all 14 cards | Eyebrow; the line above already says so | Cut |
| Nutrient card: name, icon, amount, role, guide link | The reference itself | Keep |
| Desktop title index beside the deck | Shows position in 14 cards | Keep (hidden when the deck is static) |
| Closer H2 and two buttons | Ends on the two jobs | Keep |
| Closer paragraph | Restated the buttons | Cut |

### Top Foods

| Element | Reason it exists | Decision |
|---|---|---|
| H1 | Page topic and search query | Keep, without "per 100 g" |
| Lede "Choose a nutrient and compare equal weights…" | Instructions for self-evident controls | Cut |
| 13 nutrient chips, alphabetical | Core control | Keep, ordered by pregnancy importance as in Daily Fit |
| Processed / Natural toggle, default Processed | Default led with sweets, bars and malt powder | Fixed: "Whole foods / All foods", default whole foods |
| Summary line | The one line that makes the bars readable | Keep, now per serving |
| 16 food-group cards × 5 foods (≈10,500 px on phones) | Breadth, but buried the answer | Replaced with one ranked list of 12, at most 2 per kind |
| "Covers most of a day" on each group's first row | Repeated the bar in words | Cut |
| Footnote paragraph | Source and method | Kept as one line |
| "Start with familiar foods" (images rendered empty) | Duplicated the list; broken | Cut |
| "Understand the nutrients…", 13 guide pills, iodine note | 13 links for one question | Replaced with one link for the selected nutrient |

## One system

Tokens in `src/style/style.css`, used by `home.css` and `top-foods.css` and nothing else:

- **Type:** Gloock for display, Funnel Sans for text and numbers. Steps `--fs-xs` (0.78rem) to `--fs-3xl` (fluid to 6.4rem), about 1.25 apart on phones and 1.33 on desktop.
- **Space:** a 4/8 grid, `--s-1` (4px) to `--s-10` (144px).
- **Radius:** `--r-sm` 14px, `--r-md` 22px, `--r-lg` 32px, `--r-pill`.
- **Motion:** `--ease-out` and `--ease-spring`; `--dur-1` 160ms, `--dur-2` 280ms, `--dur-3` 560ms. Everything stops under reduced motion.

`home.css` was rewritten from scratch against these: 34 KB of stacked overrides, including dead hero-visual, float-card and old-deck rules, became 16 KB. Top Foods now loads one 8 KB stylesheet instead of three totalling 33 KB.

## Honest rankings

Per 100 g, calcium among whole foods was eight cheeses led by parmesan; in the old default "Processed" view it was sesame crunch, malt powder and Luna bars. Neither answers "what should I eat?".

- **Per serving.** Each food is ranked by one typical serving, using the FDA reference amount for its category (21 CFR 101.12): 3 oz cooked fish or meat, 1 oz cheese, 1 cup milk, 6 oz yogurt, ½ cup cooked beans, and so on. See `scripts/food-serving.js`.
- **Whole foods by food group.** The `natSource` flag marked 29 of 31 nut and seed foods and 10 of 11 grains as processed, so "Natural" hid almonds and rice. "Whole foods" now means the whole-food USDA groups, minus treats, supplements and dry ingredients.
- **Variety without distortion.** At most two of each kind (salmon, egg). A cap per food group was tried and dropped: it pushed chicken (11%) into the DHA list above sardines and trout.
- **Result, folate:** edamame, cowpeas, enriched pasta, spinach, lentils and beans. **DHA:** salmon, mackerel, shad, herring, tuna, anchovy, sardines. **Calcium:** milk, buttermilk, yogurt, tofu, cheese, soymilk.

## Measurements

Local production build served with compression; Lighthouse medians of three runs; axe-core with WCAG 2.1 A and AA tags (which include colour contrast) at 390 and 1440 px.

| Page | Mode | Perf | A11y | BP | SEO | LCP | CLS | TBT | Weight |
|---|---|---|---|---|---|---|---|---|---|
| Home, before | mobile | 98 | 100 | 100 | 100 | 2.41 s | 0 | 0 ms | 311 KB |
| Home, after | mobile | 98 | 100 | 100 | 100 | 2.41 s | 0 | 0 ms | 286 KB |
| Home, before | desktop | 100 | 100 | 100 | 100 | 0.53 s | 0 | 0 ms | 1,167 KB |
| Home, after | desktop | 100 | 100 | 100 | 100 | 0.56 s | 0 | 0 ms | 374 KB |
| Top Foods, before | mobile | 99 | 100 | 100 | 100 | 2.19 s | 0 | 12 ms | 868 KB |
| Top Foods, after | mobile | 100 | 100 | 100 | 100 | 1.89 s | 0 | 0 ms | 227 KB |
| Top Foods, before | desktop | 100 | 100 | 100 | 100 | 0.75 s | 0 | 0 ms | 868 KB |
| Top Foods, after | desktop | 100 | 100 | 100 | 100 | 0.48 s | 0 | 0 ms | 227 KB |

| Check | Before | After |
|---|---|---|
| axe violations, both pages | 1 serious (header names didn't match visible text) | 0 |
| Home height on a phone | 9,549 px | 7,420 px |
| Top Foods height on a phone | 10,500 px | 2,308 px |
| Foods fully visible at 1280×720 | 1 | 5 |
| Foods fully visible at 390×844 | 0 (lede and controls first) | 4 |
| Horizontal scroll at 390, 820, 1280, 1440 | none | none |

Weight savings: nutrient icons became 160 px WebP (930 KB to 136 KB for all 14); Top Foods fetches a 107 KB precomputed ranking instead of the 827 KB food database; no stray italic or display font downloads.

## Against the Awwwards criteria

Awwwards' own judging page couldn't be loaded from the build environment, so the weights come from secondary sources that agree on Design 40%, Usability 30%, Creativity 20%, Content 10%. Recent winners couldn't be loaded for a side-by-side either. This is a self-assessment, not a jury score.

| Criterion | Score | Where it stands | Where it falls short |
|---|---|---|---|
| Design (40%) | 7.5 | One type pairing, one spacing and radius scale; editorial ranks; cut-out food photography | The centred hero is a familiar layout; no single art-directed moment that only PregNut has |
| Usability (30%) | 8.5 | Lighthouse 98–100, axe 0, CLS 0; answers above the fold; one control row | Nutrient chips scroll sideways on phones with no visible cue; Top Foods has no way to find one food's rank |
| Creativity (20%) | 6.5 | The scroll-driven nutrient deck and the half-circle are distinctive | Top Foods is a well-made list, not a memorable interaction |
| Content (10%) | 8 | Rankings per real serving, sources cited, no filler | USDA-style names ("Cowpeas, common, boiled") read clinical |
| **Weighted** | **7.65** | | |

## What only people can verify

### Five-user test

Five pregnant participants, any trimester, on their own phones, thinking aloud. Record task success, time, and a 1–7 ease rating after each task.

1. **Five-second test.** Show the home page for five seconds, then hide it: "What is this site for?" Pass: mentions food or nutrition in pregnancy.
2. "You're 20 weeks along. Find what to focus on eating this week." Pass: reaches the week 20 guide within 60 s.
3. "Find the best everyday food for iron." Pass: names the first food on Top Foods' iron list.
4. "You had two eggs and toast for breakfast. How much of today's choline is that?" Pass: adds both in Daily Fit and reads the choline figure.
5. "How much folate do you need each day?" Pass: finds 600 mcg on the home cards or Top Foods.
6. "Is soft cheese safe to eat?" Pass: reaches the soft-cheese guide or a cheese food page's safety note.

Watch for: whether "Whole foods / All foods" is understood, whether the sideways chip row is found on phones, and whether "per serving" is noticed.

### Analytics to watch (GA4, consented visitors)

The site has no custom events yet. Worth adding and watching for four weeks after release:

- `home_tool_click` with `tool` (daily_fit, top_foods, weekly_guide), plus the hero buttons: share of home visits that reach a tool.
- `home_search_submit`: name lookups from home.
- `topfoods_nutrient_change` with `nutrient`: which nutrients people actually look up.
- `topfoods_source_change` with `source`: whether anyone wants "All foods".
- `topfoods_food_click` with `nutrient` and `rank`: whether the top three earn the clicks.
- `topfoods_guide_click` with `nutrient`.
- Built-in: engagement rate and scroll depth on `/` and `/app/`, before against after.
