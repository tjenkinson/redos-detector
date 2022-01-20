const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  restoreMocks: true,
  globals: {
    'ts-jest': {
      tsconfig: path.resolve(__dirname, './tsconfig.test.json'),
    },
  },
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
