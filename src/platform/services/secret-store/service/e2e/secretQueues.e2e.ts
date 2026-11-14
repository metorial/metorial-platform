import { uniqueId } from '@lowerdeck/testing-tools';
import { subDays } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { purgeDisabledSecret } from '../src/queues/purgeDisabledSecrets';
import { reconcileSecretPurpose } from '../src/queues/reconcileSecretPurpose';
import { createSecret, createTenant, registerConsumer } from './fixtures';

let createStoredSecret = async () => {
  let tenant = await createTenant();
  let registration = await registerConsumer('worker');
  let secret = await createSecret({ tenantId: tenant.id, consumerToken: registration.token });
  return db.secret.findUniqueOrThrow({ where: { id: secret.id } });
};

describe('nebula reconcile secret purpose', () => {
  it('sets purposeOid from purposeLegacy', async () => {
    let secret = await createStoredSecret();
    let identifier = uniqueId('legacy');
    await db.secret.update({
      where: { oid: secret.oid },
      data: { purposeOid: null, purposeLegacy: identifier }
    });

    await reconcileSecretPurpose(secret.oid);

    let updated = await db.secret.findUniqueOrThrow({
      where: { oid: secret.oid },
      include: { purpose: true }
    });
    expect(updated.purposeOid).toBeTypeOf('number');
    expect(updated.purpose?.identifier).toBe(identifier);
  });

  it('is idempotent for secrets that already have a purpose', async () => {
    let secret = await createStoredSecret();
    let before = await db.secret.findUniqueOrThrow({ where: { oid: secret.oid } });
    let purposeCount = await db.secretPurpose.count();

    await reconcileSecretPurpose(secret.oid);

    let after = await db.secret.findUniqueOrThrow({ where: { oid: secret.oid } });
    expect(after.purposeOid).toBe(before.purposeOid);
    expect(await db.secretPurpose.count()).toBe(purposeCount);
  });

  it('skips secrets without purposeLegacy', async () => {
    let secret = await createStoredSecret();
    await db.secret.update({
      where: { oid: secret.oid },
      data: { purposeOid: null, purposeLegacy: null }
    });

    await reconcileSecretPurpose(secret.oid);

    let updated = await db.secret.findUniqueOrThrow({ where: { oid: secret.oid } });
    expect(updated.purposeOid).toBeNull();
  });
});

describe('nebula purge disabled secrets', () => {
  it('marks disabled secrets as deleted', async () => {
    let secret = await createStoredSecret();
    await db.secret.update({
      where: { oid: secret.oid },
      data: { status: 'disabled', disabledAt: subDays(new Date(), 15) }
    });

    await purgeDisabledSecret(secret.oid);

    let updated = await db.secret.findUniqueOrThrow({ where: { oid: secret.oid } });
    expect(updated.status).toBe('deleted');
    expect(updated.deletedAt).toBeInstanceOf(Date);
  });

  it('ignores secrets that are not disabled', async () => {
    let secret = await createStoredSecret();

    await purgeDisabledSecret(secret.oid);

    let updated = await db.secret.findUniqueOrThrow({ where: { oid: secret.oid } });
    expect(updated.status).toBe('active');
    expect(updated.deletedAt).toBeNull();
  });
});
