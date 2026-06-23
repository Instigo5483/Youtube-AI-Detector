# YouTube AI & Bot Detector

A Chrome Extension (Manifest V3) that scans YouTube in real time and labels videos, Shorts, and comments with inline status badges — so you can tell at a glance whether content is human-made or AI-generated, and whether a comment is written by a real person or a bot.

---

## Features

- **Watch Page** — shows `OK` or `AI` badge inline next to the video title
- **Shorts** — shows `OK` or `AI` badge next to the Subscribe button in the channel bar
- **Comments** — shows `BOT`, `AI`, or `HUMAN` badge next to every comment timestamp
- **Flagged Channels** — manually flag any channel to always mark it as `AI`
- **Module Toggles** — enable/disable Comments, Videos, and Shorts scanning independently
- **Re-scan Button** — force a fresh scan of the current page from the popup
- **Dark theme aware** — badge colours adjust automatically for YouTube's dark UI

---

## Status Badges

| Badge | Colour | Meaning |
|-------|--------|---------|
| `OK` | Green | Appears to be human-made content |
| `AI` | Orange | Likely AI-generated content |
| `BOT` | Red | Spam or bot comment detected |
| `HUMAN` | Gray | Appears to be written by a real person |

---

## Detection Logic

### Comments
Each comment is scored against two pattern sets:

**BOT** (any 1 match):
- Phone number obfuscation (`+91 98XXXXX`)
- WhatsApp / Telegram links
- Crypto / forex investment spam
- Earn-money / passive income claims
- Prize / giveaway scams
- Sub-for-sub / follow-for-follow
- Shortened URLs (bit.ly, tinyurl, rb.gy …)
- Excessive repeated characters
- DM-harvesting patterns

**AI** (2 or more matches):
- Generic template praise ("great video very informative")
- "Keep up the great work"
- "Well-explained / well-presented"
- "Looking forward to more content"
- "I really enjoyed / appreciated this"
- "This is exactly what I needed"
- "I learned a lot from this" … and more

**HUMAN**: everything else (including slang, mixed languages, personal references).

### Videos & Shorts
Checks the video title and channel name against:
- AI tool keywords: `midjourney`, `stable diffusion`, `sora`, `runway ml`, `pika labs`, `kling ai`, `dall-e`, `veo 2`, `ai generated`, `text to video`, `ai voice`, `ai narrator` …
- AI channel keywords: `ai animation`, `ai studio`, `ai shorts`, `ai films` …
- Manually flagged channels (set via popup)

---

## Installation (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the project folder
6. Navigate to YouTube — badges will appear automatically

---

## Roadmap

- [ ] Connect to a dedicated AI backend API for deeper analysis
- [ ] Analyse full channel history (upload frequency, content patterns)
- [ ] Confidence scores instead of binary labels
- [ ] User feedback / reporting to improve detection accuracy
- [ ] Firefox support (MV3)

---

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript (no build step)
- CSS injected into YouTube's page
- `chrome.storage.local` for settings persistence
- `MutationObserver` + `yt-navigate-finish` for YouTube SPA compatibility

---

## License

MIT — see [LICENSE](LICENSE)
