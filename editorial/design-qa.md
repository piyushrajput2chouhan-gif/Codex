# Apex Auto Captures — design QA

final result: passed

Scope: the approved A editorial direction, expanded into a responsive, single-page photography portfolio. No publication or replacement of the existing site.

## Visual evidence

- Primary selected mobile source: `/workspace/generated_images/exec-3285b564-8260-4ca7-aea4-06ab5a1a26c3.png` (853 × 1844 pixels).
- Desktop/tablet source board: `/workspace/generated_images/exec-4d118f5c-017f-4e10-80f3-0f5c4b125283.png` (1536 × 1024 pixels).
- Browser implementation: `evidence/hero-390.png` (390 × 844), `evidence/hero-768.png` (768 × 1024), `evidence/hero-1440.png` (1440 × 1000). Chromium, CSS pixels equal screenshot pixels, deviceScaleFactor 1, default unfiltered hero state.
- Full-view combined comparison inputs opened and inspected: `evidence/comparison-mobile-final.png`, `evidence/comparison-tablet-final.png`, `evidence/comparison-desktop-final.png`.
- Focused typography/header comparison opened: `evidence/comparison-mobile-type.png`. Additional photo/CTA details are readable at native resolution in the mobile comparison.
- Full page, collection, café, enquiry, lightbox, animation, failure and reduced-motion captures are in `evidence/`.

Density normalization: the mobile source was uniformly scaled to 390 pixels wide (approximately 844 high). Desktop and tablet screens were cropped from the source board, uniformly normalized by width to 1440 and 768 pixels, then cropped to the matching browser viewport height. The board’s screen aspect ratios differ from its nominal viewport labels, so those labels are not treated as pixel-perfect specifications. No device or browser chrome was compared.

## Comparison history

1. Initial visual pass found actionable P2 differences. Mobile header, contact area and spacing pushed the café photograph below the viewport. Desktop car placement began too low because it aligned to the bottom of the hero grid. DM Serif Display was noticeably heavier than the chosen source.
2. Fixed: compact mobile masthead and rhythm, inline contact details, reduced vertical spacing, mobile photo composition, and top-aligned desktop car. Replaced the display face with the closer Bodoni Moda; retained supplied Manrope. Initial and revised comparisons: `evidence/comparison-mobile-first.png`, `evidence/comparison-mobile-second.png`, and the final combined comparison inputs above. The final mobile state shows both categories’ photographs; the car preserves the full original square rather than reproducing the generated reference’s altered vehicle proportions.
3. Functional pass found P1 keyboard focus leaving the lightbox’s controls after the last Tab. Added explicit wraparound for Tab and Shift+Tab in the native dialog. Rechecked focus containment, arrow navigation, Escape and focus restoration at all three widths; all passed.
4. Final production build was captured and checked again after asset resolution and project relocation. No actionable P0/P1/P2 issues remain. Secondary sections extend the approved visual system; the first-stage source only specified the hero.

## Required fidelity surfaces

- **Fonts and typography:** Bodoni Moda regular/italic for editorial headings and wordmark; original bundled Manrope 400/500/600 for text. Three-line hero wrapping preserved at the requested widths; no truncation. Small generated reference controls were translated to usable browser type and target sizes. The primary mobile action is at least 48 pixels high. Typeface contours differ slightly from the generated image; this is a P3 approximation, not a missing asset.
- **Spacing and layout:** ivory base surface, fine rules, asymmetric desktop photographs, stacked mobile/tablet composition, restrained margins and generous section spacing. No card shadows or decorative panels. No horizontal overflow at 390, 768 or 1440; supplemental 320 and 720 checks also passed. The full original square mobile car photograph adds some height relative to the generated mock; this intentionally prioritizes supplied image fidelity over cropping off bodywork.
- **Colors and tokens:** ivory `#f4f0e7`, espresso `#2c211c`, charcoal `#171716`, silver `#bdbcb8`. Calculated text contrast: espresso/ivory 13.77:1; muted text/ivory 5.57:1; silver/charcoal 9.44:1. Body and controls avoid text placed over photographic detail. Focus outlines remain visible on both light and dark surfaces.
- **Image quality and asset fidelity:** all 17 photographs and 192 automotive frames are byte-identical to the supplied files. Generated mock imagery is not substituted for originals. Hero and collection crops were visually inspected. Original square mobile car and full 16:9 animation framing preserve the car; lightbox contains entire original photographs. The frame’s original watermark remains intact. Café composition uses still photography because the supplied café sequence is empty.
- **Copy and content:** brand is Apex Auto Captures. No About, biography, owner credit, invented claims, prices, client logos, reviews, delivery promises or extra services. Correct public contact destinations; custom quotes only. Generic photo captions describe visible subjects rather than inventing project stories.

## Interaction and accessibility verification

Production build: `npm run build` passed. `scripts/check_browser.py` recorded six passing groups in `evidence/browser-results.json`:

- At 390 × 844, 768 × 1024 and 1440 × 1000: skip link, keyboard filter controls, Cars/Cafés anchors, all-work/Cars/Cafés results (8/6/2), lightbox opening, arrow and button navigation, focus containment, Escape, restoration, lazy image decoding, enquiry message encoding and mobile WhatsApp visibility. Zero console errors and uncaught page errors in these runs.
- Native wheel scrolling advanced the desired sequence from frame 1 to 96. With network throttling, only 8 requests had started before leaving; the incomplete queue paused offscreen. At most three animated frame fetches ran concurrently. No animated frame fetches started above the offscreen feature.
- Reduced motion: supplied still visible; zero animated-frame fetches; extended sticky track removed.
- Simulated animated-frame network failures: original poster remains visible.

Additional recorded checks: `evidence/additional-results.json`. Touch emulation at 390 pixels, DPR 2, passed lightbox opening, next-image navigation and close. The standalone HTML export passed filters, lightbox, enquiry encoding, animation rendering and local-font loading when served as a single HTML resource with zero additional HTTP requests. Contrast calculations and byte-for-byte asset checks passed.

These are real browser-rendered checks in the cloud machine using Playwright and Chromium, not a GUI Sites preview. No WhatsApp message, email, or Instagram action was sent. No hosted share URL was created.

## Remaining limits and P3 polish

- Physical iOS/Android hardware, Safari and Firefox were not tested. Touch emulation does not establish physical-device behavior.
- Direct `file://` launch of the optional standalone HTML is unverified because the cloud browser administrator policy blocks that scheme. The hosted/static workflow and single-file HTTP workflow are verified.
- Display-font shapes differ subtly from the image-generated source. Content fits cleanly, and the editorial hierarchy is retained.
- Screenshot evidence for the sticky animation includes scroll travel that a static full-page capture cannot demonstrate; use the focused animation capture and recorded wheel check for that behavior.

## Implementation checklist

- [x] Responsive editorial implementation using original assets.
- [x] Native category navigation, custom photo grids and accessible lightbox.
- [x] WhatsApp enquiry with no backend or automatic sending.
- [x] One progressively loaded native-scroll sequence, bounded decoded memory, offscreen pause and still fallbacks.
- [x] Required viewport, keyboard, loading, crop and contrast checks.
- [x] Visual comparisons opened with source and implementation in the same input; actionable findings fixed and checked again.
- [x] Separate source directory and downloadable production files; original website unchanged.

final result: passed
