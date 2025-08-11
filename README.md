# AI TestGenerator

This is a JIRA plugin project that create testcases from the details provided in the story. This reduces the effort required for test case development.

## Inspiration
This is a clone of an open source project - https://github.com/Nitheeshskumar/TestGenR-ai

## Goal

To reduce the effort in test case development and increase test case coverage by leveraging LLMs. With this tool being available within JIRA it becomes easy for all team members to use. 

## What it does

AI TestGenerator is an LLM powered Jira plugin that generates testcases based on story description.

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
- **Test Case Limit**: Maximum number of test cases per story (default: 5, max: 15)
- **AI Prompt Template**: Customizable prompt sent to AI model (use {description} placeholder)

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
- **Test Case Limits**: Configurable per project (default: 5, max: 15 per story)
- **Custom Prompts**: Administrators can customize AI prompts per project

### Per-Project Isolation
- Each project maintains separate AWS credentials
- Different projects can use different AWS regions
- Trigger statuses can vary per project
- Test case limits can be configured per project
- No cross-project data sharing

### Test Case Limits
- **Default Limit**: 5 test cases per story
- **Maximum Limit**: 15 test cases per story
- **Configurable**: Set different limits per project in settings (1-15)
- **Enforced**: Prevents creation beyond configured limit
- **Applies To**: Both AI-generated and manually added test cases
- **Error Handling**: Clear error message when limit exceeded

### Usage
1. Create a Story issue with detailed description
2. Transition the story to your configured trigger status
3. Test cases automatically appear in the "Test(GenR)cases" panel
4. Edit, verify, or export test cases as needed

## Technical Architecture

### Modern Forge Platform
- **Forge React v10**: Latest Forge React framework for optimal performance
- **Custom UI**: Both project settings and issue panel use Custom UI with React 18
- **No Deprecated Dependencies**: Fully migrated from deprecated Forge UI to modern Custom UI
- **Atlaskit Design System**: Consistent UI components following Atlassian design guidelines

### Components
1. **Project Settings**: Custom UI React app with Atlaskit form components
2. **Issue Panel**: Custom UI React app for test case management
3. **Backend Resolvers**: Node.js functions using Forge API and Properties API
4. **AI Integration**: AWS Bedrock Claude-3-Haiku model for test case generation

### Technology Stack
- **Runtime**: Node.js 20.x
- **Frontend**: React 18 with Atlaskit components
- **Backend**: Forge API v3.0 with Resolver v2.0
- **Storage**: Forge Properties API for project and issue-level data
- **AI Service**: AWS Bedrock Runtime API

## Development Setup

### Prerequisites
- Node.js 20.x or higher
- Forge CLI v12.2.0 or higher
- AWS account with Bedrock access

### Quick Start

1. **Install Dependencies**:
```bash
npm install
```

2. **Build Custom UI**:
```bash
cd static/AtlassianUI
npm install
npm run build
cd ../..
```

3. **Deploy to Atlassian**:
```bash
forge deploy
```

4. **Install on Jira Site**:
```bash
forge install
```

5. **Development Mode** (optional):
```bash
forge tunnel
```

### Project Structure
```
src/
├── helpers/
│   ├── callAWSBedrock.js    # AWS Bedrock integration
│   ├── getdescription.js    # Story description parser
│   └── storageHelper.js     # Data persistence
├── projectsetting.jsx       # Project settings resolver
├── resolver.js              # Issue panel resolver
└── testgen.jsx             # Main trigger function

static/
├── AtlassianUI/            # Issue panel Custom UI
└── ProjectSettings/        # Project settings Custom UI
```

### Development Notes

- **Deployment**: Use `forge deploy` to persist code changes to Atlassian cloud
- **Installation**: Use `forge install` for new Jira sites
- **Updates**: Deployed changes automatically appear on installed sites
- **Custom UI**: Both UIs are built separately and served as static resources
- **Modern Architecture**: No deprecated Forge UI components - fully Custom UI based

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



