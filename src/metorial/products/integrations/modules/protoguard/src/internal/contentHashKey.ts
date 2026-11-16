import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { db, getId } from '@metorial-subspace/db';
import { randomBytes } from 'node:crypto';

let CONTENT_HASH_KEY_CACHE_TTL_SECONDS = 10 * 60;
let CONTENT_HASH_KEY_BYTES = 32;

// The key never leaves the database and the scanning process, so a content HMAC stored next to a
// finding cannot be reversed or correlated across tenants. It is created on first use; concurrent
// creators converge on whichever key won the conditional update.
let loadContentHashKey = async (tenantOid: bigint) => {
  let setting = await db.protoGuardTenantSetting.findUnique({
    where: { tenantOid },
    select: { contentHashKey: true }
  });
  if (setting?.contentHashKey) return setting.contentHashKey;

  let key = randomBytes(CONTENT_HASH_KEY_BYTES).toString('base64url');

  if (!setting) {
    let tenant = await db.tenant.findUniqueOrThrow({
      where: { oid: tenantOid },
      select: { projectOid: true }
    });
    await db.protoGuardTenantSetting.createMany({
      data: {
        ...getId('protoGuardTenantSetting'),
        tenantOid,
        projectOid: tenant.projectOid,
        contentHashKey: key
      },
      skipDuplicates: true
    });
  }

  await db.protoGuardTenantSetting.updateMany({
    where: { tenantOid, contentHashKey: null },
    data: { contentHashKey: key }
  });

  let stored = await db.protoGuardTenantSetting.findUniqueOrThrow({
    where: { tenantOid },
    select: { contentHashKey: true }
  });

  return stored.contentHashKey!;
};

export let getContentHashKey = createLocallyCachedFunction({
  getHash: (d: { tenantOid: bigint }) => String(d.tenantOid),
  provider: async (d: { tenantOid: bigint }) => await loadContentHashKey(d.tenantOid),
  ttlSeconds: CONTENT_HASH_KEY_CACHE_TTL_SECONDS
});
