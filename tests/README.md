# Integration Tests

## Setup

1. Copy `test-config.json` and add your AWS credentials:
```json
{
  "aws": {
    "accessKeyId": "your-actual-access-key",
    "secretAccessKey": "your-actual-secret-key", 
    "region": "us-east-1"
  },
  "testPrompt": "Create test cases for a user login feature"
}
```

2. Run tests:
```bash
npm test bedrock-integration
```

## Note
- `test-config.json` is gitignored to prevent credential exposure
- Tests mock the Forge API but use real AWS credential format