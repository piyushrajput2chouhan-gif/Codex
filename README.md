# Apex Auto Captures

React + TypeScript + Vite, Tailwind CSS and Motion. No backend, credentials, or form service is required. The booking form opens a WhatsApp draft; the visitor must send it, and a booking is never automatically confirmed.

## Live website

https://piyushrajput2chouhan-gif.github.io/Codex/

The tested static site is published on the repository's `gh-pages` branch. GitHub automatically enabled Pages and completed its first deployment successfully. The source is maintained on `main`; pushing source changes alone does not replace the static build on `gh-pages`.

Build for hosting with `npm run build -- --base=./`, then publish the complete resulting `dist/` contents to `gh-pages`, including an empty `.nojekyll` file. Preserve the deployment branch history and do not force-push. Relative build paths and `lib/public-asset.ts` keep scripts, photos, and frame requests inside the hosted project path. Car frames and their rendering are unchanged.

`.github/workflows/verify-live.yml` runs `node scripts/check-live.mjs` on GitHub to check the actual public website at phone and desktop widths. It verifies HTTP status, original car scrubbing, scene selection, both galleries, booking validation, footer text, failed asset responses, and overflow. It does not send WhatsApp messages. For checking another deployment, set the non-secret `APEX_SITE_URL` variable when running the script.

## Run

Use Node 22.12+ (validated with Node 24) and npm. Work in the existing `/workspace/Codex` checkout; cloud tasks are already isolated, so do not create a worktree unless explicitly requested.

```sh
cd /workspace/Codex
npm ci --cache /workspace/.cache/npm --no-audit --no-fund
npm run dev -- --port 5173
```

`npm run build` scans media, checks TypeScript, and builds `dist/`. `npm run preview -- --port 4173` serves that static build. Start the dev server again in each new task; running processes are not part of an environment snapshot.

`npm test` runs the browser checks using the installed `/usr/bin/chromium`. The test runner starts a development server if needed. Tests cover the five requested widths, real Chromium touch gestures, vertical scrolling, keyboard navigation, car canvas pixels and scene memory, the puzzle cycle and interaction, footer rendering, reduced motion, and WhatsApp validation/encoding. WhatsApp messages are never sent by these tests.

## Media and text

- `public/frames/cars/`: all **192 original, unchanged 1280×720 WebP frames** from `velour-website.zip`.
- `reference/velour/`: the original HTML, CSS, JavaScript, and README, kept for comparison.
- `public/work/`: the **17 unchanged supplied square photos**. No other photography is used.
- `data/apex-content.ts`: original photo titles, captions and descriptions, service copy, and verified contact information.
- `components/scene-hero.tsx`: hero headlines, supporting copy, and the two scene accents. The car palette comes from the original site.
- `styles.css`: site layout, theme tokens, responsive rules, focus styling, and reduced motion.

`components/scroll-scene.tsx` shares the original scrubbing technique across both scenes: easing factor `0.14`, settling threshold `0.03`, pixel ratio capped at `1.5`. The pinned region retains `480svh` on desktop and `380svh` on phones. Each scene saves its progress; switching does not scroll the page. The original car canvas uses **contain fit**, which is deliberately retained to preserve its appearance and show the whole car. This prioritizes the request to keep the existing car animation over the prompt's conflicting instruction to change both scenes to cover fit. The café sequence uses **cover fit** in its own box.

`lib/frames.ts` loads the first car frame before starting the café loader. Compressed frame files warm in coarse-to-fine order. Decoding has bounded concurrency and a pixel-budget cache, with `ImageBitmap.close()` on eviction. Inactive scenes retain their frame. Reduced motion keeps the first frame, skips sequence warming, and disables switching springs and the handle hint.

## Add the coffee sequence

**Still needed:** the supplied `coffee_frames_24fps.zip` could not be downloaded because the attachment-transfer tool has a **32 MiB limit**. No café frames were fabricated or substituted. The scene currently displays the labelled “Café animation coming” fallback.

Attach smaller ZIPs, each under 32 MiB, containing distinct consecutive portions of the original JPG sequence. Keep the original numbered filenames across the parts. Import every part together:

```sh
npm run frames -- --cafe-zip /path/to/part-1.zip /path/to/part-2.zip
```

The importer combines the ZIP entries, sorts filenames numerically, reads each real image size, and writes `public/frames/cafe/c001.jpg`, `c002.jpg`, etc. The count is derived from the files. It rejects duplicate names, extra images, invalid JPEGs, and attempts to overwrite different existing frames. It neither resizes nor recompresses images.

Alternatively, place the already renamed frames directly in `public/frames/cafe/`. The dev server watches for image additions and refreshes `public/frames/manifest.json` automatically. Both `npm run dev` and `npm run build` also refresh the manifest. There is no hard-coded café frame count or aspect ratio.

After importing, confirm the reported count and dimensions, scroll both scenes, check the first and final frames, switch away and back at different progress points, and repeat the phone checks. **Actual coffee playback and its full sequence remain unverified until those files are accessible.**

## Supplied components

- `components/ui/sliding-puzzle-gallery.tsx` is byte-identical to the supplied component. `App.tsx` configures separate Cars/Cafés instances with `size={4}` and `hold={2600}`. The wrapper mounts near the viewport and tilts into view; the component's internal logic is unchanged. Theme tokens map to Tailwind in `styles.css`; the no-Tailwind fallback stylesheet is unnecessary.
- `components/ui/halftone-wordmark-footer.tsx` is unchanged. `App.tsx` sets `IBRAHIM`, verified links, a loaded 900-weight display font, definite responsive height, and the site's palette. Pointer interaction remains enabled. Ibrahim has no portrait or portrait placeholder.
- `components/ui/side-by-side-slide.tsx` extends the supplied pointer patch with a 12 px horizontal gesture threshold, vertical gesture rejection, interactive-element protection, controlled tabs, an accessible slider handle, and reduced-motion snapping. Position 100 is Cars; 0 is Cafés.
- `tests/source-integrity.json` records source SHA-256 digests for every original car frame, photo, and the two unchanged components.

## Before launch

The website is deployed. Import and validate the real coffee sequence before replacing its labelled fallback, then rebuild and update `gh-pages`. The shared conversation link was inaccessible from this environment; the attached prompt and original car project provided the implementation sources. The site has no invented prices, reviews, business statistics, street address, or biography, and no tracking, payments, portrait, or external stock imagery.
