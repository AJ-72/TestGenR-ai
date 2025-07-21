# AI TestGenerator

This is a JIRA plugin project that create testcases from the details provided in the story. This reduces the effort required for test case development.

## Inspiration
This is a clone of an open source project - https://github.com/Nitheeshskumar/TestGenR-ai

## Goal

To reduce the effort in test case development and increase test case coverage by leveraging LLMs. With this tool being available within JIRA it becomes easy for all team members to use. 

## What it does

TestGenR is an OpenAI powered Jira app that generates testcases based on story description.

1. Add a trigger status (from To Do -> In Refinement) upon whose transition a LLM will automatically read the story descriptions and add testcases under the story.
2. The testcases are generated only if the issue type is a 'story' and will not regenerate testcases if it already exist.
3. The testcases can be fine-tuned by adding more to the statement, can be marked as verified, deleted or even add a new testcase.

## Configuration

### Project-Level AWS Bedrock Setup

Each Jira project can be configured independently with its own AWS Bedrock settings:

#### 1. Access Project Settings
- Go to your Jira project
- Click **Project Settings** (gear icon)
- Find **"TestcaseGenerator config"** in the left sidebar

#### 2. Configure AWS Bedrock
- **AWS Access Key ID**: Your AWS IAM access key with Bedrock permissions
- **AWS Secret Access Key**: Corresponding secret key
- **AWS Region**: Region where Bedrock is enabled (e.g., us-east-1, us-west-2, eu-west-1, ap-southeast-1)
- **Trigger Status**: Jira status that triggers test case generation (e.g., "Ready for Test")

#### 3. AWS Prerequisites
- AWS account with Bedrock service access
- IAM user with `bedrock:InvokeModel` permission
- Claude model enabled in your chosen AWS region
- Sufficient AWS Bedrock usage quotas

#### 4. Model Details
- **AI Model**: Anthropic Claude-3-Haiku (via AWS Bedrock)
- **Max Tokens**: 1000 per request
- **Input**: Story description text
- **Output**: Structured JSON array of test cases

### Per-Project Isolation
- Each project maintains separate AWS credentials
- Different projects can use different AWS regions
- Trigger statuses can vary per project
- No cross-project data sharing

### Usage
1. Create a Story issue with detailed description
2. Transition the story to your configured trigger status
3. Test cases automatically appear in the "Test(GenR)cases" panel
4. Edit, verify, or export test cases as needed

## Technical details

1. The application config panel is built using **Forge UI kit**
2. Testcases is added as an **issuePanel** and is developed using **Custom UI** following **Atlaskit design system**, **resolver** that uses **Properties API**.
3. The backend is developed in nodejs using **Forge API** and the generation of testcases is done using **Internal AWS Bedrock** model.

## Quick start

- Modify your app by editing the `src/index.jsx` file.

- Build and deploy your app by running:

```
forge deploy
```

- Install your app in an Atlassian site by running:

```
forge install
```

- Develop your app by running `forge tunnel` to proxy invocations locally:

```
forge tunnel
```

### Notes

- Use the `forge deploy` command when you want to persist code changes.
- Use the `forge install` command when you want to install the app on a new site.
- Once the app is installed on a site, the site picks up the new app changes you deploy without needing to rerun the install command.

## Permissions

This app requires the following permissions to function properly:

### Jira Permissions
- **`read:jira-work`** - Read issue data, descriptions, and status information
- **`write:jira-work`** - Store generated test cases on individual issues
- **`manage:jira-configuration`** - Enable project settings page for app configuration
- **`manage:jira-project`** - Store project-level AWS credentials and trigger settings
- **`storage:app`** - Store app-specific data and configuration

### External API Access
- **AWS Bedrock Runtime** - Connect to AWS Bedrock API endpoints in multiple regions:
  - us-east-1, us-west-2, eu-west-1, ap-southeast-1

### What This App Does NOT Access
- ❌ No global Jira settings modifications
- ❌ No system-wide configuration changes
- ❌ No access to other projects' data (unless explicitly configured)
- ❌ No user personal information beyond project context
- ❌ No modification of existing workflows or schemes

### Data Storage Scope
- **Project-Level**: AWS credentials and trigger status (isolated per project)
- **Issue-Level**: Generated test cases (stored on individual stories)
- **App-Specific**: All data is namespaced to this app only



