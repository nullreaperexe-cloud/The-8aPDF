# 8aPDF AI Finder — Offline Training & Retrieval Playbook
Version: 1 | Updated: 2026-10-29 | Primary language: Hinglish, English, Hindi, Punjabi

> **Important:** This file is a *search-training rulebook*, not a fine-tuned Groq model. Merely storing text in Markdown cannot train an LLM. The working implementation uses these deterministic query-intent and synonym rules in the instant browser-side ranker, with the compact runtime vocabulary mirrored in `data/ai-finder-training.json`. Both are versioned in this repository. No GitHub Action or Groq API call is needed to train/search these rules.

## Non-negotiable retrieval contract

1. **Never invent PDFs, announcements, dates, subjects, chapter numbers, hyperlinks or PDF contents.** Every result must map to an exact currently loaded, published catalogue record ID.
2. **Local first:** Search the already-loaded Supabase materials and announcements arrays in-browser. No network request is made on a normal search. Background loading of the compact rule file must never block user interactions.
3. **Zero Groq credits for ordinary Finder lookups.** Preserve optional server-side Groq only for ambiguous, unsupported natural-language questions after local rules have run; do not automatically query Groq merely to re-rank a perfectly adequate local result.
4. **Do not confuse a teacher-message publication date with an event/test date.** Only an explicitly stated event date counts as an upcoming test date.
5. **Never cross subjects or chapters to manufacture a result.** `Science chapter 3` must not return Mathematics chapter 3 or Science chapter 2.
6. **PDFs and teacher announcements are separate types.** For explicit homework/submission/test/circular requests prefer announcements; for PDFs/notes/worksheets prefer study materials; for unspecified subjects consider both.
7. Search title, subject, chapter, category, description, and loaded message text. Title and exact chapter should score much more highly than a weak description mention.
8. For requests like `latest PDFs` or `latest teacher announcements`, return the most recent *relevant* records by upload/message date, not fuzzy text accidents.
9. A `notebook submission` is NOT a random `homework` message. A `test` is NOT an unrelated message mentioning homework. Distinguish the requested action from category labels.
10. A document tagged `Other`, `General`, `Circular`, or `School Diary` should not be excluded solely because its subject metadata is missing; accept it only if title or description explicitly proves the requested subject.
11. Do not treat `term 1` and `term 2` as equivalent; filter only on the existing recorded term field and be transparent if it is unavailable.
12. A student's name in a source title is not a topic synonym. Never create new people, grades or names when enriching metadata.
13. No actual PDF full text is available unless a separate PDF reader extracts it. Finder only searches published catalogue metadata, not hidden PDF body text.
14. If no credible match exists, say so and suggest a more specific subject, chapter, or topic. Silence is better than misleading results.
15. Protect all credentials: no API keys in HTML, train.md, user-visible JSON, logs, source prompts, or browser localStorage.

## Multilingual and typo normalization

- Normalize Unicode (NFKC), whitespace, punctuation, case and compact chapters: `ch3`, `ch 3`, `chap 3`, `chapter 3` => `chapter 3`.
- `math`, `mathematics`, `ganit`, `गणित` => Maths subject.
- `sst`, `social studies`, `history`, `geography`, `civics` => Social Science subject.
- `vigyan`, `physics`, `chemistry`, `biology` => Science subject, **but keep original topic token** for ranking.
- `हिंदी`, `हिन्दी`, `hindi` => Hindi subject; `ਪੰਜਾਬੀ`, `punjabi` => Punjabi subject.
- `qna`, `qa`, `question answers`, `ques ans`, `solutions` => Q&A intent.
- `copy checking`, `notebook submission`, `bring your notebook` => submission intent when there is supporting evidence.
- Ignore chatter such as `bhai`, `please`, `mujhe`, `dikhao`, `can you`, `which`, `coming`, `kab`, `kal`. Do **not** ignore important content words (subject/topic/event).
- Synonyms are candidate boosters, **never evidence that a non-existent document exists**.

## Search intent labels

