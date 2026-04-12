# Function Bay

Function Bay is a serverless function deployment and orchestration service that wraps cloud function providers (like AWS Lambda) to provide a unified API for deploying, versioning, invoking, and managing serverless functions.

## Features

- **Multi-Provider Support**: Currently supports AWS Lambda with extensible architecture for additional providers
- **Function Management**: Define, version, and manage serverless functions with configurations
- **Deployment Orchestration**: Automated deployment workflows with build tracking and logging via Forge
- **Runtime Support**: Multiple runtime environments including Node.js, Python, Ruby, and Java
- **Function Invocation**: Direct function invocation with payload support and detailed logging
- **Version Control**: Track and manage different versions of your functions
- **Tenant Isolation**: Multi-tenant architecture for isolated projects
- **Configuration Management**: Memory, timeout, and environment variable configuration per deployment

## Quick Start

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: function-bay
      POSTGRES_PASSWORD: function-bay
      POSTGRES_DB: function-bay
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - function-bay-network

  redis:
    image: redis:7-alpine
    networks:
      - function-bay-network

  object-storage:
    image: ghcr.io/metorial/object-storage:latest
    ports:
      - "45010:52010"
    volumes:
      - object-store-data:/app/data
    environment:
      RUST_LOG: info
      OBJECT_STORE__SERVER__HOST: 0.0.0.0
      OBJECT_STORE__SERVER__PORT: 52010
      OBJECT_STORE__BACKEND__TYPE: local
    networks:
      - function-bay-network

  forge:
    image: ghcr.io/metorial/forge:latest
    ports:
      - "45021:52020"
    environment:
      DATABASE_URL: postgresql://function-bay:function-bay@postgres:5432/forge
      REDIS_URL: redis://redis:6379/0
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      DEFAULT_PROVIDER: aws.code-build
      OBJECT_STORAGE_URL: http://object-storage:52010
      LOG_BUCKET_NAME: logs
      ARTIFACT_BUCKET_NAME: artifacts
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
      - function-bay-network

  function-bay:
    image: ghcr.io/metorial/function-bay:latest
    ports:
      - "45030:52030"
    environment:
      DATABASE_URL: postgresql://function-bay:function-bay@postgres:5432/function-bay
      REDIS_URL: redis://redis:6379/0
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      DEFAULT_PROVIDER: ${DEFAULT_PROVIDER}
      OBJECT_STORAGE_URL: http://object-storage:52010
      BUNDLE_BUCKET_NAME: bundles
      FORGE_API_URL: http://forge:52020/metorial-forge
      LAMBDA_AWS_REGION: ${LAMBDA_AWS_REGION}
      LAMBDA_AWS_ACCESS_KEY_ID: ${LAMBDA_AWS_ACCESS_KEY_ID}
      LAMBDA_AWS_SECRET_ACCESS_KEY: ${LAMBDA_AWS_SECRET_ACCESS_KEY}
      LAMBDA_ROLE_ARN: ${LAMBDA_ROLE_ARN}
    depends_on:
      - postgres
      - redis
      - object-storage
      - forge
    networks:
      - function-bay-network

volumes:
  postgres_data:
  object-store-data:

networks:
  function-bay-network:
    driver: bridge
```

Create a `.env` file:

```bash
# Generate a random 32-character encryption key
ENCRYPTION_KEY=your-32-character-encryption-key

# Default provider (aws.lambda or gcp.cloud-functions or azure.functions)
DEFAULT_PROVIDER=aws.lambda

# AWS Lambda Configuration
LAMBDA_AWS_REGION=us-east-1
LAMBDA_AWS_ACCESS_KEY_ID=your-access-key
LAMBDA_AWS_SECRET_ACCESS_KEY=your-secret-key
LAMBDA_ROLE_ARN=arn:aws:iam::account:role/your-lambda-role

# AWS CodeBuild Configuration (for Forge)
CODE_BUILD_AWS_REGION=us-east-1
CODE_BUILD_AWS_ACCESS_KEY_ID=your-access-key
CODE_BUILD_AWS_SECRET_ACCESS_KEY=your-secret-key
CODE_BUILD_PROJECT_NAME=your-project-name
CODE_BUILD_ROLE_ARN=arn:aws:iam::account:role/your-codebuild-role
```

Start the services:

```bash
docker-compose up -d
```

The Function Bay service will be available at `http://localhost:45030`

## TypeScript Client

### Installation

```bash
npm install @metorial-services/function-bay-client
yarn add @metorial-services/function-bay-client
bun add @metorial-services/function-bay-client
```

### Basic Usage

```typescript
import { createFunctionBayClient } from '@metorial-services/function-bay-client';

let client = createFunctionBayClient({
  endpoint: 'http://localhost:45030',
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

#### 2. Runtime Management

List available runtimes for your functions:

```typescript
// List available runtimes
let runtimes = await client.runtime.list({
  tenantId: tenant.id,
  limit: 10,
  order: 'desc',
});

