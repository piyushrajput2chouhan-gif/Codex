# Apex Auto Captures — Editorial

The approved ivory editorial direction, implemented as a responsive, single-page portfolio. This is a separate build. The existing `apex-website.zip` and its theme are unchanged, and nothing has been published.

## Develop

Use Node.js 24 (tested with 24.19.0) and npm. From this directory:

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

For a static production build:

```sh
npm run build
npm run preview -- --host 0.0.0.0 --port 4173 --strictPort
```

The complete static site is in `dist/`. Serve its contents as a static site; retain the `work`, `frames`, `fonts`, and `assets` directories beside `index.html`. The relative build base supports hosting under a subdirectory. No backend, API key, external font server, or account is required. HTTPS is recommended for an eventual public deployment. Publication is a separate action.

To export one portable HTML file with all original images, frames and fonts embedded:

```sh
python3 scripts/export_standalone.py
```

`exports/Apex-Auto-Captures.html` contains the whole app in one document, about 15 MB. It was tested over HTTP with no separate asset requests. Direct `file://` launch is blocked by the cloud browser’s policy and remains unverified, as do mobile document viewers. The static build in `dist/` remains the version to host.

## Design and content

- Warm ivory, espresso, charcoal and silver. Bodoni Moda display typography and the supplied Manrope text font.
- Original supplied photographs are used directly. No generated design-board photography is used in the website.
- Editorial hero; filterable selected work; one automotive scroll sequence; café collection; WhatsApp enquiry.
- No About section, owner attribution, invented claims, prices, reviews or client logos.
- Photography of cars and cafés. Enquiries are for custom quotes.
- Instagram: @apexautocaptures. Email: apexautocaptures@gmail.com. WhatsApp: +91 97014 14074.

## Interactions

The photo lightbox uses a native modal dialog, explicitly traps Tab/Shift+Tab, supports Left/Right arrows and Escape, and restores focus to the opening photograph. Navigation and filters use native links and buttons with visible focus. The mobile WhatsApp action appears after the hero action leaves the viewport and disappears when the enquiry panel is visible.

The optional enquiry text stays in the browser and is encoded into the WhatsApp compose link. The visitor sends it themselves. No message is sent automatically and no data is submitted to a backend.

## Animation assets and behavior

The supplied sequence contains 192 consecutive WebP frames at 1280 × 720, totaling 9,281,644 bytes. There are no café animation frames. The original café photographs remain still.

Native vertical scrolling drives a sticky automotive section; no wheel or touch events are intercepted. Frames fetch only while the section is visible, with at most three requests in flight. Loading starts around the current scroll position and progressively fills a sparse set before other frames. Compressed frames are retained while at most ten decoded bitmaps are held (roughly 37 MB), avoiding decoding the complete sequence into hundreds of megabytes of memory. Offscreen and hidden-tab requests are aborted. A passive scroll listener schedules a single paint instead of running a continuous animation loop.

The supplied first frame stays underneath the canvas as a fallback. Frame-request or decode errors retain that still. Reduced motion and browser data saver show the still with no animated-frame fetches, and remove the extended sticky track. On mobile the canvas contains the full 16:9 frame rather than cutting off the car.

## Verification

See `design-qa.md` for the visual comparison and `evidence/browser-results.json` for recorded checks. Screenshots in `evidence/` come from real Chromium rendering. Desktop Chromium was tested at 390, 768 and 1440 CSS pixels; this does not establish behavior on physical iOS or Android devices.

The optional browser check script needs Python, Playwright and `/usr/bin/chromium`, all provided in the prepared cloud machine:

```sh
python3 scripts/check_browser.py
```

Set `APEX_TEST_URL` to check a separately started production preview. The script does not click external WhatsApp, Instagram or email links, or send messages. Font and icon license notices are included in `public/licenses/` and the built site.
