# Netbutikk (Webstore) Design

**Date:** 2026-02-23
**Status:** Approved
**Approach:** B — Cart system + Stripe Checkout (future-proofed for more products)

## Overview

Add a webstore section to the Iqra site selling Islamic children's books. Two products initially (Islamsk Bok 1 & 2), with a shopping cart for multi-item purchases and Stripe Checkout with Vipps integration.

## Requirements

- 2 products: Islamsk Bok 1, Islamsk Bok 2 (both 299 NOK)
- Images: `bok1.png`, `bok2.png` (already in `public/images/`)
- Quantity selector per product (1-10)
- Shopping cart (persisted to localStorage)
- 4 delivery locations only: Marakiz 1, Marakiz 2, Marakiz 3, Marakiz 4
- Stripe Checkout with Vipps MobilePay + card payments
- Navigation: after "Aktuelt" in navbar
- Normal scrollable page (not snap scroll)

## Pages & Routing

| Route | Purpose |
|---|---|
| `/netbutikk` | Product listing (grid of books) |
| `/netbutikk/[slug]` | Product detail page |
| `/netbutikk/handlekurv` | Cart page (review, select delivery, checkout) |
| `/api/checkout` | API route: creates Stripe Checkout Session |
| `/netbutikk/bekreftelse` | Success page after payment |
| `/netbutikk/avbrutt` | Cancel/return page |

## Data Model

Products stored in `src/lib/constants.ts`:

```ts
export interface Product {
  slug: string;
  name: string;
  price: number; // NOK
  image: string;
  description: string;
  stripePriceId: string;
}

export const products: Product[] = [
  {
    slug: "islamic-book-1",
    name: "Islamsk Bok 1",
    price: 299,
    image: "/images/bok1.png",
    description: "En vakker bildebok for barn...",
    stripePriceId: "price_REPLACE_WITH_REAL_ID",
  },
  {
    slug: "islamic-book-2",
    name: "Islamsk Bok 2",
    price: 299,
    image: "/images/bok2.png",
    description: "En vakker bildebok for barn...",
    stripePriceId: "price_REPLACE_WITH_REAL_ID",
  },
];

export const deliveryLocations = [
  "Marakiz 1",
  "Marakiz 2",
  "Marakiz 3",
  "Marakiz 4",
];
```

## Cart System

- **CartContext** (`src/lib/cart-context.tsx`) wrapping app in `layout.tsx`
- State: `CartItem[] = { product: Product, quantity: number }`
- Persisted to **localStorage** (survives refresh)
- API: `addToCart(product, qty)`, `removeFromCart(slug)`, `updateQuantity(slug, qty)`, `clearCart()`, `cartTotal`, `cartCount`
- Cart icon with badge in Navbar

## Checkout Flow

1. Browse `/netbutikk` → click book card
2. Product page → quantity selector → "Legg i handlekurv" button
3. `/netbutikk/handlekurv` → review items, adjust quantities, select delivery (Marakiz 1-4 dropdown)
4. "Ga til betaling" → POST to `/api/checkout` with cart items + delivery location
5. API creates Stripe Checkout Session → redirect to Stripe hosted page
6. Payment completes → redirect to `/netbutikk/bekreftelse` → cart cleared

## Stripe Integration

- **Package:** `stripe` (server-side)
- **Env vars:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Payment methods:** `card`, `vipps_mobilepay`
- **Checkout Session includes:**
  - Line items with quantity from cart
  - Delivery location as `metadata.delivery_location`
  - Success URL: `/netbutikk/bekreftelse?session_id={CHECKOUT_SESSION_ID}`
  - Cancel URL: `/netbutikk/avbrutt`
- Products/Prices created in Stripe Dashboard, IDs referenced in constants
- Vipps MobilePay enabled in Stripe Dashboard → Settings → Payment methods

## Visual Design

- Matches site aesthetic: Sora font, moss green/terracotta palette
- Product listing: 2-column grid (desktop), 1-column (mobile)
- Product cards: rounded corners, book image, title, price, "Se mer" link
- Product detail: image left + info right (desktop), stacked (mobile)
- Cart page: item list with qty adjusters, delivery dropdown, order total, CTA button
- All pages use existing Navbar + Footer
- Framer Motion fade-in animations consistent with other pages

## Navigation Update

Add to `src/lib/constants.ts` navItems after "Aktuelt":

```ts
{ name: "Netbutikk", href: "/netbutikk" },
```

## Future Considerations

- Cart system designed to scale to more products
- Stripe webhook for order fulfillment (not in v1)
- Order confirmation email (not in v1)
- Inventory tracking (not in v1)