// Get a specific runtime
let runtime = await client.runtime.get({
  runtimeId: runtimes.items[0].id,
});

console.log('Runtime:', runtime.identifier);
console.log('Specification:', runtime.specification);
```

#### 3. Function Management

Functions define serverless function resources:

```typescript
// Create/update a function
let func = await client.function.upsert({
  tenantId: tenant.id,
  name: 'My API Handler',
  identifier: 'api-handler',
});

// List functions
let functions = await client.function.list({
  tenantId: tenant.id,
  limit: 10,
  order: 'desc',
});

// Get a specific function
let functionDetails = await client.function.get({
  tenantId: tenant.id,
  functionId: func.id,
});

// Update a function
let updated = await client.function.update({
  tenantId: tenant.id,
  functionId: func.id,
  name: 'Updated API Handler',
});
```

#### 4. Function Deployments

Deploy function code with specific runtime and configuration:

```typescript
// Create a deployment
let deployment = await client.functionDeployment.create({
  tenantId: tenant.id,
  functionId: func.id,
  name: 'v1.0.0',
  runtime: {
    identifier: 'nodejs',
    version: '24.x',
  },
  config: {
    memorySizeMb: 512,
    timeoutSeconds: 30,
  },
  env: {
    NODE_ENV: 'production',
    API_KEY: 'your-api-key',
  },
  files: [
    {
      filename: 'index.js',
      content: `
        export const handler = async (event) => {
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Hello from Function Bay!' }),
          };
        };
      `,
      encoding: 'utf-8',
    },
    {
      filename: 'package.json',
      content: JSON.stringify({
        name: 'my-function',
        type: 'module',
      }),
      encoding: 'utf-8',
    },
  ],
});

console.log('Deployment ID:', deployment.id);
console.log('Status:', deployment.status);

// List deployments
let deployments = await client.functionDeployment.list({
  tenantId: tenant.id,
  functionId: func.id,
  limit: 20,
  order: 'desc',
});

// Get deployment details
let deploymentDetails = await client.functionDeployment.get({
  tenantId: tenant.id,
  functionId: func.id,
  functionDeploymentId: deployment.id,
});

console.log('Deployment:', deploymentDetails);
console.log('Runtime:', deploymentDetails.runtime);
console.log('Version:', deploymentDetails.version);
```

#### 5. Accessing Deployment Logs

Retrieve build and deployment logs:

```typescript
// Get all deployment step outputs
let outputs = await client.functionDeployment.getOutput({
  tenantId: tenant.id,
  functionId: func.id,
  functionDeploymentId: deployment.id,
});

for (let output of outputs) {
  console.log(`Step: ${output.name}`);
  console.log(`Status: ${output.status}`);
  console.log(`Type: ${output.type}`);
  console.log('Logs:');
  for (let log of output.logs) {
    console.log(`  [${new Date(log.timestamp)}] ${log.message}`);
  }
  console.log('---');
}
```

#### 6. Function Versions

List and manage deployed function versions:

```typescript
// List function versions
let versions = await client.functionVersion.list({
  tenantId: tenant.id,
  functionId: func.id,
  limit: 10,
  order: 'desc',
});

for (let version of versions.items) {
  console.log('Version:', version.name);
  console.log('Is Current:', version.isCurrent);
  console.log('Runtime:', version.runtime.specification);
  console.log('Configuration:', version.configuration);
}

// Get a specific version
let version = await client.functionVersion.get({
  tenantId: tenant.id,
  functionId: func.id,
  functionVersionId: versions.items[0].id,
});
```

#### 7. Invoking Functions

Execute deployed functions with custom payloads:

```typescript
// Invoke a function
let invocation = await client.function.invoke({
  tenantId: tenant.id,
  functionId: func.id,
  payload: {
    action: 'process',
    data: { userId: '123', operation: 'update' },
  },
});

if (invocation.type === 'success') {
  console.log('Result:', invocation.result);
} else {
  console.error('Error:', invocation.error);
}
```

#### 8. Function Invocation History

View invocation logs and metrics:

```typescript
// List function invocations
let invocations = await client.functionInvocation.list({
  tenantId: tenant.id,
  functionId: func.id,
  limit: 20,
  order: 'desc',
});

for (let inv of invocations.items) {
  console.log('Invocation ID:', inv.id);
  console.log('Status:', inv.status);
  console.log('Compute Time:', inv.computeTimeMs, 'ms');
  console.log('Billed Time:', inv.billedTimeMs, 'ms');
  console.log('Logs:', inv.logs);
  if (inv.error) {
    console.log('Error:', inv.error);
  }
}

// Get detailed invocation information
let invocationDetails = await client.functionInvocation.get({
  tenantId: tenant.id,
  functionId: func.id,
  functionInvocationId: invocations.items[0].id,
});

console.log('Full invocation details:', invocationDetails);
console.log('Function Version:', invocationDetails.functionVersionId);
```

#### 9. Provider Information

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
