import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/seo";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Vilkår",
  description: "Vilkår for bruk av nettsiden, kjøp av bøker i nettbutikken og støtte til Iqra Senter.",
  alternates: { canonical: "https://www.iqrasenter.no/vilkar" },
  openGraph: { images: OG_IMAGES, title: "Vilkår hos Iqra Senter", url: "https://www.iqrasenter.no/vilkar" },
};

export default function VilkarPage() {
  return (
    <LegalPage title="Vilkår" updated="22. oktober 2026">
      <h2>Om nettsiden</h2>
      <p>
        Nettsiden drives av Iqra Læring og Aktivitetssenter, Ryenstubben 2, 0679 Oslo. Du kan lese den fritt. Vi gjør vårt beste for at informasjonen er riktig og
        oppdatert, men vi kan ikke love at alt er uten feil, og vi kan endre innhold uten varsel.
      </p>

      <h2>Innhold og bilder</h2>
      <p>
        Tekster, bilder og logo tilhører Iqra, med mindre noe annet er oppgitt. Du må spørre oss før du bruker dem andre steder. Bilder av barn er publisert med
        foresattes samtykke. Ønsker du et bilde fjernet, send oss en e-post, så tar vi det ned.
      </p>

      <h2>Kjøp av bøker i nettbutikken</h2>
      <p>
        Bøkene bestilles og betales med Vipps, slik det står på <Link href="/nettbutikk">nettbutikken</Link>. Prisen som står der, er den du betaler. Du skriver
        hvilken bok du vil ha og hvor den skal leveres.
      </p>
      <ul>
        <li>
          <strong>Angrerett.</strong> Er du forbruker, har du som hovedregel 14 dagers angrerett etter angrerettloven. Skriv til oss på e-post for å bruke den.
          Boken sendes tilbake i ubrukt stand.
        </li>
        <li>
          <strong>Reklamasjon.</strong> Har boken en feil, har du reklamasjonsrett etter forbrukerkjøpsloven. Gi beskjed til oss så snart du oppdager feilen.
        </li>
      </ul>

      <h2>Støtte til Iqra</h2>
      <p>
        Gaver er frivillige og gis med Vipps, bankoverføring eller AvtaleGiro. Fast støtte med AvtaleGiro kan du stoppe når du vil. Gaven går til driften av
        helgeskolen og aktivitetene, slik det står på <Link href="/stott-oss">Støtt oss</Link>.
      </p>

      <h2>Skoleplass og venteliste</h2>
      <p>
        En interessemelding gir ikke rett til skoleplass. Når et barn tilbys plass, gjelder <Link href="/foreldreavtale">foreldreavtalen</Link>.
      </p>

      <h2>Lenker til andre nettsteder</h2>
      <p>Vi lenker til tjenester som Vipps og portalen vår. Vi har ikke ansvar for innholdet på andre nettsteder.</p>

      <h2>Personvern</h2>
      <p>
        Hva vi lagrer om deg og hvorfor, står på <Link href="/personvern">personvernsiden</Link>.
      </p>

      <h2>Lovvalg og klager</h2>
      <p>
        Norsk lov gjelder. Er du uenig i noe, ta kontakt med oss først på <a href="mailto:info@iqrasenter.net">info@iqrasenter.net</a>. Forbrukere kan også ta
        saken videre til Forbrukertilsynet.
      </p>

      <h2>Endringer</h2>
      <p>Vi kan endre vilkårene. Den nye versjonen gjelder fra den er lagt ut her, og datoen øverst viser når den ble oppdatert.</p>
    </LegalPage>
  );
}
