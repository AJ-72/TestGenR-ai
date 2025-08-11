const { describe, it, expect, beforeEach, jest } = require('@jest/globals');

// Mock the Forge API
jest.mock('@forge/api', () => ({
  fetch: jest.fn(),
}));

// Mock storage helper
jest.mock('../src/helpers/storageHelper', () => ({
  getAwsCredentials: jest.fn(),
  getAwsRegion: jest.fn(),
}));

// Mock crypto for AWS signing
global.crypto = {
  subtle: {
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    importKey: jest.fn().mockResolvedValue({}),
    sign: jest.fn().mockResolvedValue(new ArrayBuffer(32))
  }
};

const { fetch } = require('@forge/api');
const { getAwsCredentials, getAwsRegion } = require('../src/helpers/storageHelper');
const callAWSBedrock = require('../src/helpers/callAWSBedrock').default;

describe('AWS Bedrock Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock AWS credentials
    getAwsCredentials.mockResolvedValue({
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key'
    });
    getAwsRegion.mockResolvedValue('us-east-1');
  });

  describe('Valid JSON Response', () => {
    it('should parse valid JSON response with result array', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: JSON.stringify({
              result: [
                { label: "Test user login with valid credentials" },
                { label: "Verify error message for invalid password" },
                { label: "Check account lockout after failed attempts" }
              ]
            })
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await callAWSBedrock("Test login functionality", "TEST-PROJECT");
      console.log(result);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('label', 'Test user login with valid credentials');
      expect(result[0]).toHaveProperty('id');
      expect(result[1]).toHaveProperty('label', 'Verify error message for invalid password');
      expect(result[2]).toHaveProperty('label', 'Check account lockout after failed attempts');
    });

    it('should handle empty result array', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: JSON.stringify({ result: [] })
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await callAWSBedrock("Empty test", "TEST-PROJECT");

      expect(result).toEqual([]);
    });

    it('should handle missing result property', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: JSON.stringify({ data: [] })
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await callAWSBedrock("Missing result", "TEST-PROJECT");

      expect(result).toEqual([]);
    });
  });

  describe('Fallback Text Parsing', () => {
    it('should parse bullet points when JSON parsing fails', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: `Here are the test cases:
- Test user can login successfully
- Verify password validation
- Check session timeout`
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await callAWSBedrock("Test parsing fallback", "TEST-PROJECT");

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('label', 'Test user can login successfully');
      expect(result[1]).toHaveProperty('label', 'Verify password validation');
      expect(result[2]).toHaveProperty('label', 'Check session timeout');
      expect(result[0]).toHaveProperty('id');
    });

    it('should parse numbered lists when JSON parsing fails', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: `Test cases:
1. Validate user registration form
2. Test email verification process
3. Check duplicate email handling`
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await callAWSBedrock("Test numbered list", "TEST-PROJECT");

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('label', 'Validate user registration form');
      expect(result[1]).toHaveProperty('label', 'Test email verification process');
      expect(result[2]).toHaveProperty('label', 'Check duplicate email handling');
    });
  });

  describe('Error Handling', () => {
    it('should return empty array on API error', async () => {
      const mockResponse = {
        status: 400,
        text: jest.fn().mockResolvedValue('Bad Request')
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await callAWSBedrock("Error test", "TEST-PROJECT");

      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      const result = await callAWSBedrock("Network error test", "TEST-PROJECT");

      expect(result).toEqual([]);
    });

    it('should return empty array when content is malformed', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{ text: 'Invalid response format' }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await callAWSBedrock("Malformed test", "TEST-PROJECT");

      expect(result).toEqual([]);
    });
  });

  describe('AWS Connection Tests', () => {
    it('should construct correct AWS Bedrock URL', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{ text: JSON.stringify({ result: [] }) }]
        })
      };

      fetch.mockResolvedValue(mockResponse);
      getAwsRegion.mockResolvedValue('us-west-2');

      await callAWSBedrock("Test prompt", "TEST-PROJECT");

      expect(fetch).toHaveBeenCalledWith(
        'https://bedrock-runtime.us-west-2.amazonaws.com/model/anthropic.claude-3-haiku-20240307-v1:0/invoke',
        expect.any(Object)
      );
    });

    it('should include correct headers for AWS authentication', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{ text: JSON.stringify({ result: [] }) }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      await callAWSBedrock("Test prompt", "TEST-PROJECT");

      const callArgs = fetch.mock.calls[0][1];
      expect(callArgs.headers).toHaveProperty('Authorization');
      expect(callArgs.headers).toHaveProperty('Content-Type', 'application/json');
      expect(callArgs.headers).toHaveProperty('X-Amz-Date');
      expect(callArgs.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256/);
    });

    it('should send correct payload structure to Bedrock', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{ text: JSON.stringify({ result: [] }) }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      await callAWSBedrock("Generate test cases for login", "TEST-PROJECT");

      const callArgs = fetch.mock.calls[0][1];
      const payload = JSON.parse(callArgs.body);
      
      expect(payload).toHaveProperty('anthropic_version', 'bedrock-2023-05-31');
      expect(payload).toHaveProperty('max_tokens', 1000);
      expect(payload).toHaveProperty('messages');
      expect(payload.messages).toHaveLength(1);
      expect(payload.messages[0]).toHaveProperty('role', 'user');
      expect(payload.messages[0].content).toContain('Generate test cases for login');
    });

    it('should handle different AWS regions correctly', async () => {
      const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
      
      for (const region of regions) {
        const mockResponse = {
          status: 200,
          json: jest.fn().mockResolvedValue({
            content: [{ text: JSON.stringify({ result: [] }) }]
          })
        };

        fetch.mockResolvedValue(mockResponse);
        getAwsRegion.mockResolvedValue(region);

        await callAWSBedrock("Test", "TEST-PROJECT");

        expect(fetch).toHaveBeenCalledWith(
          `https://bedrock-runtime.${region}.amazonaws.com/model/anthropic.claude-3-haiku-20240307-v1:0/invoke`,
          expect.any(Object)
        );
        
        fetch.mockClear();
      }
    });
  });

  describe('Bedrock Response Processing', () => {
    it('should handle actual Bedrock response format', async () => {
      const actualBedrockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: `{
              "result": [
                {"label": "Test valid user login with correct credentials"},
                {"label": "Verify login failure with invalid password"},
                {"label": "Check account lockout after multiple failed attempts"},
                {"label": "Test password reset functionality"},
                {"label": "Validate session timeout behavior"}
              ]
            }`
          }],
          usage: {
            input_tokens: 45,
            output_tokens: 120
          }
        })
      };

      fetch.mockResolvedValue(actualBedrockResponse);

      const result = await callAWSBedrock("Generate login test cases", "TEST-PROJECT");

      expect(result).toHaveLength(5);
      expect(result[0]).toHaveProperty('label', 'Test valid user login with correct credentials');
      expect(result[4]).toHaveProperty('label', 'Validate session timeout behavior');
      result.forEach(testCase => {
        expect(testCase).toHaveProperty('id');
        expect(typeof testCase.id).toBe('string');
      });
    });

    it('should handle Bedrock API rate limiting', async () => {
      const rateLimitResponse = {
        status: 429,
        text: jest.fn().mockResolvedValue('Too Many Requests')
      };

      fetch.mockResolvedValue(rateLimitResponse);

      const result = await callAWSBedrock("Test rate limit", "TEST-PROJECT");

      expect(result).toEqual([]);
    });

    it('should handle Bedrock authentication errors', async () => {
      const authErrorResponse = {
        status: 403,
        text: jest.fn().mockResolvedValue('Forbidden - Invalid credentials')
      };

      fetch.mockResolvedValue(authErrorResponse);

      const result = await callAWSBedrock("Test auth error", "TEST-PROJECT");

      expect(result).toEqual([]);
    });

    it('should handle Bedrock model not found errors', async () => {
      const modelErrorResponse = {
        status: 404,
        text: jest.fn().mockResolvedValue('Model not found')
      };

      fetch.mockResolvedValue(modelErrorResponse);

      const result = await callAWSBedrock("Test model error", "TEST-PROJECT");

      expect(result).toEqual([]);
    });
  });

  describe('Response Structure Validation', () => {
    it('should ensure all test cases have required fields', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: JSON.stringify({
              result: [
                { label: "Test case 1" },
                { label: "Test case 2" }
              ]
            })
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await callAWSBedrock("Structure test", "TEST-PROJECT");

      result.forEach(testCase => {
        expect(testCase).toHaveProperty('label');
        expect(testCase).toHaveProperty('id');
        expect(typeof testCase.label).toBe('string');
        expect(typeof testCase.id).toBe('string');
        expect(testCase.label.length).toBeGreaterThan(0);
        expect(testCase.id.length).toBeGreaterThan(0);
      });
    });

    it('should generate unique IDs for each test case', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: JSON.stringify({
              result: [
                { label: "Test 1" },
                { label: "Test 2" },
                { label: "Test 3" }
              ]
            })
          }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await callAWSBedrock("Unique ID test", "TEST-PROJECT");

      const ids = result.map(tc => tc.id);
      const uniqueIds = [...new Set(ids)];
      
      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should handle complete workflow from prompt to test cases', async () => {
      const storyDescription = "As a user, I want to login to the system so that I can access my dashboard";
      const expectedResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{
            text: JSON.stringify({
              result: [
                { label: "Test successful login with valid username and password" },
                { label: "Verify login failure with invalid username" },
                { label: "Verify login failure with invalid password" },
                { label: "Test login with empty credentials" },
                { label: "Verify redirect to dashboard after successful login" }
              ]
            })
          }]
        })
      };

      fetch.mockResolvedValue(expectedResponse);

      const result = await callAWSBedrock(storyDescription, "TEST-PROJECT");

      expect(result).toHaveLength(5);
      expect(result[0].label).toContain('successful login');
      expect(result[4].label).toContain('dashboard');
      
      // Verify AWS call was made with correct parameters
      expect(fetch).toHaveBeenCalledTimes(1);
      const callArgs = fetch.mock.calls[0];
      expect(callArgs[0]).toContain('bedrock-runtime');
      expect(callArgs[0]).toContain('anthropic.claude-3-haiku');
    });

    it('should validate system prompt is included in request', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{ text: JSON.stringify({ result: [] }) }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      await callAWSBedrock("Test system prompt", "TEST-PROJECT");

      const callArgs = fetch.mock.calls[0][1];
      const payload = JSON.parse(callArgs.body);
      const userMessage = payload.messages[0].content;
      
      expect(userMessage).toContain('experienced software tester');
      expect(userMessage).toContain('QA engineer');
      expect(userMessage).toContain('Test system prompt');
      expect(userMessage).toContain('JSON object containing a \'result\' array');
    });
  });
});