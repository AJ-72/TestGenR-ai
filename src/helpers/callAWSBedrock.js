import { fetch } from "@forge/api";
import { getAwsCredentials, getAwsRegion } from "./storageHelper";

const callAWSBedrock = async (prompt, projectKey) => {
  const systemPrompt = "You are a helpful coding assistant. Generate test cases in JSON format with an array of objects containing 'label' field for each test case description.";
  const fullPrompt = `${systemPrompt}\n\nHuman: ${prompt}\n\nPlease respond with a JSON object containing a 'result' array where each item has a 'label' field with the test case description.\n\nAssistant:`;

  try {
    const { accessKeyId, secretAccessKey } = await getAwsCredentials(projectKey);
    const region = await getAwsRegion(projectKey);
    
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/anthropic.claude-3-haiku-20240307-v1:0/invoke`;
    
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: fullPrompt
      }]
    };

    const headers = await createAwsHeaders(url, JSON.stringify(payload), accessKeyId, secretAccessKey, region);
    
    const options = {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    };

    const response = await fetch(url, options);
    
    if (response.status === 200) {
      const data = await response.json();
      const content = data.content[0].text;
      
      try {
        const parsed = JSON.parse(content);
        return parsed.result?.map((el) => ({ ...el, id: getUniqueId() })) || [];
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
const createAwsHeaders = async (url, body, accessKeyId, secretAccessKey, region) => {
  const service = 'bedrock';
  const method = 'POST';
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const date = new Date().toISOString().replace(/[:\-]|\..*/g, '');
  const dateStamp = date.substr(0, 8);
  
  const canonicalHeaders = `host:${host}\nx-amz-date:${date}\n`;
  const signedHeaders = 'host;x-amz-date';
  const payloadHash = await sha256(body);
  
  const canonicalRequest = `${method}\n/model/anthropic.claude-3-haiku-20240307-v1:0/invoke\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${date}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacSha256(signingKey, stringToSign);
  
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    'Authorization': authorizationHeader,
    'Content-Type': 'application/json',
    'X-Amz-Date': date
  };
};

const sha256 = async (message) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const hmacSha256 = async (key, message) => {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;
  const messageData = encoder.encode(message);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const getSignatureKey = async (key, dateStamp, regionName, serviceName) => {
  const kDate = await hmacSha256('AWS4' + key, dateStamp);
  const kRegion = await hmacSha256(new Uint8Array(kDate.match(/.{2}/g).map(byte => parseInt(byte, 16))), regionName);
  const kService = await hmacSha256(new Uint8Array(kRegion.match(/.{2}/g).map(byte => parseInt(byte, 16))), serviceName);
  const kSigning = await hmacSha256(new Uint8Array(kService.match(/.{2}/g).map(byte => parseInt(byte, 16))), 'aws4_request');
  return new Uint8Array(kSigning.match(/.{2}/g).map(byte => parseInt(byte, 16)));
};

export const getUniqueId = () => "_" + Math.random().toString(16).slice(2, 15);
export default callAWSBedrock;