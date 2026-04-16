/** @type {import("prettier").Config} */
const config = {
  plugins: ['@trivago/prettier-plugin-sort-imports', 'prettier-plugin-glsl'],
  printWidth: 100,
  singleQuote: true,
  arrowParens: 'always',
  importOrder: ['<THIRD_PARTY_MODULES>', '^~/(.*)$', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  overrides: [{ files: ['*.frag'], options: { parser: 'glsl-parser' } }],
};

export default config;
