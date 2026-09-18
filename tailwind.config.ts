import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Terracotta accent — kept distinct from emerald, which the
        // app already uses everywhere to mean "savings/discount".
        brand: {
          50: "#fef6ee",
          100: "#fdead7",
          200: "#fad3ae",
          300: "#f6b57a",
          400: "#f18f44",
          500: "#ec7220",
          600: "#dd5a16",
          700: "#b74414",
          800: "#923718",
          900: "#762f16",
        },
        ink: {
          50: "#f8f7f5",
          100: "#efece7",
          200: "#dcd6cd",
          300: "#c1b7a8",
          400: "#a2937d",
          500: "#8a7a63",
          600: "#6f6152",
          700: "#5a4f44",
          800: "#3c352e",
          900: "#211d19",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(33, 29, 25, 0.04), 0 8px 24px -12px rgba(33, 29, 25, 0.12)",
        "card-hover": "0 2px 4px rgba(33, 29, 25, 0.05), 0 16px 32px -12px rgba(33, 29, 25, 0.18)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
