import { badRequestError, conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Prisma,
  SsoConnection,
  SsoConnectionStatus,
  SsoTenant
} from '@mtsrc/auth-core-db';
import { db } from '@mtsrc/auth-core-db';
import { getId } from '@mtsrc/auth-core-db';
import { jackson } from '../../lib/jackson';
import {
  assertSsoUrlReachable,
  fetchSsoMetadata,
  ssoAllowsPrivateNetworks
} from '../../lib/ssoFetch';
import { getSamlConnectionDefaultRedirectUrl } from '@mtsrc/auth-core-sso-protocol';
import { enqueueDisableSsoDirectoryUsers } from '../../queues/disableSsoDirectoryUsers';

let ssoConnectionInclude = {
  tenant: true,
  directories: true,
  groups: { include: { rootGroup: true } },
  roles: { include: { rootRole: true } }
} satisfies Prisma.SsoConnectionInclude;

class SsoConnectionServiceImpl {
  async createSamlConnection(d: {
    tenant: SsoTenant;
    input: {
      name: string;
      metadata?: Record<string, any>;
      provider: string;
      samlMetadata: { type: 'xml'; payload: string } | { type: 'url'; url: string };
    };
  }) {
    if (d.tenant.importedDelegationOid) {
      throw new ServiceError(
        conflictError({ message: 'Imported SSO connections are read-only' })
      );
    }
    let connectionId = getId('ssoConnection');

    let con;
    try {
      let rawMetadata =
        d.input.samlMetadata.type === 'xml'
          ? d.input.samlMetadata.payload
          : await fetchSsoMetadata(d.input.samlMetadata.url);

      con = await jackson.apiController.createSAMLConnection({
        product: 'metorial',
        tenant: d.tenant.id,
        name: d.input.name,
        redirectUrl: jackson.redirectUrl,
        defaultRedirectUrl: getSamlConnectionDefaultRedirectUrl({
          callbackUrl: jackson.defaultRedirectUrl.saml,
          tenantId: d.tenant.id,
          connectionId: connectionId.id
        }),
        rawMetadata
      });
    } catch (error) {
      throw new ServiceError(
        badRequestError({
          message: `Could not create SAML connection: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        })
      );
    }

    if (d.tenant.status == 'pending') {
      await db.ssoTenant.update({
        where: { oid: d.tenant.oid },
        data: { status: 'completed' }
      });
    }

    return await db.ssoConnection.create({
      data: {
        ...connectionId,
        tenantOid: d.tenant.oid,
        internalId: con.clientID,
        internalClientId: con.clientID,
        internalClientSecret: con.clientSecret,
        providerType: 'saml',
        providerName: d.input.provider,
        name: d.input.name,
        metadata: d.input.metadata ?? undefined
      },
      include: ssoConnectionInclude
    });
  }

  async createOidcConnection(d: {
    tenant: SsoTenant;
    input: {
      name: string;
      metadata?: Record<string, any>;
      provider: string;
      oidcDiscoveryUrl: string;
      clientId: string;
      clientSecret: string;
    };
  }) {
    if (d.tenant.importedDelegationOid) {
      throw new ServiceError(
        conflictError({ message: 'Imported SSO connections are read-only' })
      );
    }
    let internalId = generatePlainId(20);

    let con;
    try {
      await assertSsoUrlReachable(d.input.oidcDiscoveryUrl);

      con = await jackson.apiController.createOIDCConnection({
        product: 'metorial',
        tenant: internalId,
        name: d.input.name,
        oidcMetadata: undefined,
        oidcDiscoveryUrl: d.input.oidcDiscoveryUrl,
        oidcClientId: d.input.clientId,
        oidcClientSecret: d.input.clientSecret,
        redirectUrl: jackson.redirectUrl,
        defaultRedirectUrl: jackson.defaultRedirectUrl.oidc
      });
    } catch (error) {
      throw new ServiceError(
        badRequestError({
          message: `Could not create OIDC connection: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        })
      );
    }

    if (d.tenant.status == 'pending') {
      await db.ssoTenant.update({
        where: { oid: d.tenant.oid },
        data: { status: 'completed' }
      });
    }

    return await db.ssoConnection.create({
      data: {
        ...getId('ssoConnection'),
        tenantOid: d.tenant.oid,
        internalId,
        internalClientId: con.clientID,
        internalClientSecret: con.clientSecret,
        providerType: 'oidc',
        providerName: d.input.provider,
        name: d.input.name,
        metadata: d.input.metadata ?? undefined
      },
      include: ssoConnectionInclude
    });
  }

