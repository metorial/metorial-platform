import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Server, ServerOAuthCredentials, Tenant } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { validateWithJsonSchema } from '../../lib/jsonSchema/validateData';
import { delegatedOauthAuthorizationService } from './delegated';
import { remoteOauthAuthorizationService } from './remote';
import { serverEventService } from './serverEvent';
import { serverOAuthCredentialsService } from './serverOAuthCredentials';

let include = {
  server: true,
  tenant: true,
  credentials: {
    include: {
      remoteConnection: {
        include: { config: true, registration: true }
      },
      delegatedConnection: {
        include: { config: true, functionServer: true }
      }
    }
  },
  authConfig: {
    include: {
      remoteOAuthConnectionAuthToken: {
        include: { connectionProfile: true }
      },
      delegatedOAuthConnectionAuthToken: true
    }
  },
  events: {
    orderBy: {
      createdAt: 'asc' as const
    }
  }
};

class serverOAuthSetupServiceImpl {
  async createServerOAuthSetup(d: {
    tenant: Tenant;

    input: {
      server: Server;
      credentials?: ServerOAuthCredentials;
      redirectUrl: string;
      authConfig?: Record<string, unknown>;
      callbackUrlOverride?: string;
    };
  }) {
    if (d.input.credentials && d.input.credentials.serverOid !== d.input.server.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Mismatched server OAuth credentials'
        })
      );
    }

    if (d.input.server.type == 'remote' && !d.input.credentials) {
      try {
        d.input.credentials =
          await serverOAuthCredentialsService.ensureDefaultServerOAuthCredentials({
            tenant: d.tenant,
            server: d.input.server
          });
      } catch (err) {
        throw new ServiceError(
          badRequestError({
            message:
              'Automatic credentials creation not supported for this provider. Please create credentials manually.'
          })
        );
      }
    }

    if (!d.input.credentials) {
      throw new ServiceError(
        badRequestError({
          message: 'Auth credentials are required for this provider'
        })
      );
    }

    let authSetupCreateParams = {
      ...getId('serverOAuthSetup'),
      status: 'pending' as const,
      redirectUri: d.input.redirectUrl,
      callbackUrlOverride: d.input.callbackUrlOverride || null,
      tenantOid: d.tenant.oid,
      serverOid: d.input.server.oid,
      credentialsOid: d.input.credentials.oid
    };

    if (d.input.server.type == 'remote') {
      let setup = await db.serverOAuthSetup.create({
        data: {
          ...authSetupCreateParams,
          type: 'remote',
          authConfigValue: {}
        },
        include
      });

      await serverEventService.recordServerOAuthSetupEvent({
        serverOAuthSetup: setup,
        type: 'oauth_setup_created',
        payload: {
          type: 'remote'
        }
      });

      return setup;
    }

    if (d.input.server.type == 'function') {
      if (!d.input.server.delegatedOauthConfigOid) {
        throw new Error('Server does not have delegated OAuth configuration');
      }

      let delegatedConfig = await db.delegatedOAuthConfig.findFirstOrThrow({
        where: { oid: d.input.server.delegatedOauthConfigOid }
      });

      let authConfig = d.input.authConfig || {};
      if (delegatedConfig.authConfigSchema) {
        authConfig = validateWithJsonSchema({
          schema: delegatedConfig.authConfigSchema,
          data: authConfig,
          entity: 'auth_config',
          message: 'Invalid auth config for OAuth setup'
        });
      } else {
        authConfig = {};
      }

      let setup = await db.serverOAuthSetup.create({
        data: {
          ...authSetupCreateParams,
          type: 'delegated',
          authConfigValue: authConfig
        },
        include
      });

      await serverEventService.recordServerOAuthSetupEvent({
        serverOAuthSetup: setup,
        type: 'oauth_setup_created',
        payload: {
          type: 'delegated'
        }
      });

      return setup;
    }

    throw new ServiceError(
      badRequestError({
        message: 'Provider does not support OAuth'
      })
    );
  }

  async consumeServerOAuthSetup(d: { serverOAuthSetupId: string }) {
    let setup = await db.serverOAuthSetup.findFirst({
      where: { id: d.serverOAuthSetupId },
      include: {
        credentials: {
          include: {
            remoteConnection: { include: { config: true } },
            delegatedConnection: { include: { config: true } }
          }
        }
      }
    });
    if (!setup) throw new ServiceError(notFoundError('server_oauth_setup'));

    if (setup.type == 'remote') {
      if (!setup.credentials.remoteConnection) {
        throw new ServiceError(badRequestError({ message: 'OAuth setup not configured' }));
      }
      if (setup.remoteOAuthConnectionSetupOid) {
        throw new ServiceError(badRequestError({ message: 'OAuth setup already consumed' }));
      }

      let inner = await remoteOauthAuthorizationService.startAuthorization({
        connection: setup.credentials.remoteConnection
      });

      await db.serverOAuthSetup.updateMany({
        where: { id: setup.id },
        data: {
          remoteOAuthConnectionSetupOid: inner.setup.oid
        }
      });

      await serverEventService.recordServerOAuthSetupEvent({
        serverOAuthSetup: setup,
        type: 'oauth_setup_authorization_started',
        message: 'Started OAuth authorization',
        payload: {
          state: inner.setup.stateIdentifier
        }
      });

      return { url: inner.redirectUrl, state: inner.setup.stateIdentifier };
    }

    if (setup.type == 'delegated') {
      if (!setup.credentials.delegatedConnection) {
        throw new ServiceError(badRequestError({ message: 'OAuth setup not configured' }));
      }
      if (setup.delegatedOAuthConnectionSetupOid) {
        throw new ServiceError(badRequestError({ message: 'OAuth setup already consumed' }));
      }

      let inner = await delegatedOauthAuthorizationService.startAuthorization({
        connection: setup.credentials.delegatedConnection,
        authConfig: setup.authConfigValue
      });

      await db.serverOAuthSetup.updateMany({
        where: { id: setup.id },
        data: {
          delegatedOAuthConnectionSetupOid: inner.setup.oid
        }
      });

      await serverEventService.recordServerOAuthSetupEvent({
        serverOAuthSetup: setup,
        type: 'oauth_setup_authorization_started',
        message: 'Started OAuth authorization',
        payload: {
          state: inner.setup.stateIdentifier
        },
        functionInvocationId: inner.functionInvocationId ?? null
      });

      return { url: inner.redirectUrl, state: inner.setup.stateIdentifier };
    }

    throw new ServiceError(badRequestError({ message: 'Provider does not support OAuth' }));
  }

  async getServerOAuthSetupById(d: { tenant: Tenant; serverOAuthSetupId: string }) {
    let serverOAuthSetup = await db.serverOAuthSetup.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.serverOAuthSetupId
      },
      include
    });
    if (!serverOAuthSetup) throw new ServiceError(notFoundError('server_config'));
    return serverOAuthSetup;
  }

  async DANGEROUSLY_getServerOAuthSetupById(d: { serverOAuthSetupId: string }) {
    let serverOAuthSetup = await db.serverOAuthSetup.findFirst({
      where: {
        id: d.serverOAuthSetupId
      },
      include
    });
    if (!serverOAuthSetup) throw new ServiceError(notFoundError('server_config'));
    return serverOAuthSetup;
  }

  async getServerOAuthSetupLogs(d: { serverOAuthSetupId: string; tenant?: Tenant }) {
    let serverOAuthSetup = await db.serverOAuthSetup.findFirst({
      where: {
        id: d.serverOAuthSetupId,
        tenantOid: d.tenant?.oid
      },
      include
    });
    if (!serverOAuthSetup) throw new ServiceError(notFoundError('server_config'));

    return serverOAuthSetup;
  }

  async listServerOAuthSetups(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverOAuthSetup.findMany({
            ...opts,
            where: { tenantOid: d.tenant.oid },
            include
          })
      )
    );
  }

  async listServerOAuthSetupsGlobal(d: {
    serverOAuthSetupIds?: string[];
    serverIds?: string[];
    statuses?: Array<'pending' | 'completed' | 'failed'>;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverOAuthSetup.findMany({
            ...opts,
            where: {
              id: d.serverOAuthSetupIds ? { in: d.serverOAuthSetupIds } : undefined,
              server: d.serverIds ? { id: { in: d.serverIds } } : undefined,
              status: d.statuses?.length ? { in: d.statuses } : undefined
            },
            include
          })
      )
    );
  }
}

export let serverOAuthSetupService = Service.create(
  'serverOAuthSetupService',
  () => new serverOAuthSetupServiceImpl()
).build();
