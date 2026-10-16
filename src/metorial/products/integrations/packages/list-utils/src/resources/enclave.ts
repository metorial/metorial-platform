import { db } from '@metorial-subspace/db';
import { createResolver } from '../resolver';

export let resolveInternetGateways = createResolver(async ({ ts, ids }) =>
  db.integrationInternetGateway.findMany({
    where: {
      tenantOid: ts.tenantOid,
      environmentOid: ts.environmentOid,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveEnclaveEnvironments = createResolver(async ({ ts, ids }) =>
  db.integrationEnclaveEnvironment.findMany({
    where: {
      tenantOid: ts.tenantOid,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveEnclaves = createResolver(async ({ ts, ids }) =>
  db.integrationEnclave.findMany({
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
