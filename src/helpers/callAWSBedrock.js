import { fetch } from "@forge/api";
import { getAwsCredentials, getAwsRegion } from "./storageHelper";
import { properties } from "@forge/api";

const getSessionToken = async (projectKey) => {
  try {
    return await properties.onJiraProject(projectKey).get('test-genR-aws-session-token');
  } catch {
    return null;
  }
};

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
     console.log("Bedrock API response:", JSON.stringify(response.json, null, 2));     
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

// AWS Signature V4 signing
const createAwsHeaders = async (url, body, accessKeyId, secretAccessKey, region, sessionToken = null) => {
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
  
  const canonicalRequest = `${method}\n/model/anthropic.claude-3-haiku-20240307-v1%3A0/invoke\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${date}\n${credentialScope}\n${sha256(canonicalRequest)}`;
  
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const crypto = require('crypto');
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
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(message).digest('hex');
};

const getSignatureKey = (key, dateStamp, regionName, serviceName) => {
  const crypto = require('crypto');
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
};

export const testAwsBedrockConnection = async (accessKeyId, secretAccessKey, region = 'us-east-1') => {
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
    const headers = await createAwsHeaders(url, JSON.stringify(payload), accessKeyId, secretAccessKey, region);
    
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