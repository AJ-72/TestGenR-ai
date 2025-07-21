import ForgeUI, {
  ProjectSettingsPage,
  render,
  Text,
  Select,
  Option,
  Form,
  TextField,
  useEffect,
  Link,
  useAction,
  useProductContext,
  SectionMessage,
  useState,
} from "@forge/ui";
import api, { route, properties } from "@forge/api";
const TestGenRConfig = () => {
  const context = useProductContext();
  const [showMessage, setShowMessage] = useState(false);
  const getStatuses = async () => {
    console.log("AI TestGenerator Config log: fetching statuses");
    try {
      const response = await api.asApp().requestJira(route`/rest/api/3/status`, {
        headers: {
          Accept: "application/json",
        },
      });
      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-status/#api-rest-api-3-statuses-get

      const result = await response.json();
      return result.map(({ name, id }) => ({ name, id }));
    } catch (e) {
      console.log("AI TestGenerator Config log: failed to get statuses", e);
      return "false";
    }
  };
  const getSelectedStatus = async () => {
    try {
      console.log("AI TestGenerator Config log: fetching selected trigger status");
      let response = await properties.onJiraProject(context.platformContext.projectKey).get("test-genR-trigger-status");

      return response;
    } catch (e) {
      console.log("AI TestGenerator Config log: failed to get trigger status", e);
    }
  };
  const getAwsConfig = async () => {
    try {
      console.log("AI TestGenerator Config log: fetching AWS config");
      const accessKey = await properties.onJiraProject(context.platformContext.projectKey).get("test-genR-aws-access-key");
      const secretKey = await properties.onJiraProject(context.platformContext.projectKey).get("test-genR-aws-secret-key");
      const region = await properties.onJiraProject(context.platformContext.projectKey).get("test-genR-aws-region");
      return { accessKey, secretKey, region };
    } catch (e) {
      console.log("AI TestGenerator Config log: failed to get AWS config", e);
    }
  };
  const [statuses] = useAction(
    (value) => value,
    async () => {
      return await getStatuses();
    }
  );
  const [defaultselected, setDefaultselected] = useAction(
    (value, step) => step,
    async () => {
      return await getSelectedStatus();
    }
  );
  const [defaultAwsConfig, setDefaultAwsConfig] = useAction(
    (value, step) => step,
    async () => {
      return await getAwsConfig();
    }
  );
  useEffect(() => {
    getStatuses();
  }, []);
  //check if new config is submitted
  const checkConfigUpdate = (newConfig) => {
    if (defaultAwsConfig?.accessKey !== newConfig.accessKey) {
      setShowMessage(true);
    }
    return true;
  };
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Handles form submission, which is a good place to call APIs, or to set component state...
  const onSubmit = async (formData) => {
    console.log("AI TestGenerator Config log: submitting config", formData);
    try {
      await properties
        .onJiraProject(context.platformContext.projectKey)
        .set("test-genR-trigger-status", formData.milestone);
      await properties.onJiraProject(context.platformContext.projectKey).set("test-genR-aws-access-key", formData.accessKey);
      await properties.onJiraProject(context.platformContext.projectKey).set("test-genR-aws-secret-key", formData.secretKey);
      await properties.onJiraProject(context.platformContext.projectKey).set("test-genR-aws-region", formData.region || "us-east-1");
      setDefaultselected(formData.milestone);
      setDefaultAwsConfig({ accessKey: formData.accessKey, secretKey: formData.secretKey, region: formData.region });
      checkConfigUpdate({ accessKey: formData.accessKey });
    } catch (e) {
      console.log("TestGenr Config log: error on setting config", e);
    }
    return true;
  };

  return (
    <ProjectSettingsPage>
      <Text>
        AI TestGenerator uses AWS Bedrock to generate test cases after reading the story description. Add a trigger 'transition to
        status' to automatically generate the test cases. Its recommended to choose a status when the story is ready for
        test. This ensures the story descriptions are finalized and avoid generating test cases for stories that don't
        require testing.
      </Text>
      {statuses && (
        <Form onSubmit={onSubmit}>
          <Select label="Status to trigger" name="milestone" isRequired>
            {statuses.map((el) => (
              <Option label={el.name} value={el.name} defaultSelected={defaultselected === el.name} />
            ))}
          </Select>

          <TextField
            name="accessKey"
            label="AWS Access Key ID"
            placeholder="Your AWS Access Key"
            defaultValue={defaultAwsConfig?.accessKey}
            isRequired
          />
          <TextField
            name="secretKey"
            label="AWS Secret Access Key"
            placeholder="Your AWS Secret Key"
            defaultValue={defaultAwsConfig?.secretKey}
            isRequired
          />
          <TextField
            name="region"
            label="AWS Region"
            placeholder="us-east-1"
            defaultValue={defaultAwsConfig?.region || "us-east-1"}
          />
          <Text>
            {" "}
            Go to{" "}
            <Link href="https://console.aws.amazon.com/iam/home#/security_credentials" openNewTab>
              AWS IAM Console
            </Link>{" "}
            to create AWS credentials with Bedrock access
          </Text>
          {showMessage && <SectionMessage title="AWS credentials updated" appearance="confirmation"></SectionMessage>}
        </Form>
      )}
    </ProjectSettingsPage>
  );
};
export const run = render(<TestGenRConfig />);
