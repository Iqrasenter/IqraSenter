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
