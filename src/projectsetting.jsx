import Resolver from "@forge/resolver";
import api, { route, properties } from "@forge/api";

const resolver = new Resolver();

// Simple test function to verify resolver connectivity
resolver.define("test", async ({ context }) => {
  console.log(`[CONFIG-BACKEND] ===== TEST FUNCTION CALLED =====`);
  console.log(`[CONFIG-BACKEND] Test context:`, JSON.stringify(context, null, 2));
  return { message: "Backend resolver is working", timestamp: new Date().toISOString() };
});

resolver.define("getStatuses", async ({ context }) => {
  const projectKey = context?.extension?.project?.key;
  console.log(`[CONFIG-BACKEND] ===== getStatuses CALLED =====`);
  console.log(`[CONFIG-BACKEND] Project key: ${projectKey}`);
  console.log(`[CONFIG-BACKEND] Context:`, JSON.stringify(context, null, 2));
  
  try {
    console.log("[CONFIG-BACKEND] Fetching statuses from Jira API...");
    const response = await api.asApp().requestJira(route`/rest/api/3/status`, {
      headers: { Accept: "application/json" },
    });
    
    console.log(`[CONFIG-BACKEND] Jira API response status: ${response.status}`);
    console.log(`[CONFIG-BACKEND] Response headers:`, response.headers);
    
    if (!response.ok) {
      console.error(`[CONFIG-BACKEND] Failed to fetch statuses: ${response.status} ${response.statusText}`);
      const fallbackStatuses = [
        { name: "In Analysis", id: "in-analysis" },
        { name: "Ready For Development", id: "ready-for-development" },
        { name: "Ready For Test", id: "ready-for-test" }
      ];
      console.log(`[CONFIG-BACKEND] Returning fallback statuses:`, fallbackStatuses);
      return fallbackStatuses;
    }
    
    const result = await response.json();
    console.log(`[CONFIG-BACKEND] Raw Jira response:`, JSON.stringify(result, null, 2));
    console.log(`[CONFIG-BACKEND] Successfully fetched ${result.length} statuses from Jira`);
    const mappedStatuses = result.map(({ name, id }) => ({ name, id }));
    console.log(`[CONFIG-BACKEND] Mapped statuses:`, mappedStatuses);
    console.log(`[CONFIG-BACKEND] ===== getStatuses SUCCESS =====`);
    return mappedStatuses;
  } catch (e) {
    console.error(`[CONFIG-BACKEND] ===== getStatuses EXCEPTION =====`);
    console.error(`[CONFIG-BACKEND] Error message:`, e.message);
    console.error(`[CONFIG-BACKEND] Error stack:`, e.stack);
    console.error(`[CONFIG-BACKEND] Full error:`, e);
    const fallbackStatuses = [
      { name: "In Analysis", id: "in-analysis" },
      { name: "Ready For Development", id: "ready-for-development" },
      { name: "Ready For Test", id: "ready-for-test" }
    ];
    console.log(`[CONFIG-BACKEND] Returning fallback statuses due to exception:`, fallbackStatuses);
    return fallbackStatuses;
  }
});

resolver.define("getConfig", async ({ context }) => {
  const projectKey = context?.extension?.project?.key;
  console.log(`[CONFIG-BACKEND] ===== getConfig CALLED =====`);
  console.log(`[CONFIG-BACKEND] Project key: ${projectKey}`);
  
  try {
    console.log(`[CONFIG-BACKEND] Fetching configuration from project properties...`);
    const [triggerStatus, accessKey, secretKey, region, limit, prompt, sessionToken] = await Promise.all([
      properties.onJiraProject(projectKey).get("test-genR-trigger-status"),
      properties.onJiraProject(projectKey).get("test-genR-aws-access-key"),
      properties.onJiraProject(projectKey).get("test-genR-aws-secret-key"),
      properties.onJiraProject(projectKey).get("test-genR-aws-region"),
      properties.onJiraProject(projectKey).get("test-genR-limit"),
      properties.onJiraProject(projectKey).get("test-genR-prompt"),
      properties.onJiraProject(projectKey).get("test-genR-aws-session-token")
    ]);
    
    console.log(`[CONFIG-BACKEND] Raw property values:`, {
      triggerStatus: triggerStatus || 'null',
      accessKey: accessKey || 'null',
      secretKey: secretKey || 'null',
      region: region || 'null',
      limit: limit || 'null',
      prompt: prompt || 'null',
      sessionToken: sessionToken || 'null'
    });
    
    const config = { triggerStatus, accessKey, secretKey, region, limit, prompt, sessionToken };
    console.log(`[CONFIG-BACKEND] Processed configuration:`, {
      triggerStatus,
      accessKey: accessKey ? `***${accessKey.slice(-4)}` : 'not set',
      secretKey: secretKey ? '***MASKED***' : 'not set',
      region: region || 'not set',
      limit: limit || 'not set',
      prompt: prompt ? `${prompt.substring(0, 50)}...` : 'not set',
      sessionToken: sessionToken ? '***MASKED***' : 'not set'
    });
    
    console.log(`[CONFIG-BACKEND] ===== getConfig SUCCESS =====`);
    return config;
  } catch (e) {
    console.error(`[CONFIG-BACKEND] ===== getConfig EXCEPTION =====`);
    console.error(`[CONFIG-BACKEND] Error message:`, e.message);
    console.error(`[CONFIG-BACKEND] Error stack:`, e.stack);
    console.error(`[CONFIG-BACKEND] Full error:`, e);
    return {};
  }
});

