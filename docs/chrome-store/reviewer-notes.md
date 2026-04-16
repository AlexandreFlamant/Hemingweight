# Reviewer notes

Paste this into the "Notes to reviewer" field on the Chrome Web Store submission form.

---

Hemingweight is a companion UI for a local coding environment. The extension itself is a thin shell — it opens a window pointing to `http://localhost:3456`, which is served by a small Node.js helper app the user installs separately on their machine.

**How to test:** the full flow requires running our install script (`curl -fsSL https://raw.githubusercontent.com/AlexandreFlamant/Hemingweight/main/install-remote.sh | bash`), which installs the local server and a native messaging host. We understand reviewers can't run this, so:

- A recorded walkthrough is available at [YOUR VIDEO URL]
- Without the local server, clicking the extension icon shows a clear error message ("Could not start server") — this is expected behaviour, not a bug
- Full install docs: https://github.com/AlexandreFlamant/Hemingweight/blob/main/TESTING-INSTALL.md

**Permissions:**

- `nativeMessaging` — used only to launch our local helper (`com.hemingweight.server`) when the user clicks the extension icon. No other messages are sent.
- `sidePanel` — registered but currently hidden; the primary UI opens in a popup window.

**Data handling:** the extension does not collect, transmit, or store any user data. All code written by the user stays on their machine. No analytics, no telemetry.

---

## TODO before submitting

- [ ] Record walkthrough video, upload to YouTube/Loom, replace `[YOUR VIDEO URL]` above