| User request | Source | Hard requirements | Preferred order |
|---|---|---|---|
| `Science chapter 3 PDF` | PDFs | Science + explicit chapter 3 | Exact title/chapter, newest tie-break |
| `Chapter 3 force notes` | PDFs | Chapter 3 + force where available | Notes > generic file |
| `Maths ch5 worksheet` | PDFs | Maths + chapter 5 | Worksheet > generic PDF |
| `Hindi term 2` | PDFs | Hindi + stored term 2 | Relevant title/date |
| `latest PDF` | PDFs | Published source | Upload date descending |
| `latest announcements` | Announcements | Published source | Message date descending |
| `upcoming test` | Announcements | Explicit test/exam in text | Confirmed event date first |
| `English notebook submission` | Announcements | English + submission/bring notebook | Relevant announcement |
| `Science homework` | Announcements | Science + actual homework reference | Best matched date |
| `school holiday` | Announcements | Explicit holiday/closure | Date then relevance |
| `aaj ka teacher message` | Announcements | Most recent messages | Message date |
| `HTML practical PDF` | PDFs | Computer/HTML practical metadata if present | Exact title/topic |

## False-positive prevention

- `Science chapter 3` ≠ `Maths chapter 3`.
- `Science chapter 3` ≠ `Science chapter 2`.
- `term 2` ≠ `term 1`.
- `test` ≠ ordinary `homework`.
- `submission` ≠ any unrelated School Diary item.
- `notes` should outrank `practice` if both contain the same exact chapter; do not remove practice if notes are unavailable.
- `latest` is not permission to return older, unrelated subject results.
- `when is the test` may list an identified announcement, but do not claim a test date inferred only from `messageDate`.
- Never include a teacher announcement card under PDFs solely because its body mentions "PDF".

## Candidate scoring (cheap O(N) browser operation)

1. Reject invalid IDs/titles, conflicting known subjects, conflicting explicit chapters/terms, and incompatible notice types.
2. Reward exact subject, chapter, relevant title tokens, explicitly requested format (notes/worksheet/Q&A/practical), description tokens, and the exact stored metadata fields.
3. The ranker's default vocabulary is built into JavaScript so the first search never waits for files or API calls.
4. The smaller `data/ai-finder-training.json` is an optional, async, cacheable extra synonym vocabulary derived from this playbook. Its per-ID `items` may remain empty: the ranker extracts current metadata live, so newly uploaded records work without any refresh/training.
5. Sort by relevance first; for explicitly latest requests sort by relevant date first; then break ties by title.
6. Return a small number of actual cards (up to six PDFs and four announcements); include Preview/Download and View Teacher Messages controls already provided by 8aPDF.
7. Reuse loaded arrays; no embeddings, database migrations, external vector DB, expensive re-indexing or Groq call per query.

## Groq-only optional answer policy

- Default cost: **0 Groq tokens per normal search**.
- If explicitly using optional AI fallback, send at most the already shortlisted metadata records, never all PDF bytes. Groq must return verified source IDs; reject invented IDs. Use the server-held `GROQ_API_KEY` (Vercel environment, not GitHub Actions).
- No scheduled Groq batches, no training retries, no daily Actions billing, and no Gemini backend for Finder.
- A 404 from the old training run signifies the API request was rejected; it does not demonstrate that 187 records were trained. Replacing it with this offline rulebook removes that failing dependency.

## Regression prompts (examples; **not** fabricated source results)

| Prompt | Expected behavior |
|---|---|
| `Science ch 3 notes` | Exact Science chapter 3; notes ranked before practice |
| `science chapter 2` | No chapter 3 collisions |
| `maths ch5 worksheet` | Mathematics chapter 5 worksheet only |
| `Physics Chapter 12` | No made-up results |
| `hindi chapter 3 term 1` | Only Hindi term 1 chapter 3 |
| `Computer HTML programs` | Match documented HTML/program metadata |
| `Latest PDF` | Top PDFs sorted newest first |
| `Latest teacher announcements` | Real newest teacher messages |
| `Which test is coming next?` | Only confirmed test announcements; never assert unsupported event dates |
| `English notebook submission` | Submission-specific English notice |
| `Science homework` | Real homework, not just a test notice |
| `School holiday circular` | Actual holiday/circular messages |
| `Show me biology chapter 3` | Science subject + biology keyword where supported |
| `Give me French revision` | French sources ranked using revision aliases |
| `कक्षा ३ विज्ञान` | Match only if the actual chapter/subject can be determined; no inventions |

## Maintenance

When new student phrases are observed, add grounded aliases to this playbook AND the compact runtime JSON (or the in-browser default vocabulary). Add a regression assertion to `tests/ai-finder-quality.test.cjs`. Do not use GitHub Actions for Groq-based training. Standard repository CI tests can remain, but they do not spend AI credits. Changes to this file alone do not fine-tune a model.
