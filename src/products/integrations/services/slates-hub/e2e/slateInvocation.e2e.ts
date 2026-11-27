import { addDays } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { SlateDeploymentStatus, SlateStatus } from '../prisma/generated/client';
import { getId } from '../src/id';
import { getStoredAttachmentsStorageKey } from '../src/lib/invocation/store';
import { invocationsBucketRecord, storage } from '../src/storage';
import { slatesHubClient } from './client';
import { fixtures } from './fixtures';
import { db as testDb } from '../src/db';

let createStoredAttachment = async (invocationOid: bigint) => {
  let content = Buffer.from('invocation-attachment');
  let digest = new Uint8Array(new Bun.CryptoHasher('sha256').update(content).digest());
  let digestString = Buffer.from(digest).toString('hex');
  let storageKey = getStoredAttachmentsStorageKey(digestString);

  await storage.putObject(
    invocationsBucketRecord.bucket,
    storageKey,
    content,
    'application/octet-stream'
  );

  await testDb.slateAttachmentBlob.create({
    data: {
      ...getId('slateAttachmentBlob'),
      digest,
      storageBucket: invocationsBucketRecord.bucket,
      storageKey
    }
  });

  let attachment = await testDb.slateAttachment.create({
    data: {
      ...getId('slateAttachment'),
      digest,
      storageBucket: invocationsBucketRecord.bucket,
      storageKey,
      expiresAt: addDays(new Date(), 7)
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
