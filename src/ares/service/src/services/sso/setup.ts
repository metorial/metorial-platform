import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { SsoConnection, SsoTenant } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId, ID } from '../../id';
import { ssoConnectionService } from './connection';

class SsoSetupServiceImpl {
  async createSetup(d: { tenant: SsoTenant; input: { redirectUri: string } }) {
    return await db.ssoConnectionSetup.create({
      data: {
        ...getId('ssoConnectionSetup'),
        tenantOid: d.tenant.oid,
        clientSecret: await ID.generateId('ssoConnectionSetup_clientSecret'),
        redirectUri: d.input.redirectUri
      }
    });
  }

  async getSetupByClientSecret(d: { clientSecret: string }) {
    let setup = await db.ssoConnectionSetup.findUnique({
      where: { clientSecret: d.clientSecret },
      include: { tenant: true, connection: true }
    });
    if (!setup) throw new ServiceError(notFoundError('sso.setup'));
    return setup;
  }

  async createConnectionForSetup(d: {
    clientSecret: string;
    providerId: string;
    name: string;
    samlMetadata?: { type: 'xml'; payload: string } | { type: 'url'; url: string };
    oidcDiscoveryUrl?: string;
    oidcClientId?: string;
    oidcClientSecret?: string;
  }) {
    let setup = await this.getSetupByClientSecret({ clientSecret: d.clientSecret });

    if (setup.status === 'completed') {
      throw new ServiceError(badRequestError({ message: 'Setup already completed' }));
    }

    let connection: SsoConnection;

    if (d.samlMetadata) {
      connection = await ssoConnectionService.createSamlConnection({
        tenant: setup.tenant,
        input: {
          name: d.name,
          provider: d.providerId,
          metadata: {},
          samlMetadata: d.samlMetadata
        }
      });
    } else if (d.oidcDiscoveryUrl && d.oidcClientId && d.oidcClientSecret) {
      connection = await ssoConnectionService.createOidcConnection({
        tenant: setup.tenant,
        input: {
          name: d.name,
          provider: d.providerId,
          metadata: {},
          oidcDiscoveryUrl: d.oidcDiscoveryUrl,
          clientId: d.oidcClientId,
          clientSecret: d.oidcClientSecret
        }
      });
    } else {
      throw new ServiceError(badRequestError({ message: 'Invalid connection configuration' }));
    }

    await db.ssoConnectionSetup.update({
      where: { oid: setup.oid },
      data: { connectionOid: connection.oid, status: 'completed' }
    });

    return { setup, tenant: setup.tenant, connection };
  }
}

export let ssoSetupService = Service.create(
  'SsoSetupService',
  () => new SsoSetupServiceImpl()
).build();
