/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-deepest': 'var(--bg-deepest)',
        'bg-deep': 'var(--bg-deep)',
        'bg-base': 'var(--bg-base)',
        'bg-raised': 'var(--bg-raised)',
        'bg-hover': 'var(--bg-hover)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'accent': 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'border-subtle': 'var(--border-subtle)',
        'border-hover': 'var(--border-hover)',
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"SF Pro Display"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', '"Fira Code"', '"Consolas"', 'monospace'],
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '14px',
        'xl': '20px',
      },
    },
  },
  plugins: [],
};
