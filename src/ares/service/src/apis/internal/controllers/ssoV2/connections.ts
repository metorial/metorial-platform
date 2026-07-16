import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { randomUUID } from 'crypto';
import { db } from '../../../../db';
import { env } from '../../../../env';
import { getId } from '../../../../id';
import { ssoAuthService } from '../../../../services/sso/auth';
import { ssoConnectionService } from '../../../../services/sso/connection';
import { ssoGroupRoleService } from '../../../../services/sso/groupRole';
import { ssoIdentityService } from '../../../../services/sso/identity';
import {
  ssoConnectionGroupPresenter,
  ssoConnectionPresenter,
  ssoConnectionRolePresenter,
  ssoUserProfilePresenter
} from '../../presenters';
import { tenantApp } from './_middleware';

export let ssoConnectionsController = tenantApp.controller({
  create: tenantApp
    .handler()
    .input(
      v.union([
        v.object({
          tenantId: v.string(),
          providerType: v.literal('saml'),
          providerName: v.optional(v.string()),
          name: v.string(),
          metadata: v.optional(v.record(v.any())),
          samlMetadata: v.union([
            v.object({ type: v.literal('xml'), payload: v.string() }),
            v.object({ type: v.literal('url'), url: v.string() })
          ])
        }),
        v.object({
          tenantId: v.string(),
          providerType: v.literal('oidc'),
          providerName: v.optional(v.string()),
          name: v.string(),
          metadata: v.optional(v.record(v.any())),
          oidcDiscoveryUrl: v.string(),
          clientId: v.string(),
          clientSecret: v.string()
        })
      ])
    )
    .do(async ({ input, tenant }) => {
      let { tenantId: _, ...connectionInput } = input;
      let connection = await ssoConnectionService.createConnection({
        tenant,
        input: connectionInput
      });
      return ssoConnectionPresenter(connection);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          userIds: v.optional(v.array(v.string())),
          userProfileIds: v.optional(v.array(v.string())),
          connectionIds: v.optional(v.array(v.string())),
          groupIds: v.optional(v.array(v.string())),
          roleIds: v.optional(v.array(v.string())),
          directoryIds: v.optional(v.array(v.string())),
          externalIds: v.optional(v.array(v.string())),
          statuses: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ({ input, tenant }) => {
      let paginator = await ssoConnectionService.listConnections({ tenant, filters: input });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, ssoConnectionPresenter);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        connectionId: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let connection = await ssoConnectionService.getConnectionById({
        tenant,
        connectionId: input.connectionId
      });
      return ssoConnectionPresenter(connection);
    }),

  test: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        connectionId: v.string(),
        redirectUri: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let redirectUri: URL;
      try {
        redirectUri = new URL(input.redirectUri);
      } catch {
        throw new ServiceError(badRequestError({ message: 'Invalid redirect URI.' }));
      }
      if (redirectUri.protocol !== 'http:' && redirectUri.protocol !== 'https:') {
        throw new ServiceError(badRequestError({ message: 'Invalid redirect URI protocol.' }));
      }

      let connection = await ssoConnectionService.getConnectionById({
        tenant,
        connectionId: input.connectionId
      });
      if (connection.status !== 'active') {
        throw new ServiceError(badRequestError({ message: 'SSO connection is disabled.' }));
      }

      let account = tenant.accountOid
        ? await db.account.findUnique({ where: { oid: tenant.accountOid } })
        : null;
      let auth = await ssoAuthService.createAuth({
        tenant,
        account,
        connection,
        input: {
          redirectUri: redirectUri.toString(),
          state: randomUUID(),
          purpose: 'connection_test'
        }
      });
      await db.ssoTest.create({
        data: {
          ...getId('ssoTest'),
          authId: auth.id,
          authOid: auth.oid,
          tenantOid: tenant.oid,
          connectionOid: connection.oid
        }
      });
      let url = new URL('/sso/auth', env.service.ARES_SSO_URL);
      url.searchParams.set('client_secret', auth.clientSecret);
      return { url: url.toString() };
    }),

  update: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        connectionId: v.string(),
        name: v.optional(v.string()),
        providerName: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.record(v.any())),
        status: v.optional(v.enumOf(['active', 'disabled']))
      })
    )
    .do(async ({ input, tenant }) => {
      let connection = await ssoConnectionService.getConnectionById({
        tenant,
        connectionId: input.connectionId
      });
      let updated = await ssoConnectionService.updateConnection({
        tenant,
        connection,
        input: {
          name: input.name,
          providerName: input.providerName,
          metadata: input.metadata,
          status: input.status
        }
      });
      return ssoConnectionPresenter(updated);
    }),

  delete: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        connectionId: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let connection = await ssoConnectionService.getConnectionById({
        tenant,
        connectionId: input.connectionId
      });
      let deleted = await ssoConnectionService.deleteConnection({ tenant, connection });
      return ssoConnectionPresenter(deleted);
    }),

  groups: tenantApp.controller({
    create: tenantApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          connectionId: v.string(),
          value: v.string(),
          displayName: v.optional(v.nullable(v.string())),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .do(async ({ input, tenant }) => {
        let connection = await ssoConnectionService.getConnectionById({
          tenant,
          connectionId: input.connectionId
        });
        let group = await ssoGroupRoleService.upsertGroup({
          connection,
          value: input.value,
          displayName: input.displayName,
          metadata: input.metadata
        });
        let fullGroup = await ssoGroupRoleService.getConnectionGroupById({
          tenant,
          groupId: group.id
        });
        return ssoConnectionGroupPresenter(fullGroup);
      }),

    list: tenantApp
      .handler()
      .input(
        Paginator.validate(
          v.object({
            tenantId: v.string(),
            connectionId: v.optional(v.string()),
            userIds: v.optional(v.array(v.string())),
            userProfileIds: v.optional(v.array(v.string())),
            connectionIds: v.optional(v.array(v.string())),
            groupIds: v.optional(v.array(v.string()))
          })
        )
      )
      .do(async ({ input, tenant }) => {
        let paginator = await ssoGroupRoleService.listConnectionGroups({
          tenant,
          filters: {
            ...input,
            connectionIds: input.connectionId ? [input.connectionId] : undefined
          }
        });
        let list = await paginator.run(input);
        return Paginator.presentLight(list, ssoConnectionGroupPresenter);
      }),

    get: tenantApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          groupId: v.string()
        })
      )
      .do(async ({ input, tenant }) => {
        let group = await ssoGroupRoleService.getConnectionGroupById({
          tenant,
          groupId: input.groupId
        });
        return ssoConnectionGroupPresenter(group);
      }),

    update: tenantApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          groupId: v.string(),
          value: v.optional(v.string()),
          displayName: v.optional(v.nullable(v.string())),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .do(async ({ input, tenant }) => {
        let group = await ssoGroupRoleService.getConnectionGroupById({
          tenant,
          groupId: input.groupId
        });
        let updated = await ssoGroupRoleService.updateConnectionGroup({
          tenant,
          group,
          input: {
            value: input.value,
            displayName: input.displayName,
            metadata: input.metadata
          }
        });
        return ssoConnectionGroupPresenter(updated);
      }),

    delete: tenantApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          groupId: v.string()
        })
      )
      .do(async ({ input, tenant }) => {
        let group = await ssoGroupRoleService.getConnectionGroupById({
          tenant,
          groupId: input.groupId
        });
        let deleted = await ssoGroupRoleService.deleteConnectionGroup({ tenant, group });
        return ssoConnectionGroupPresenter(deleted);
      })
  }),

  roles: tenantApp.controller({
    create: tenantApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          connectionId: v.string(),
          value: v.string(),
          displayName: v.optional(v.nullable(v.string())),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .do(async ({ input, tenant }) => {
        let connection = await ssoConnectionService.getConnectionById({
          tenant,
          connectionId: input.connectionId
        });
        let role = await ssoGroupRoleService.upsertRole({
          connection,
          value: input.value,
          displayName: input.displayName,
          metadata: input.metadata
        });
        let fullRole = await ssoGroupRoleService.getConnectionRoleById({
          tenant,
          roleId: role.id
        });
        return ssoConnectionRolePresenter(fullRole);
      }),

    list: tenantApp
      .handler()
      .input(
        Paginator.validate(
          v.object({
            tenantId: v.string(),
            connectionId: v.optional(v.string()),
            userIds: v.optional(v.array(v.string())),
            userProfileIds: v.optional(v.array(v.string())),
            connectionIds: v.optional(v.array(v.string())),
            roleIds: v.optional(v.array(v.string()))
          })
        )
      )
      .do(async ({ input, tenant }) => {
        let paginator = await ssoGroupRoleService.listConnectionRoles({
          tenant,
          filters: {
            ...input,
            connectionIds: input.connectionId ? [input.connectionId] : undefined
          }
        });
        let list = await paginator.run(input);
        return Paginator.presentLight(list, ssoConnectionRolePresenter);
      }),

    get: tenantApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          roleId: v.string()
        })
      )
      .do(async ({ input, tenant }) => {
        let role = await ssoGroupRoleService.getConnectionRoleById({
          tenant,
          roleId: input.roleId
        });
        return ssoConnectionRolePresenter(role);
      }),

    update: tenantApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          roleId: v.string(),
          value: v.optional(v.string()),
          displayName: v.optional(v.nullable(v.string())),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .do(async ({ input, tenant }) => {
        let role = await ssoGroupRoleService.getConnectionRoleById({
          tenant,
          roleId: input.roleId
        });
        let updated = await ssoGroupRoleService.updateConnectionRole({
          tenant,
          role,
          input: {
            value: input.value,
            displayName: input.displayName,
            metadata: input.metadata
          }
        });
        return ssoConnectionRolePresenter(updated);
      }),

    delete: tenantApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          roleId: v.string()
        })
      )
      .do(async ({ input, tenant }) => {
        let role = await ssoGroupRoleService.getConnectionRoleById({
          tenant,
          roleId: input.roleId
        });
        let deleted = await ssoGroupRoleService.deleteConnectionRole({ tenant, role });
        return ssoConnectionRolePresenter(deleted);
      })
  }),

  profiles: tenantApp.controller({
    list: tenantApp
      .handler()
      .input(
        Paginator.validate(
          v.object({
            tenantId: v.string(),
            connectionId: v.optional(v.string()),
            userIds: v.optional(v.array(v.string())),
            userProfileIds: v.optional(v.array(v.string())),
            connectionIds: v.optional(v.array(v.string())),
            groupIds: v.optional(v.array(v.string())),
            roleIds: v.optional(v.array(v.string())),
            uids: v.optional(v.array(v.string())),
            directoryIds: v.optional(v.array(v.string())),
            externalIds: v.optional(v.array(v.string())),
            emails: v.optional(v.array(v.string())),
            statuses: v.optional(v.array(v.string()))
          })
        )
      )
      .do(async ({ input, tenant }) => {
        let connection = input.connectionId
          ? await ssoConnectionService.getConnectionById({
              tenant,
              connectionId: input.connectionId
            })
          : undefined;
        let paginator = await ssoIdentityService.listUserProfiles({
          tenant,
          connection,
          filters: {
            ...input,
            connectionIds: input.connectionId ? [input.connectionId] : undefined
          }
        });
        let list = await paginator.run(input);
        return Paginator.presentLight(list, ssoUserProfilePresenter);
      }),

    get: tenantApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          userProfileId: v.string()
        })
      )
      .do(async ({ input, tenant }) => {
        let profile = await ssoIdentityService.getUserProfileById({
          tenant,
          userProfileId: input.userProfileId
        });
        return ssoUserProfilePresenter(profile);
      })
  })
});