  async createConnection(d: {
    tenant: SsoTenant;
    input:
      | {
          providerType: 'saml';
          name: string;
          metadata?: Record<string, any>;
          providerName?: string;
          samlMetadata: { type: 'xml'; payload: string } | { type: 'url'; url: string };
        }
      | {
          providerType: 'oidc';
          name: string;
          metadata?: Record<string, any>;
          providerName?: string;
          oidcDiscoveryUrl: string;
          clientId: string;
          clientSecret: string;
        };
  }) {
    if (d.tenant.importedDelegationOid) {
      throw new ServiceError(
        conflictError({ message: 'Imported SSO connections are read-only' })
      );
    }

    if (d.input.providerType === 'saml') {
      return await this.createSamlConnection({
        tenant: d.tenant,
        input: {
          name: d.input.name,
          metadata: d.input.metadata,
          provider: d.input.providerName ?? d.input.providerType,
          samlMetadata: d.input.samlMetadata
        }
      });
    }

    return await this.createOidcConnection({
      tenant: d.tenant,
      input: {
        name: d.input.name,
        metadata: d.input.metadata,
        provider: d.input.providerName ?? d.input.providerType,
        oidcDiscoveryUrl: d.input.oidcDiscoveryUrl,
        clientId: d.input.clientId,
        clientSecret: d.input.clientSecret
      }
    });
  }

