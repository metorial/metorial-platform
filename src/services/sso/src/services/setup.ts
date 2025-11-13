import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Connection, ConnectionSetup, Tenant } from '../db/schema';
import { ID } from '../id';
import { connectionService } from './connection';

class setupServiceImpl {
  async createSetup(d: {
    tenant: Tenant;
    input: {
      redirectUri: string;
    };
  }) {
    return await ConnectionSetup.create({
      tenantId: d.tenant._id,
      status: 'pending',
      redirectUri: d.input.redirectUri,
      clientSecret: await ID.generateId('setup_clientSecret')
    });
  }

  async getSetupByClientSecret(d: { clientSecret: string }) {
    let setup = await ConnectionSetup.findOne({ clientSecret: d.clientSecret });
    if (!setup) throw new ServiceError(notFoundError('sso.setup'));

    let tenant = (await Tenant.findById(setup.tenantId))!;
    let connection = setup.connectionId
      ? (await Connection.findById(setup.connectionId))!
      : undefined;

    return { setup, tenant, connection };
  }

  async createConnectionForSetup(d: {
    clientSecret: string;
    providerId: string;
    name: string;
    samlMetadata?:
      | {
          type: 'xml';
          payload: string;
        }
      | {
          type: 'url';
          url: string;
        };
    oidcDiscoveryUrl?: string;
    oidcClientId?: string;
    oidcClientSecret?: string;
  }) {
    let { setup, tenant } = await this.getSetupByClientSecret({
      clientSecret: d.clientSecret
    });

    if (setup.status === 'completed') {
      throw new ServiceError(
        badRequestError({
          message: 'Setup already completed'
        })
      );
    }

    let connection: Connection;

    if (d.samlMetadata) {
      connection = await connectionService.createSamlConnection({
        tenant,
        input: {
          name: d.name,
          provider: d.providerId,
          metadata: {},
          samlMetadata: d.samlMetadata
        }
      });
    } else if (d.oidcDiscoveryUrl && d.oidcClientId && d.oidcClientSecret) {
      connection = await connectionService.createOidcConnection({
        tenant,
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
      throw new ServiceError(
        badRequestError({
          message: 'Invalid connection configuration'
        })
      );
    }

    await ConnectionSetup.updateOne(
      { _id: setup._id },
      {
        connectionId: connection._id,
        status: 'completed',
        updatedAt: new Date()
      }
    );

    return { setup, tenant, connection };
  }
}

export let setupService = Service.create('setup', () => new setupServiceImpl()).build();
