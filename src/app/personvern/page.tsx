import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/seo";
import { LegalPage } from "@/components/legal/LegalPage";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";

export const metadata: Metadata = {
  title: "Personvern",
  description: "Hva Iqra Senter lagrer når du bruker nettsiden eller sender et skjema, hvorfor, og hvilke rettigheter du har.",
  alternates: { canonical: "https://www.iqrasenter.no/personvern" },
  openGraph: { images: OG_IMAGES, title: "Personvern hos Iqra Senter", url: "https://www.iqrasenter.no/personvern" },
};

export default function PersonvernPage() {
  return (
    <LegalPage title="Personvern" updated="22. oktober 2026">
      <h2>Hvem er vi</h2>
      <p>
        Iqra Læring og Aktivitetssenter, Ryenstubben 2, 0679 Oslo, er ansvarlig for opplysningene som samles inn på denne nettsiden. Du når oss på{" "}
        <a href="mailto:info@iqrasenter.net">info@iqrasenter.net</a> eller <a href="tel:+4799864331">+47 998 64 331</a>.
      </p>

      <h2>Hva vi lagrer, og hvorfor</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Når</th>
            <th scope="col">Hva</th>
            <th scope="col">Hvorfor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Kontaktskjemaet</th>
            <td>Navn, e-postadresse og meldingen din</td>
            <td>For å svare på henvendelsen</td>
          </tr>
          <tr>
            <th scope="row">Interessemelding om skoleplass</th>
            <td>
              Barnets navn, fødselsdato og klassetrinn. Foresattes e-post, telefon og adresse. Samtykke til bilder, om barnet snakker arabisk, og eventuelle
              spesielle behov
            </td>
            <td>For å sette barnet på ventelisten og ta kontakt når det er plass</td>
          </tr>
          <tr>
            <th scope="row">Medlemsregistrering</th>
            <td>Navn, e-post, telefon, adresse, antall familiemedlemmer og eventuell melding</td>
            <td>For å registrere familien og sende informasjon om aktiviteter</td>
          </tr>
          <tr>
            <th scope="row">Besøk på nettsiden</th>
            <td>Anonym statistikk over sidevisninger, bare hvis du har sagt ja</td>
            <td>For å se hva som leses og hva som kan bli bedre</td>
          </tr>
        </tbody>
      </table>
      <p>
        Opplysninger om barn gis av foresatte. Opplysninger om spesielle behov er helseopplysninger, og vi bruker dem bare til å tilrettelegge for barnet. Du kan
        la feltet stå tomt.
      </p>

      <h2>Hvem får opplysningene</h2>
      <p>
        Skjemaene sendes via Formspree, en amerikansk tjeneste som tar imot meldingen og videresender den til oss. Nettsiden ligger hos Vercel, som også er et
        amerikansk selskap. Opplysninger du sender kan derfor bli behandlet utenfor EØS. Vi selger ikke opplysninger og deler dem ikke med andre.
      </p>
      <p>
        Betaling med Vipps, bankoverføring eller AvtaleGiro skjer utenfor nettsiden. Vi ser bare at betalingen er mottatt. Innlogging i portalen skjer på{" "}
        <a href="https://portal.iqrasenter.no">portal.iqrasenter.no</a>, som er en egen tjeneste.
      </p>

      <h2>Hvor lenge vi lagrer</h2>
      <p>Vi lagrer opplysningene så lenge vi trenger dem til formålet de ble gitt for, og sletter dem etter det. Du kan når som helst be oss slette dem tidligere.</p>

      <h2>Informasjonskapsler og statistikk</h2>
      <p>
        Nettsiden bruker ingen informasjonskapsler til sporing eller reklame. Hvis du sier ja til statistikk, teller vi sidevisninger med Vercel Web Analytics. Den
        bruker ikke informasjonskapsler og følger deg ikke fra nettsted til nettsted. Svaret ditt lagres i nettleseren din, slik at vi ikke spør hver gang. Sier du
        nei, lastes ikke statistikken.
      </p>
      <p>
        <CookieSettingsButton className="legal-link">Endre valget ditt</CookieSettingsButton>
      </p>

      <h2>Rettighetene dine</h2>
      <p>Du har rett til å:</p>
      <ul>
        <li>få vite hvilke opplysninger vi har om deg, og få en kopi</li>
        <li>få rettet opplysninger som er feil</li>
        <li>få opplysningene slettet</li>
        <li>be oss begrense bruken av dem, eller protestere mot den</li>
        <li>trekke tilbake et samtykke du har gitt</li>
      </ul>
      <p>
        Send oss en e-post, så svarer vi. Er du ikke fornøyd med svaret, kan du klage til <a href="https://www.datatilsynet.no">Datatilsynet</a>.
      </p>

      <h2>Endringer</h2>
      <p>Hvis vi endrer hva vi samler inn, oppdaterer vi denne siden og datoen øverst.</p>
    </LegalPage>
  );
}
