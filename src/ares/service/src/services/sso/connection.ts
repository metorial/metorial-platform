import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  SsoConnection,
  SsoConnectionStatus,
  SsoTenant
} from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { jackson } from '../../lib/jackson';

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
    let con = await jackson.apiController.createSAMLConnection({
      product: 'metorial',
      tenant: d.tenant.id,
      name: d.input.name,
      redirectUrl: jackson.redirectUrl,
      defaultRedirectUrl: jackson.defaultRedirectUrl.saml,
      rawMetadata:
        d.input.samlMetadata.type === 'xml' ? d.input.samlMetadata.payload : undefined!,
      metadataUrl: d.input.samlMetadata.type === 'url' ? d.input.samlMetadata.url : undefined
    });

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
        internalId: con.clientID,
        internalClientId: con.clientID,
        internalClientSecret: con.clientSecret,
        providerType: 'saml',
        providerName: d.input.provider,
        name: d.input.name,
        metadata: d.input.metadata ?? undefined
      }
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
    let internalId = generatePlainId(20);

    let con = await jackson.apiController.createOIDCConnection({
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
      }
    });
  }

  async listConnections(d: { tenant: SsoTenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoConnection.findMany({
            ...opts,
            where: { tenantOid: d.tenant.oid }
          })
      )
    );
  }

  async getConnectionsByTenant(d: { tenant: SsoTenant }) {
    return await db.ssoConnection.findMany({
      where: { tenantOid: d.tenant.oid, status: 'active' }
    });
  }

  async getConnectionById(d: { connectionId: string; tenant: SsoTenant }) {
    let con = await db.ssoConnection.findFirst({
      where: { id: d.connectionId, tenantOid: d.tenant.oid }
    });
    if (!con) throw new ServiceError(notFoundError('sso.connection'));
    return con;
  }

  async setConnectionStatus(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    status: SsoConnectionStatus;
  }) {
    if (d.connection.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('sso.connection'));
    }

    if (d.status === 'disabled') {
      await db.ssoUserProfile.updateMany({
        where: { connectionOid: d.connection.oid },
        data: { status: 'deprovisioned' }
      });

      await db.ssoDirectory.updateMany({
        where: { connectionOid: d.connection.oid },
        data: { status: 'disabled' }
      });
    }

    return await db.ssoConnection.update({
      where: { oid: d.connection.oid },
      data: { status: d.status }
    });
  }
}

export let ssoConnectionService = Service.create(
  'SsoConnectionService',
  () => new SsoConnectionServiceImpl()
).build();
