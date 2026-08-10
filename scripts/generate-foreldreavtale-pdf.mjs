#!/usr/bin/env node
/**
 * Renders the foreldreavtale to a print-ready PDF.
 *
 * Reads the same src/app/foreldreavtale/avtale.json the website page renders, so
 * the two cannot drift. That matters more here than in most places: the PDF is
 * what many parents actually read and keep, and it is the wording an oppsigelse
 * of a skoleplass would be argued against. A PDF disagreeing with the page is
 * worse than no PDF at all.
 *
 * By default output goes to docs/ with an UTKAST stamp, deliberately NOT public/ —
 * anything in public/ is live on the website the moment it is deployed.
 *
 * ⛔ --endelig is what publishes. It writes public/foreldreavtale.pdf, which is the
 * file the page's «Last ned avtalen (PDF)» button serves, and drops the UTKAST
 * stamp. Nothing else updates that file, so a text change merged without re-running
 * this leaves the page stating the new terms while the download hands over the old
 * ones — the single failure this document cannot have. Publishing is a deliberate
 * flag rather than the default so that regenerating a draft can never publish by
 * accident.
 *
 * Usage:  node scripts/generate-foreldreavtale-pdf.mjs [--endelig]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const FINAL = process.argv.includes('--endelig');
const AVTALE = 'src/app/foreldreavtale/avtale.json';
const OUT = FINAL ? 'public/foreldreavtale.pdf' : 'docs/foreldreavtale-UTKAST.pdf';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!existsSync(CHROME)) {
  console.error(`Google Chrome not found at:\n  ${CHROME}\nInstall it, or adjust CHROME.`);
  process.exit(1);
}

const { versjon, sections } = JSON.parse(readFileSync(AVTALE, 'utf8'));
if (!versjon || !Array.isArray(sections) || sections.length === 0) {
  throw new Error(`${AVTALE} is missing "versjon" or has no sections`);
}

const logo = readFileSync('public/logo-wide.jpg').toString('base64');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = `<!doctype html>
<html lang="nb"><head><meta charset="utf-8">
<title>Foreldreavtale ${esc(versjon)}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 17mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Outfit, "Avenir Next", system-ui, sans-serif;
    color: #1c2b24; font-size: 10pt; line-height: 1.5; margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  header { border-bottom: 2px solid #1f6f4a; padding-bottom: 7mm; margin-bottom: 7mm; }
  header img { height: 13mm; }
  h1 { font-size: 20pt; font-weight: 700; margin: 5mm 0 1.5mm; letter-spacing: -0.015em; }
  .meta { font-size: 8.5pt; color: #5b6b63; margin: 0; }
  .meta b { color: #1f6f4a; font-weight: 600; }
  .lede {
    margin: 4mm 0 0; padding: 3.5mm 4mm; background: #f2f7f4;
    border-left: 3px solid #1f6f4a; font-size: 9.5pt;
  }
  .draft {
    margin: 4mm 0 0; padding: 3mm 4mm; border: 1px dashed #b4531f;
    color: #8a3f14; font-size: 9pt; font-weight: 500;
  }
  section { break-inside: avoid; margin-bottom: 6mm; }
  h2 {
    font-size: 12pt; font-weight: 600; color: #1f6f4a;
    margin: 0 0 2mm; padding-bottom: 1.2mm; border-bottom: 1px solid #d9e5df;
  }
  p { margin: 0 0 1.5mm; }
  ul { margin: 0; padding-left: 4.5mm; }
  li { margin-bottom: 1.5mm; break-inside: avoid; }
  li::marker { color: #1f6f4a; }
  footer {
    margin-top: 8mm; padding-top: 4mm; border-top: 1px solid #d9e5df;
    font-size: 9pt; color: #5b6b63; break-inside: avoid;
  }
  .sign { margin-top: 10mm; display: flex; gap: 10mm; }
  .sign div { flex: 1; border-top: 1px solid #9aa8a1; padding-top: 1.5mm; font-size: 8.5pt; }
</style></head><body>

<header>
  <img src="data:image/jpeg;base64,${logo}" alt="Iqra Læring og Aktivitetssenter">
  <h1>Foreldreavtale</h1>
  <p class="meta">Avtale mellom Iqra Læring og Aktivitetssenter og foresatte ·
     <b>Versjon ${esc(versjon)}</b> · gjelder fra skolestart høsten 2026</p>
  ${FINAL ? '' : '<p class="draft">UTKAST — til gjennomgang av staben. Ikke publisert og ikke gjeldende ennå.</p>'}
  <p class="lede">Denne avtalen er bindende og må leses og bekreftes før skoleplassen er endelig.
     Bekreftelse skjer via skjemaet på iqrasenter.no/foreldreavtale.</p>
</header>

${sections
  .map(
    (s) => `<section>
  <h2>${esc(s.title)}</h2>
  ${s.intro ? `<p>${esc(s.intro)}</p>` : ''}
  ${s.items?.length ? `<ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
</section>`,
  )
  .join('\n')}

<footer>
  <p>Ved å bekrefte avtalen erklærer foresatte at de har lest og godtar vilkårene over,
     i versjon ${esc(versjon)}.</p>
  <div class="sign">
    <div>Sted og dato</div>
    <div>Foresattes navn</div>
    <div>Signatur</div>
  </div>
</footer>

</body></html>`;

const tmp = '/tmp/foreldreavtale-print.html';
writeFileSync(tmp, html);
mkdirSync(dirname(OUT), { recursive: true });

execFileSync(
  CHROME,
  [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--virtual-time-budget=10000',
    `--print-to-pdf=${resolve(OUT)}`,
    `file://${tmp}`,
  ],
  { stdio: 'pipe' },
);

console.log(`✅ ${OUT}`);
console.log(`   versjon ${versjon} · ${sections.length} seksjoner`);
console.log(
  FINAL
    ? `   ENDELIG — no UTKAST stamp, written to public/. This IS the file parents download.`
    : `   Marked UTKAST, and written outside public/ — nothing is published.`,
);
