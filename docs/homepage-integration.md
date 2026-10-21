# Local homepage integration — 21 October 2026

The user authorized integrating the complete approved redesign into the Next.js website locally, without pushing or deploying. Integration starts from commit 699249fa04dda2230f31ebc483e76e71bc927e90.

## Result

The homepage now renders native React components matching the saved editorial homepage: selected navigation/announcement A, current editorial hero A, green programme explorer A, newsroom A, community portrait A, all giving methods C, closing/footer B, warm ivory palette and selected Softer sans typography. The hero choice had not been finalized separately; the current displayed editorial option is used, and alternatives remain in the saved design study.

The homepage owns its header, semantic main and footer. SiteShell retains the original Navbar and noise treatment on other routes, including when navigating between the homepage and another page without reloading. Homepage CSS is scoped to .iqra-home; its locally bundled General Sans fonts have a distinct family name. The seven edited WebP files are under public/images/home/. Original photos, book artwork, logo and payment QR are preserved. Native Next Image handles responsive photo loading; brand/QR images remain unoptimized. Preview choosers and filesystem references are absent from the website UI and runtime.

Programme switching, menu Escape and close-on-navigation, and copy-account success/failure feedback use React components. Same-site destinations use Next Link with local routes. Existing external portal, social and AvtaleGiro destinations are retained. Next's bundler and output tracing explicitly use this repository root, avoiding an unrelated lockfile in the parent home directory.

## Verification

- Production build passed with TypeScript and all existing routes generated.
- ESLint passed for all changed TypeScript/TSX files; Git whitespace checks passed.
- Built production entry point checked in a hidden browser at 320, 390, 430, 768, 1024 and 1440 pixels: six final layouts passed.
- One main, one h1 and one header; no duplicate IDs, broken in-page anchors, horizontal overflow or page exceptions; images decoded successfully.
- All headings use the bundled family and weight 500, fit within their containers and use at most two lines at the checked sizes.
- All three programme selections updated the photo, caption and alt text; mobile menu open/Escape/anchor-close passed.
- Copy-account success and denial feedback passed with an in-page clipboard stub; system clipboard was not modified.
- Client-side navigation to /om-oss and back passed on phone and desktop, including preserved route styling and no duplicate chrome.
- Desktop, tablet and phone screenshots were visually inspected. Final browser results and screenshots are saved with the design study under docs/design/home-preview/previews/local-integration/ (local study files, not runtime dependencies).

## Local preview

From the project directory:

    npm run build
    npm run start -- --hostname 127.0.0.1 --port 3157

The review server is deliberately retained at http://127.0.0.1:3157 for local review. It binds only to loopback. Verification browsers were closed. Prior task-owned server instances were identified by full command line and stopped before rebuilding; unrelated servers were untouched.

## Outstanding before a public release

- No push or deployment was authorized or performed. The saved alternative studies remain available.
- The AI-edited photographs change some expressions and fine facial details; this limitation was shown to the user before their instruction to integrate.
- News dates/copy and payment references are carried over from the selected study. No real transaction or external form submission was tested.
- Browser verification used the installed Chromium engine; Safari/Firefox and physical-device payment scanning remain untested. The ported styles use native CSS @scope, as did the approved study.
- npm ci reported 19 dependency audit findings (1 low, 2 moderate, 15 high, 1 critical). Package versions and the lockfile were not changed. Dependency security review remains separate work before any public release.

Existing .gitignore edits and untracked design-study files were preserved separately from the integration commit.
