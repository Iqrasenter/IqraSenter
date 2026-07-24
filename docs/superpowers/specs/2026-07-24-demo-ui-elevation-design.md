# Demo-UI-løft — «Handling + hovedbok» (design)

**Dato:** 2026-07-24 · **Mål:** feat/demo-redesign i portal-repoet (`~/dev/iqra-portal`)
**Status:** godkjent av bruker seksjon for seksjon (se beslutningslogg §9)

Full visuell/UX-elevering av pitch-demoen: lett å forstå, god oversikt, lett å
navigere, skikkelig responsiv. Designspråket fra `DESIGN.md` («C · Familie»,
2. utgave — tokens, Outfit/Fraunces, mørk house-flanke) ligger FAST; dette
dokumentet endrer layout, tetthet, hierarki og responsivitet — ikke språket.

---

## 1 · Bakgrunn og funn (designrevisjon 2026-07-24)

Gjennomgang av alle 5 roller på desktop (1280) og mobil (375), demo på :3100.

**Fungerer godt (fredes):** tokensystemet, sidemeny + mobilskuff, mushaf-kartet,
muraja'ah-ukekortet, økonomi-dashbordets struktur, veiviser-skjelettet i
fakturakjøring, tomtilstands-tekstene, print-rutene, ⌘K.

**Feil:** «Ta oppmøte» kollapser på 375px — navn brytes ord for ord,
«Forhåndsmeldt fravær»-chip og notat kolliderer med statuspillen.

**Svakheter:**
1. Lærer-dashbordet nesten tomt (én rad + ett kort); ingen neste-handling,
   ingen arbeidskø, ingen muraja'ah-glimt.
2. Vurdering-indeksen er en naken navneliste — null skanneverdi.
3. Fakturakjøring steg 2: Neste-knappen ligger under 12 familiekort scroll;
   ingen klebrig oppsummering.
4. Fargede nuller: «Fravær 0» i alarm-rødt, «For sent 0» i gult.
5. Redundante chips: rader i statusgrupperte lister gjentar gruppens status.
6. Admin-hendelseslogg lekker maskinspråk (`student.updated`, `class_students`).
7. Desktop-bredden ubrukt: alt i én smal kolonne; død flate under innholdet.
8. Strukne kontroller: barnevelger/segmenter maler full-bredde tintbånd bak
   to små piller.
9. Oppmøtestatus = blind trykk-for-å-bla gjennom 4 skjulte tilstander;
   notatblyanten er et bittelite mål.

## 2 · Låste beslutninger (bruker, 2026-07-24)

| Beslutning | Valg |
|---|---|
| Mål | Portal-demoen (feat/demo-redesign), ikke markedssiden |
| Designspråk | Behold systemet, elever utførelsen (ingen token-/font-endring) |
| Omfang | Full feiing, alle 5 roller, alle skjermer |
| Rekkefølge | ①mobil-oppmøtefeil ②dashbord ③heltflyter ④responsiv/nav-feiing ⑤mikropolish |
| Dashbordretning | **Hybrid: A-hero + B-grid** (valgt fra tre live-mockups, `scratchpad/mockups/laerer-dashboard-varianter.html`) |
| §1–§4 under | Alle godkjent uendret |

## 3 · Dashbordmønsteret «Handling + hovedbok» (§1, godkjent)

Fem lag, ovenfra og ned — samme anatomi på alle roller:

1. **Hilsen** — `DashboardHeader` som i dag (Fraunces «Salam, fornavn» + dato);
   får valgfritt høyre-slot (stille kontekstchip, f.eks. «Høst 2026»).
2. **Hero-handling** — rollens ene mest presserende handling. Anatomi:
   surface-kort; venstre tintblokk (klokkeslett/nøkkeltall), tittel +
   kontekstlinje, høyre statuschip + primær CTA (min-h-11).
   **Alt-i-orden-regelen:** finnes ingen presserende handling kollapser heroen
   til en stille success-stripe («Alt ført · neste time lørdag 21. november»)
   uten knapp. Heroen maser aldri.
3. **Hovedbok-stripe** — ÉN `Card` med divide-hairlines, 3–4 celler
   (etikett over, Fraunces-figur, kvalifikator under/bak). Celler er lenker.
   **Null-toneregelen:** oppmerksomhets-kvalifikatorer får warning-ink KUN når
   tallet > 0; nuller står i dempet ink. Komponent-håndhevet.
4. **Sonerad** — 2 kolonner ≥lg (1.45fr/1fr), stables under: venstre =
   rollens arbeidsliste (timeplan/fakturaer/familie), høyre =
   **«Trenger oppmerksomhet»**-strøm (severity-prikk + fet subjekt +
   én forklaringslinje; maks ~5 rader; hver rad er lenke).
5. **Referanserad** — rollespesifikk (Mine klasser + muraja'ah-uke; barnas
   kort; terminkort + hendelser).

### Per rolle

