import { SITE } from "@/lib/constants";

export function OrganizationJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: SITE.name,
    alternateName: SITE.shortName,
    url: "https://www.iqrasenter.net",
    logo: "https://www.iqrasenter.net/images/logo.png",
    description: SITE.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Ryenstubben 2",
      addressLocality: "Oslo",
      postalCode: "0679",
      addressCountry: "NO",
    },
    telephone: SITE.phone,
    email: SITE.email,
    sameAs: [SITE.social.facebook, SITE.social.instagram],
    areaServed: {
      "@type": "City",
      name: "Oslo",
    },
    inLanguage: "nb",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function WebSiteJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    alternateName: SITE.shortName,
    url: "https://www.iqrasenter.net",
    inLanguage: "nb",
    publisher: {
      "@type": "EducationalOrganization",
      name: SITE.name,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
