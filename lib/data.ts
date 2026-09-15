import { Product } from "./types";

// Seeded demo catalog — swap this module for a Prisma/Drizzle query layer
// in Phase 2 without touching any component code (see lib/repository.ts).
export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Classic Crew Tee",
    brand: "Everlane",
    category: "t-shirt",
    colors: ["black", "white", "navy"],
    sizes: ["S", "M", "L", "XL"],
    image: "/images/tee-1.svg",
    offers: [
      { store: "Everlane", price: 22, originalPrice: 30, shippingCost: 5, sizesInStock: ["S", "M", "L"], lastUpdated: "2026-09-10", url: "#" },
      { store: "Nordstrom", price: 24, originalPrice: 30, shippingCost: 0, sizesInStock: ["M", "L", "XL"], lastUpdated: "2026-09-12", url: "#" },
    ],
  },
  {
    id: "p2",
    name: "Heavyweight Hoodie",
    brand: "Champion",
    category: "hoodie",
    colors: ["gray", "black"],
    sizes: ["M", "L", "XL", "XXL"],
    image: "/images/hoodie-1.svg",
    offers: [
      { store: "Champion", price: 45, originalPrice: 65, shippingCost: 0, sizesInStock: ["M", "L"], lastUpdated: "2026-09-13", url: "#" },
      { store: "Amazon", price: 49, originalPrice: 65, shippingCost: 0, sizesInStock: ["L", "XL", "XXL"], lastUpdated: "2026-09-11", url: "#" },
      { store: "Kohl's", price: 52, originalPrice: 65, shippingCost: 6, sizesInStock: ["M", "XXL"], lastUpdated: "2026-09-08", url: "#" },
    ],
  },
  {
    id: "p3",
    name: "Fleece Crewneck Sweatshirt",
    brand: "Uniqlo",
    category: "sweatshirt",
    colors: ["beige", "olive", "black"],
    sizes: ["S", "M", "L"],
    image: "/images/sweatshirt-1.svg",
    offers: [
      { store: "Uniqlo", price: 29, originalPrice: 39, shippingCost: 0, sizesInStock: ["S", "M", "L"], lastUpdated: "2026-09-13", url: "#" },
    ],
  },
  {
    id: "p4",
    name: "Waffle Knit Long Sleeve",
    brand: "J.Crew",
    category: "long-sleeve",
    colors: ["white", "gray", "burgundy"],
    sizes: ["S", "M", "L", "XL"],
    image: "/images/longsleeve-1.svg",
    offers: [
      { store: "J.Crew", price: 34, originalPrice: 48, shippingCost: 7, sizesInStock: ["M", "L"], lastUpdated: "2026-09-09", url: "#" },
      { store: "Nordstrom", price: 36, originalPrice: 48, shippingCost: 0, sizesInStock: ["S", "XL"], lastUpdated: "2026-09-12", url: "#" },
    ],
  },
  {
    id: "p5",
    name: "Oversized Graphic Tee",
    brand: "Urban Outfitters",
    category: "t-shirt",
    colors: ["black", "white"],
    sizes: ["S", "M", "L", "XL"],
    image: "/images/tee-2.svg",
    offers: [
      { store: "Urban Outfitters", price: 18, originalPrice: 34, shippingCost: 6, sizesInStock: ["S", "M", "XL"], lastUpdated: "2026-09-07", url: "#" },
    ],
  },
  {
    id: "p6",
    name: "Zip-Up Fleece Hoodie",
    brand: "Nike",
    category: "hoodie",
    colors: ["navy", "gray"],
    sizes: ["M", "L", "XL"],
    image: "/images/hoodie-2.svg",
    offers: [
      { store: "Nike", price: 55, originalPrice: 70, shippingCost: 0, sizesInStock: ["M", "L", "XL"], lastUpdated: "2026-09-13", url: "#" },
      { store: "Foot Locker", price: 58, originalPrice: 70, shippingCost: 5, sizesInStock: ["L"], lastUpdated: "2026-09-05", url: "#" },
    ],
  },
];
