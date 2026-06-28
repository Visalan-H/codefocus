# CodeFocus

A Chrome extension that turns any Codeforces problem page into a proper coding environment. Instead of switching tabs to test your code, you get a split view - problem statement on the left, editor and runner on the right, without ever leaving the page.

<p align="center">
  <a href="https://github.com/Visalan-H/codefocus/archive/refs/heads/main.zip">
    <img src="https://img.shields.io/badge/-⬇%20Download%20CodeFocus-000000?style=for-the-badge&logoColor=white&logo=googlechrome" alt="Download CodeFocus" />
  </a>
</p>

---

## What it does

- **Split layout** — the problem statement and your editor sit side by side. Drag the divider to resize either panel. Your preferred split ratio and console height are saved and restored automatically.
- **Real code editor** — Monaco (the same editor that powers VS Code) with syntax highlighting, auto-brackets, and a dark theme.
- **Run against samples** — hit Run (or `Ctrl+'`) and your code is executed against every public sample on the page. Each one gets a ✓ or ✗, and failures show an expected-vs-got diff inline.
- **Submit without leaving** — the Submit button (or `Ctrl+Enter`) fills in Codeforces' own submit form and fires it. No copy-pasting.
- **Sketch panel** — hit Draw to open a Rough.js-powered scratch canvas per problem. Supports select, text, pen, line, arrow, rect, ellipse, diamond, and triangle tools with undo and per-problem persistence.
- **Remembers your preferences** — language, split ratio, console height, sketch height, and per-problem code are all persisted across sessions via `chrome.storage.local`.

---

## Installation

> This extension isn't on the Chrome Web Store. You load it directly from the folder.

**Step 1 — Load the extension in Chrome**

1. Go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select this folder — the whole thing, including `vs/` and `lib/`
5. Open any `https://codeforces.com/problemset/problem/...` page

**Step 2 — Add your API key**

Click the CodeFocus icon in the Chrome toolbar to open the popup. Paste your compiler API key into the **API Key** field and hit Save.

> **Reloading after changes:** If you edit any `src/*.js` file, remove the extension and re-add it via Load unpacked. A simple reload button won't clear Chrome's module cache for web-accessible resources and you'll get the old version.

---

## Supported languages

| Language | Compiler used | CF submission ID |
|----------|--------------|-----------------|
| C++17 | `g++-15` | `54` |
| Java | `openjdk-25` | `60` |
| Python 3 | `python-3.14` | `31` |

To add more, extend the `LANGUAGES` object in `src/config.js`. CF submission IDs come from the `value` attributes on the language `<select>` in CF's submit form.

---

## Known limitations

- **Problemset, contest, and gym** — matches `/problemset/problem/...`, `/contest/.../problem/...`, and `/gym/.../problem/...` URLs.
- **Custom test cases** — add your own via the + button in the Testcase tab. One custom case at a time; custom cases don't require an expected output.
- **String diff** — pass/fail is decided by comparing trimmed, lowercased lines. Special-judge or interactive problems will misfire.
- **Rate limit** — samples run sequentially with a brief pause between them. A problem with many samples will be slightly slow.
- **Submit needs a logged-in session** — the Submit button drives CF's own form, so you need to be logged in to CF for it to actually go through.

---

## Tech decisions and implementation notes

### Why Monaco is bundled locally

Monaco is bundled in the `vs/` folder rather than loaded from a CDN. Codeforces runs a strict Content Security Policy that blocks external scripts — any `<script src="https://cdn.jsdelivr.net/...">` would be rejected. The extension's own origin (`chrome-extension://...`) is automatically allowlisted by Chrome, so local files always load cleanly regardless of the page's CSP.

The `vs/` folder is trimmed to only what's needed for the supported languages. Unused workers (`ts.worker`, `css.worker`, `html.worker`, `json.worker`), ~80 unused language grammars, all non-English NLS files, and unused language servers have been stripped from the original Monaco distribution.

### Why Rough.js lives in `lib/` not `vs/`

Rough.js is a vendored dependency of the sketch panel — it has nothing to do with Monaco. It previously lived in `vs/` as a side-effect of how the bundle was assembled, but that made the import path fragile (`../vs/rough.js` from inside `src/`). It now lives in `lib/rough.js` and is declared separately in `web_accessible_resources`. If you ever update Rough.js, drop the new build into `lib/` — the import in `src/sketch.js` and the manifest entry don't need to change.

### Why content.js injects a `<script>` tag instead of running Monaco directly

Chrome content scripts run in an **isolated world** — they share the page's DOM but have a completely separate JavaScript environment. Monaco needs to run in the **page's main world** to mount an editor into a real DOM node. The solution: `content.js` creates a `<script src="monaco-bootstrap.js">` tag, which Chrome injects into the page world and executes there.

This also sidesteps the CSP `eval` restriction. Monaco's AMD loader uses `eval`-like patterns internally. Running it via a `<script>` tag in the page world avoids triggering the isolated-world CSP entirely.

