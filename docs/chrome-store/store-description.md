# Store listing copy

Text to paste into the Chrome Web Store dashboard.

## Short description (≤132 characters)

> Browser-based AI coding environment. Describe what you want in plain English — Claude writes the code and shows you the result, live.

## Detailed description

> Hemingweight is an open-source, local-first coding environment that runs in your browser. Type what you want to build — a landing page, a Chrome extension, a tool — and an AI coding agent writes the code, builds the files, and shows you the result with a live preview.
>
> **How it works**
> - Install the local helper app on your Mac (one-time, takes about a minute)
> - Click the Hemingweight icon in Chrome — the app opens in a dedicated window
> - Type what you want. Watch it get built.
>
> **Features**
> - Live preview of what you're building
> - Built-in code viewer with syntax highlighting
> - Git integration (commit, push, history)
> - CLAUDE.md project memory
> - Bring your own model — Claude available today; OpenAI, Mistral, and Gemini coming soon
>
> **Local-first & private**
> Everything runs on your machine. Your code never touches our servers. You use your own AI provider account and pay them directly.
>
> **Requires**
> - macOS (Windows/Linux coming soon)
> - A Claude account (Claude Max recommended for unlimited usage)
>
> Open source on GitHub: https://github.com/AlexandreFlamant/Hemingweight

## Single-purpose statement

> Hemingweight provides an AI-powered coding assistant that runs locally on the user's machine. The extension's single purpose is to launch and host the UI for this local coding environment.

## Permission justifications

### `nativeMessaging`
> Used exclusively to launch the Hemingweight local helper (`com.hemingweight.server`) when the user clicks the extension icon. The extension sends a single "start" message; no other data is transmitted through native messaging.

### `sidePanel`
> Registers a side panel as an alternate UI surface for the Hemingweight app. Currently the primary UI opens in a popup window; the side panel is reserved for future use.

## Data handling disclosures

For the privacy form, all checkboxes should be **No**:

- [ ] Does not collect personally identifiable information
- [ ] Does not collect health information
- [ ] Does not collect financial and payment information
- [ ] Does not collect authentication information
- [ ] Does not collect personal communications
- [ ] Does not collect location data
- [ ] Does not collect web history
- [ ] Does not collect user activity
- [ ] Does not collect website content

Certifications:
- [x] I do not sell or transfer user data to third parties
- [x] I do not use or transfer user data for purposes unrelated to the item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes
