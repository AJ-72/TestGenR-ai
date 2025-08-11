module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
  ],
  moduleNameMapping: {
    '^@forge/(.*)$': '<rootDir>/node_modules/@forge/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};