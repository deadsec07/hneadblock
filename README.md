# Hne Ad Tools — YouTube™ Ad Blocker

Two simple modes to tame YouTube preroll ads:

- **Stealth** — mutes the player and auto-clicks “Skip Ad” when available (minimal footprint).
- **Aggressive** — blocks known ad endpoints (IMA/VMAP) and fast-forwards any ad that leaks.

Lightweight popup, tiny “Skipping ads…” toast (so users know it’s working), and a blocked-ads counter.  
**No data collection. Runs only on YouTube domains.**

---

## Features

- 🔇 **Stealth mode**: mute + auto-skip; keeps behavior human-like.
- 🚫 **Aggressive mode**: DNR rules stub IMA and return empty VMAP; blitz any stray ads.
- ✅ **Blocked counter** on the toolbar badge and in the popup.
- 📝 **Tiny corner toast** (“Skipping ads…”) during short black-screen waits.
- 🔒 **Privacy-friendly**: no telemetry, no remote code, no personal data.

---

## Install (Load Unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder (the one containing `manifest.json`)

---

## Pack ZIP (for store upload)

**macOS/Linux**
```bash
zip -r dist/hne-1.0.0.zip . \
  -x "*/.git/*" "*/node_modules/*" "*.DS_Store" "dist/*" \
  "metadata/*" "_metadata/*"

