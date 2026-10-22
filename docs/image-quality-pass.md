# Image quality pass

The eight public pages at iqrasenter.no were audited on 22 October 2026, covering 33 distinct image files. Fifteen older photographs have new editorial alternatives in `public/images/editorial/`. Three duplicate photographs in the news/gallery reuse the existing stage, summer and boys' portrait edits. The seven previously approved editorial images remain in use.

The treatment improves white balance, shadow detail, colour and clarity. New exports have long edges of 2896–3304 pixels. They are 2× Lanczos exports from native AI masters around 1.5 megapixels; the larger pixel count does not represent additional recovered camera detail. The fifteen WebP files total 9,241,156 bytes before responsive optimization.

Responsive image widths now include 1440, 1920 and 2560 pixels, while smaller variants remain available. Gallery metadata follows the new image dimensions. Original files, logos, QR codes, book covers and the summer-school poster are preserved.

## Validation

- Production build and TypeScript compilation passed.
- Focused ESLint and Git whitespace checks passed.
- All eight production routes passed image decoding, single-h1, horizontal-overflow and page-exception checks at 1440, 768 and 390 pixels: 24 layouts. Desktop used device-pixel ratio 2; image requests up to 2560 pixels were observed.
- All eighteen original/enhanced comparisons passed image decoding and overflow checks at the same three widths.
- Temporary servers and task browser debugging ports were verified closed.

Initial eager decoding timed out while responsive variants were cold. A direct optimized-image request returned HTTP 200, and the final instrumented browser checks passed. No cold-cache performance benchmark was performed.

## Review and rollback

AI restoration can alter faces, expressions, certificate text, banners and projected lettering. These are retouched alternatives rather than documentary-exact restorations. The owner authorized merging after the comparison and this limitation were presented. Original design files would be needed for reliable substantial improvements to the book covers or poster.

All originals remain available. Reverting the image-pass commit restores the previous image references and responsive widths.

Lossless masters, prompts, the full audit, comparisons, screenshots and verification scripts are retained locally under `docs/design/image-quality-pass/`; these local review artifacts are not required by the production application.
