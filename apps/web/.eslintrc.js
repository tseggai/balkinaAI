/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals', '../../.eslintrc.js'],
  rules: {
    '@next/next/no-html-link-for-pages': 'error',
  },
};
