// https://eslint.org/docs/user-guide/configuring
module.exports = {
  root: true,
  parser: 'babel-eslint',
  env: {
    browser: true,
    es6: true,
  },
  extends: [
    'airbnb-base',
  ],
  rules: {
    'import/prefer-default-export': 'off',
    'object-curly-newline': 0,
    'no-underscore-dangle': 0,
    'no-param-reassign': 0,
    'prefer-spread': 0,
    'class-methods-use-this': 0,
    'consistent-return': 0,
  },
};
