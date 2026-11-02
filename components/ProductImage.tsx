"use client";

import { useState } from "react";
import { CATEGORY_GLYPH } from "@/lib/category";
import { safeImageUrl } from "@/lib/product-image";
import type { Category } from "@/lib/types";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  category: Category;
  className?: string;
};

export default function ProductImage({ src, alt, category, className = "" }: ProductImageProps) {
  const imageSrc = safeImageUrl(src);
  const [state, setState] = useState<"loading" | "loaded" | "error">(imageSrc ? "loading" : "error");

  if (state === "error" || !imageSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-50 to-brand-50 text-4xl ${className}`}
      >
        <span aria-hidden="true">{CATEGORY_GLYPH[category]}</span>
      </div>
    );
  }

  return (
    <div
      aria-busy={state === "loading"}
      className={`relative h-full w-full overflow-hidden bg-gradient-to-br from-ink-50 to-brand-50 ${className}`}
    >
      {state === "loading" && (
        <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-ink-50" />
      )}
      <img
        src={imageSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
        className={`h-full w-full object-cover transition-opacity ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
