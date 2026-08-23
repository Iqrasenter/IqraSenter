export const SITE = {
  name: "Iqra Læring og Aktivitetssenter",
  shortName: "Iqra Senter",
  tagline: "Læring og aktivitet for hele familien",
  description:
    "Et trygt og inkluderende fellesskap med læring, fritidsaktiviteter og sosialt samvær for barn, unge og familier i Oslo.",
  email: "info@iqrasenter.net",
  phone: "+47 998 64 331",
  phoneRaw: "+4799864331",
  address: "Ryenstubben 2, 0679 Oslo",
  mapUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2001.5!2d10.7942!3d59.8963!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x46416e5c8b4a0a0b%3A0x0!2sRyenstubben+2%2C+0679+Oslo!5e0!3m2!1sno!2sno!4v1",
  social: {
    facebook: "https://www.facebook.com/iqrasenter",
    instagram: "https://www.instagram.com/iqrasenter",
    whatsapp: "https://wa.me/4799864331",
  },
} as const;

/** Elev-, foresatt- og ansattportalen. Egen app på eget subdomene. */
export const PORTAL_URL = "https://portal.iqrasenter.no";

export const NAV_ITEMS = [
  { label: "Siste Nytt", href: "/sistenytt" },
  { label: "Nettbutikk", href: "/nettbutikk" },
  { label: "Bli medlem / Opptak", href: "/bli-medlem" },
  { label: "Om oss", href: "/om-oss" },
  { label: "Kontakt oss", href: "/kontakt" },
] as const;

export const SERVICES = [
  {
    title: "Helgeskole",
    description:
      "Vi tilbyr helgeskole der barn og unge kan lære språk, kultur og tradisjon på en engasjerende og praktisk måte. Helgeskolen er en flott måte å utvikle både faglige ferdigheter og sosiale nettverk på!",
    image: "/images/fritid.webp",
    icon: "BookOpen" as const,
    size: "large" as const,
  },
  {
    title: "Fritidsaktiviteter",
    description:
      "Medlemmene får muligheten til delta i spennende utflukter og sosiale aktiviteter. Dette gir dem unik mulighet til å både lære og knytte bånd med andre.",
    image: "/images/iqrany1.webp",
    icon: "Users" as const,
    size: "large" as const,
  },
  {
    title: "Kurs og opplæring",
    description:
      "Vi tilbyr en rekke spesialiserte kurs og seminarer innenfor språk, kultur, barneoppdragelse, personlig utvikling, etc.",
    image: "/images/iqrasenter8.webp",
    icon: "GraduationCap" as const,
    size: "small" as const,
  },
] as const;

export const TESTIMONIALS = [
  {
    name: "Hibo",
    age: 21,
    quote:
      "Iqra læring og aktivitetssenter har vært en fantastisk opplevelse for vår familie! Vi har lært så mye sammen.",
    initials: "H",
  },
  {
    name: "Khalid",
    age: 17,
    quote:
      "Jeg kan ikke si nok om den enestående servicen jeg mottok fra firmaet ditt. Teamet deres gikk utover for å møte våre behov og overgikk forventningene våre.",
    initials: "K",
  },
  {
    name: "Hussein",
    age: 24,
    quote:
      "Tusen takk for en fantastisk helg på hyttetur! Jeg lærte mye nytt og fikk nye venner. Dere har gjort en flott jobb med å organisere alt!",
    initials: "H",
  },
] as const;

