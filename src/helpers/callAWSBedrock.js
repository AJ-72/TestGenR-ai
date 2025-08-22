import { fetch } from "@forge/api";
import { getAwsCredentials, getAwsRegion, getSessionToken } from "./storageHelper";

const callAWSBedrock = async (prompt, projectKey) => {
  const systemPrompt = "You are an experienced software tester and QA engineer with expertise in creating comprehensive test scenarios. Analyze the provided user story and generate detailed test cases that cover functional requirements, edge cases, negative scenarios, and boundary conditions. Consider user workflows, data validation, error handling, and integration points. Use orthogonal array methodology to reduce the combinations. Focus on both happy path and potential failure scenarios to ensure thorough test coverage.";
  const fullPrompt = `${systemPrompt}\n\nHuman: ${prompt}\n\nPlease respond with a JSON object containing a 'result' array where each item has a 'label' field with the test case description.\n\nAssistant:`;

  try {
    const { accessKeyId, secretAccessKey } = await getAwsCredentials(projectKey);
    const sessionToken = await getSessionToken(projectKey);
    
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured for this project');
    }
    
    if (accessKeyId.startsWith('ASIA') && !sessionToken) {
      console.log('[AWS] Warning: Temporary credentials detected but no session token configured');
    }
    const region = await getAwsRegion(projectKey);
    
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/anthropic.claude-3-haiku-20240307-v1:0/invoke`;
    
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 10000,
      messages: [{
        role: "user",
        content: fullPrompt
      }]
    };

    const headers = await createAwsHeaders(url, JSON.stringify(payload), accessKeyId, secretAccessKey, region, sessionToken);
    
    const options = {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    };

    console.log("Bedrock API request:", { url, headers, payload });
    const response = await fetch(url, options);
    if (response.status === 200) {
      const data = await response.json();
      console.log("Bedrock API response:", JSON.stringify(data, null, 2));
      const content = data.content[0].text;
      
      try {
        const parsed = JSON.parse(content);
        return parsed?.result?.map((el) => ({ ...el, id: getUniqueId() })) || [];
      } catch {
        // Fallback: extract test cases from text
        const lines = content.split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./));
        return lines.map(line => ({ label: line.replace(/^[-\d\.\s]+/, '').trim(), id: getUniqueId() }));
      }
    } else {
      console.log("Bedrock API error:", response.status, await response.text());
      return [];
    }
  } catch (e) {
    console.log("error in callAWSBedrock", e);
    return [];
  }
};

// AWS Signature V4 signing - CORRECTED VERSION
const createAwsHeaders = async (url, body, accessKeyId, secretAccessKey, region, sessionToken = null) => {
  const service = 'bedrock';
  const method = 'POST';
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const date = new Date().toISOString().replace(/[:\-]/g, '').replace(/\..*/g, 'Z');
  const dateStamp = date.substr(0, 8);
  
  // Fix 1: Proper canonical URI encoding
  const canonicalUri = '/model/anthropic.claude-3-haiku-20240307-v1%3A0/invoke';
  
  // Fix 2: Correct canonical headers order and format
  const canonicalHeaders = sessionToken 
    ? `content-type:application/json\nhost:${host}\nx-amz-date:${date}\nx-amz-security-token:${sessionToken}\n`
    : `content-type:application/json\nhost:${host}\nx-amz-date:${date}\n`;
  const signedHeaders = sessionToken ? 'content-type;host;x-amz-date;x-amz-security-token' : 'content-type;host;x-amz-date';
  const payloadHash = await sha256(body);
  
  // Fix 3: Proper canonical request format
  const canonicalRequest = `${method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${date}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacSha256(signingKey, stringToSign);
  
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

// Fix 4: Corrected HMAC and signing key functions
const hmacSha256 = async (key, message) => {
  const encoder = new TextEncoder();
  const messageData = encoder.encode(message);
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const sha256 = async (message) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const getSignatureKey = async (key, dateStamp, regionName, serviceName) => {
  const encoder = new TextEncoder();
  const kDate = await hmacSha256Raw(encoder.encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256Raw(kDate, regionName);
  const kService = await hmacSha256Raw(kRegion, serviceName);
  const kSigning = await hmacSha256Raw(kService, 'aws4_request');
  return kSigning;
};

const hmacSha256Raw = async (key, message) => {
  const encoder = new TextEncoder();
  const messageData = encoder.encode(message);
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return new Uint8Array(signature);
};


export const testAwsBedrockConnection = async (accessKeyId, secretAccessKey, region = 'us-east-1', sessionToken = null) => {
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
    const headers = await createAwsHeaders(url, JSON.stringify(payload), accessKeyId, secretAccessKey, region, sessionToken);
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    console.log(`[AWS_TEST] Connection test result: ${response.status}`);
    
    if (response.status === 200) {
      return { success: true, message: 'AWS Bedrock connection successful' };
    } else {
      const errorText = await response.text();
      console.log(`[AWS_TEST] Error response:`, errorText);
      return { success: false, message: `Connection failed: ${response.status}`, error: errorText };
    }
  } catch (error) {
    console.log(`[AWS_TEST] Connection test failed:`, error.message);
    return { success: false, message: 'Connection test failed', error: error.message };
  }
};

export const getUniqueId = () => "_" + Math.random().toString(16).slice(2, 15);
export default callAWSBedrock;