# Netbutikk (Webstore) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a webstore section selling Islamic children's books with a shopping cart, Stripe Checkout, and Vipps payment integration.

**Architecture:** Static product data in constants, React Context cart persisted to localStorage, Next.js API route creating Stripe Checkout Sessions. Normal scrollable pages (not snap scroll) matching the editorial style of existing subpages (om-oss, kontakt, etc.).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Stripe SDK, Framer Motion, Lucide React icons

---

### Task 1: Install Stripe dependency

**Files:**
- Modify: `package.json`

**Step 1: Install stripe package**

Run: `cd /Users/daodilyas/Desktop/iqra && npm install stripe`

**Step 2: Verify installation**

Run: `npm ls stripe`
Expected: `stripe@x.x.x` listed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add stripe dependency for webstore"
```

---

### Task 2: Add product data and delivery locations to constants

**Files:**
- Modify: `src/lib/constants.ts:20-28` (add nav item after Aktuelt)
- Modify: `src/lib/constants.ts` (add products + delivery locations at bottom)

**Step 1: Add Netbutikk to NAV_ITEMS after Aktuelt (line 23)**

In `src/lib/constants.ts`, insert after `{ label: "Aktuelt", href: "/aktuelt" },`:

```ts
  { label: "Netbutikk", href: "/netbutikk" },
```

**Step 2: Add product types and data at bottom of constants.ts**

Append to `src/lib/constants.ts`:

```ts
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
```

**Step 3: Verify build**

Run: `cd /Users/daodilyas/Desktop/iqra && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add product data, delivery locations, and netbutikk nav item"
```

---

### Task 3: Create Cart Context with localStorage persistence

**Files:**
- Create: `src/lib/cart-context.tsx`

**Step 1: Create cart context**

Create `src/lib/cart-context.tsx`:

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "./constants";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (slug: string) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "iqra-cart";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage may be unavailable
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  // Persist to localStorage on change (after hydration)
  useEffect(() => {
    if (hydrated) saveCart(items);
  }, [items, hydrated]);

  const addToCart = useCallback((product: Product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.slug === product.slug);
      if (existing) {
        return prev.map((item) =>
          item.product.slug === product.slug
            ? { ...item, quantity: Math.min(item.quantity + quantity, 10) }
            : item
        );
      }
      return [...prev, { product, quantity: Math.min(quantity, 10) }];
    });
  }, []);

  const removeFromCart = useCallback((slug: string) => {
    setItems((prev) => prev.filter((item) => item.product.slug !== slug));
  }, []);

  const updateQuantity = useCallback((slug: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) =>
      prev.map((item) =>
        item.product.slug === slug
          ? { ...item, quantity: Math.min(quantity, 10) }
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const cartCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const cartTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items]
  );

  const value = useMemo<CartContextType>(
    () => ({ items, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal }),
    [items, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
```

**Step 2: Add CartProvider to layout.tsx**

In `src/app/layout.tsx`, add import at top:

```tsx
import { CartProvider } from "@/lib/cart-context";
```

Wrap children inside `<ScrollProvider>` with `<CartProvider>`:

```tsx
<ScrollProvider>
  <CartProvider>
    <NoiseOverlay />
    <Navbar />
    <main>{children}</main>
  </CartProvider>
</ScrollProvider>
```

**Step 3: Verify build**

Run: `cd /Users/daodilyas/Desktop/iqra && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/lib/cart-context.tsx src/app/layout.tsx
git commit -m "feat: add CartProvider with localStorage persistence"
```

---

### Task 4: Add cart icon badge to Navbar

**Files:**
- Modify: `src/components/Navbar.tsx`

**Step 1: Add cart icon to Navbar**

In `src/components/Navbar.tsx`:

1. Add imports: `import { Menu, X, ShoppingCart } from "lucide-react";` and `import { useCart } from "@/lib/cart-context";`
2. Inside the `Navbar` component, add: `const { cartCount } = useCart();`
3. Add cart icon link before the mobile menu button (after the CTA button around line 98). Place it between the desktop CTA and mobile menu button:

```tsx
{/* Cart icon */}
<Link
  href="/netbutikk/handlekurv"
  className={`relative p-2 rounded-full transition-colors cursor-pointer ${
    lightText
      ? "text-white hover:bg-white/10"
      : "text-text hover:bg-black/5"
  }`}
  aria-label="Handlekurv"
>
  <ShoppingCart size={20} />
  {cartCount > 0 && (
    <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-accent text-white text-[10px] font-bold rounded-full">
      {cartCount}
    </span>
  )}
</Link>
```

