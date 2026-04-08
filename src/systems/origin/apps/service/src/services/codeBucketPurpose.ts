import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { getId } from '../id';

let ensureCached = createLocallyCachedFunction({
  getHash: (identifier: string) => identifier,
  ttlSeconds: 60 * 60,
  provider: async (identifier: string) =>
    await db.codeBucketPurpose.upsert({
      where: { identifier },
      update: {},
      create: {
        ...getId('codeBucketPurpose'),
        identifier
      }
    })
});

class codeBucketPurposeServiceImpl {
  async ensurePurpose(d: { purpose: string }) {
    return (await ensureCached(d.purpose)).oid;
  }
}

export let codeBucketPurposeService = Service.create(
  'codeBucketPurposeService',
  () => new codeBucketPurposeServiceImpl()
).build();
