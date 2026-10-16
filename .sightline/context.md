# pregnut.com SEO context
Updated: 2026-10-16

> Inferred from the live site and repo (README, DESIGN.md, docs/seo-content-plan.md, search-console-refresh.md) by an SEO agent. **Inferred, unconfirmed by owner.** Correct anything that is wrong.

## Business
PregNut is a free, static pregnancy-nutrition site: a week-by-week guide, "Top Foods" rankings per nutrient (% of a pregnancy reference amount per 100 g, from a fixed USDA snapshot), ~1,270 food pages, and an evidence-first blog on nutrients and food safety. English, US-oriented (NIH/ACOG/CDC references), online only; no products sold.

## Goal
Inferred: grow qualified organic and AI-answer traffic for pregnancy nutrition and food-safety questions ("can I eat X while pregnant", "what nutrients are important during pregnancy").

## Audience
Pregnant people and partners checking whether a food is safe, which nutrients matter at their stage, and which foods are richest in them.

## Competitors
- Not asked. The site's own rank checks reference ACOG, NCCIH and NIDDK; the big consumer sites (e.g. Healthline, BabyCenter, What to Expect) are likely SERP competitors.

## Key pages
- https://pregnut.com/ (hub): home, nutrient library
- https://pregnut.com/weekly-diet/ and /weekly-guide/<period>/ (hub): stage-by-stage guides
- https://pregnut.com/app/ (hub): Top Foods rankings
- https://pregnut.com/food/ and /food/<id>-<slug>/ (support): food lookup pages
- https://pregnut.com/blog/ and /blog/<slug>/ (support): food-safety and nutrient Q&A posts (top Search Console pages: sprouts, eggs, ginger, caffeine, juice, fiber)

## Writing rules
- Evidence first: every claim cites NIH/ACOG/CDC-type sources; nutrient values come only from the dataset. Never invent claims, amounts or dates.
- Calm, non-alarmist tone; "ask your care team" framing. Preserve the design system in DESIGN.md.

## Research log
- 2026-10-15 technical pass (PR #20): titles ≤60 chars, one long meta description trimmed. Score 96 → 96.
- 2026-10-16 audit: https://pregnut.com/ (pages=3, probe=1) + crawl max=50. Score 96; crawl clean (50 URLs, 0 broken, 0 duplicates, 0 orphans, 1 H1 each). Keywords (seeds: pregnancy nutrients / week by week): "most important nutrients during pregnancy" (10), "what nutrients are important during pregnancy" (8), "why is iron/folic acid/choline important during pregnancy". Verdict: no access blockers; pass 1 added pages.dev noindex, fixed the Top Foods heading level and the weekly-diet "Loading…" H2, and phrased the home nutrient heading as that question.
