import { addDays } from 'date-fns';
import { beforeEach, describe, expect, it } from 'vitest';
import { SlateDeploymentStatus, SlateStatus } from '../../../../prisma/generated/client';
import { getId } from '../../../id';
import { getStoredAttachmentsStorageKey } from '../../../lib/invocation/store';
import { invocationsBucketRecord, storage } from '../../../storage';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

let createStoredAttachment = async (invocationOid: bigint) => {
  let content = Buffer.from('invocation-attachment');
  let digest = new Uint8Array(new Bun.CryptoHasher('sha256').update(content).digest());
  let digestString = Buffer.from(digest).toString('hex');

  await storage.putObject(
    invocationsBucketRecord.bucket,
    getStoredAttachmentsStorageKey(digestString),
    content,
    'application/octet-stream'
  );

  let attachment = await testDb.slateAttachment.create({
    data: {
      ...getId('slateAttachment'),
      digest,
      expiresAt: addDays(new Date(), 7),
      lastCreatedAt: new Date()
    }
  });

  await testDb.slateInvocationAttachment.create({
    data: {
      ...getId('slateInvocationAttachment'),
      invocationOid,
      attachmentsOid: attachment.oid
    }
  });

  return attachment;
};

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
      id: invocation.id,
      status: 'succeeded'
    });
  });
});
