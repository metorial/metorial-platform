import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '@mtsrc/mcp-runtime-db';
import { ID, snowflake } from '@mtsrc/mcp-runtime-db';
import { integrationsOAuthCallbackUrl, oauthCallbackUrl } from '@mtsrc/mcp-runtime-env';
import { linkFunctionBayTenant } from '../internal/functionBayTenant';

let include = {};

class tenantServiceImpl {
  async upsertTenant(d: {
    input: {
      name: string;
      identifier: string;
      logRetentionInDays?: number;
      storeContent?: boolean;
      collectErrors?: boolean;
    };
  }) {
    let tenant = await db.tenant.upsert({
      where: { identifier: d.input.identifier },
      update: {
        name: d.input.name,
        logRetentionInDays: d.input.logRetentionInDays,
        storeContent: d.input.storeContent,
        collectErrors: d.input.collectErrors
      },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('tenant'),
        name: d.input.name,
        identifier: d.input.identifier,
        logRetentionInDays: d.input.logRetentionInDays,
        storeContent: d.input.storeContent ?? true,
        collectErrors: d.input.collectErrors ?? true
      }
    });

    return await linkFunctionBayTenant(tenant);
  }

  async getOAuthCallbackSettings(d: { identifier: string }) {
    let tenant = await db.tenant.findUnique({
      where: { identifier: d.identifier },
      select: { dynamicOAuthCallbackUrlOverride: true }
    });

    return {
      dynamicOAuthCallbackUrlOverride: tenant?.dynamicOAuthCallbackUrlOverride ?? null,
      defaultUrl: integrationsOAuthCallbackUrl ?? oauthCallbackUrl
    };
  }

  async updateOAuthCallbackSettings(d: {
    tenant: Tenant;
    callbackUrlOverride: string | null;
  }) {
    if (d.callbackUrlOverride != null) {
      let url = URL.parse(d.callbackUrlOverride);

      if (
        url?.protocol !== 'https:' ||
        !/^https:\/\/[^/@?#\\\s]+(?:\/[^?#\\\s]*)?$/i.test(d.callbackUrlOverride) ||
        url.username ||
        url.password
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'Enter an HTTPS callback URL without credentials, a query, or a fragment'
          })
        );
      }
    }

    await db.tenant.update({
      where: { oid: d.tenant.oid },
      data: { dynamicOAuthCallbackUrlOverride: d.callbackUrlOverride }
    });

    return { dynamicOAuthCallbackUrlOverride: d.callbackUrlOverride };
  }

  async getTenantById(d: { id: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] }
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant'));
    return tenant;
  }
}

export let tenantService = Service.create(
  'tenantService',
  () => new tenantServiceImpl()
).build();