### How the two worlds talk to each other

Because isolated-world scripts and page-world scripts don't share `window`, everything goes over `window.postMessage`. There are three bridges:

| Message type | Direction | Purpose |
|---|---|---|
| `cfr:mount`, `cfr:get-value`, `cfr:set-language`, etc. | content ↔ monaco-bootstrap | Control the Monaco editor |
| `cfr:run-request` / `cfr:run-response` | runner.js → content.js → background → content.js → runner.js | Execute code via the API |
| `cfr:storage-get` / `cfr:storage-set` / `cfr:storage-response` | page-world modules → content.js → chrome.storage → content.js → page-world | Persist any key to chrome.storage |

Every postMessage uses a `requestId` counter so concurrent requests (e.g. multiple samples running) resolve to the right promise and don't cross-wire.

### Why the API fetch goes through the background service worker

`fetch()` from a content script or page-world module has `https://codeforces.com` as its origin. The compiler API doesn't send `Access-Control-Allow-Origin` headers, so the browser blocks it at the preflight stage — even with `host_permissions` in the manifest.

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

All keys are written to `chrome.storage.local`. The page-world modules can't access storage directly — reads and writes go through the `cfr:storage-get` / `cfr:storage-set` postMessage bridge in `content.js`.

| Key | Type | What it stores |
|---|---|---|
| `cfr_enabled` | boolean | Whether the split view is on or off |
| `cfr_lang` | string | Last selected language (`cpp`, `java`, `python`) |
| `cfr_submit` | object | Code + language + problem context, read by the submit page to auto-fill CF's submission form |
| `cfr_split_w` | number | Left panel width as a percentage (saved on splitter drag-end) |
| `cfr_console_h` | number | Console panel height in px (saved on console resizer drag-end) |
| `cfr_sketch_h` | number | Sketch panel height in px (saved on sketch resizer drag-end) |
| `cfr_code_<problemId>_<langKey>` | string | Per-problem, per-language editor contents (auto-saved 1 s after last keystroke) |
| `cfr_sketch_<problemId>` | string | JSON-serialised sketch canvas elements for each problem |

Layout preferences and the saved code for the current problem are all read in `buildLayout()` before the DOM is constructed, so panel sizes and editor content are correct on the first render with no visible reflow.

### Monaco worker filename is hash-pinned

`content.js` hardcodes `vs/assets/editor.worker-Be8ye1pW.js`. This hash is baked into the Monaco 0.55.1 build. If you ever update `vs/` (e.g. by running `npm install monaco-editor` and re-copying `min/vs`), find the new `editor.worker-*.js` under `vs/assets/` and update the path in `content.js`.

---

## Module notes

### console.js — Testcase and Test Result panel

`console.js` owns all state and rendering for the bottom console panel. State is module-level (no classes).

**Case object shape:**
```js
{
  input:      string,
  expected:   string | undefined,  // undefined = custom case with no expected output
  custom:     boolean,
  status:     'idle' | 'pending' | 'pass' | 'fail' | 'done',
  actual:     string | undefined,  // raw output or error text from last run
  isError:    boolean,             // true for compiler/runtime errors (not WA)
  errorLabel: string,              // e.g. 'Compilation Error', 'Runtime Error'
}
```

`status` values: `idle` = never run; `pending` = API call in flight; `pass` = output matched expected; `fail` = mismatch or error; `done` = ran fine but no expected output to compare.

**Public API:**

| Export | Called by | Purpose |
|---|---|---|
| `initConsole(samples)` | `buildLayout` | Seeds cases from scraped samples, resets all state, initial render |
| `wireConsoleTabs()` | `buildLayout` | Attaches click listeners to the two tab buttons |
| `getCases()` | `runner.js` | Returns the live cases array so the runner knows what to execute |
| `resetAllStatuses()` | `runner.js` (Run click) | Resets all cases to `idle` before a new run starts |
| `setCaseStatus(i, status, actual?, isError?, label?)` | `runner.js` (per case) | Updates one case after its API call returns, triggers re-render |
| `finishRun(ms)` | `runner.js` (after all cases) | Records total runtime, auto-selects the first failing case in the result tab |
| `showResultTab()` | `runner.js` (Run click) | Switches to the Test Result tab so results appear without manual tab switch |

**Rendering:** all three private render functions (`renderPills`, `renderDetail`, `renderResultPane`) rebuild their section via `innerHTML` from scratch on each call — no diffing. Listeners are re-attached after each rebuild.

The **verdict banner** in the result pane only counts cases that have an expected output. Cases with no expected output don't affect the Accepted / Wrong Answer verdict.

The **side-by-side diff** splits both strings on newlines, renders them in two aligned columns, and highlights mismatched rows with `cfr-diff-side-mismatch`. Pass/fail comparison itself uses `normalize()` from `utils.js` (trim + lowercase per line) so case-insensitive output still passes.

Custom cases are capped at one at a time. Only custom cases show the × remove button; scraped samples can't be removed.