resolver.define("saveConfig", async ({ payload, context }) => {
  const projectKey = context?.extension?.project?.key;
  console.log(`[CONFIG-BACKEND] ===== saveConfig CALLED =====`);
  console.log(`[CONFIG-BACKEND] Project key: ${projectKey}`);
  console.log(`[CONFIG-BACKEND] Raw payload:`, JSON.stringify(payload, null, 2));
  console.log(`[CONFIG-BACKEND] Payload summary:`, {
    triggerStatus: payload?.triggerStatus,
    accessKey: payload?.accessKey ? `***${payload.accessKey.slice(-4)}` : 'not provided',
    secretKey: payload?.secretKey ? '***MASKED***' : 'not provided',
    region: payload?.region,
    limit: payload?.limit,
    prompt: payload?.prompt ? `${payload.prompt.substring(0, 50)}...` : 'not provided',
    sessionToken: payload?.sessionToken ? '***MASKED***' : 'not provided'
  });
  
  try {
    const limitValue = Math.min(Math.max(parseInt(payload.limit) || 5, 1), 15);
    console.log(`[CONFIG-BACKEND] Processed limit value: ${limitValue}`);
    
    const valuesToSave = {
      "test-genR-trigger-status": payload.triggerStatus?.value || payload.triggerStatus,
      "test-genR-aws-access-key": payload.accessKey,
      "test-genR-aws-secret-key": payload.secretKey,
      "test-genR-aws-region": payload.region || "us-east-1",
      "test-genR-limit": limitValue,
      "test-genR-prompt": payload.prompt || "Write test cases for the following story requirements: {description}",
      "test-genR-aws-session-token": payload.sessionToken || null
    };
    
    console.log(`[CONFIG-BACKEND] Values to save:`, {
      ...valuesToSave,
      "test-genR-aws-secret-key": "***MASKED***",
      "test-genR-aws-session-token": valuesToSave["test-genR-aws-session-token"] ? "***MASKED***" : null
    });
    
    console.log(`[CONFIG-BACKEND] Saving configuration to project properties...`);
    await Promise.all([
      properties.onJiraProject(projectKey).set("test-genR-trigger-status", valuesToSave["test-genR-trigger-status"]),
      properties.onJiraProject(projectKey).set("test-genR-aws-access-key", valuesToSave["test-genR-aws-access-key"]),
      properties.onJiraProject(projectKey).set("test-genR-aws-secret-key", valuesToSave["test-genR-aws-secret-key"]),
      properties.onJiraProject(projectKey).set("test-genR-aws-region", valuesToSave["test-genR-aws-region"]),
      properties.onJiraProject(projectKey).set("test-genR-limit", valuesToSave["test-genR-limit"]),
      properties.onJiraProject(projectKey).set("test-genR-prompt", valuesToSave["test-genR-prompt"]),
      properties.onJiraProject(projectKey).set("test-genR-aws-session-token", valuesToSave["test-genR-aws-session-token"])
    ]);
    
    console.log(`[CONFIG-BACKEND] All properties saved successfully`);
    console.log(`[CONFIG-BACKEND] ===== saveConfig SUCCESS =====`);
    return { success: true };
  } catch (e) {
    console.error(`[CONFIG-BACKEND] ===== saveConfig EXCEPTION =====`);
    console.error(`[CONFIG-BACKEND] Error message:`, e.message);
    console.error(`[CONFIG-BACKEND] Error stack:`, e.stack);
    console.error(`[CONFIG-BACKEND] Full error:`, e);
    throw new Error(`Failed to save configuration: ${e.message}`);
  }
});

export const handler = resolver.getDefinitions();
