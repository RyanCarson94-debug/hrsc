/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        csl: {
          red:    '#FC1921',
          'red-dark': '#d4141a',
          black:  '#231F20',
          gray1:  '#F1EFEA',
          gray2:  '#E2DFDA',
          gray3:  '#808284',
          teal:   '#00A28A',
          blue:   '#0E56A5',
          pink:   '#DA2877',
          orange: '#F06125',
          yellow: '#F5C017',
          lime:   '#C6D92D',
          cyan:   '#03B3BE',
          lav:    '#975DA2',
          purple: '#572A7B',
        },
      },
    },
  },
  plugins: [],
}
