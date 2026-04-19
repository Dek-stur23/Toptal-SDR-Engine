import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0a0b",
          900: "#121214",
          800: "#1a1a1d",
          700: "#26262b",
          600: "#3a3a42",
          500: "#6b6b75",
          400: "#9a9aa3",
          300: "#cfcfd4",
        },
        brand: {
          500: "#3b82f6",
          600: "#2563eb",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
