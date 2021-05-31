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
    'import/no-unresolved': 'off',
    'object-curly-newline': 0,
    'no-underscore-dangle': 0,
    'no-param-reassign': 0,
    'prefer-spread': 0,
    'class-methods-use-this': 0,
    'consistent-return': 0,
    'max-len': 0,
    'global-require': 0,
    'import/no-dynamic-require': 0,
  },
};