4. Also add the cart link in the mobile menu (inside the mobile menu div, before the "Bli medlem" link).

**Step 2: Verify dev server**

Run: `cd /Users/daodilyas/Desktop/iqra && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: add cart icon with badge to navbar"
```

---

### Task 5: Create product listing page (/netbutikk)

**Files:**
- Create: `src/app/netbutikk/page.tsx`
- Create: `src/components/ProductCard.tsx`

**Step 1: Create ProductCard component**

Create `src/components/ProductCard.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/constants";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/netbutikk/${product.slug}`}
      className="group block rounded-2xl border border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
    >
      <div className="relative aspect-square bg-white p-8">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
      <div className="p-6">
        <h3 className="font-heading text-lg font-bold text-text group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <p className="mt-1 text-sm text-text-muted line-clamp-2">
          {product.description}
        </p>
        <p className="mt-3 font-data text-lg font-bold text-accent">
          {product.price} kr
        </p>
      </div>
    </Link>
  );
}
```

**Step 2: Create product listing page**

Create `src/app/netbutikk/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PRODUCTS } from "@/lib/constants";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { FadeIn } from "@/components/FadeIn";
import { ProductCard } from "@/components/ProductCard";

export const metadata: Metadata = {
  title: "Netbutikk",
  description:
    "Kjop islamske barneboker og andre produkter fra Iqra Laering og Aktivitetssenter.",
};

