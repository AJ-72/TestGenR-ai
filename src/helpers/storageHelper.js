import { properties } from "@forge/api";

const log = (operation, key, data) => {
  console.log(`[StorageHelper] ${operation}:`, { key, data });
};

export const storageGetHelper = async (issueKey) => {
  const result = await properties.onJiraIssue(issueKey).get("test_gen");
  log('GET_ISSUE', issueKey, result);
  return result;
};

export const storageSetHelper = async (issueKey, record) => {
  const result = await properties.onJiraIssue(issueKey).set("test_gen", record);
  log('SET_ISSUE', issueKey, record);
  return result;
};

export const getSelectedStatus = async (projectKey) => {
  const result = await properties.onJiraProject(projectKey).get("test-genR-trigger-status");
  log('GET_STATUS', projectKey, result);
  return result;
};

export const getAwsCredentials = async (projectKey) => {
  const accessKeyId = await properties.onJiraProject(projectKey).get("test-genR-aws-access-key");
  const secretAccessKey = await properties.onJiraProject(projectKey).get("test-genR-aws-secret-key");
  const result = { accessKeyId, secretAccessKey };
  log('GET_AWS_CREDS', projectKey, { accessKeyId: accessKeyId ? '[REDACTED]' : null, secretAccessKey: secretAccessKey ? '[REDACTED]' : null });
  return result;
};

export const getAwsRegion = async (projectKey) => {
  const result = await properties.onJiraProject(projectKey).get("test-genR-aws-region") || "us-east-1";
  log('GET_REGION', projectKey, result);
  return result;
};

export const getGenStatus = async (issueKey) => {
  const result = await properties.onJiraIssue(issueKey).get("test-genR-status");
  log('GET_GEN_STATUS', issueKey, result);
  return result;
};

export const setGenStatus = async (issueKey, stat) => {
  const result = await properties.onJiraIssue(issueKey).set("test-genR-status", stat);
  log('SET_GEN_STATUS', issueKey, stat);
  return result;
};

export const getTestCaseLimit = async (projectKey) => {
  const result = await properties.onJiraProject(projectKey).get("test-genR-limit") || 5;
  log('GET_LIMIT', projectKey, result);
  return result;
};

export const setTestCaseLimit = async (projectKey, limit) => {
  const maxLimit = 15;
  const validLimit = Math.min(Math.max(parseInt(limit) || 5, 1), maxLimit);
  await properties.onJiraProject(projectKey).set("test-genR-limit", validLimit);
  log('SET_LIMIT', projectKey, validLimit);
  return validLimit;
};

export const getPromptTemplate = async (projectKey) => {
  const result = await properties.onJiraProject(projectKey).get("test-genR-prompt") || "Write test cases for the following story requirements: {description}";
  log('GET_PROMPT', projectKey, result);
  return result;
};

export const getSessionToken = async (projectKey) => {
  const result = await properties.onJiraProject(projectKey).get("test-genR-aws-session-token");
  log('GET_SESSION_TOKEN', projectKey, result ? '[REDACTED]' : null);
  return result;
};

export const setSessionToken = async (projectKey, token) => {
  await properties.onJiraProject(projectKey).set("test-genR-aws-session-token", token);
  log('SET_SESSION_TOKEN', projectKey, token ? '[REDACTED]' : null);
  return token;
};

export const verifyStoredValues = async (projectKey, issueKey) => {
  console.log(`[StorageHelper] Verifying stored values for project: ${projectKey}, issue: ${issueKey}`);
  
  try {
    const [status, credentials, region, genStatus, limit, prompt, testGen, sessionToken] = await Promise.all([
      getSelectedStatus(projectKey),
      getAwsCredentials(projectKey),
      getAwsRegion(projectKey),
      issueKey ? getGenStatus(issueKey) : null,
      getTestCaseLimit(projectKey),
      getPromptTemplate(projectKey),
      issueKey ? storageGetHelper(issueKey) : null,
      getSessionToken(projectKey)
    ]);
    
    const verification = {
      projectKey,
      issueKey,
      triggerStatus: status,
      awsRegion: region,
      testCaseLimit: limit,
      promptTemplate: prompt,
      hasCredentials: !!(credentials.accessKeyId && credentials.secretAccessKey),
      hasSessionToken: !!sessionToken,
      isTemporaryCredentials: credentials.accessKeyId?.startsWith('ASIA'),
      generationStatus: genStatus,
      testCases: testGen
    };
    
    console.log('[StorageHelper] Verification complete:', verification);
    return verification;
  } catch (error) {
    console.error('[StorageHelper] Verification failed:', error);
    throw error;
  }
};
