import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f8f7f4',
          100: '#e8e6df',
          200: '#d3d0c4',
          700: '#4a473f',
          800: '#2e2c26',
          900: '#1c1b17',
        },
        accent: {
          500: '#2f5f8f',
          600: '#27517c',
          700: '#1f4367',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'Songti SC', 'SimSun', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
