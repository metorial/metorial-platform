# Forge

Forge is a build orchestration service that wraps different cloud build providers (like AWS CodeBuild) to provide a unified API for running build processes, managing workflows, versioning, artifacts, and logs.

## Features

- **Multi-Provider Support**: Currently supports AWS CodeBuild with extensible architecture for additional providers
- **Workflow Management**: Define, version, and manage build workflows with multiple steps
- **Artifact Storage**: Automatic artifact collection and storage with presigned URL generation
- **Log Management**: Centralized log collection and retrieval for all build runs
- **Environment Variables**: Encrypted environment variable storage and injection
- **Build Versioning**: Track and manage different versions of your workflows
- **Tenant Isolation**: Multi-tenant architecture for isolated projects

## Quick Start

### Using Docker

Pull and run the latest image from GitHub Container Registry:

```bash
docker pull ghcr.io/metorial/forge:latest

docker run -d \
  -p 55020:52020 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/forge \
  -e REDIS_URL=redis://host:6379/0 \
  -e ENCRYPTION_KEY=your-32-char-encryption-key \
  -e DEFAULT_PROVIDER=aws.code-build \
  -e OBJECT_STORAGE_URL=http://object-storage:52010 \
  -e LOG_BUCKET_NAME=logs \
  -e ARTIFACT_BUCKET_NAME=artifacts \
  ghcr.io/metorial/forge:latest
```

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: forge
      POSTGRES_PASSWORD: forge
      POSTGRES_DB: forge
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - forge-network

  redis:
    image: redis:7-alpine
    networks:
      - forge-network

  object-storage:
    image: ghcr.io/metorial/object-storage:latest
    ports:
      - "55010:52010"
    volumes:
      - object-store-data:/app/data
    environment:
      RUST_LOG: info
      OBJECT_STORE__SERVER__HOST: 0.0.0.0
      OBJECT_STORE__SERVER__PORT: 52010
      OBJECT_STORE__BACKEND__TYPE: local
    networks:
      - forge-network

  forge:
    image: ghcr.io/metorial/forge:latest
    ports:
      - "55020:52020"
    environment:
      DATABASE_URL: postgresql://forge:forge@postgres:5432/forge
      REDIS_URL: redis://redis:6379/0

      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      DEFAULT_PROVIDER: aws.code-build

      OBJECT_STORAGE_URL: http://object-storage:52010
      LOG_BUCKET_NAME: logs
      ARTIFACT_BUCKET_NAME: artifacts

      # AWS CodeBuild Configuration (if using AWS provider)
      CODE_BUILD_AWS_REGION: ${CODE_BUILD_AWS_REGION}
      CODE_BUILD_AWS_ACCESS_KEY_ID: ${CODE_BUILD_AWS_ACCESS_KEY_ID}
      CODE_BUILD_AWS_SECRET_ACCESS_KEY: ${CODE_BUILD_AWS_SECRET_ACCESS_KEY}
      CODE_BUILD_PROJECT_NAME: ${CODE_BUILD_PROJECT_NAME}
      CODE_BUILD_ROLE_ARN: ${CODE_BUILD_ROLE_ARN}
    depends_on:
      - postgres
      - redis
      - object-storage
    networks:
      - forge-network

volumes:
  postgres_data:
  object-store-data:

networks:
  forge-network:
    driver: bridge
```

Create a `.env` file:

```bash
# Generate a random 32-character encryption key
ENCRYPTION_KEY=your-32-character-encryption-key

# AWS CodeBuild Configuration
CODE_BUILD_AWS_REGION=us-east-1
CODE_BUILD_AWS_ACCESS_KEY_ID=your-access-key
CODE_BUILD_AWS_SECRET_ACCESS_KEY=your-secret-key
CODE_BUILD_PROJECT_NAME=your-project-name
CODE_BUILD_ROLE_ARN=arn:aws:iam::account:role/your-role
```

Start the services:

```bash
docker-compose up -d
```

The Forge service will be available at `http://localhost:55020`

## TypeScript Client

### Installation

```bash
npm install @metorial-services/forge-client
yarn add @metorial-services/forge-client
bun add @metorial-services/forge-client
```

### Basic Usage

```typescript
import { createForgeClient } from '@metorial-services/forge-client';

let client = createForgeClient({
  endpoint: 'http://localhost:55020',
});
```

### Core API Examples

#### 1. Tenant Management

Tenants represent isolated tenants or projects:

```typescript
// Create/update an tenant
let tenant = await client.tenant.upsert({
  name: 'My Project',
  identifier: 'my-project',
});

// Get an tenant
let retrievedTenant = await client.tenant.get({
  tenantId: tenant.id,
});
```

