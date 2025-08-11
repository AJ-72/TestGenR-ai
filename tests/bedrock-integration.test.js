const fs = require('fs');
const path = require('path');
const { fetch } = require('@forge/api');

// Mock storage helper to return test credentials
jest.mock('../src/helpers/storageHelper', () => ({
  getAwsCredentials: jest.fn(),
  getAwsRegion: jest.fn()
}));

const { getAwsCredentials, getAwsRegion } = require('../src/helpers/storageHelper');
const callAWSBedrock = require('../src/helpers/callAWSBedrock').default;

describe('AWS Bedrock Integration Test', () => {
  let config;

  beforeAll(() => {
    const configPath = path.join(__dirname, 'test-config.json');
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Setup mocks to return test credentials
    getAwsCredentials.mockResolvedValue({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
      sessionToken: config.aws.sessionToken
    });
    getAwsRegion.mockResolvedValue(config.aws.region);
  });

  test('should generate test cases from story description', async () => {
    const testProjectKey = 'TEST';
    const result = await callAWSBedrock(config.testPrompt, testProjectKey);
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    
    // Verify each test case has required structure
    result.forEach(testCase => {
      expect(testCase).toHaveProperty('label');
      expect(testCase).toHaveProperty('id');
      expect(typeof testCase.label).toBe('string');
      expect(testCase.label.length).toBeGreaterThan(0);
    });
  }, 30000);

  test('should handle empty prompt gracefully', async () => {
    const testProjectKey = 'TEST';
    const result = await callAWSBedrock('', testProjectKey);
    
    expect(Array.isArray(result)).toBe(true);
  }, 30000);
});