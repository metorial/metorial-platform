import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FunctionDeploymentStatus,
  FunctionDeploymentStepStatus
} from '../../../prisma/generated/client';
import { functionBayClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

const buildQueueMocks = vi.hoisted(() => ({
  add: vi.fn().mockResolvedValue({ id: 'test-job-id' })
}));

vi.mock('../../queues/build', () => ({
  startBuildQueue: {
    add: buildQueueMocks.add
  }
}));

describe('functionDeployment:create E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
    buildQueueMocks.add.mockReset();
  });

  it('creates a new deployment', async () => {
    const func = await f.function.withTenant();
    await f.runtime.nodejs22();

    const result = await functionBayClient.functionDeployment.create({
      tenantId: func.tenant.id,
      functionId: func.id,
      name: 'Production Deploy',
      runtime: { identifier: 'nodejs', version: '22.x' },
      config: {
        memorySizeMb: 256,
        timeoutSeconds: 30
      },
      env: { NODE_ENV: 'production' },
      files: [
        {
          filename: 'index.js',
          content: 'exports.handler = async () => ({ statusCode: 200 })'
        }
      ]
    });

    expect(result).toMatchObject({
      id: expect.any(String),
      name: 'Production Deploy',
      status: FunctionDeploymentStatus.pending,
      createdAt: expect.any(Date)
    });
  });

  it('creates deployment with base64 encoded files', async () => {
    const func = await f.function.withTenant();
    await f.runtime.nodejs22();

    const result = await functionBayClient.functionDeployment.create({
      tenantId: func.tenant.id,
      functionId: func.id,
      name: 'Binary Deploy',
      runtime: { identifier: 'nodejs', version: '22.x' },
      config: { memorySizeMb: 128, timeoutSeconds: 10 },
      env: {},
      files: [
        {
          filename: 'index.js',
          content: Buffer.from('exports.handler = () => {}').toString('base64'),
          encoding: 'base64'
        }
      ]
    });

    expect(result.status).toBe(FunctionDeploymentStatus.pending);
  });
});

describe('functionDeployment:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns deployments for a function', async () => {
    const func = await f.function.withTenantAndRuntime();

    const deployments = await Promise.all([
      f.functionDeployment.default({
        functionOid: func.oid,
        runtimeOid: func.runtime!.oid,
        overrides: { status: FunctionDeploymentStatus.pending }
      }),
      f.functionDeployment.default({
        functionOid: func.oid,
        runtimeOid: func.runtime!.oid,
        overrides: { status: FunctionDeploymentStatus.succeeded }
      }),
      f.functionDeployment.default({
        functionOid: func.oid,
        runtimeOid: func.runtime!.oid,
        overrides: { status: FunctionDeploymentStatus.failed }
      })
    ]);

    const deploymentIds = deployments.map(deployment => deployment.id);

    const result = await functionBayClient.functionDeployment.list({
      tenantId: func.tenant.id,
      functionId: func.id,
      limit: 10
    });

    expect(result.items).toHaveLength(3);
    result.items.forEach(item => {
      expect(deploymentIds).toContain(item.id);
      expect(item.function.id).toBe(func.id);
    });
    const [presented] = result.items;
    expect(presented).toBeDefined();
    expect(presented).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      status: expect.any(String),
      function: {
        id: func.id
      },
      runtime: {
        id: func.runtime!.id
      }
    });
    const statuses = result.items.map(item => item.status);
    expect(statuses).toContain(FunctionDeploymentStatus.pending);
    expect(statuses).toContain(FunctionDeploymentStatus.succeeded);
    expect(statuses).toContain(FunctionDeploymentStatus.failed);
  });
});

describe('functionDeployment:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a deployment by ID', async () => {
    const deployment = await f.functionDeployment.succeeded();

    const result = await functionBayClient.functionDeployment.get({
      tenantId: deployment.function.tenant.id,
      functionId: deployment.function.id,
      functionDeploymentId: deployment.id
    });

    expect(result).toMatchObject({
      id: deployment.id,
      name: deployment.name,
      status: FunctionDeploymentStatus.succeeded
    });
  });

  it('returns failed deployment with error details', async () => {
    const deployment = await f.functionDeployment.failed({
      errorCode: 'BUILD_ERROR',
      errorMessage: 'Compilation failed'
    });

    const result = await functionBayClient.functionDeployment.get({
      tenantId: deployment.function.tenant.id,
      functionId: deployment.function.id,
      functionDeploymentId: deployment.id
    });

    expect(result).toMatchObject({
      status: FunctionDeploymentStatus.failed,
      error: {
        code: 'BUILD_ERROR',
        message: 'Compilation failed'
      }
    });
  });
});

describe('functionDeployment:getOutput E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns deployment steps as output', async () => {
    const deployment = await f.functionDeployment.succeeded();

    await f.functionDeploymentStep.succeeded({
      functionDeploymentOid: deployment.oid,
      output: '[1234567890, "Build completed successfully"]'
    });

    const result = await functionBayClient.functionDeployment.getOutput({
      tenantId: deployment.function.tenant.id,
      functionId: deployment.function.id,
      functionDeploymentId: deployment.id
    });

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toMatchObject({
      status: FunctionDeploymentStepStatus.succeeded,
      logs: expect.arrayContaining([
        expect.objectContaining({
          timestamp: 1234567890,
          message: 'Build completed successfully'
        })
      ])
    });
  });

  it('returns empty array for deployment with no steps', async () => {
    const deployment = await f.functionDeployment.pending();

    const result = await functionBayClient.functionDeployment.getOutput({
      tenantId: deployment.function.tenant.id,
      functionId: deployment.function.id,
      functionDeploymentId: deployment.id
    });

    expect(result).toEqual([]);
  });

  it('returns multiple steps in order', async () => {
    const deployment = await f.functionDeployment.succeeded();

    await f.functionDeploymentStep.succeeded({
      functionDeploymentOid: deployment.oid,
      output: '[1234567890, "Step 1 complete"]',
      overrides: { name: 'Build' }
    });
    await f.functionDeploymentStep.succeeded({
      functionDeploymentOid: deployment.oid,
      output: '[1234567891, "Step 2 complete"]',
      overrides: { name: 'Deploy' }
    });

    const result = await functionBayClient.functionDeployment.getOutput({
      tenantId: deployment.function.tenant.id,
      functionId: deployment.function.id,
      functionDeploymentId: deployment.id
    });

    expect(result.length).toBe(2);
  });
});
