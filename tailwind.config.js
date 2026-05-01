/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./blog/index.html",
    "./blog/blog-*.html",
    "./about/index.html",
    "./contact/index.html",
    "./services/index.html",
    "./mortgage-rates/index.html",
    "./affordability/index.html",
    "./refinance-calculator/index.html",
    "./equity-loan/index.html",
    "./free-report/index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        console: ['Fraunces', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
  // Safelist for classes only present in JS template strings
  safelist: [
    'hidden', 'lg:flex', 'lg:hidden', 'lg:inline-flex', 'lg:block',
    'md:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4', 'lg:grid-cols-5', 'lg:grid-cols-12',
    'col-span-1', 'col-span-2', 'col-span-3', 'col-span-5', 'col-span-7',
    'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-5', 'lg:col-span-7',
  ],
}
