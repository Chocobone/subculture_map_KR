import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',   // indigo-500
        ongoing: '#22c55e',   // green-500
        upcoming: '#3b82f6',  // blue-500
        ended:    '#9ca3af',  // gray-400
      },
    },
  },
  plugins: [],
} satisfies Config;
