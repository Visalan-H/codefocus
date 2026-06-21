# Code Focus

A Chrome extension that turns any Codeforces problem page into a proper coding environment. Instead of switching tabs to test your code, you get a split view — problem statement on the left, editor and runner on the right — without ever leaving the page.

---

## What it does

- **Split layout** — the problem statement and your editor sit side by side. Drag the divider to resize either panel.
- **Real code editor** — Monaco (the same editor that powers VS Code) with syntax highlighting, auto-brackets, and a dark theme.
- **Run against samples** — hit Run (or `Ctrl+'`) and your code is executed against every public sample on the page. Each one gets a ✓ or ✗, and failures show an expected-vs-got diff inline.
- **Submit without leaving** — the Submit button (or `Ctrl+Enter`) fills in Codeforces' own submit form and fires it. No copy-pasting.
- **Remembers your language** — whichever language you picked last (C++17, Python3, or Java) is restored the next time you open a problem.

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
| Python 3 | `python-3.14` | `31` |
| Java | `openjdk-25` | `60` |

To add more, extend the `LANGUAGES` object in `src/config.js`. Compiler IDs come from [onlinecompiler.io/docs#compilers](https://onlinecompiler.io/docs#compilers). CF submission IDs come from the `value` attributes on the language `<select>` in CF's submit form.

---

## Known limitations

- **Problemset, contest, and gym** — matches `/problemset/problem/...`, `/contest/.../problem/...`, and `/gym/.../problem/...` URLs.
- **Custom test cases** — add your own via the + button in the Testcase tab. Custom cases don't require an expected output.
- **String diff** — pass/fail is decided by comparing trimmed lines. Special-judge or interactive problems will misfire.
- **Submit needs a logged-in session** — the Submit button drives CF's own form, so you need to be logged in to CF for it to actually go through.

---

## Tech decisions and implementation notes

### Why Monaco is bundled locally (~16 MB)

Monaco is bundled in the `vs/` folder rather than loaded from a CDN. Codeforces runs a strict Content Security Policy that blocks external scripts — any `<script src="https://cdn.jsdelivr.net/...">` would be rejected. The extension's own origin (`chrome-extension://...`) is automatically allowlisted by Chrome, so local files always load cleanly regardless of the page's CSP.

The `vs/` folder is large because Monaco ships syntax support for dozens of languages. Trimming it down to just C++/Python/Java is a stretch goal.

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

### Language preference storage

`chrome.storage.local` is also only accessible from the isolated world, so it follows the same pattern — page world postMessages a get/set request, `content.js` does the actual `chrome.storage` call and postMessages the result back. The preference is loaded in `buildLayout()` before the DOM is built, so the `<select>` starts on the right value and the editor mounts with the correct language and template on the first render.

### Monaco worker filename is hash-pinned

`content.js` hardcodes `vs/assets/editor.worker-Be8ye1pW.js`. This hash is baked into the Monaco 0.55.1 build. If you ever update `vs/` (e.g. by running `npm install monaco-editor` and re-copying `min/vs`), find the new `editor.worker-*.js` under `vs/assets/` and update the path in `content.js`.

### Submit form selectors are best-effort

The Submit button looks for `form[name="submitForm"], form#formSubmit, form[action*="submit"]` and fills in `textarea[name="source"]` and `select[name="programTypeId"]`. These selectors were written without a verified logged-in session. If CF changes their form markup, open DevTools on a problem page, inspect the actual form, and update `wireSubmit()` in `src/submit.js`. If the form can't be found, the button shows a toast and does nothing — you can always submit manually.