export default function NetbutikkPage() {
  return (
    <>
      <EditorialPageHeader
        label="Netbutikk"
        title="Var nettbutikk"
        subtitle="Utforsk vart utvalg av islamske barneboker — vakre illustrasjoner og inspirerende fortellinger for de minste."
      />

      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {PRODUCTS.map((product, index) => (
              <FadeIn key={product.slug} delay={index * 0.1}>
                <ProductCard product={product} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
```

**Step 3: Verify build**

Run: `cd /Users/daodilyas/Desktop/iqra && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/netbutikk/page.tsx src/components/ProductCard.tsx
git commit -m "feat: add product listing page and ProductCard component"
```

---

### Task 6: Create product detail page (/netbutikk/[slug])

**Files:**
- Create: `src/app/netbutikk/[slug]/page.tsx`
- Create: `src/components/AddToCartButton.tsx`

**Step 1: Create AddToCartButton client component**

Create `src/components/AddToCartButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ShoppingCart, Minus, Plus, Check } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/constants";

export function AddToCartButton({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Quantity selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-text-muted">Antall:</span>
        <div className="flex items-center border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3 py-2 hover:bg-primary/5 transition-colors cursor-pointer"
            aria-label="Reduser antall"
          >
            <Minus size={16} />
          </button>
          <span className="px-4 py-2 font-data font-bold text-sm min-w-[3rem] text-center">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity((q) => Math.min(10, q + 1))}
            className="px-3 py-2 hover:bg-primary/5 transition-colors cursor-pointer"
            aria-label="Oek antall"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Add to cart button */}
      <button
        onClick={handleAdd}
        className={`w-full flex items-center justify-center gap-2 px-8 py-4 font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer text-base ${
          added
            ? "bg-green-600 text-white"
            : "bg-accent hover:bg-accent-light text-white"
        }`}
      >
        {added ? (
          <>
            <Check size={20} />
            Lagt til i handlekurven
          </>
        ) : (
          <>
            <ShoppingCart size={20} />
            Legg i handlekurv — {product.price * quantity} kr
          </>
        )}
      </button>
    </div>
  );
}
```

**Step 2: Create product detail page**

Create `src/app/netbutikk/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PRODUCTS } from "@/lib/constants";
import { FadeIn } from "@/components/FadeIn";
import { AddToCartButton } from "@/components/AddToCartButton";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) notFound();

  return (
    <section className="pt-28 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <FadeIn>
          <Link
            href="/netbutikk"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors mb-8 cursor-pointer"
          >
            <ArrowLeft size={16} />
            Tilbake til nettbutikken
          </Link>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Image */}
          <FadeIn>
            <div className="relative aspect-square bg-white rounded-2xl border border-border/50 p-8">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-contain p-8"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </FadeIn>

          {/* Info */}
          <FadeIn delay={0.1}>
            <div className="flex flex-col justify-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                Barnebok
              </span>
              <h1 className="mt-3 font-heading text-3xl lg:text-4xl font-bold text-text">
                {product.name}
              </h1>
              <p className="mt-4 text-lg text-text-muted leading-relaxed">
                {product.description}
              </p>
              <p className="mt-6 font-data text-3xl font-bold text-accent">
                {product.price} kr
              </p>

              <div className="mt-8">
                <AddToCartButton product={product} />
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
```

**Step 3: Verify build**

Run: `cd /Users/daodilyas/Desktop/iqra && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/netbutikk/[slug]/page.tsx src/components/AddToCartButton.tsx
git commit -m "feat: add product detail page with add-to-cart functionality"
```

---

### Task 7: Create cart page (/netbutikk/handlekurv)

**Files:**
- Create: `src/app/netbutikk/handlekurv/page.tsx`
- Create: `src/components/CartPageContent.tsx`

**Step 1: Create CartPageContent client component**

Create `src/components/CartPageContent.tsx`:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { DELIVERY_LOCATIONS } from "@/lib/constants";

export function CartPageContent() {
  const { items, updateQuantity, removeFromCart, cartTotal } = useCart();
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!deliveryLocation) return;
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            slug: item.product.slug,
            quantity: item.quantity,
          })),
          deliveryLocation,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <ShoppingCart size={48} className="mx-auto text-border mb-4" />
        <h2 className="font-heading text-2xl font-bold text-text">
          Handlekurven er tom
        </h2>
        <p className="mt-2 text-text-muted">
          Utforsk nettbutikken var og legg til produkter.
        </p>
        <Link
          href="/netbutikk"
          className="inline-flex items-center mt-6 px-6 py-3 bg-accent hover:bg-accent-light text-white font-semibold rounded-xl transition-colors cursor-pointer"
        >
          Ga til nettbutikken
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
      {/* Cart items */}
      <div className="lg:col-span-2 space-y-4">
        {items.map((item) => (
          <div
            key={item.product.slug}
            className="flex gap-4 p-4 rounded-xl border border-border/50"
          >
            <div className="relative w-20 h-20 bg-white rounded-lg border border-border/30 shrink-0">
              <Image
                src={item.product.image}
                alt={item.product.name}
                fill
                className="object-contain p-2"
                sizes="80px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/netbutikk/${item.product.slug}`}
                className="font-heading font-bold text-text hover:text-primary transition-colors cursor-pointer"
              >
                {item.product.name}
              </Link>
              <p className="text-sm text-text-muted mt-1">
                {item.product.price} kr per stk
              </p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() =>
                      updateQuantity(item.product.slug, item.quantity - 1)
                    }
                    disabled={item.quantity <= 1}
                    className="px-2 py-1 hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-30"
                    aria-label="Reduser antall"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="px-3 py-1 font-data text-sm font-bold">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() =>
                      updateQuantity(item.product.slug, item.quantity + 1)
                    }
                    disabled={item.quantity >= 10}
                    className="px-2 py-1 hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-30"
                    aria-label="Oek antall"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  onClick={() => removeFromCart(item.product.slug)}
                  className="p-1 text-text-muted hover:text-red-500 transition-colors cursor-pointer"
                  aria-label="Fjern fra handlekurv"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-data font-bold text-text">
                {item.product.price * item.quantity} kr
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Order summary */}
      <div className="lg:col-span-1">
        <div className="sticky top-28 rounded-2xl border border-border/50 p-6 space-y-6">
          <h3 className="font-heading text-lg font-bold text-text">
            Ordresammendrag
          </h3>

          {/* Delivery location */}
          <div>
            <label
              htmlFor="delivery"
              className="block text-sm font-medium text-text-muted mb-2"
            >
              Hentested
            </label>
            <select
              id="delivery"
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent cursor-pointer"
            >
              <option value="">Velg hentested...</option>
              {DELIVERY_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Total */}
          <div className="border-t border-border/50 pt-4">
            <div className="flex justify-between items-center">
              <span className="font-heading font-bold text-text">Totalt</span>
              <span className="font-data text-2xl font-bold text-accent">
                {cartTotal} kr
              </span>
            </div>
          </div>

          {/* Checkout button */}
          <button
            onClick={handleCheckout}
            disabled={!deliveryLocation || loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-accent hover:bg-accent-light disabled:bg-border disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer"
          >
            {loading ? "Laster..." : "Ga til betaling"}
          </button>

          {deliveryLocation === "" && (
            <p className="text-xs text-text-muted text-center">
              Velg et hentested for a ga videre
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create cart page**

Create `src/app/netbutikk/handlekurv/page.tsx`:

```tsx
import type { Metadata } from "next";
import { EditorialPageHeader } from "@/components/EditorialPageHeader";
import { CartPageContent } from "@/components/CartPageContent";

export const metadata: Metadata = {
  title: "Handlekurv",
  description: "Din handlekurv hos Iqra Senter.",
};

export default function HandlekurvPage() {
  return (
    <>
      <EditorialPageHeader
        label="Handlekurv"
        title="Din handlekurv"
        subtitle="Se over bestillingen din og velg hentested for a fullfoere kjopet."
      />

      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <CartPageContent />
        </div>
      </section>
    </>
  );
}
```

**Step 3: Verify build**

Run: `cd /Users/daodilyas/Desktop/iqra && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/netbutikk/handlekurv/page.tsx src/components/CartPageContent.tsx
git commit -m "feat: add cart page with delivery location selector"
```

---

### Task 8: Create Stripe Checkout API route

**Files:**
- Create: `src/app/api/checkout/route.ts`
- Create: `.env.local` (if not exists — add Stripe keys)

**Step 1: Create .env.local with placeholder keys**

Create `.env.local` (NOT committed to git):

```
STRIPE_SECRET_KEY=sk_test_REPLACE_ME
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_REPLACE_ME
NEXT_PUBLIC_STRIPE_PRICE_BOOK1=price_REPLACE_ME
NEXT_PUBLIC_STRIPE_PRICE_BOOK2=price_REPLACE_ME
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Step 2: Create the API route**

Create `src/app/api/checkout/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { PRODUCTS } from "@/lib/constants";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, deliveryLocation } = body as {
      items: { slug: string; quantity: number }[];
      deliveryLocation: string;
    };

    // Validate delivery location
    const validLocations = ["Marakiz 1", "Marakiz 2", "Marakiz 3", "Marakiz 4"];
    if (!validLocations.includes(deliveryLocation)) {
      return NextResponse.json(
        { error: "Ugyldig hentested" },
        { status: 400 }
      );
    }

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    for (const item of items) {
      const product = PRODUCTS.find((p) => p.slug === item.slug);
      if (!product) {
        return NextResponse.json(
          { error: `Produkt ikke funnet: ${item.slug}` },
          { status: 400 }
        );
      }
      lineItems.push({
        price: product.stripePriceId,
        quantity: Math.min(Math.max(item.quantity, 1), 10),
      });
    }

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "Ingen produkter i bestillingen" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      metadata: {
        delivery_location: deliveryLocation,
      },
      success_url: `${baseUrl}/netbutikk/bekreftelse?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/netbutikk/avbrutt`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Kunne ikke opprette betalingsoekt" },
      { status: 500 }
    );
  }
}
```

**Note on Vipps:** `payment_method_types` starts with `["card"]`. Once you enable Vipps MobilePay in your Stripe Dashboard (Settings → Payment methods), add `"vipps_mobilepay"` to the array. Stripe requires the payment method to be enabled in the Dashboard before it can be used in API calls.

**Step 3: Verify build**

Run: `cd /Users/daodilyas/Desktop/iqra && npx next build 2>&1 | tail -20`
Expected: Build succeeds (API route compiles even without real keys)

**Step 4: Commit**

```bash
git add src/app/api/checkout/route.ts
git commit -m "feat: add Stripe Checkout API route with delivery metadata"
```

---

### Task 9: Create success and cancel pages

**Files:**
- Create: `src/app/netbutikk/bekreftelse/page.tsx`
- Create: `src/app/netbutikk/avbrutt/page.tsx`
- Create: `src/components/ClearCartOnSuccess.tsx`

**Step 1: Create ClearCartOnSuccess client component**

Create `src/components/ClearCartOnSuccess.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-context";