export const NEWS = [
  {
    title: "Iqra Sommerskole 2026",
    excerpt:
      "Iqra Senter inviterer til en lærerik og minnerik sommer! En hel måned fylt med islamsk undervisning, lek, uteaktiviteter og turer — en flott mulighet for barna til å lære, vokse og knytte nye vennskap i trygge og inspirerende omgivelser.",
    date: "2026-06-18",
    image: "/images/sommerskole-2026.webp",
    imagePosition: "center top",
    details: [
      { icon: "Calendar", text: "29. juni – 30. juli 2026 (uke 27–31)" },
      { icon: "Clock", text: "Mandag–torsdag kl. 11:00–16:00, med én time aktivitet hver dag" },
      { icon: "MapPin", text: "Iqra Senter, Ryenstubben 2, Oslo" },
      { icon: "Users", text: "For barn og unge, jenter og gutter — elever ved Iqra eller på venteliste" },
      { icon: "Coins", text: "Skoleavgift: 400 kr for aktive elever / 1200 kr for øvrige" },
      { icon: "CalendarClock", text: "Påmeldingsfrist: søndag 21. juni — begrenset antall plasser" },
    ],
    cta: {
      label: "Innmeldingsskjema",
      href: "https://docs.google.com/forms/d/e/1FAIpQLScHmgO3SRN-P0mRmh3XjkG_JVHQenB1Em6M4UiP-GPqjDmO-g/viewform",
    },
  },
  {
    title: "Tusen takk for en fantastisk sommerfest!",
    excerpt:
      "Tusen takk til alle som deltok på Iqras sommerfest! Vi hadde en fantastisk dag med stort oppmøte, herlig fellesskap og masse glede. Barna og ungdommene imponerte med sine fremføringer, vi hadde inspirerende taler, ansiktsmaling, fotball, stikkball, sang, lek og nydelig mat. En stor takk til alle frivillige, foreldre og medlemmer som gjorde dagen så vellykket — sammen skaper vi et trygt og inkluderende fellesskap for våre barn og unge.",
    cardExcerpt:
      "Tusen takk til alle som deltok på Iqras sommerfest! En fantastisk dag med stort oppmøte, herlig fellesskap og masse glede.",
    date: "2026-06-14",
    image: "/images/sommerfest-1.webp",
    gallery: [
      { src: "/images/sommerfest-1.webp", w: 1600, h: 900, alt: "Barn og ungdom fremfører på scenen under Iqras sommerfest" },
      { src: "/images/sommerfest-2.webp", w: 1200, h: 1600, alt: "Ansiktsmaling av et barn på sommerfesten" },
      { src: "/images/sommerfest-3.webp", w: 1200, h: 1600, alt: "To barn presenterer med mikrofon på scenen" },
      { src: "/images/sommerfest-4.webp", w: 1200, h: 1600, alt: "Jenter samlet ute i sommersol på sommerfesten" },
      { src: "/images/sommerfest-5.webp", w: 1200, h: 1600, alt: "Publikum følger med under fremføringene" },
      { src: "/images/sommerfest-6.webp", w: 1200, h: 1600, alt: "Barn med ansiktsmaling ute på sommerfesten" },
      { src: "/images/sommerfest-7.webp", w: 1200, h: 1600, alt: "Elev synger på scenen" },
      { src: "/images/sommerfest-8.webp", w: 1080, h: 622, alt: "Gjestetaler holder innlegg under sommerfesten" },
      { src: "/images/sommerfest-9.webp", w: 1200, h: 1600, alt: "Full sal med deltakere på sommerfesten" },
      { src: "/images/sommerfest-10.webp", w: 1114, h: 1600, alt: "Presentasjon av nye Tarbiyah-bøker på scenen" },
    ],
  },
  {
    title: "Nye utgivelser: To nye barnebøker",
    excerpt:
      "Vi har gleden av å presentere to nye barnebøker med fokus på islamsk barneoppdragelse. Bøkene er nå til salgs i vår nettbutikk og hos våre utsalgssteder.",
    date: "2026-02-26",
    image: "/images/books-combined.webp",
  },
  {
    title: "Foreldremøte — Viktig beskjed til alle foreldre",
    excerpt:
      "Ledelsen i Iqra kaller inn alle foreldre til foreldremøte. Søndag 09.02.2025 kl. 15:30 i Iqra sine lokaler.",
    date: "2025-02-05",
    image: "/images/iqrany5.webp",
    imagePosition: "center 20%",
  },
  {
    title: "Intern Koran-konkurranse avsluttet",
    excerpt:
      "Alle deltakerne har gjort en fantastisk innsats. Gratulerer til alle som har deltatt!",
    date: "2025-01-20",
    image: "/images/iqrany4.webp",
    imagePosition: "center 20%",
  },
  {
    title: "Refleksjonskveld med imam Abdifataah",
    excerpt:
      "En inspirerende refleksjonskveld og workshop om egenskapene som er mest elsket av Allah.",
    date: "2025-01-04",
    image: "/images/helgeskole.webp",
  },
] as const;

export const TEACHERS = [
  {
    name: "Fatima Hassan",
    designation: "Arabisklærer",
    quote:
      "Det beste med å undervise her er å se barna vokse — både faglig og som mennesker. Iqra gir rom for læring med hjertet.",
    src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&h=500&fit=crop",
  },
  {
    name: "Ahmed Mohamed",
    designation: "Koranlærer",
    quote:
      "Å formidle Koranens budskap til neste generasjon er et stort ansvar og en enda større glede. Elevene inspirerer meg hver dag.",
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=500&fit=crop",
  },
  {
    name: "Maryam Ali",
    designation: "Fritidskoordinator",
    quote:
      "Fritidsaktivitetene handler om mer enn bare moro — det er her barna bygger vennskap og selvtillit for livet.",
    src: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=500&h=500&fit=crop",
  },
  {
    name: "Omar Ibrahim",
    designation: "Islamsk studielærer",
    quote:
      "Vi skaper et trygt rom der ungdommene kan stille spørsmål, reflektere og finne sin egen vei innen troen.",
    src: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&h=500&fit=crop",
  },
] as const;

export const STATS = [
  { value: "200+", label: "Medlemmer" },
  { value: "5+", label: "År aktive" },
  { value: "50+", label: "Arrangementer i året" },
] as const;

export interface Product {
  slug: string;
  name: string;
  price: number;
  image: string;
  description: string;
  stripePriceId: string;
}

export const PRODUCTS: Product[] = [
  {
    slug: "islamic-book-1",
    name: "Islamsk Bok 1",
    price: 299,
    image: "/images/bok1.webp",
    description:
      "En vakker islamsk bildebok for barn med fargerike illustrasjoner og inspirerende fortellinger.",
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BOOK1 || "price_placeholder_1",
  },
  {
    slug: "islamic-book-2",
    name: "Islamsk Bok 2",
    price: 299,
    image: "/images/bok2.webp",
    description:
      "En vakker islamsk bildebok for barn med fargerike illustrasjoner og inspirerende fortellinger.",
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BOOK2 || "price_placeholder_2",
  },
];

export const DELIVERY_LOCATIONS = [
  "Marakiz 1",
  "Marakiz 2",
  "Marakiz 3",
  "Marakiz 4",
] as const;
