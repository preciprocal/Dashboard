// components/seo/JsonLd.tsx
import { SITE } from "@/lib/seo";

/**
 * Organization schema. Tells Google "this is the official Preciprocal app"
 * and points the brand knowledge panel at the marketing site (where it
 * canonically lives).
 */
export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.marketing,
    logo: `${SITE.marketing}/logo.png`,
    // Only profiles that exist. The placeholder Twitter and LinkedIn URLs
    // here returned 404, which search engines read as a broken entity.
    sameAs: ["https://preciprocal.com"],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * SoftwareApplication schema. Helps Google show rich results
 * (rating, price, category) for branded queries.
 */
export function SoftwareAppJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Chrome Extension",
    url: SITE.marketing,
    description: SITE.description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "1200",
    },
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}