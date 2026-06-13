# Dogfooding guide — position persistence (Epic 2 / Milestone M2)

The anchoring engine is validated automatically against fixtures (M1, 100%). But
"does it _feel_ right on the live web" can only be answered by using it daily.
This is the acceptance step for Epic 2.

**Exit criterion (M2):** two weeks of daily use across 50+ distinct real sites,
with a perceived-correct restoration rate that feels trustworthy and **zero
incidents of stolen scroll** (the extension moving the page while you were
reading or after you took control).

---

## 1. Install the build

```sh
pnpm install
pnpm --filter @reader-mode/extension build
```

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select `packages/extension/dist`
4. Pin the extension so the popup is one click away

For active iteration use the dev server instead — CRXJS hot-reloads on save:

```sh
pnpm --filter @reader-mode/extension dev
```

Load `packages/extension/dist` the same way; it rebuilds as you edit. After
changing the **service worker** or **manifest**, click the reload icon on the
extension card.

> Reloading the extension card fires `onInstalled`, which runs one garbage-collection
> pass over stored positions — handy for clearing expired records on demand.

---

## 2. The daily loop

The feature is intentionally invisible when it works. To exercise it:

1. Open a long article and **read for 15+ seconds while actually scrolling**
   (both conditions are required before anything is stored — see `isEngaged`).
2. Close the tab, or navigate away.
3. Reopen the same URL.
4. The page should jump to roughly where you left off, on the block that was at
   ~40% of your viewport.

Aim for breadth: news, blogs, docs, wikis, forums, long-form essays, SPA-based
readers. The goal is 50+ _different_ sites over the two weeks, a handful each
day, in your normal browsing — not a scripted session.

---

## 3. What to watch for

Map each observation to one of these. The first three are the real test; the
cardinal sin is the last one.

| Behavior                | Expected                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| **Exact / fuzzy match** | Silent, accurate jump to where you were. No toast.                       |
| **Ordinal / percent**   | Approximate jump **with** a small bottom toast disclosing it's approximate. |
| **Abort**               | Page left untouched (content changed too much to trust a match).         |
| **Stolen scroll** 🚫     | Page moves _after_ you started scrolling, or jumps mid-read. Must be 0.   |

Specifically stress the family-D situations:

- **Lazy-loaded media / late images** — images that load after restore push
  content down. The 3s stabilization window should re-pin without yanking you.
- **Web fonts / hydration shift** — layout settling after first paint.
- **You scroll during stabilization** — start scrolling immediately on load; the
  extension must yield instantly and never fight you (`scroll-guard` + the
  `userHasScrolled` flag).
- **SPA navigation** — on sites like react.dev or a news SPA, navigate between
  articles without a full reload; each article should track and restore under
  its own URL.
- **Thin pages** — a homepage or a short page (<2000 chars of content) should
  store nothing.
- **Sensitive / private** — banking, `.gov`, health portals, and any Incognito
  window must never capture or restore.

---

## 4. Inspecting state

Open the service-worker console: `chrome://extensions` → Reader Mode → **service
worker** → _inspect_. Then:

```js
// All stored position records and settings
await chrome.storage.local.get(null);

// Just the settings
await chrome.storage.local.get('settings');

// Wipe everything to start a clean trial
await chrome.storage.local.clear();
```

Each saved page is a `pos:<urlHash>` entry. A record under ~2 KB, with three
anchors and a `scrollPercent`, is healthy. Records carry `url` and `title` so you
can tell which page each one is.

Content-script logs (capture/restore activity) show in the **page's own DevTools
console**, not the service worker's.

To verify the popup: click it on a page with a saved position — toggle the global
switch, the per-site switch, pin an entry (★, extends its life to 90 days),
reopen it, and use "Clear all positions".

---

## 5. Keeping a log

A lightweight log is enough. For anything that felt wrong, capture:

| Date | URL | What happened | Confidence (if toast) | Notes |
| ---- | --- | ------------- | --------------------- | ----- |

The two numbers that decide M2:

- **Perceived-correct rate** — of the times a restore _happened_, how often it
  put you in the right place. Should feel high (target ~95%+, matching M1).
- **Stolen-scroll count** — must be **0**. A single reliable repro of the page
  moving under you is a blocker, not a polish item.

---

## 6. Triage when something is off

- **Landed slightly high/low within a long block** — expected for now: v1 anchors
  at block granularity (`intraBlockOffset` is 0). Note it; the fix is intra-block
  precision, a known follow-up.
- **No restore at all** — check the record exists in storage, that the URL
  normalizes to the same `urlHash` (tracking params are stripped), and that the
  page actually had >2000 chars when captured.
- **Restored to the wrong spot** — this is the one to report in detail: the page,
  whether it was exact/fuzzy/ordinal/percent (toast?), and what changed between
  visits. These cases feed back into the anchoring engine.
- **Scroll stolen** — note the site and the exact timing (on load? after an image
  loaded? while scrolling?). This is the highest-priority signal.

When the two weeks are up and both numbers hold, Epic 2's exit criterion is met
and Epic 3 (rules engine & cleanup) can start.
