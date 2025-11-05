/* eslint-env node */
/** @type {import("prettier").Config} */
const config = {
  plugins: ['prettier-plugin-organize-imports', 'prettier-plugin-tailwindcss'],
  tailwindFunctions: ['cva', 'clsx', 'cn'],
  printWidth: 100,
  tabWidth: 2,
  quoteProps: 'as-needed',
  semi: false,
  singleQuote: true,
}

export default config
