module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },
  extends: [
    'airbnb-base',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    "no-useless-escape": 0,
    "no-underscore-dangle": 0,
    "no-throw-literal": 0,
    "global-require": 0,
    "no-param-reassign": 0,
    "no-plusplus": 0,
    "max-len":0
  },
};
