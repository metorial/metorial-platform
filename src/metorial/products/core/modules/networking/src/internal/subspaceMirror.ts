import { db, type Instance } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { db as subspaceDb, getId } from '@metorial-subspace/db';
import { subspaceScopeService } from '@metorial-subspace/module-tenant';

let defaultNetworkName = 'Metorial Magic Network';

let resolveScope = async (instance: Instance) => {
  let { tenant, environment } = await subspaceScopeService.ensureForInstance(instance);

  return { tenant, environment };
};

export let ensureSubspaceNetwork = async (instance: Instance) => {
  let { tenant, environment } = await resolveScope(instance);

  return await subspaceDb.network.upsert({
    where: {
      tenantOid_environmentOid: { tenantOid: tenant.oid, environmentOid: environment.oid }
    },
    update: {},
    create: {
      ...getId('network'),
      name: defaultNetworkName,
      tenantOid: tenant.oid,
      projectOid: tenant.projectOid,
      environmentOid: environment.oid,
      instanceOid: environment.instanceOid
    }
  });
};

export let mirrorNetworkPolicy = async (d: { networkPolicyId: string }) => {
  let source = await db.networkPolicy.findUnique({
    where: { id: d.networkPolicyId },
    include: { versions: true, instance: true, currentVersion: true }
  });
  if (!source) return false;

  let { tenant, environment } = await resolveScope(source.instance);

  let mirrored = await subspaceDb.networkPolicy.findUnique({ where: { id: source.id } });
  let policy =
    mirrored ??
    (await subspaceDb.networkPolicy.create({
      data: {
        ...getId('networkPolicy'),
        id: source.id,
        name: source.name,
        tenantOid: tenant.oid,
        projectOid: tenant.projectOid,
        environmentOid: environment.oid,
        instanceOid: environment.instanceOid,
        createdAt: source.createdAt
      }
    }));

  let existingVersions = await subspaceDb.networkPolicyVersion.findMany({
    where: { networkPolicyOid: policy.oid },
    select: { id: true, oid: true }
  });
  let knownVersions = new Map(existingVersions.map(version => [version.id, version.oid]));

  for (let version of [...source.versions].sort((a, b) => a.version - b.version)) {
    if (knownVersions.has(version.id)) continue;

    let created = await subspaceDb.networkPolicyVersion.create({
      data: {
        ...getId('networkPolicyVersion'),
        id: version.id,
        version: version.version,
        rules: version.rules as PrismaJson.NetworkPolicyRules,
        networkPolicyOid: policy.oid,
        createdAt: version.createdAt
      }
    });
    knownVersions.set(created.id, created.oid);
  }

  await subspaceDb.networkPolicy.update({
    where: { oid: policy.oid },
    data: {
      status: source.status,
      name: source.name,
      description: source.description,
      archivedAt: source.archivedAt,
      currentVersionNumber: source.currentVersionNumber,
      currentVersionOid: source.currentVersion
        ? (knownVersions.get(source.currentVersion.id) ?? null)
        : null,
      sourceRevision: source.revision
    }
  });

  await db.networkPolicy.updateMany({
    where: { oid: source.oid, revision: source.revision },
    data: { needsSubspaceSync: false, subspaceSyncedRevision: source.revision }
  });

  await Fabric.fire('networking.network_policy.mirrored:after', {
    networkPolicyId: source.id
  });

  return true;
};

export let mirrorFirewall = async (d: { firewallId: string }) => {
  let source = await db.firewall.findUnique({
    where: { id: d.firewallId },
    include: { instance: true, networkPolicyLinks: { include: { networkPolicy: true } } }
  });
  if (!source) return false;

  let { tenant, environment } = await resolveScope(source.instance);
  let network = await ensureSubspaceNetwork(source.instance);

  let policyOids = new Map<string, bigint>();
  for (let link of source.networkPolicyLinks) {
    let policyId = link.networkPolicy.id;
    await mirrorNetworkPolicy({ networkPolicyId: policyId });

    let policy = await subspaceDb.networkPolicy.findUniqueOrThrow({
      where: { id: policyId },
      select: { oid: true }
    });
    policyOids.set(policyId, policy.oid);
  }

  let firewall = await subspaceDb.firewall.upsert({
    where: { id: source.id },
    update: {
      status: source.status,
      name: source.name,
      description: source.description,
      slug: source.slug,
      archivedAt: source.archivedAt,
      sourceRevision: source.revision
    },
    create: {
      ...getId('firewall'),
      id: source.id,
      status: source.status,
      name: source.name,
      description: source.description,
      slug: source.slug,
      archivedAt: source.archivedAt,
      sourceRevision: source.revision,
      networkOid: network.oid,
      tenantOid: tenant.oid,
      projectOid: tenant.projectOid,
      environmentOid: environment.oid,
      instanceOid: environment.instanceOid,
      createdAt: source.createdAt
    }
  });

  await subspaceDb.firewallNetworkPolicy.deleteMany({
    where: {
      firewallOid: firewall.oid,
      networkPolicyOid: { notIn: [...policyOids.values()] }
    }
  });

  for (let link of source.networkPolicyLinks) {
    let networkPolicyOid = policyOids.get(link.networkPolicy.id)!;

    await subspaceDb.firewallNetworkPolicy.upsert({
      where: {
        firewallOid_networkPolicyOid: { firewallOid: firewall.oid, networkPolicyOid }
      },
      update: { position: link.position },
      create: {
        ...getId('firewallNetworkPolicy'),
        id: link.id,
        firewallOid: firewall.oid,
        networkPolicyOid,
        position: link.position
      }
    });
  }

  await db.firewall.updateMany({
    where: { oid: source.oid, revision: source.revision },
    data: { needsSubspaceSync: false, subspaceSyncedRevision: source.revision }
  });

  await Fabric.fire('networking.firewall.mirrored:after', { firewallId: source.id });

  return true;
};
