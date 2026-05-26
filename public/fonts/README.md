Licensed brand font files were not present in this repo, so the CSS currently
uses local font names only and does not request missing assets.

When the licensed files are available, prefer wiring them through
`next/font/local` so Next serves them from `/_next/static`:

- `avelon.woff2` for heading text
- `sfc-la-pura.woff2` for brand text

`Gantari` is loaded through `next/font/google` for body text.
