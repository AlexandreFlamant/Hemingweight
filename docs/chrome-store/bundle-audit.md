# Bundle audit

What to include and exclude when zipping the extension for Chrome Web Store submission.

## Issues to fix before zipping

### Unused popup files
`popup.html`, `popup.js`, `popup.css` are not referenced anywhere — the manifest has no `default_popup` declared, and the action click handler in `background.js` opens a `chrome.windows.create` popup window instead. Options:
- **Recommended:** delete all three files
- Alternative: wire them up by adding `"default_popup": "popup.html"` to `manifest.json`'s `action` block

### Stray privacy.html
`extension/privacy.html` sits inside the bundle but isn't declared in the manifest. Move it out:
- Host the already-existing `site/privacy.html` at a public URL (e.g. `https://hemingweight.vercel.app/privacy`)
- Reference that URL in the Chrome Web Store dashboard's "Privacy policy" field
- Delete `extension/privacy.html`

### The `key` field
`manifest.json` contains a `"key"` that pins the local dev extension ID. Check whether `install-remote.sh` or the native messaging host manifest hardcodes that ID:
- **If yes** — keep the key (removing it would change the extension ID and break native messaging for anyone who installed via your script)
- **If no** — remove the key before zipping so the store issues a fresh ID

## What the ZIP should contain

After cleanup, the zip should have:

```
manifest.json
background.js
sidepanel.html
sidepanel.js
icon16.png
icon48.png
icon128.png
```

That's it. 7 files.

## What NOT to include

- `.DS_Store`, `.git`, any dotfiles
- Source maps
- `popup.*` (unless wired up)
- `privacy.html` (host separately)
- README/docs
