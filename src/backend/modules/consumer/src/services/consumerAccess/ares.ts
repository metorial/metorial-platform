import { notFoundError, preconditionFailedError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import { getConsumerAresInternalClient } from '@metorial/consumer-auth';

type ConsumerAresInternalClient = ReturnType<typeof getConsumerAresInternalClient>;

type PaginationInput = {
  limit?: number;
  after?: string;
  before?: string;
  cursor?: string;
  order?: 'asc' | 'desc';
};

type ConsumerAresRawListResponse<T> = {
  items: T[];
  pagination: {
    has_more_after: boolean;
    has_more_before: boolean;
  };
};

type ConsumerAresListResponse<T> = {
  items: T[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type ConsumerAresRawSsoTenantList = Awaited<
  ReturnType<ConsumerAresInternalClient['sso']['listTenants']>
>;
export type ConsumerAresApp = Awaited<ReturnType<ConsumerAresInternalClient['app']['get']>>;
export type ConsumerAresSsoTenant = Awaited<
  ReturnType<ConsumerAresInternalClient['sso']['getTenant']>
>;
export type ConsumerAresSsoTenantList = ConsumerAresListResponse<
  ConsumerAresRawSsoTenantList['items'][number]
>;
type ConsumerAresRawSsoConnectionList = Awaited<
  ReturnType<ConsumerAresInternalClient['sso']['listConnections']>
>;
export type ConsumerAresSsoConnectionList = ConsumerAresListResponse<
  ConsumerAresRawSsoConnectionList['items'][number]
>;
export type ConsumerAresSsoConnection = ConsumerAresRawSsoConnectionList['items'][number];
export type ConsumerAresSsoTenantSetup = Awaited<
  ReturnType<ConsumerAresInternalClient['sso']['createSetup']>
>;

class ConsumerAresServiceImpl {
  private normalizePagination<T>(
    list: ConsumerAresRawListResponse<T>
  ): ConsumerAresListResponse<T> {
    return {
      items: list.items,
      pagination: {
        hasNextPage: list.pagination.has_more_after,
        hasPreviousPage: list.pagination.has_more_before
      }
    };
  }

  private getClient() {
    let ares = getConsumerAresInternalClient();
    if (!ares) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Ares integration is not configured'
        })
      );
    }

    return ares;
  }

  async upsertApp(d: {
    slug: string;
    defaultRedirectUrl: string;
    redirectDomains?: string[];
  }) {
    return await this.getClient().app.upsert({
      slug: d.slug,
      defaultRedirectUrl: d.defaultRedirectUrl,
      redirectDomains: d.redirectDomains,
      isSessionless: true,
      disableEmailAuth: false
    });
  }

  async updateApp(d: { id: string; slug?: string; redirectDomains?: string[] }) {
    return await this.getClient().app.update({
      id: d.id,
      slug: d.slug,
      redirectDomains: d.redirectDomains
    });
  }

  async getApp(d: { appId: string }) {
    return await this.getClient().app.get({
      id: d.appId
    });
  }

  async listSsoTenants(d: { appId: string } & PaginationInput) {
    let client = this.getClient();
    let res = await client.sso.listTenants({
      appId: d.appId,
      limit: d.limit,
      after: d.after,
      before: d.before,
      cursor: d.cursor,
      order: d.order
    });

    let connections = res.items
      .filter(i => i.status == 'completed')
      .reduce((c, i) => c + i.counts.connections, 0);

    if (connections > 0) {
      await client.app.update({
        id: d.appId,
        isSessionless: true,
        disableEmailAuth: true
      });
    } else {
      await client.app.update({
        id: d.appId,
        isSessionless: true,
        disableEmailAuth: false
      });
    }

    return this.normalizePagination(res);
  }

  async getSsoTenant(d: { ssoTenantId: string }) {
    return await this.getClient().sso.getTenant({
      id: d.ssoTenantId
    });
  }

  async getSsoTenantForApp(d: { appId: string; ssoTenantId: string }) {
    let after: string | undefined = undefined;

    while (true) {
      let tenants = await this.listSsoTenants({
        appId: d.appId,
        limit: 100,
        after,
        order: 'asc'
      });
      let tenant = tenants.items.find(item => item.id == d.ssoTenantId);
      if (tenant) {
        return tenant;
      }

      let lastTenant = tenants.items[tenants.items.length - 1];
      if (!tenants.pagination.hasNextPage || !lastTenant) {
        break;
      }

      after = lastTenant.id;
    }

    throw new ServiceError(notFoundError('portal.auth.sso_tenant'));
  }

  async createSsoTenant(d: { appId: string; name: string }) {
    return await this.getClient().sso.createTenant({
      appId: d.appId,
      name: d.name
    });
  }

  async createSsoTenantSetup(d: { ssoTenantId: string; redirectUrl: string }) {
    return await this.getClient().sso.createSetup({
      tenantId: d.ssoTenantId,
      redirectUri: d.redirectUrl
    });
  }

  async listSsoConnections(d: { ssoTenantId: string } & PaginationInput) {
    return this.normalizePagination(
      await this.getClient().sso.listConnections({
        tenantId: d.ssoTenantId,
        limit: d.limit,
        after: d.after,
        before: d.before,
        cursor: d.cursor,
        order: d.order
      })
    );
  }

  async exchangeOAuthCode(d: { clientId: string; code: string }) {
    return await this.getClient().oauth.exchange({
      clientId: d.clientId,
      authorizationCode: d.code
    });
  }

  async logoutSession(d: { sessionId: string }) {
    return await this.getClient().session.logout({
      sessionId: d.sessionId
    });
  }
}

export let consumerAresService = Service.create(
  'consumerAresService',
  () => new ConsumerAresServiceImpl()
).build();
