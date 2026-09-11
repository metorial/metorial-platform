import { db } from '@metorial-subspace/db';
import { createResolver } from '../resolver';

export let resolveNetworks = createResolver(async ({ ts, ids }) =>
  db.network.findMany({
    where: {
      tenantOid: ts.tenantOid,
      environmentOid: ts.environmentOid,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveEnclaveEnvironments = createResolver(async ({ ts, ids }) =>
  db.enclaveEnvironment.findMany({
    where: {
      tenantOid: ts.tenantOid,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveEnclaves = createResolver(async ({ ts, ids }) =>
  db.enclave.findMany({
    where: {
      tenantOid: ts.tenantOid,
      environmentOid: ts.environmentOid,
      OR: [{ id: { in: ids } }, { slug: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveFirewalls = createResolver(async ({ ts, ids }) =>
  db.firewall.findMany({
    where: {
      tenantOid: ts.tenantOid,
      environmentOid: ts.environmentOid,
      OR: [{ id: { in: ids } }, { slug: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveNetworkPolicies = createResolver(async ({ ts, ids }) =>
  db.networkPolicy.findMany({
    where: {
      tenantOid: ts.tenantOid,
      environmentOid: ts.environmentOid,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);
