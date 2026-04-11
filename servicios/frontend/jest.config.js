export default {
  testEnvironment: 'jsdom',
  transform: { '^.+\\.jsx?$': 'babel-jest' },
  setupFilesAfterFramework: ['@testing-library/jest-dom'],
  moduleNameMapper: { '\\.(css|less)$': '<rootDir>/__mocks__/fileMock.js' },
}
