/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./rates-admin.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
  // Console uses many dynamic classes via JS template strings — safelist common ones.
  safelist: [
    'hidden', 'block', 'flex', 'inline-flex', 'grid',
    'lg:flex', 'lg:hidden', 'lg:inline-flex', 'lg:block',
    'md:grid-cols-2', 'md:grid-cols-3', 'md:grid-cols-4',
    'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4', 'lg:grid-cols-5', 'lg:grid-cols-6', 'lg:grid-cols-12',
    'col-span-1', 'col-span-2', 'col-span-3', 'col-span-4', 'col-span-5', 'col-span-6', 'col-span-7', 'col-span-8',
    'lg:col-span-1', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-4', 'lg:col-span-5', 'lg:col-span-6', 'lg:col-span-7', 'lg:col-span-8',
    'opacity-50', 'opacity-100',
    'rotate-90', 'rotate-180', '-rotate-90',
  ],
}
