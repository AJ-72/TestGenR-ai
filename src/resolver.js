import Resolver from "@forge/resolver";

import { getGenStatus, storageGetHelper, storageSetHelper, getTestCaseLimit, verifyStoredValues, getAwsCredentials, getAwsRegion } from "./helpers/storageHelper";
import { testAwsBedrockConnection } from "./helpers/callAWSBedrock";

const resolver = new Resolver();
const getUniqueId = () => "_" + Math.random().toString(16).slice(2, 15);
const DEFAULT_TEST_CASE_LIMIT = 5;
const MAX_TEST_CASE_LIMIT = 15;

const getIssueKeyFromContext = (context) => {
  const issueKey = context?.extension?.issue?.key;
  if (!issueKey) {
    console.log(`[RESOLVER ERROR] No issue key found in context:`, JSON.stringify(context?.extension));
  }
  return issueKey;
};
async function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
const getAll = async (context) => {
  const issueKey = getIssueKeyFromContext(context);
  console.log(`[RESOLVER DEBUG] Getting all testcases for issue: ${issueKey}`);
  console.log(`[RESOLVER DEBUG] Context:`, JSON.stringify({
    issueKey: context.extension?.issue?.key,
    issueType: context.extension?.issue?.issueType,
    projectKey: context.extension?.project?.key
  }));
  
  try {
    const result = (await storageGetHelper(issueKey)) || [];
    console.log(`[RESOLVER DEBUG] Retrieved ${result.length} test cases`);
    return result;
  } catch (error) {
    console.log(`[RESOLVER ERROR] Failed to get test cases: ${error.message}`);
    return [];
  }
};
const getGenrStatus = async (context, attempt) => {
  const issueKey = getIssueKeyFromContext(context);
  console.log(`[RESOLVER DEBUG] Checking generation status for ${issueKey}, attempt ${attempt}`);
  
  try {
    const res = await getGenStatus(issueKey);
    console.log(`[RESOLVER DEBUG] Generation status: ${res}`);
    
    if (res !== "loading") {
      const testCases = await getAll(context);
      console.log(`[RESOLVER DEBUG] Status not loading, returning ${testCases?.length || 0} test cases`);
      return testCases;
    } else if (attempt > 3) {
      console.log(`[RESOLVER DEBUG] Max attempts reached, returning failed`);
      return "failed";
    } else {
      console.log(`[RESOLVER DEBUG] Status is loading, waiting 4s for attempt ${attempt + 1}`);
      await wait(4000);
      return await getGenrStatus(context, attempt + 1);
    }
  } catch (error) {
    console.log(`[RESOLVER ERROR] Failed to check generation status: ${error.message}`);
    return await getAll(context);
  }
};
resolver.define("get-all", async ({ context }) => {
  console.log(`[RESOLVER DEBUG] get-all called`);
  try {
    const issueKey = getIssueKeyFromContext(context);
    const projectKey = context.extension?.project?.key;
    
    // Verify stored values for debugging
    await verifyStoredValues(projectKey, issueKey);
    
    const result = await getGenrStatus(context, 1);
    console.log(`[RESOLVER DEBUG] get-all returning:`, result?.length || 'non-array');
    return result;
  } catch (e) {
    console.log(`[RESOLVER ERROR] get-all failed:`, e.message);
    console.log(`[RESOLVER ERROR] Stack:`, e.stack);
    return [];
  }
});

resolver.define("create", async ({ payload, context }) => {
  try {
    const records = await getAll(context);
    const projectKey = context.extension.project.key;
    const limit = await getTestCaseLimit(projectKey) || DEFAULT_TEST_CASE_LIMIT;
    
    if (records.length >= limit) {
      throw new Error(`Maximum test case limit of ${limit} reached`);
    }
    
    const id = getUniqueId();
    const newRecord = {
      id,
      ...payload,
    };
    await storageSetHelper(getIssueKeyFromContext(context), [...records, newRecord]);
    return newRecord;
  } catch (e) {
    console.log("error in resolver create", e);
    throw e;
  }
});

