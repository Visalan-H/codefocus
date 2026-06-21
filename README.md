# CodeFocus

A Chrome extension that turns any Codeforces problem page into a proper coding environment. Instead of switching tabs to test your code, you get a split view - problem statement on the left, editor and runner on the right, without ever leaving the page.

---

## What it does

- **Split layout** — the problem statement and your editor sit side by side. Drag the divider to resize either panel. Your preferred split ratio and console height are saved and restored automatically.
- **Real code editor** — Monaco (the same editor that powers VS Code) with syntax highlighting, auto-brackets, and a dark theme.
- **Run against samples** — hit Run (or `Ctrl+'`) and your code is executed against every public sample on the page. Each one gets a ✓ or ✗, and failures show an expected-vs-got diff inline.
- **Submit without leaving** — the Submit button (or `Ctrl+Enter`) fills in Codeforces' own submit form and fires it. No copy-pasting.
- **Remembers your preferences** — language, split ratio, and console height are all persisted across sessions via `chrome.storage.local`.

---

## Installation

> This extension isn't on the Chrome Web Store. You load it directly from the folder.

**Step 1 — Get an API key**

Code execution is powered by [onlinecompiler.io](https://onlinecompiler.io). You need a free account:

1. Sign up at [api.onlinecompiler.io](https://api.onlinecompiler.io)
2. Go to **API Keys** (not Widgets — that's a different key type)
3. Create a key and copy it

**Step 2 — Add your key to the extension**

Create `src/api-key.js` (it's gitignored, so it won't exist after a fresh clone):

```js
export const API_KEY = 'your_key_here';
```

**Step 3 — Load the extension in Chrome**

1. Go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select this folder — the whole thing, including `vs/`
5. Open any `https://codeforces.com/problemset/problem/...` page

> **Reloading after changes:** If you edit any `src/*.js` file, remove the extension and re-add it via Load unpacked. A simple reload button won't clear Chrome's module cache for web-accessible resources and you'll get the old version.

---

## Supported languages

| Language | Compiler used | CF submission ID |
|----------|--------------|-----------------|
| C++17 | `g++-15` | `54` |
| Java | `openjdk-25` | `60` |
| Python 3 | `python-3.14` | `31` |

To add more, extend the `LANGUAGES` object in `src/config.js`. Compiler IDs come from [onlinecompiler.io/docs#compilers](https://onlinecompiler.io/docs#compilers). CF submission IDs come from the `value` attributes on the language `<select>` in CF's submit form.

---

## Known limitations

- **Problemset, contest, and gym** — matches `/problemset/problem/...`, `/contest/.../problem/...`, and `/gym/.../problem/...` URLs.
- **Custom test cases** — add your own via the + button in the Testcase tab. Up to 10 custom cases per session; custom cases don't require an expected output.
- **String diff** — pass/fail is decided by comparing trimmed lines. Special-judge or interactive problems will misfire.
- **Rate limit** — samples run sequentially with an 800 ms pause between them to stay within onlinecompiler.io's rate limits. A large number of samples will be slow.
- **Submit needs a logged-in session** — the Submit button drives CF's own form, so you need to be logged in to CF for it to actually go through.

---

## Tech decisions and implementation notes

### Why Monaco is bundled locally (~4.4 MB)

Monaco is bundled in the `vs/` folder rather than loaded from a CDN. Codeforces runs a strict Content Security Policy that blocks external scripts — any `<script src="https://cdn.jsdelivr.net/...">` would be rejected. The extension's own origin (`chrome-extension://...`) is automatically allowlisted by Chrome, so local files always load cleanly regardless of the page's CSP.

The `vs/` folder is trimmed to only what's needed for the supported languages. Unused workers (`ts.worker`, `css.worker`, `html.worker`, `json.worker`), ~80 unused language grammars, all non-English NLS files, and unused language servers have been stripped from the original Monaco distribution.

### Why content.js injects a `<script>` tag instead of running Monaco directly

Chrome content scripts run in an **isolated world** — they share the page's DOM but have a completely separate JavaScript environment. Monaco needs to run in the **page's main world** to mount an editor into a real DOM node. The solution: `content.js` creates a `<script src="monaco-bootstrap.js">` tag, which Chrome injects into the page world and executes there.

This also sidesteps the CSP `eval` restriction. Monaco's AMD loader uses `eval`-like patterns internally. Running it via a `<script>` tag in the page world avoids triggering the isolated-world CSP entirely.

### How the two worlds talk to each other

Because isolated-world scripts and page-world scripts don't share `window`, everything goes over `window.postMessage`. There are three bridges:

| Message type | Direction | Purpose |
|---|---|---|
| `cfr:mount`, `cfr:get-value`, `cfr:set-language`, etc. | content ↔ monaco-bootstrap | Control the Monaco editor |
| `cfr:run-request` / `cfr:run-response` | runner.js → content.js → background → content.js → runner.js | Execute code via the API |
| `cfr:storage-get` / `cfr:storage-set` / `cfr:storage-response` | layout.js → content.js → chrome.storage → content.js → layout.js | Persist language preference |

Every postMessage uses a `requestId` counter so concurrent requests (e.g. multiple samples running) resolve to the right promise and don't cross-wire.

### Why the API fetch goes through the background service worker

`fetch()` from a content script or page-world module has `https://codeforces.com` as its origin. `api.onlinecompiler.io` doesn't send `Access-Control-Allow-Origin` headers, so the browser blocks it at the preflight stage — even with `host_permissions` in the manifest.

Fetches from the **background service worker** have no web origin at all. Chrome doesn't apply CORS to them. So the flow is:

```
runner.js (page world)
  →  postMessage cfr:run-request
content.js (isolated world)
  →  chrome.runtime.sendMessage
background.js (service worker)
  →  fetch() — no CORS, no origin
  →  sendResponse({ ok, data })
content.js
  →  postMessage cfr:run-response
runner.js
  →  renders pass / fail
```

### Persisted preferences

Five keys are written to `chrome.storage.local`:

| Key | Type | What it stores |
|---|---|---|
| `cfr_enabled` | boolean | Whether the split view is on or off |
| `cfr_lang` | string | Last selected language (`cpp`, `java`, `python`) |
| `cfr_submit` | string | Last submitted code (used to pre-fill the editor on re-open) |
| `cfr_split_w` | number | Left panel width as a percentage (saved on splitter drag-end) |
| `cfr_console_h` | number | Console panel height in px (saved on console resizer drag-end) |

`chrome.storage.local` is only accessible from the isolated world, so reads and writes follow the same postMessage bridge used for everything else — the page world sends a `cfr:storage-get` or `cfr:storage-set` request, `content.js` does the actual storage call, and postMessages the result back. All five keys are read in `buildLayout()` before the DOM is constructed, so the editor, split ratio, and console height are all correct on the first render with no visible reflow.

### Monaco worker filename is hash-pinned

`content.js` hardcodes `vs/assets/editor.worker-Be8ye1pW.js`. This hash is baked into the Monaco 0.55.1 build. If you ever update `vs/` (e.g. by running `npm install monaco-editor` and re-copying `min/vs`), find the new `editor.worker-*.js` under `vs/assets/` and update the path in `content.js`.

### Submit form selectors are best-effort

The Submit button looks for `form[name="submitForm"], form#formSubmit, form[action*="submit"]` and fills in `textarea[name="source"]` and `select[name="programTypeId"]`. These selectors were written without a verified logged-in session. If CF changes their form markup, open DevTools on a problem page, inspect the actual form, and update `wireSubmit()` in `src/submit.js`. If the form can't be found, the button shows a toast and does nothing — you can always submit manually.
