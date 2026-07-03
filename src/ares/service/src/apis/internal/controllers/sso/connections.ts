import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
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
      v.object({
        tenantId: v.string(),
        providerType: v.enumOf(['saml', 'oidc']),
        providerName: v.optional(v.string()),
        name: v.string(),
        metadata: v.optional(v.record(v.any())),
        samlMetadata: v.optional(
          v.union([
            v.object({ type: v.literal('xml'), payload: v.string() }),
            v.object({ type: v.literal('url'), url: v.string() })
          ])
        ),
        oidcDiscoveryUrl: v.optional(v.string()),
        clientId: v.optional(v.string()),
        clientSecret: v.optional(v.string())
      })
    )
    .do(async ({ input, tenant }) => {
      let connection = await ssoConnectionService.createConnection({
        tenant,
        input:
          input.providerType === 'saml'
            ? {
                providerType: 'saml',
                providerName: input.providerName,
                name: input.name,
                metadata: input.metadata,
                samlMetadata: input.samlMetadata!
              }
            : {
                providerType: 'oidc',
                providerName: input.providerName,
                name: input.name,
                metadata: input.metadata,
                oidcDiscoveryUrl: input.oidcDiscoveryUrl!,
                clientId: input.clientId!,
                clientSecret: input.clientSecret!
              }
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
