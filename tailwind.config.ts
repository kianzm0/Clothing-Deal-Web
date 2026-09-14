import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f6ff",
          100: "#e6ecff",
          500: "#4f5df7",
          600: "#3c48d6",
          700: "#2e37a8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
