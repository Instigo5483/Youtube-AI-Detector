# YouTube AI & Bot Detector

A Chrome Extension (Manifest V3) that scans YouTube comments in real time and labels them with inline status badges — so you can tell at a glance whether a comment is written by a real person, AI-generated, or posted by a bot.

---

## Features

- **Comment Scanning** — shows `BOT`, `AI`, or `HUMAN` badge next to every comment timestamp
- **3-Stage Detection** — regex bot patterns → trained ML classifier → linguistic fallback, in order
- **Trained Classifier** — TF-IDF + Logistic Regression trained on 222 labeled YouTube comments (CV F1: 95%)
- **Detection Report Panel** — click any badge to open a detailed panel showing exactly how and why the comment was flagged
- **4-Side Dockable Panel** — dock the report panel to the right, left, top, or bottom of the screen (like Chrome DevTools)
- **Probability Bars** — animated AI / Bot / Human probability bars for classifier results
- **Module Toggle** — enable/disable comment scanning from the popup
- **Re-scan Button** — force a fresh scan of the current page
- **Dark theme aware** — badge colours adjust automatically for YouTube's dark UI

---

## Status Badges

| Badge | Colour | Meaning |
|-------|--------|---------|
| `AI` | Orange | Likely AI-generated comment |
| `BOT` | Red | Spam or bot comment detected |
| `HUMAN` | Gray | Appears to be written by a real person |

---

## Detection Logic

Comment analysis runs in three stages, in order:

### Stage 1 — Bot Pattern Matching
If any of these patterns match, the comment is immediately flagged `BOT`:
- Phone number obfuscation (`+91 98XXXXX`)
- WhatsApp / Telegram links
- Crypto / forex investment spam
- Earn-money / passive income claims
- Prize / giveaway scams
- Sub-for-sub / follow-for-follow solicitation
- Shortened URLs (bit.ly, tinyurl, rb.gy …)
- Excessive repeated characters
- DM-harvesting patterns
- Promotional hashtag spam
- Suspicious external links

### Stage 2 — Trained Classifier
Comments that pass Stage 1 are run through a trained ML model (TF-IDF + Logistic Regression) trained on 222 labeled YouTube comments. It outputs a 3-class probability distribution:

| Class | Meaning |
|-------|---------|
| `AI` | Generic praise, perfect grammar, no typos, filler phrases |
| `BOT` | Promotional links, phone numbers, solicitation |
| `HUMAN` | Informal, personal, references specific content |

If the top-class confidence is ≥ 65%, that label is used. The Detection Report panel shows animated probability bars for all three classes.

### Stage 3 — Linguistic Analysis (Fallback)
Used only when the classifier confidence is below 65% (or the model hasn't loaded yet). Scores comments across four dimensions (0–100 each):

| Signal | Weight | High score means… |
|--------|--------|-------------------|
| Burstiness | 30% | Unnaturally uniform sentence lengths |
| Lexical Diversity | 25% | Low vocabulary variety (repetitive words) |
| Filler Phrases | 25% | Generic AI praise patterns |
| Punctuation Uniformity | 20% | Missing punctuation variation |

A combined score ≥ 60 is flagged `AI`; below 60 is `HUMAN`.

Clicking any badge opens the **Detection Report** panel showing which stage flagged the comment and the full evidence breakdown.

---

## Installation (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the project folder
6. Navigate to any YouTube video — badges appear automatically on comments

---

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript (no build step, no external dependencies)
- CSS injected into YouTube's page
- `chrome.storage.local` for settings persistence
- `MutationObserver` + `yt-navigate-finish` for YouTube SPA compatibility
- `WeakMap` for per-badge metadata (no memory leaks)
- `classifier_model.json` — 45 KB TF-IDF + Logistic Regression model (trained with scikit-learn, inferred in pure JS)
- `training/` — labeled dataset (222 comments) and training script (`python train.py`)

---

## License

MIT — see [LICENSE](LICENSE)
