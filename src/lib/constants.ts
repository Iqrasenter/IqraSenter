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

export const NAV_ITEMS = [
  { label: "Om oss", href: "/om-oss" },
  { label: "Aktuelt", href: "/aktuelt" },
  { label: "Nettbutikk", href: "/netbutikk" },
  { label: "Bli medlem / Opptak", href: "/bli-medlem" },
  { label: "Kontakt oss", href: "/kontakt" },
] as const;

export const SERVICES = [
  {
    title: "Helgeskole",
    description:
      "Vi tilbyr helgeskole der barn og unge kan lære språk, kultur og tradisjon på en engasjerende og praktisk måte. Helgeskolen er en flott måte å utvikle både faglige ferdigheter og sosiale nettverk på!",
    image: "/images/helgeskole.jpg",
    icon: "BookOpen" as const,
    size: "large" as const,
  },
  {
    title: "Fritidsaktiviteter",
    description:
      "Medlemmene får muligheten til delta i spennende utflukter og sosiale aktiviteter. Dette gir dem unik mulighet til å både lære og knytte bånd med andre.",
    image: "/images/fritid.jpg",
    icon: "Users" as const,
    size: "large" as const,
  },
  {
    title: "Kurs og opplæring",
    description:
      "Vi tilbyr en rekke spesialiserte kurs og seminarer innenfor språk, kultur, barneoppdragelse, personlig utvikling, etc.",
    image: "/images/kurs.png",
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
      "Tusen takk for en fantastisk helg på hyttetur! Jeg lærte mye nytt og fikk nye venner, og det setter jeg stor pris på. Dere har virkelig gjort en flott jobb med å organisere alt, og det var en perfekt blanding av aktiviteter og avslapning.",
    initials: "H",
  },
] as const;

export const NEWS = [
  {
    title: "Nye utgivelser: To nye islamske barnebøker",
    excerpt:
      "Vi har gleden av å presentere to nye barnebøker med fokus på islamsk barneoppdragelse. Bøkene er nå til salgs i vår nettbutikk og hos våre utsalgssteder.",
    date: "2026-02-26",
    image: "/images/books-combined.png",
  },
  {
    title: "Foreldremøte — Viktig beskjed til alle foreldre",
    excerpt:
      "Ledelsen i Iqra kaller inn alle foreldre til foreldremøte. Søndag 09.02.2025 kl. 15:30 i Iqra sine lokaler.",
    date: "2025-02-05",
    image: "/images/lokale.jpg",
  },
  {
    title: "Intern Koran-konkurranse avsluttet",
    excerpt:
      "Alle deltakerne har gjort en fantastisk innsats. Gratulerer til alle som har deltatt!",
    date: "2025-01-20",
    image: "/images/koran-konkurranse.jpg",
  },
  {
    title: "Refleksjonskveld med imam Abdifataah",
    excerpt:
      "En inspirerende refleksjonskveld og workshop om egenskapene som er mest elsket av Allah.",
    date: "2025-01-04",
    image: "/images/helgeskole.jpg",
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
  { value: "8", label: "Rom tilgjengelig" },
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
    image: "/images/bok1.png",
    description:
      "En vakker islamsk bildebok for barn med fargerike illustrasjoner og inspirerende fortellinger.",
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BOOK1 || "price_placeholder_1",
  },
  {
    slug: "islamic-book-2",
    name: "Islamsk Bok 2",
    price: 299,
    image: "/images/bok2.png",
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