resolver.define("update", async ({ payload, context }) => {
  try {
    let records = await getAll(context);
    records = records.map((item) => {
      if (item.id === payload.id) {
        return payload;
      }
      return item;
    });
    // await storage.set(getListKeyFromContext(context), records);
    await storageSetHelper(getIssueKeyFromContext(context), records);
    return payload;
  } catch (e) {
    console.log("error in resolver update", e);
  }
});

resolver.define("delete", async ({ payload, context }) => {
  try {
    let records = await getAll(context);
    records = records.filter((item) => item.id !== payload.id);
    // await storage.set(getListKeyFromContext(context), records);
    await storageSetHelper(getIssueKeyFromContext(context), records);
    return payload;
  } catch (e) {
    console.log("error in resolver delete", e);
  }
});

resolver.define("delete-all", async ({ context }) => {
  try {
    // return storage.set(getListKeyFromContext(context), []);
    await storageSetHelper(getIssueKeyFromContext(context), []);
    return [];
  } catch (e) {
    console.log("error in resolver delete-all", e);
  }
});

resolver.define("get-status", async ({ context }) => {
  try {
    return (await storageGetHelper(getIssueKeyFromContext(context))) || [];
  } catch (e) {
    console.log("error in resolver get-status", e);
  }
});

// Test resolver to verify panel is loading
resolver.define("test-connection", async ({ context }) => {
  console.log(`[RESOLVER DEBUG] Test connection called`);
  console.log(`[RESOLVER DEBUG] Issue key: ${context?.extension?.issue?.key}`);
  console.log(`[RESOLVER DEBUG] Issue type: ${context?.extension?.issue?.issueType}`);
  console.log(`[RESOLVER DEBUG] Project key: ${context?.extension?.project?.key}`);
  
  return {
    success: true,
    issueKey: context?.extension?.issue?.key,
    issueType: context?.extension?.issue?.issueType,
    projectKey: context?.extension?.project?.key,
    timestamp: new Date().toISOString()
  };
});

resolver.define("test-aws-connection", async ({ payload }) => {
  console.log(`[RESOLVER DEBUG] Testing AWS connection`);
  try {
    const { accessKeyId, secretAccessKey, region } = payload;
    
    if (!accessKeyId || !secretAccessKey) {
      return { success: false, message: 'AWS credentials are required' };
    }
    
    const result = await testAwsBedrockConnection(accessKeyId, secretAccessKey, region);
    console.log(`[RESOLVER DEBUG] AWS test result:`, result);
    return result;
  } catch (error) {
    console.log(`[RESOLVER ERROR] AWS test failed:`, error.message);
    return { success: false, message: 'Test failed', error: error.message };
  }
});

resolver.define("execute-aws-test", async ({ context }) => {
  console.log(`[RESOLVER DEBUG] Executing AWS test with stored credentials`);
  try {
    const projectKey = context.extension?.project?.key;
    if (!projectKey) {
      return { success: false, message: 'No project key found' };
    }
    
    // Get stored credentials and test them
    const { accessKeyId, secretAccessKey } = await getAwsCredentials(projectKey);
    const region = await getAwsRegion(projectKey);
    
    if (!accessKeyId || !secretAccessKey) {
      return { success: false, message: 'No AWS credentials configured for this project' };
    }
    
    console.log(`[RESOLVER DEBUG] Testing with region: ${region}`);
    const result = await testAwsBedrockConnection(accessKeyId, secretAccessKey, region);
    console.log(`[RESOLVER DEBUG] Test execution result:`, result);
    return result;
  } catch (error) {
    console.log(`[RESOLVER ERROR] Test execution failed:`, error.message);
    return { success: false, message: 'Test execution failed', error: error.message };
  }
});

console.log(`[RESOLVER DEBUG] Resolver definitions loaded:`, Object.keys(resolver.getDefinitions()));
export const handler = resolver.getDefinitions();
