import getDescription from "./helpers/getdescription";
import callAWSBedrock from "./helpers/callAWSBedrock";
import { getSelectedStatus, setGenStatus, storageGetHelper, storageSetHelper, getPromptTemplate } from "./helpers/storageHelper";

console.log(`[TESTGEN DEBUG] Module loaded at ${new Date().toISOString()}`);

// Sanitize user input for logging
const sanitizeForLog = (input) => {
  if (typeof input === 'string') {
    return encodeURIComponent(input).substring(0, 200);
  }
  return JSON.stringify(input).substring(0, 200);
};

export async function run(event, context) {
  // CRITICAL: This should appear in logs for ANY Jira issue update
  console.log(`\n\n===== TESTGEN FUNCTION CALLED =====`);
  console.log(`[TESTGEN CRITICAL] Function invoked at ${new Date().toISOString()}`);
  console.log(`[TESTGEN CRITICAL] Event type: ${event?.eventType}`);
  console.log(`[TESTGEN CRITICAL] Issue key: ${event?.issue?.key}`);
  console.log(`[TESTGEN CRITICAL] Full event object keys: ${Object.keys(event || {}).join(', ')}`);
  console.log(`[TESTGEN CRITICAL] Context keys: ${Object.keys(context || {}).join(', ')}`);
  console.log(`===== TESTGEN FUNCTION CALLED =====\n\n`);
  
  const issueKey = event?.issue?.key || 'unknown';
  
  console.log(`[TESTGEN DEBUG] ========== TRIGGER INVOKED ==========`);
  console.log(`[TESTGEN DEBUG] Timestamp: ${new Date().toISOString()}`);
  console.log(`[TESTGEN DEBUG] Event received:`, JSON.stringify({
    eventType: event?.eventType,
    issueKey: event?.issue?.key,
    issueType: event?.issue?.fields?.issuetype?.name,
    projectKey: event?.issue?.fields?.project?.key,
    hasAssociatedStatuses: !!event?.associatedStatuses,
    associatedStatusesLength: event?.associatedStatuses?.length || 0
  }, null, 2));
  
  try {
    console.log(`[DEBUG] testgen invoked for issue: ${sanitizeForLog(issueKey)}`);
    console.log(`[DEBUG] Event type: ${event?.eventType || 'unknown'}`);
    console.log(`[DEBUG] Has associatedStatuses: ${!!event.associatedStatuses}`);
    console.log(`[DEBUG] AssociatedStatuses array length: ${event.associatedStatuses?.length || 0}`);
    
    // Enhanced validation with detailed logging
    if (!event.associatedStatuses) {
      console.log(`[DEBUG] SKIP: No associatedStatuses found - not a status change event`);
      return true;
    }
    
    if (!Array.isArray(event.associatedStatuses) || event.associatedStatuses.length < 2) {
      console.log(`[DEBUG] SKIP: Invalid associatedStatuses array structure`);
      return true;
    }
    
    const issueType = event.issue?.fields?.issuetype?.name;
    console.log(`[DEBUG] Issue type: ${sanitizeForLog(issueType)}`);
    
    // Case-insensitive issue type check
    if (!issueType || issueType.toLowerCase() !== "story") {
      console.log(`[DEBUG] SKIP: Issue type '${sanitizeForLog(issueType)}' is not 'Story'`);
      return true;
    }
    
    const projectKey = event.issue?.fields?.project?.key;
    if (!projectKey) {
      console.log(`[DEBUG] ERROR: No project key found`);
      return true;
    }
    
    console.log(`[DEBUG] Project key: ${sanitizeForLog(projectKey)}`);
    
    const triggerStatus = await getSelectedStatus(projectKey);
    const fromStatus = event.associatedStatuses[0]?.name;
    const toStatus = event.associatedStatuses[1]?.name;
    
    console.log(`[DEBUG] Status transition: '${sanitizeForLog(fromStatus)}' -> '${sanitizeForLog(toStatus)}'`);
    console.log(`[DEBUG] Configured trigger status: '${sanitizeForLog(triggerStatus)}'`);
    
    if (!triggerStatus) {
      console.log(`[DEBUG] SKIP: No trigger status configured for project ${sanitizeForLog(projectKey)}`);
      return true;
    }
    
    if (!toStatus) {
      console.log(`[DEBUG] SKIP: No 'to' status found in transition`);
      return true;
    }
    
    // Case-insensitive and trimmed status comparison
    if (toStatus.trim().toLowerCase() !== triggerStatus.trim().toLowerCase()) {
      console.log(`[DEBUG] SKIP: Status '${sanitizeForLog(toStatus)}' does not match trigger '${sanitizeForLog(triggerStatus)}'`);
      return true;
    }
    
    console.log(`[DEBUG] MATCH: Status matches trigger - proceeding with test generation`);
    
    await setGenStatus(issueKey, "loading");
    
    const existingTests = await storageGetHelper(issueKey);
    console.log(`[DEBUG] Existing tests count: ${existingTests?.length || 0}`);
    
    if (existingTests && Array.isArray(existingTests) && existingTests.length > 0) {
      console.log(`[DEBUG] SKIP: Test cases already exist (${existingTests.length} found)`);
      return true;
    }
    
    console.log(`[DEBUG] Extracting story description for issue ID: ${sanitizeForLog(event.issue.id)}`);
    
    let extractedText;
    try {
      extractedText = await getDescription(event.issue.id);
      extractedText = typeof extractedText === "string" ? extractedText : extractedText.join(".");
      console.log(`[DEBUG] Extracted text length: ${extractedText?.length || 0}`);
    } catch (descError) {
      console.log(`[ERROR] Failed to extract description: ${descError.message}`);
      throw descError;
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      console.log(`[DEBUG] SKIP: No description text found to generate tests from`);
      return true;
    }
    
    const promptTemplate = await getPromptTemplate(projectKey);
    const prompt = promptTemplate.replace('{description}', extractedText);
    console.log(`[DEBUG] Generated prompt length: ${prompt?.length || 0}`);
    
    console.log(`[DEBUG] Calling AWS Bedrock for test generation`);
    
    let responseBedrock;
    try {
      responseBedrock = await callAWSBedrock(prompt, projectKey);
      console.log(`[DEBUG] Bedrock response received - test cases count: ${responseBedrock?.length || 0}`);
    } catch (bedrockError) {
      console.log(`[ERROR] Bedrock call failed: ${bedrockError.message}`);
      throw bedrockError;
    }
    
    if (!responseBedrock || !Array.isArray(responseBedrock) || responseBedrock.length === 0) {
      console.log(`[DEBUG] WARNING: No test cases generated from Bedrock`);
      responseBedrock = [];
    }
    
    await storageSetHelper(issueKey, responseBedrock);
    console.log(`[DEBUG] SUCCESS: ${responseBedrock.length} test cases saved to storage`);
    
  } catch (error) {
    console.log(`[ERROR] Failed to generate test cases for issue ${sanitizeForLog(issueKey)}: ${error.message}`);
    console.log(`[ERROR] Stack trace: ${error.stack}`);
    
    // Set error status for UI feedback
    try {
      await setGenStatus(issueKey, "error");
    } catch (statusError) {
      console.log(`[ERROR] Failed to set error status: ${statusError.message}`);
    }
    
    throw error; // Re-throw to ensure proper error handling
  } finally {
    try {
      const currentStatus = await setGenStatus(issueKey, "done");
      console.log(`[DEBUG] Final status set to 'done' for issue ${sanitizeForLog(issueKey)}`);
    } catch (finalError) {
      console.log(`[ERROR] Failed to set final status: ${finalError.message}`);
    }
    
    console.log(`[DEBUG] Completed processing for issue ${sanitizeForLog(issueKey)}`);
  }
  
  return true;
}
