import type {
  Provider,
  ProviderType,
  Tenant,
  TenantOAuthCallbackUrl
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';

type StoredUrlBatch = {
  providerOids: Set<bigint>;
  result: Promise<Map<bigint, TenantOAuthCallbackUrl>>;
};

let pendingStoredUrlBatches = new Map<bigint, StoredUrlBatch>();

// List presenters resolve callback URLs for every item concurrently, so lookups issued in the
// same tick are coalesced into one query per tenant instead of one query per provider.
let findStoredUrl = async (tenantOid: bigint, providerOid: bigint) => {
  let batch = pendingStoredUrlBatches.get(tenantOid);

  if (!batch) {
    let providerOids = new Set<bigint>();

    let result = new Promise<void>(resolve => setImmediate(resolve)).then(async () => {
      pendingStoredUrlBatches.delete(tenantOid);

      let storedUrls = await db.tenantOAuthCallbackUrl.findMany({
        where: { tenantOid, providerOid: { in: [...providerOids] } }
      });

      return new Map(storedUrls.map(storedUrl => [storedUrl.providerOid, storedUrl]));
    });

    batch = { providerOids, result };
    pendingStoredUrlBatches.set(tenantOid, batch);
  }

  batch.providerOids.add(providerOid);

  let storedUrls = await batch.result;
  return storedUrls.get(providerOid) ?? null;
};

export let getLegacySlug = (providerType: ProviderType, provider: Provider, tenant: Tenant) =>
  `${tenant.urlKey}-${provider.tag}-${providerType.shortKey}`;

export let getOAuthCallbackUrl = async (
  providerType: ProviderType,
  provider: Provider,
  tenant: Tenant
) => {
  let storedUrl = await findStoredUrl(tenant.oid, provider.oid);

  if (!storedUrl) {
    let slug = getLegacySlug(providerType, provider, tenant);

    try {
      storedUrl = await db.tenantOAuthCallbackUrl.upsert({
        where: {
          tenantOid_providerOid: {
            tenantOid: tenant.oid,
            providerOid: provider.oid
          }
        },
        create: {
          ...getId('tenantOAuthCallbackUrl'),
          tenantOid: tenant.oid,
          projectOid: tenant.projectOid,
          providerOid: provider.oid,
          providerTypeOid: providerType.oid,
          slug
        },
        update: {
          providerTypeOid: providerType.oid,
          slug
        }
      });
    } catch (e) {
      try {
        storedUrl = await db.tenantOAuthCallbackUrl.findUniqueOrThrow({
          where: {
            tenantOid_providerOid: {
              tenantOid: tenant.oid,
              providerOid: provider.oid
            }
          }
        });
      } catch {
        throw e;
      }
    }
  }

  if (providerType.oid !== storedUrl.providerTypeOid) {
    storedUrl = await db.tenantOAuthCallbackUrl.update({
      where: { oid: storedUrl.oid },
      data: { providerTypeOid: providerType.oid }
    });
  }

  let slug = storedUrl.slug;
  return `${env.service.INTEGRATIONS_API_URL}/oauth-callback/${slug}`;
};

export let parseTenantOAuthCallbackSlug = async (slug: string) => {
  let record = await db.tenantOAuthCallbackUrl.findUnique({
    where: { slug },
    include: {
      tenant: true,
      provider: true,
      providerType: true
    }
  });

  if (record) {
    return {
      tenant: record.tenant,
      provider: record.provider,
      providerType: record.providerType
    };
  }

  let [tenantUrlKey, providerTag, providerTypeShortKey] = slug.split('-');
  if (!tenantUrlKey || !providerTag || !providerTypeShortKey) return null;

  let providerType = await db.providerType.findFirst({
    where: { shortKey: providerTypeShortKey }
  });
  if (!providerType) return null;

  let provider = await db.provider.findFirst({
    where: { tag: providerTag, typeOid: providerType.oid }
  });
  if (!provider) return null;

  let tenant = await db.tenant.findFirst({
    where: { urlKey: tenantUrlKey }
  });
  if (!tenant) return null;

  return { tenant, provider, providerType };
};