- **Lærer:** hero = «Før oppmøte» for neste uførte time (ellers vurderings-kø,
  ellers alt-i-orden). Stripe: Timer i dag · Elever · Å vurdere · Uleste.
  Obs-strøm: forhåndsmeldt fravær i dag, repeteres-flagg (m/ notat), ventende
  innleveringer. Referanse: Mine klasser + muraja'ah-uke (kondensert 7-dagers
  rutenett fra eksisterende `MurajaahCard`-data).
- **Forelder:** hero = utestående med forfall («Betal 400 kr · forfall 27. nov»
  → økonomi) ellers neste time. **Barnevelgeren fjernes fra dashbordet** —
  begge barna vises som stablede kompakte bånd (oppmøte % · bokenhet ·
  koranposisjon per barn). Velgeren består på undersidene
  (oppmøte/fremdrift/lekser). Familie-obs: ny melding fra lærer, diplom,
  forfall.
- **Elev (barn som bruker):** mønsteret i mildeste form — dagens time-hero,
  liten stripe (oppmøte % · koran nå · lekser), «øv i dag»-muraja'ah-kort.
  **Ingen alarmstrøm til barn.** Vennlig, rolig.
- **Admin:** hero = «2 timer ikke ført» → oppfølging. Stripe: Aktive elever ·
  Klasser · Ikke ført · Usette fravær. Obs-strøm: fravær i dag + purre-
  sammendrag. Referanse: terminkort + humanisert hendelseslogg (§6).
- **Økonomi:** hero = «2 forfalte fakturaer · 4 200 kr» → purringer (ellers
  «Start fakturakjøring» når termin står åpen). Stripe: Fakturert · Betalt ·
  Utestående, med «49 % innbetalt»-kvalifikator. Venstre sone: eksisterende
  grupperte fakturaliste (minus redundante chips); høyre: forfalte + delvis
  betalte + siste innbetalinger (fra bankavstemmings-dataene).

## 4 · Heltflytene (§2, godkjent)

### Ta oppmøte
- **Mobilfeilen:** raden restruktureres <sm til to stablede linjer:
  linje 1 = avatar + navn (trunkeres med ellipse ved behov) + notatknapp;
  linje 2 = statuskontroll i full bredde. Forhåndsmeldt-chip og notat får egen
  linje under navnet. Kollisjoner blir umulige.
- **Statuskontroll:** trykk-for-å-bla erstattes. ≥sm: synlig **4-segments
  kontroll** (Til stede / Fravær / For sent / Gyldig) — selvdokumenterende,
  null ekstra trykk. <sm: kompakt statuspille som åpner **popover med 4 store
  valg** (44px mål, radiogroup, fokusfelle, Esc lukker). Standard er fortsatt
  «Til stede», så kun unntak koster ett trykk.
- Oppsummeringsbåndet beholdes som én ledger-Card; null-toneregelen gjelder.
- **Klebrig lagre-linje** på mobil: «6 av 7 til stede · Lagre oppmøte» festet
  i bunn, `env(safe-area-inset-bottom)`. Desktop beholder i-flyt-footer.
- Notatknapp ≥44×44px.

### Fakturakjøring
- **Klebrig oppsummeringslinje** gjennom steg 2: «12 familier · 27 elever ·
  36 000 kr — Neste», oppdateres live når familier utelates.
- Familiekortene strammes: mindre vertikal padding; moderasjonslinjer slås
  sammen til én dempet linje per familie.
- Steg 3 (KID-kvittering) uendret.

## 5 · Indeks- og arbeidsflater (§3, godkjent)

- **Vurdering-indeksen:** signalrader — navn + koranposisjon-chip (warning-tint
  ved «Repeteres») + arabisk mini-fremdriftssøyle + «sist vurdert»-dato +
  oppmerksomhets-prikk. Trenger-oppmerksomhet sorteres først, deretter
  alfabetisk.
- **Lærers elevdetalj:** to kolonner ≥lg — venstre = GJØRE (registrer
  koranfremgang + bokfremgang), høyre = SE (mushaf, muraja'ah-uke, siste
  registreringer, prøver). Mobil: skjema først, deretter kontekst.
- **Fremdriftssider (forelder/elev):** to kolonner ≥lg — mushaf + posisjon
  venstre; prøver/terminkarakterer/rapport høyre. Mobil: dagens rekkefølge.
- **Lister/meldinger (alle roller):** konsistent radanatomi — ulest-prikk,
  forhåndsvisning, tidsformat, chevron på alle klikkbare rader. Lett hånd.
- **Dødflate-regelen:** dashbord/arbeidsflater får maks-bredde ~1160px med
  soner; lesesider beholder smal kolonne. Sider slutter med innholdet.

## 6 · Systematisk polish + responsive regler (§4, godkjent)

- Null-toneregelen (komponent-håndhevet i `StatCell`).
- Statusgrupperte lister dropper rad-chips (gruppeoverskriften bærer status);
  chips beholdes kun i blandede lister.
