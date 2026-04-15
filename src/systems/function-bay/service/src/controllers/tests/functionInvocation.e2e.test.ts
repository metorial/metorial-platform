import { beforeEach, describe, expect, it } from 'vitest';
import { FunctionInvocationStatus } from '../../../prisma/generated/client';
import { functionBayClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

describe('functionInvocation:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns invocations for a function', async () => {
    const version = await f.functionVersion.complete();

    const invocations = await Promise.all([
      f.functionInvocation.default({
        functionVersionOid: version.oid,
        overrides: { status: FunctionInvocationStatus.succeeded }
      }),
      f.functionInvocation.default({
        functionVersionOid: version.oid,
        overrides: { status: FunctionInvocationStatus.failed }
      })
    ]);

    const invocationIds = invocations.map(invocation => invocation.id);

    const result = await functionBayClient.functionInvocation.list({
      tenantId: version.function.tenant.id,
      functionId: version.function.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    result.items.forEach(item => {
      expect(invocationIds).toContain(item.id);
      expect(item.functionVersionId).toBe(version.id);
    });
    const [presented] = result.items;
    expect(presented).toBeDefined();
    expect(presented).toMatchObject({
      id: expect.any(String),
      functionVersionId: version.id
    });
    const statuses = result.items.map(item => item.status);
    expect(statuses).toContain(FunctionInvocationStatus.succeeded);
    expect(statuses).toContain(FunctionInvocationStatus.failed);
  });
});

describe('functionInvocation:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns an invocation by ID', async () => {
    const invocation = await f.functionInvocation.succeeded({
      invocationOverrides: {
        logs: '[1234567890, "Function output: success"]'
      }
    });

    const result = await functionBayClient.functionInvocation.get({
      tenantId: invocation.functionVersion.function.tenant.id,
      functionId: invocation.functionVersion.function.id,
      functionInvocationId: invocation.id
    });

    expect(result).toMatchObject({
      id: invocation.id,
      status: FunctionInvocationStatus.succeeded,
      logs: expect.arrayContaining([
        expect.objectContaining({
          timestamp: 1234567890,
          message: 'Function output: success'
        })
      ]),
      computeTimeMs: expect.any(Number),
      billedTimeMs: expect.any(Number)
    });
  });

  it('returns failed invocation with error details', async () => {
    const invocation = await f.functionInvocation.failed({
      error: { message: 'Runtime error', stack: 'at handler()' },
      invocationOverrides: {
        logs: '[1234567890, "Error: Something went wrong"]'
      }
    });

    const result = await functionBayClient.functionInvocation.get({
      tenantId: invocation.functionVersion.function.tenant.id,
      functionId: invocation.functionVersion.function.id,
      functionInvocationId: invocation.id
    });

    expect(result).toMatchObject({
      status: FunctionInvocationStatus.failed,
      error: expect.objectContaining({ message: 'Runtime error' }),
      logs: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('Error')
        })
      ])
    });
  });
});
