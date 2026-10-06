import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './lib/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        panel: '#0f172a',
        sidebar: '#111827',
        accent: '#22c55e',
        userbubble: '#1f2937',
        assistantbubble: '#0b1220'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.35)'
      }
    }
  },
  plugins: []
} satisfies Config;
