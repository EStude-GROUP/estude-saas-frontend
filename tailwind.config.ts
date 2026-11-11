import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#12233f",
        background: "var(--background)",
        brand: {
          50: "rgb(var(--brand-50, 238 247 255) / <alpha-value>)",
          100: "rgb(var(--brand-100, 217 236 255) / <alpha-value>)",
          200: "rgb(var(--brand-200, 188 221 255) / <alpha-value>)",
          300: "rgb(var(--brand-300, 142 200 255) / <alpha-value>)",
          400: "rgb(var(--brand-400, 89 168 255) / <alpha-value>)",
          500: "rgb(var(--brand-500, 52 136 251) / <alpha-value>)",
          600: "rgb(var(--brand-600, 34 105 239) / <alpha-value>)",
          700: "rgb(var(--brand-700, 26 83 220) / <alpha-value>)",
          800: "rgb(var(--brand-800, 28 69 178) / <alpha-value>)",
          900: "rgb(var(--brand-900, 29 61 140) / <alpha-value>)",
        },
      },
      boxShadow: {
        soft: "0 24px 80px rgb(15 23 42 / 0.10)",
        card: "0 4px 16px rgb(15 23 42 / 0.04)",
      },
      animation: {
        float: "float 7s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
