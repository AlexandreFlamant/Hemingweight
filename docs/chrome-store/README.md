# Chrome Web Store submission

Working docs for getting Hemingweight accepted on the Chrome Web Store.

## Files

- [`bundle-audit.md`](./bundle-audit.md) — what to include/exclude when zipping the extension
- [`reviewer-notes.md`](./reviewer-notes.md) — text to paste into the "notes to reviewer" field during submission
- [`store-description.md`](./store-description.md) — short + detailed listing copy, permission justifications

## Pre-submission checklist

**Blockers**
- [ ] Decide how reviewers will test (demo mode in the sidepanel, or a walkthrough video linked in reviewer notes)
- [ ] Clean the extension bundle (see `bundle-audit.md`)
- [ ] Host `site/privacy.html` at a public URL (e.g. `https://hemingweight.vercel.app/privacy`)

**Store listing assets**
- [ ] Screenshots — 1280×800 or 640×400, 1–5 required. Check dimensions of `site/screenshot.png`
- [ ] Small promo tile — 440×280 (recommended)
- [ ] Marquee promo tile — 1400×560 (optional but helps featured placement)
- [ ] Category + language picked in the dashboard

**Policy / forms**
- [ ] Privacy policy URL filled in
- [ ] Single-purpose statement: "AI coding assistant in a side panel"
- [ ] Permission justifications for `nativeMessaging` and `sidePanel` (copy from `reviewer-notes.md`)
- [ ] Data handling disclosures (we collect nothing → all "No" boxes)
- [ ] Certified compliance with Developer Program Policies

**Account**
- [ ] Chrome Web Store developer account ($5 one-time fee)
- [ ] ZIP the cleaned `extension/` folder and upload
