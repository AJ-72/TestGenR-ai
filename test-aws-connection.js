const crypto = require('crypto');
const fetch = require('node-fetch');

// Standalone AWS Bedrock connection test
const testAwsBedrockConnection = async (accessKeyId, secretAccessKey, region = 'us-east-1', sessionToken = null) => {
  const testPrompt = 'Test connection';
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/anthropic.claude-3-haiku-20240307-v1:0/invoke`;
  
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 10,
    messages: [{
      role: "user",
      content: testPrompt
    }]
  };

  try {
    console.log(`[DEBUG] URL: ${url}`);
    console.log(`[DEBUG] Region: ${region}`);
    const headers = createAwsHeaders(url, JSON.stringify(payload), accessKeyId, secretAccessKey, region, sessionToken);
    console.log(`[DEBUG] Headers created successfully`);
    
    console.log(`[DEBUG] Making fetch request...`);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    console.log(`[DEBUG] Fetch completed`);

    console.log(`[AWS_TEST] Connection test result: ${response.status}`);
    
    if (response.status === 200) {
      const data = await response.json();
      console.log(`[AWS_TEST] Success! Response:`, data);
      return { success: true, message: 'AWS Bedrock connection successful', data };
    } else {
      const errorText = await response.text();
      console.log(`[AWS_TEST] Error response:`, errorText);
      return { success: false, message: `Connection failed: ${response.status}`, error: errorText };
    }
  } catch (error) {
    console.log(`[AWS_TEST] Connection test failed:`, error.message);
    console.log(`[AWS_TEST] Full error:`, error);
    return { success: false, message: 'Connection test failed', error: error.message };
  }
};

// AWS Signature V4 signing
const createAwsHeaders = (url, body, accessKeyId, secretAccessKey, region, sessionToken = null) => {
  const service = 'bedrock';
  const method = 'POST';
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const date = new Date().toISOString().replace(/[:\-]/g, '').replace(/\..*/g, 'Z');
  const dateStamp = date.substr(0, 8);
  
  const canonicalHeaders = sessionToken 
    ? `content-type:application/json\nhost:${host}\nx-amz-date:${date}\nx-amz-security-token:${sessionToken}\n`
    : `content-type:application/json\nhost:${host}\nx-amz-date:${date}\n`;
  const signedHeaders = sessionToken ? 'content-type;host;x-amz-date;x-amz-security-token' : 'content-type;host;x-amz-date';
  const payloadHash = sha256(body);
  
  const canonicalRequest = `${method}\n/model/anthropic.claude-3-haiku-20240307-v1:0/invoke\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${date}\n${credentialScope}\n${sha256(canonicalRequest)}`;
  
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  const headers = {
    'Authorization': authorizationHeader,
    'Content-Type': 'application/json',
    'X-Amz-Date': date
  };
  
  if (sessionToken) {
    headers['X-Amz-Security-Token'] = sessionToken;
  }
  
  return headers;
};

const sha256 = (message) => {
  return crypto.createHash('sha256').update(message).digest('hex');
};

const getSignatureKey = (key, dateStamp, regionName, serviceName) => {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
};

// Test execution
const runTest = async () => {
  console.log('=== AWS Bedrock Connection Test ===');
  
  // Get credentials from environment variables or replace with your values
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || 'YOUR_ACCESS_KEY_HERE';
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || 'YOUR_SECRET_KEY_HERE';
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = (process.env.AWS_REGION || 'us-east-1').trim();
  
  if (accessKeyId === 'YOUR_ACCESS_KEY_HERE' || secretAccessKey === 'YOUR_SECRET_KEY_HERE') {
    console.log('Please set your AWS credentials:');
    console.log('1. Set environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION');
    console.log('2. Or edit this file and replace the placeholder values');
    return;
  }
  
  console.log(`Testing with region: '${region}'`);
  console.log(`Access Key: ${accessKeyId.substring(0, 8)}...`);
  
  const result = await testAwsBedrockConnection(accessKeyId, secretAccessKey, region, sessionToken);
  
  console.log('\n=== Test Result ===');
  console.log(JSON.stringify(result, null, 2));
};

// Run the test
runTest().catch(console.error);