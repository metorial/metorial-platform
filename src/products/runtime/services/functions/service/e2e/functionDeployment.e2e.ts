import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { functionBay } from './client';
import {
  createDeployment,
  createDeploymentStep,
  createFunction,
  createRuntime,
  createTenant
} from './fixtures';

let seedFunction = async () => {
  let tenant = await createTenant();
  let runtime = await createRuntime();
  let func = await createFunction({ tenantOid: tenant.oid, runtimeOid: runtime.oid });
  return { tenant, runtime, function: func };
};

describe('function-bay function deployment', () => {
  it('creates a deployment', async () => {
    let seeded = await seedFunction();

    let result = await functionBay.functionDeployment.create({
      tenantId: seeded.tenant.id,
      functionId: seeded.function.id,
      name: 'Production Deploy',
      runtime: { identifier: 'nodejs', version: '22.x' },
      config: { memorySizeMb: 256, timeoutSeconds: 30 },
      env: { NODE_ENV: 'production' },
      files: [
        { filename: 'index.js', content: 'exports.handler = async () => ({ statusCode: 200 })' }
      ]
    });

    expect(result).toMatchObject({
      id: expect.any(String),
      name: 'Production Deploy',
      createdAt: expect.any(Date)
    });

    let row = await db.functionDeployment.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.functionOid).toBe(seeded.function.oid);
    expect(row.encryptedEnvironmentVariables).not.toContain('production');
  });

  it('creates a deployment with base64 encoded files', async () => {
    let seeded = await seedFunction();

    let result = await functionBay.functionDeployment.create({
      tenantId: seeded.tenant.id,
      functionId: seeded.function.id,
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

    expect(result.id).toEqual(expect.any(String));
  });

  it('lists the deployments of a function', async () => {
    let seeded = await seedFunction();
    let other = await seedFunction();

    let deployments = await Promise.all(
      (['pending', 'succeeded', 'failed'] as const).map(status =>
        createDeployment({
          functionOid: seeded.function.oid,
          runtimeOid: seeded.runtime.oid,
          overrides: { status }
        })
      )
    );
    let otherDeployment = await createDeployment({
      functionOid: other.function.oid,
      runtimeOid: other.runtime.oid
    });

    let result = await functionBay.functionDeployment.list({
      tenantId: seeded.tenant.id,
      functionId: seeded.function.id,
      limit: 10
    });

    let ids = result.items.map(item => item.id);
    expect(ids).toHaveLength(3);
    for (let deployment of deployments) expect(ids).toContain(deployment.id);
    expect(ids).not.toContain(otherDeployment.id);
    expect(result.items.map(item => item.status).sort()).toEqual([
      'failed',
      'pending',
      'succeeded'
    ]);
    expect(result.items[0]).toMatchObject({
      function: { id: seeded.function.id },
      runtime: { id: seeded.runtime.id }
    });
  });

  it('gets a deployment by id', async () => {
    let seeded = await seedFunction();
    let deployment = await createDeployment({
      functionOid: seeded.function.oid,
      runtimeOid: seeded.runtime.oid,
      overrides: { status: 'succeeded' }
    });

    let result = await functionBay.functionDeployment.get({
      tenantId: seeded.tenant.id,
      functionId: seeded.function.id,
      functionDeploymentId: deployment.id
    });

    expect(result).toMatchObject({
      id: deployment.id,
      name: deployment.name,
      status: 'succeeded'
    });
  });

  it('returns error details of a failed deployment', async () => {
    let seeded = await seedFunction();
    let deployment = await createDeployment({
      functionOid: seeded.function.oid,
      runtimeOid: seeded.runtime.oid,
      overrides: { status: 'failed', errorCode: 'BUILD_ERROR', errorMessage: 'Compilation failed' }
    });

    let result = await functionBay.functionDeployment.get({
      tenantId: seeded.tenant.id,
      functionId: seeded.function.id,
      functionDeploymentId: deployment.id
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: { code: 'BUILD_ERROR', message: 'Compilation failed' }
    });
  });

  it('returns the steps of a deployment as output', async () => {
    let seeded = await seedFunction();
    let deployment = await createDeployment({
      functionOid: seeded.function.oid,
      runtimeOid: seeded.runtime.oid,
      overrides: { status: 'succeeded' }
    });

    await createDeploymentStep({
      functionDeploymentOid: deployment.oid,
      output: '[1234567890, "Step 1 complete"]',
      overrides: { name: 'Build' }
    });
    await createDeploymentStep({
      functionDeploymentOid: deployment.oid,
      output: '[1234567891, "Step 2 complete"]',
      overrides: { name: 'Deploy' }
    });

    let result = await functionBay.functionDeployment.getOutput({
      tenantId: seeded.tenant.id,
      functionId: seeded.function.id,
      functionDeploymentId: deployment.id
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      status: 'succeeded',
      logs: [expect.objectContaining({ timestamp: 1234567890, message: 'Step 1 complete' })]
    });
  });

  it('returns no output for a deployment without steps', async () => {
    let seeded = await seedFunction();
    let deployment = await createDeployment({
      functionOid: seeded.function.oid,
      runtimeOid: seeded.runtime.oid,
      overrides: { status: 'succeeded' }
    });

    let result = await functionBay.functionDeployment.getOutput({
      tenantId: seeded.tenant.id,
      functionId: seeded.function.id,
      functionDeploymentId: deployment.id
    });

    expect(result).toEqual([]);
  });
});