#### 2. Workflow Management

Workflows define build processes:

```typescript
// Create/update a workflow
let workflow = await client.workflow.upsert({
  tenantId: tenant.id,
  name: 'Build and Test',
  identifier: 'build-test',
});

// List workflows
let workflows = await client.workflow.list({
  tenantId: tenant.id,
  limit: 10,
  order: 'desc',
});

// Get a specific workflow
let workflowDetails = await client.workflow.get({
  tenantId: tenant.id,
  workflowId: workflow.id,
});

// Update a workflow
let updated = await client.workflow.update({
  tenantId: tenant.id,
  workflowId: workflow.id,
  name: 'Build, Test, and Deploy',
});

// Delete a workflow
await client.workflow.delete({
  tenantId: tenant.id,
  workflowId: workflow.id,
});
```

#### 3. Workflow Versions

Versions allow you to define the actual build steps:

```typescript
// Create a workflow version with steps
let version = await client.workflowVersion.create({
  tenantId: tenant.id,
  workflowId: workflow.id,
  name: 'v1.0.0',
  steps: [
    {
      name: 'Install Dependencies',
      type: 'script',
      initScript: ['echo "Initializing..."'],
      actionScript: [
        'npm install',
        'npm run build',
      ],
      cleanupScript: ['echo "Cleaning up..."'],
    },
    {
      name: 'Run Tests',
      type: 'script',
      actionScript: [
        'npm test',
        'npm run coverage',
      ],
    },
  ],
});

// List versions
let versions = await client.workflowVersion.list({
  tenantId: tenant.id,
  workflowId: workflow.id,
  limit: 10,
});

// Get version details
let versionDetails = await client.workflowVersion.get({
  tenantId: tenant.id,
  workflowId: workflow.id,
});
```

#### 4. Running Workflows

Execute workflows with environment variables and files:

```typescript
// Create a workflow run
let run = await client.workflowRun.create({
  tenantId: tenant.id,
  workflowId: workflow.id,
  env: {
    NODE_ENV: 'production',
    API_KEY: 'your-api-key',
  },
  files: [
    {
      filename: 'config.json',
      content: JSON.stringify({ setting: 'value' }),
      encoding: 'utf-8',
    },
    {
      filename: 'binary-file.zip',
      content: 'base64-encoded-content',
      encoding: 'base64',
    },
  ],
});

console.log('Run ID:', run.id);
console.log('Status:', run.status);
console.log('Steps:', run.steps);

// List workflow runs
let runs = await client.workflowRun.list({
  tenantId: tenant.id,
  workflowId: workflow.id,
  limit: 20,
  order: 'desc',
});

// Get detailed run information
let runDetails = await client.workflowRun.get({
  tenantId: tenant.id,
  workflowId: workflow.id,
  workflowRunId: run.id,
});

console.log('Full run details:', runDetails.run);
console.log('Artifacts:', runDetails.run.artifacts);
console.log('Steps:', runDetails.run.steps);
```

#### 5. Accessing Logs

Retrieve build logs for workflow runs:

```typescript
// Get all step outputs for a run
let outputs = await client.workflowRun.getOutput({
  tenantId: tenant.id,
  workflowId: workflow.id,
  workflowRunId: run.id,
});

for (let output of outputs) {
  console.log(`Step: ${output.step.name}`);
  console.log(`Status: ${output.step.status}`);
  console.log(`Output:\n${output.output}`);
  console.log('---');
}

// Get output for a specific step
let stepOutput = await client.workflowRun.getOutputForStep({
  tenantId: tenant.id,
  workflowId: workflow.id,
  workflowRunId: run.id,
  workflowRunStepId: run.steps[0].id,
});

console.log('Step output:', stepOutput.output);
```

#### 6. Artifacts

Access build artifacts generated during workflow runs:

```typescript
// List artifacts for a workflow
let artifacts = await client.workflowArtifact.list({
  tenantId: tenant.id,
  workflowId: workflow.id,
  limit: 10,
});

for (let artifact of artifacts.items) {
  console.log('Artifact:', artifact.name);
  console.log('Type:', artifact.type);
  console.log('Download URL:', artifact.url);
}

// Get a specific artifact
let artifact = await client.workflowArtifact.get({
  tenantId: tenant.id,
  workflowId: workflow.id,
});

// The artifact URL contains presigned download links
console.log('Download URL:', artifact.url);
```

#### 7. Provider Information

```typescript
// Get the default provider configuration
let provider = await client.provider.getDefault();

console.log('Provider:', provider.identifier);
console.log('Provider ID:', provider.id);
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
