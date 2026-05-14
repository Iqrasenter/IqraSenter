export { SITE, STATS } from "./site-config";

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
