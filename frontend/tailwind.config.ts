import type { Config } from 'tailwindcss'

const color = (name: string) => `rgb(var(${name}) / <alpha-value>)`

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: 'rgb(255 255 255 / <alpha-value>)',
      black: 'rgb(0 0 0 / <alpha-value>)',
      app: color('--color-app'),
      surface: color('--color-surface'),
      elevated: color('--color-elevated'),
      muted: color('--color-muted-surface'),
      primary: color('--color-text-primary'),
      secondary: color('--color-text-secondary'),
      tertiary: color('--color-text-tertiary'),
      subtle: color('--color-border-subtle'),
      gray: {
        50: color('--color-gray-50'),
        100: color('--color-gray-100'),
        200: color('--color-gray-200'),
        300: color('--color-gray-300'),
        400: color('--color-gray-400'),
        500: color('--color-gray-500'),
        600: color('--color-gray-600'),
        700: color('--color-gray-700'),
        800: color('--color-gray-800'),
        900: color('--color-gray-900'),
      },
      blue: {
        50: color('--color-blue-50'),
        100: color('--color-blue-100'),
        200: color('--color-blue-200'),
        300: color('--color-blue-300'),
        400: color('--color-blue-400'),
        500: color('--color-blue-500'),
        600: color('--color-blue-600'),
        700: color('--color-blue-700'),
        800: color('--color-blue-800'),
        900: color('--color-blue-900'),
      },
      red: {
        50: color('--color-red-50'),
        100: color('--color-red-100'),
        200: color('--color-red-200'),
        300: color('--color-red-300'),
        400: color('--color-red-400'),
        500: color('--color-red-500'),
        600: color('--color-red-600'),
        700: color('--color-red-700'),
      },
      green: {
        50: color('--color-green-50'),
        100: color('--color-green-100'),
        300: color('--color-green-300'),
        400: color('--color-green-400'),
        500: color('--color-green-500'),
        600: color('--color-green-600'),
        700: color('--color-green-700'),
      },
      amber: {
        50: color('--color-amber-50'),
        100: color('--color-amber-100'),
        200: color('--color-amber-200'),
        500: color('--color-amber-500'),
        600: color('--color-amber-600'),
        700: color('--color-amber-700'),
        900: color('--color-amber-900'),
      },
      yellow: {
        100: color('--color-yellow-100'),
        500: color('--color-yellow-500'),
        600: color('--color-yellow-600'),
        700: color('--color-yellow-700'),
      },
      orange: {
        50: color('--color-orange-50'),
        100: color('--color-orange-100'),
        200: color('--color-orange-200'),
        500: color('--color-orange-500'),
        600: color('--color-orange-600'),
        700: color('--color-orange-700'),
      },
      purple: {
        50: color('--color-purple-50'),
        400: color('--color-purple-400'),
        500: color('--color-purple-500'),
        700: color('--color-purple-700'),
      },
      indigo: {
        50: color('--color-indigo-50'),
        100: color('--color-indigo-100'),
        500: color('--color-indigo-500'),
        600: color('--color-indigo-600'),
        700: color('--color-indigo-700'),
      },
      pink: {
        50: color('--color-pink-50'),
        300: color('--color-pink-300'),
        600: color('--color-pink-600'),
      },
    },
    extend: {
      colors: {
        brand: {
          50: color('--color-blue-50'),
          100: color('--color-blue-100'),
          500: color('--color-blue-500'),
          600: color('--color-blue-600'),
          700: color('--color-blue-700'),
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
