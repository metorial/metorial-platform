import type { Provider, ProviderType, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';

export let getLegacySlug = (providerType: ProviderType, provider: Provider, tenant: Tenant) =>
  `${tenant.urlKey}-${provider.tag}-${providerType.shortKey}`;

export let getOAuthCallbackUrl = async (
  providerType: ProviderType,
  provider: Provider,
  tenant: Tenant
) => {
  let storedUrl = await db.tenantOAuthCallbackUrl.findUnique({
    where: {
      tenantOid_providerOid: {
        tenantOid: tenant.oid,
        providerOid: provider.oid
      }
    }
  });

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