export function ClearCartOnSuccess() {
  const { clearCart } = useCart();
  useEffect(() => {
    clearCart();
  }, [clearCart]);
  return null;
}
```

**Step 2: Create success page**

Create `src/app/netbutikk/bekreftelse/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/FadeIn";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";

export const metadata: Metadata = {
  title: "Bestilling bekreftet",
  description: "Takk for din bestilling hos Iqra Senter.",
};

export default function BekreftelsePage() {
  return (
    <section className="pt-28 pb-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
        <ClearCartOnSuccess />
        <FadeIn>
          <CheckCircle size={64} className="mx-auto text-green-500 mb-6" />
          <h1 className="font-heading text-3xl lg:text-4xl font-bold text-text">
            Takk for bestillingen!
          </h1>
          <p className="mt-4 text-lg text-text-muted">
            Vi har mottatt bestillingen din. Du vil faa en bekreftelse paa e-post.
            Boken(e) kan hentes paa valgt hentested.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/netbutikk"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all duration-200 shadow-lg cursor-pointer"
            >
              Fortsett a handle
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border hover:border-primary text-text font-semibold rounded-xl transition-all duration-200 cursor-pointer"
            >
              Tilbake til forsiden
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
```

**Step 3: Create cancel page**

Create `src/app/netbutikk/avbrutt/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { XCircle, ArrowLeft } from "lucide-react";
import { FadeIn } from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Betaling avbrutt",
  description: "Betalingen ble avbrutt.",
};

export default function AvbruttPage() {
  return (
    <section className="pt-28 pb-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
        <FadeIn>
          <XCircle size={64} className="mx-auto text-text-muted mb-6" />
          <h1 className="font-heading text-3xl lg:text-4xl font-bold text-text">
            Betaling avbrutt
          </h1>
          <p className="mt-4 text-lg text-text-muted">
            Det ser ut som du avbroeyt betalingen. Varene dine ligger fortsatt i
            handlekurven.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/netbutikk/handlekurv"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all duration-200 shadow-lg cursor-pointer"
            >
              <ArrowLeft size={18} />
              Tilbake til handlekurven
            </Link>
            <Link
              href="/netbutikk"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border hover:border-primary text-text font-semibold rounded-xl transition-all duration-200 cursor-pointer"
            >
              Fortsett a handle
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
```

**Step 4: Verify build**

Run: `cd /Users/daodilyas/Desktop/iqra && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/app/netbutikk/bekreftelse/page.tsx src/app/netbutikk/avbrutt/page.tsx src/components/ClearCartOnSuccess.tsx
git commit -m "feat: add order confirmation and cancellation pages"
```

---

### Task 10: Add Footer to netbutikk pages

**Files:**
- Modify: `src/app/netbutikk/page.tsx` (add Footer import + render)
- Modify: `src/app/netbutikk/[slug]/page.tsx` (add Footer)
- Modify: `src/app/netbutikk/handlekurv/page.tsx` (add Footer)
- Modify: `src/app/netbutikk/bekreftelse/page.tsx` (add Footer)
- Modify: `src/app/netbutikk/avbrutt/page.tsx` (add Footer)

**Step 1: Check if other subpages include Footer**

Check existing subpages (om-oss, kontakt) to see if Footer is included at the page level or in layout. If not already included globally, add `<Footer />` at the bottom of each netbutikk page.

If Footer is rendered per-page (as in the homepage snap scroll), add to each page:

```tsx
import { Footer } from "@/components/Footer";
// ... at end of JSX:
<Footer />
```

**Step 2: Verify dev server visually**

Run: `cd /Users/daodilyas/Desktop/iqra && npm run dev`
Navigate to `http://localhost:3000/netbutikk` and verify layout.

**Step 3: Commit**

```bash
git add src/app/netbutikk/
git commit -m "feat: add Footer to all netbutikk pages"
```

---

## Stripe Setup Checklist (Manual — for the user)

After the code is deployed, the user needs to:

1. Create a Stripe account at stripe.com
2. In Stripe Dashboard → Products: Create two products (Islamsk Bok 1, Islamsk Bok 2) with price 299 NOK each
3. Copy the Price IDs (e.g., `price_1Abc...`) into `.env.local`
4. In Stripe Dashboard → Settings → Payment methods: Enable "Vipps MobilePay"
5. Once Vipps is enabled, update the API route to include `"vipps_mobilepay"` in `payment_method_types`
6. Copy your Stripe secret key and publishable key into `.env.local`
7. Set `NEXT_PUBLIC_BASE_URL` to your production URL when deploying

---

## Summary of Files Created/Modified

**New files:**
- `src/lib/cart-context.tsx`
- `src/components/ProductCard.tsx`
- `src/components/AddToCartButton.tsx`
- `src/components/CartPageContent.tsx`
- `src/components/ClearCartOnSuccess.tsx`
- `src/app/netbutikk/page.tsx`
- `src/app/netbutikk/[slug]/page.tsx`
- `src/app/netbutikk/handlekurv/page.tsx`
- `src/app/netbutikk/bekreftelse/page.tsx`
- `src/app/netbutikk/avbrutt/page.tsx`
- `src/app/api/checkout/route.ts`
- `.env.local`

**Modified files:**
- `src/lib/constants.ts` (nav item + products + delivery locations)
- `src/app/layout.tsx` (CartProvider wrapper)
- `src/components/Navbar.tsx` (cart icon with badge)
- `package.json` (stripe dependency)
