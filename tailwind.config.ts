import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Beacon palette — the CSS variables let Clarity Mode swap them at runtime.
        bg: "var(--bg)",
        s1: "var(--s1)",
        s2: "var(--s2)",
        line: "var(--ln)",
        tx: "var(--tx)",
        mu: "var(--mu)",
        mint: "var(--mint)",
        emerald: "var(--em)",
        pink: "var(--pk)",
        pink2: "var(--pk2)",
        canary: "var(--yl)",
        limeade: "var(--lm)",
        royal: "var(--bl)",
        sky: "var(--bl2)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-grotesk)", "var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        xl2: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
