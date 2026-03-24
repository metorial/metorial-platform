import { describe, it, expect, beforeEach } from 'vitest';
import { SlateStatus, SlateDeploymentStatus } from '../../../../prisma/generated/client';
import { testDb, cleanDatabase } from '../../../test/setup';
import { fixtures } from '../../../test/fixtures';
import { slatesHubClient } from '../../../test/client';

describe('slateInvocation:DANGEROUSLY_get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single invocation by ID', async () => {
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });
    const provider = await f.deploymentProvider.default();
    const deployment = await f.slateDeployment.default({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      providerOid: provider.oid,
      overrides: { status: SlateDeploymentStatus.succeeded }
    });
    const invocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid
    });

    const result = await slatesHubClient.slateInvocation.DANGEROUSLY_get({
      slateInvocationId: invocation.id
    });

    expect(result).toMatchObject({
      object: 'slate.invocation',
      id: invocation.id
    });
  });

  it('returns succeeded invocation', async () => {
    const slate = await f.slate.complete();
    const provider = await f.deploymentProvider.default();
    const deployment = await f.slateDeployment.default({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      providerOid: provider.oid
    });
    const invocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid
    });

    const result = await slatesHubClient.slateInvocation.DANGEROUSLY_get({
      slateInvocationId: invocation.id
    });

    expect(result).toMatchObject({
      object: 'slate.invocation',
      id: invocation.id,
      status: 'succeeded'
    });
  });
});
