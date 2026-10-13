import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f7f6f3',
        surface: '#ffffff',
        line: '#e4e2dc',
        ink: '#23221f',
        muted: '#6b6962',
        accent: {
          DEFAULT: '#2f5d62',
          soft: '#e7efee',
        },
      },
    },
  },
  plugins: [],
};

export default config;