- Admin-hendelser humaniseres: ren funksjon mapper event → norsk setning med
  aktør og relativ tid («I dag 11:05 · Amina oppdaterte eleven Yusuf Farah»).
- Segmenter/barnevelger får egenbredde (inline-flex) — aldri mer full-bredde
  tintbånd bak små piller.
- **Responsivt:** hovedbok-striper går 2×2 under md (aldri skjermhøye
  stat-stabler på mobil); soner stables; klebrige handlingslinjer på lange
  flyter; heroen stabler <sm med full-bredde CTA; tabellignende rader blir
  kortrader <md; `StoryBar` får safe-area-inset (kjent etterslep).
- **Bevegelse:** ingen ny innlastings-orkestrering i portalen (DESIGN.md-
  forbudet står); kun eksisterende hover-/trykkdisiplin på nye komponenter.
- **Tilgjengelighet:** segmentkontroll = radiogroup med piltaster; popover med
  fokusfelle og Esc; obs-rader er lenker med beskrivende navn; AA-kontrast per
  parringsreglene i globals.css; focus-visible overalt; trykkmål ≥44px.

## 7 · Komponentinventar

**Nye:**
| Komponent | Hjem | Ansvar |
|---|---|---|
| `HeroAction` | ui | Hero-kort m/ tintblokk, chip, CTA; `allClear`-tilstand |
| `StatLedger` / `StatCell` | ui | Delt hovedbok-stripe; null-toneregel; celle-lenker; 2×2 <md |
| `AttentionFeed` | portal | «Trenger oppmerksomhet»-strøm (prikk + subjekt + linje) |
| `SegmentedStatus` | portal | 4-status radiogroup (≥sm) for oppmøte |
| `StatusSheet` | portal | Mobil-popover med 4 statusvalg |
| `StickyActionBar` | ui | Klebrig bunnlinje: oppsummering + CTA, safe-area |
| `MiniBar` | ui | Liten fremdriftssøyle for indeksrader |
| `humanizeEvent` | lib/admin | Ren funksjon: hendelse → norsk setning |

**Endres:** `DashboardHeader` (høyre-slot), `DataRow` (chevron-standard),
oppmøteraden (to-linjes mobilanatomi), `MurajaahCard` (kondensert
uke-variant), vurderingsindeksens rad. **Slettes:** trykk-bla-logikken i
`AttendanceStatusControl` (erstattes av de to nye kontrollene).

**Datagrunnlag:** alt avledes av eksisterende demo-DAL (attendance,
assignments, progress, messaging, economy, quran/murajaah, bankMatch).
Små aggregerings-funksjoner legges i `lib/dal/*` (demo-modus), TDD-testet —
ingen nye datakilder, ingen endring i demodata-innholdet.

## 8 · Testing, gate og verifikasjon

- **TDD:** nye rene funksjoner (aggregeringer, `humanizeEvent`, null-tone-
  logikk) og nye komponenter (RTL: roller, navn, tastatur, tilstander) får
  tester FØR implementasjon. Eksisterende 118 enhetstester skal bestå.
- **Gate per milepæl:** `tsc` 0 feil · `vitest` grønn ·
  `NEXT_PUBLIC_DEMO=1 next build` OK.
- **Nettleser-verifikasjon:** hver berørt skjerm sjekkes på 375 / 768 / 1280,
  inkl. skuff, klebrige linjer og popover-fokus. Kjente pane-triks: unngå
  scroll-skjermbilder (bruk høy viewport), førstegangs rutekompilering tar
  sekunder.
- **Sluttrevisjon:** `web-design-guidelines`-gjennomgang (CLAUDE.md fase 3)
  før arbeidet erklæres ferdig; DESIGN.md får et 3.-utgave-tillegg som
  kodifiserer mønsteret (hero-regelen, null-toneregelen, klebrig-linje-
  regelen, 2×2-regelen).

## 9 · Prosess og beslutningslogg

- Gren: **feat/demo-redesign** (fortsettelse); inkrementelle commits per
  milepæl; ingen push uten brukers OK.
- Milepælsrekkefølge: ①oppmøte-mobilfix ②mønsterkomponenter + lærer-dashbord
  ③øvrige dashbord ④heltflyter ⑤indeks/arbeidsflater ⑥polish + responsiv
  feiing ⑦sluttrevisjon + full gate.
- 2026-07-24: mål=portal-demo; språk=behold+elever; omfang=full feiing;
  mockup-metode akseptert; retning=hybrid A+B (fra tre live-varianter);
  §1–§4 godkjent enkeltvis. Mockup-kilde:
  `laerer-dashboard-varianter.html` (sesjonens scratchpad, servert :3199).

## 10 · Utenfor omfang

Ingen endring i: tokens/fonter/flanke, mushaf-kartet, landingen,
fortellermodus (utover safe-area), print-rutene, ⌘K-paletten, demodata-
innhold, DAL-kontrakter mot ekte backend, `real`-grenens arbeid, markedssiden.
