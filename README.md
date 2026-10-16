# Apex Auto Captures

The downloadable site is `apex-website.zip`. It contains the supplied production application, photography, fonts, and the **Emerald Editorial** visual refresh, guided by UI/UX Pro Max.

## Design

Deep emerald surfaces (`#091b18`), warm ivory text (`#f4f1e8`), and champagne accents (`#dfc69a`). Editorial serif headings contrast with the bundled Manrope body font. The theme adds readable body text, refined buttons, framed galleries, a paper-colored booking section, keyboard focus states, and reduced-motion support. The café hero uses an existing interior photo as its static backdrop; its original pending animation notice remains accurate.

## Edit and package

The original source project is not included. Visual changes live in `theme/premium.css`, loaded after the supplied production CSS. The original application bundle, interactions, and images are preserved.

From the repository root:

```sh
python3 tools/package_theme.py
```

This updates the ZIP in place and is safe to repeat. No Node dependencies or external fonts are required.

## Run locally

Extract `apex-website.zip` into a separate directory, then serve that directory:

```sh
python3 -m zipfile -e apex-website.zip /tmp/apex-preview
python3 -m http.server 8000 --directory /tmp/apex-preview
```

Use the extracted folder as the root of a static hosting deployment. Keep the `assets`, `frames`, and `work` directories together with `index.html`. The contact form prepares a WhatsApp message; it does not submit to a backend.
