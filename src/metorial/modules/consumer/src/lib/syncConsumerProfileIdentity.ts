import { TransactionDB } from '@metorial/db';

export let syncConsumerProfileIdentity = async (d: {
  db: TransactionDB;
  instanceOid: bigint;
  consumerOid: bigint;
  name: string;
  email: string;
}) => {
  let profiles = await d.db.consumerProfile.findMany({
    where: {
      instanceOid: d.instanceOid,
      consumerOid: d.consumerOid,
      status: 'active'
    },
    select: { oid: true, surfaceOid: true },
    orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }]
  });

  if (!profiles.length) return;

  await d.db.consumerProfile.updateMany({
    where: { oid: { in: profiles.map(profile => profile.oid) } },
    data: { name: d.name }
  });

  let surfaceOids = Array.from(new Set(profiles.map(profile => profile.surfaceOid)));
  let existingEmailProfiles = await d.db.consumerProfile.findMany({
    where: {
      surfaceOid: { in: surfaceOids },
      email: d.email
    },
    select: { surfaceOid: true }
  });
  let surfacesWithEmail = new Set(existingEmailProfiles.map(profile => profile.surfaceOid));

  for (let surfaceOid of surfaceOids) {
    if (surfacesWithEmail.has(surfaceOid)) continue;

    let profile = profiles.find(profile => profile.surfaceOid === surfaceOid);
    if (!profile) continue;

    await d.db.consumerProfile.update({
      where: { oid: profile.oid },
      data: { email: d.email }
    });
  }
};
