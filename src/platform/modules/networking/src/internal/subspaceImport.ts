import { db } from '@metorial/db';
import { db as subspaceDb } from '@metorial-subspace/db';

export let importNetworkPolicy = async (d: { networkPolicyId: string }) => {
  let existing = await db.networkPolicy.findUnique({ where: { id: d.networkPolicyId } });
  if (existing) return existing;

  let source = await subspaceDb.networkPolicy.findUnique({
    where: { id: d.networkPolicyId },
    include: { versions: true, currentVersion: true }
  });
  if (!source) return null;

  if (!source.instanceOid) return null;

  let instance = await db.instance.findUniqueOrThrow({ where: { oid: source.instanceOid } });

  let policy = await db.networkPolicy.create({
    data: {
      id: source.id,
      status: source.status,
      name: source.name,
      description: source.description,
      currentVersionNumber: source.currentVersionNumber,
      revision: 1,
      needsSubspaceSync: false,
      subspaceSyncedRevision: 1,
      organizationOid: instance.organizationOid,
      projectOid: instance.projectOid,
      instanceOid: instance.oid,
      createdAt: source.createdAt,
      archivedAt: source.archivedAt
    }
  });

  let versionOids = new Map<string, bigint>();
  for (let version of source.versions) {
    let created = await db.networkPolicyVersion.create({
      data: {
        id: version.id,
        version: version.version,
        rules: version.rules as PrismaJson.NetworkingPolicyRules,
        networkPolicyOid: policy.oid,
        createdAt: version.createdAt
      }
    });
    versionOids.set(version.id, created.oid);
  }

  if (source.currentVersion) {
    await db.networkPolicy.update({
      where: { oid: policy.oid },
      data: { currentVersionOid: versionOids.get(source.currentVersion.id) }
    });
  }

  await subspaceDb.networkPolicy.update({
    where: { oid: source.oid },
    data: { sourceRevision: 1 }
  });

  return policy;
};

export let importFirewall = async (d: { firewallId: string }) => {
  let existing = await db.firewall.findUnique({ where: { id: d.firewallId } });
  if (existing) return existing;

  let source = await subspaceDb.firewall.findUnique({
    where: { id: d.firewallId },
    include: { networkPolicyLinks: { include: { networkPolicy: true } } }
  });
  if (!source) return null;

  if (!source.instanceOid) return null;

  let instance = await db.instance.findUniqueOrThrow({ where: { oid: source.instanceOid } });

  for (let link of source.networkPolicyLinks) {
    await importNetworkPolicy({ networkPolicyId: link.networkPolicy.id });
  }

  let firewall = await db.firewall.create({
    data: {
      id: source.id,
      status: source.status,
      name: source.name,
      description: source.description,
      slug: source.slug,
      revision: 1,
      needsSubspaceSync: false,
      subspaceSyncedRevision: 1,
      organizationOid: instance.organizationOid,
      projectOid: instance.projectOid,
      instanceOid: instance.oid,
      createdAt: source.createdAt,
      archivedAt: source.archivedAt
    }
  });

  for (let link of source.networkPolicyLinks) {
    let policy = await db.networkPolicy.findUniqueOrThrow({
      where: { id: link.networkPolicy.id }
    });

    await db.firewallNetworkPolicy.create({
      data: {
        id: link.id,
        firewallOid: firewall.oid,
        networkPolicyOid: policy.oid,
        position: link.position
      }
    });
  }

  await subspaceDb.firewall.update({
    where: { oid: source.oid },
    data: { sourceRevision: 1 }
  });

  return firewall;
};