  async listConnections(d: {
    tenant: SsoTenant;
    filters?: {
      userIds?: string[];
      userProfileIds?: string[];
      connectionIds?: string[];
      groupIds?: string[];
      roleIds?: string[];
      directoryIds?: string[];
      externalIds?: string[];
      statuses?: string[];
    };
  }) {
    let where: Prisma.SsoConnectionWhereInput = {
      tenantOid: d.tenant.oid,
      id: d.filters?.connectionIds?.length ? { in: d.filters.connectionIds } : undefined,
      status: d.filters?.statuses?.length
        ? { in: d.filters.statuses as SsoConnectionStatus[] }
        : undefined,
      userProfiles:
        d.filters?.userIds?.length || d.filters?.userProfileIds?.length
          ? {
              some: {
                user: d.filters?.userIds?.length
                  ? { id: { in: d.filters.userIds } }
                  : undefined,
                id: d.filters?.userProfileIds?.length
                  ? { in: d.filters.userProfileIds }
                  : undefined
              }
            }
          : undefined,
      AND: [
        d.filters?.directoryIds?.length
          ? { directories: { some: { id: { in: d.filters.directoryIds } } } }
          : undefined,
        d.filters?.externalIds?.length
          ? {
              directories: {
                some: {
                  userProfiles: {
                    some: {
                      externalId: { in: d.filters.externalIds }
                    }
                  }
                }
              }
            }
          : undefined,
        d.filters?.groupIds?.length
          ? {
              OR: [
                { groups: { some: { id: { in: d.filters.groupIds } } } },
                { groups: { some: { rootGroup: { id: { in: d.filters.groupIds } } } } }
              ]
            }
          : undefined,
        d.filters?.roleIds?.length
          ? {
              OR: [
                { roles: { some: { id: { in: d.filters.roleIds } } } },
                { roles: { some: { rootRole: { id: { in: d.filters.roleIds } } } } }
              ]
            }
          : undefined
      ].filter(Boolean) as Prisma.SsoConnectionWhereInput[]
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoConnection.findMany({
            ...opts,
            where,
            include: ssoConnectionInclude
          })
      )
    );
  }

  async assertIdentityProviderReachable(d: {
    connection: Pick<SsoConnection, 'providerType' | 'internalClientId'>;
  }) {
    if (ssoAllowsPrivateNetworks) return;
    if (d.connection.providerType !== 'oidc' || !d.connection.internalClientId) return;

    let records = await jackson.apiController.getConnections({
      clientID: d.connection.internalClientId
    });

    for (let record of records) {
      if (!('oidcProvider' in record)) continue;

      let { discoveryUrl, metadata } = record.oidcProvider;
      let urls = [
        discoveryUrl,
        metadata?.token_endpoint,
        metadata?.userinfo_endpoint,
        metadata?.jwks_uri
      ].filter((url): url is string => typeof url == 'string' && !!url);

      for (let url of urls) await assertSsoUrlReachable(url);
    }
  }

  async getConnectionsByTenant(d: { tenant: SsoTenant }) {
    return await db.ssoConnection.findMany({
      where: { tenantOid: d.tenant.oid, status: 'active' }
    });
  }

  async getConnectionById(d: { connectionId: string; tenant: SsoTenant }) {
    let con = await db.ssoConnection.findFirst({
      where: { id: d.connectionId, tenantOid: d.tenant.oid },
      include: ssoConnectionInclude
    });
    if (!con) throw new ServiceError(notFoundError('sso.connection'));
    return con;
  }

  async updateConnection(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    input: {
      name?: string;
      providerName?: string | null;
      metadata?: Record<string, any>;
      status?: SsoConnectionStatus;
    };
  }) {
    if (d.connection.importedDelegationOid) {
      throw new ServiceError(
        conflictError({ message: 'Imported SSO connections are read-only' })
      );
    }

    if (d.connection.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('sso.connection'));
    }

    if (d.input.status && d.input.status !== d.connection.status) {
      return await this.setConnectionStatus({
        tenant: d.tenant,
        connection: d.connection,
        status: d.input.status
      });
    }

    return await db.ssoConnection.update({
      where: { oid: d.connection.oid },
      data: {
        name: d.input.name,
        providerName:
          d.input.providerName !== undefined ? (d.input.providerName ?? null) : undefined,
        metadata: d.input.metadata
      },
      include: ssoConnectionInclude
    });
  }

  async setConnectionStatus(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    status: SsoConnectionStatus;
  }) {
    if (d.connection.importedDelegationOid) {
      throw new ServiceError(
        conflictError({ message: 'Imported SSO connections are read-only' })
      );
    }

    if (d.connection.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('sso.connection'));
    }

    if (d.status === 'disabled') {
      let directories = await db.ssoDirectory.findMany({
        where: {
          connectionOid: d.connection.oid,
          status: { not: 'disabled' }
        },
        select: { id: true }
      });

      await db.ssoUserProfile.updateMany({
        where: { connectionOid: d.connection.oid },
        data: { status: 'deprovisioned' }
      });

      await db.ssoDirectory.updateMany({
        where: { connectionOid: d.connection.oid },
        data: { status: 'disabled' }
      });

      await Promise.all(
        directories.map(directory =>
          enqueueDisableSsoDirectoryUsers({
            directoryId: directory.id
          })
        )
      );
    }

    return await db.ssoConnection.update({
      where: { oid: d.connection.oid },
      data: { status: d.status },
      include: ssoConnectionInclude
    });
  }

  async deleteConnection(d: { tenant: SsoTenant; connection: SsoConnection }) {
    return await this.setConnectionStatus({
      tenant: d.tenant,
      connection: d.connection,
      status: 'disabled'
    });
  }
}

export let ssoConnectionService = Service.create(
  'SsoConnectionService',
  () => new SsoConnectionServiceImpl()
).build();
