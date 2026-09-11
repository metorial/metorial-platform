import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { MagicMcpTokenStatus } from '@metorial/db';
import { grantConsumerOwnedMagicMcpTokenAccess } from '@metorial/consumer-magic-access';
import {
  magicMcpEndpointService,
  magicMcpGroupService,
  magicMcpServerService,
  magicMcpTokenService
} from '@metorial/module-magic';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { magicMcpTokenPresenter } from '@metorial/presenters';

export let magicMcpTokenGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.magicMcpTokenId) {
    throw new ServiceError(
      badRequestError({
        message: 'magicMcpTokenId is required',
        description: 'The magicMcpTokenId path parameter is required.'
      })
    );
  }

  let magicMcpToken = await magicMcpTokenService.getMagicMcpTokenById({
    magicMcpTokenId: ctx.params.magicMcpTokenId,
    instance: ctx.instance,
    accessTags: ctx.accessTags
  });

  return { magicMcpToken };
});

let magicMcpTokenStatusValues: ['active', 'deleted'] = ['active', 'deleted'];

export let magicMcpTokenController = Controller.create(
  {
    name: 'Magic MCP Tokens',
    description:
      'Magic MCP tokens authorize access to Magic MCP servers via the /magic connection API.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('magic-mcp-tokens', 'magicMcpTokens.list'), {
        name: 'List magic MCP tokens',
        description: 'Returns a paginated list of magic MCP tokens.',
        confidential: true
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:read',
            'consumer#instance.magic_mcp:read'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .outputList(magicMcpTokenPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(magicMcpTokenStatusValues),
                v.array(v.enumOf(magicMcpTokenStatusValues))
              ])
            ),
            magic_mcp_group_id: v.optional(v.union([v.string(), v.array(v.string())])),
            magic_mcp_server_id: v.optional(v.union([v.string(), v.array(v.string())])),
            magic_mcp_endpoint_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let paginator = await magicMcpTokenService.listMagicMcpTokens({
          instance: ctx.instance,
          status: normalizeArrayParam<MagicMcpTokenStatus>(ctx.query.status),
          groupIds: normalizeArrayParam(ctx.query.magic_mcp_group_id),
          serverIds: normalizeArrayParam(ctx.query.magic_mcp_server_id),
          endpointIds: normalizeArrayParam(ctx.query.magic_mcp_endpoint_id),
          accessTags: ctx.accessTags
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpToken =>
          magicMcpTokenPresenter.present({ magicMcpToken })
        );
      }),

    get: magicMcpTokenGroup
      .get(instancePath('magic-mcp-tokens/:magicMcpTokenId', 'magicMcpTokens.get'), {
        name: 'Get magic MCP token',
        description: 'Retrieves a specific magic MCP token.',
        confidential: true
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:read',
            'consumer#instance.magic_mcp:read'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpTokenPresenter.present({ magicMcpToken: ctx.magicMcpToken });
      }),

    create: instanceGroup
      .post(instancePath('magic-mcp-tokens', 'magicMcpTokens.create'), {
        name: 'Create magic MCP token',
        description: 'Creates a new magic MCP token.',
        confidential: true
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:write',
            'consumer#instance.magic_mcp:write'
          ]
        })
      )
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          magic_mcp_group_ids: v.optional(v.array(v.string())),
          magic_mcp_server_id: v.optional(v.string()),
          magic_mcp_endpoint_id: v.optional(v.string())
        })
      )
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        if (ctx.consumerProfile && ctx.body.magic_mcp_group_ids?.length) {
          throw new ServiceError(
            badRequestError({
              message: 'Consumer-created magic MCP tokens cannot be locked to admin groups.'
            })
          );
        }

        if (ctx.body.magic_mcp_server_id && ctx.body.magic_mcp_endpoint_id) {
          throw new ServiceError(
            badRequestError({
              message: 'A magic MCP token can be linked to either one server or one endpoint.'
            })
          );
        }

        let groups = ctx.body.magic_mcp_group_ids?.length
          ? await magicMcpGroupService.findManyGroupsById({
              groupIds: ctx.body.magic_mcp_group_ids,
              instance: ctx.instance
            })
          : undefined;
        let magicMcpServer = ctx.body.magic_mcp_server_id
          ? await magicMcpServerService.getMagicMcpServerById({
              magicMcpServerId: ctx.body.magic_mcp_server_id,
              instance: ctx.instance,
              accessTags: ctx.accessTags
            })
          : undefined;
        let magicMcpEndpoint = ctx.body.magic_mcp_endpoint_id
          ? await magicMcpEndpointService.getMagicMcpEndpointById({
              magicMcpEndpointId: ctx.body.magic_mcp_endpoint_id,
              instance: ctx.instance,
              accessTags: ctx.accessTags
            })
          : undefined;

        let magicMcpToken = await magicMcpTokenService.createMagicMcpToken({
          auditScope: ctx.auditScope,
          instance: ctx.instance,
          groups,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            magicMcpServer,
            magicMcpEndpoint
          }
        });

        if (ctx.consumerProfile) {
          await grantConsumerOwnedMagicMcpTokenAccess({
            organization: ctx.organization,
            consumerProfile: ctx.consumerProfile,
            consumerGroups: ctx.consumerGroups,
            magicMcpToken
          });
        }

        return magicMcpTokenPresenter.present({ magicMcpToken });
      }),

    delete: magicMcpTokenGroup
      .delete(instancePath('magic-mcp-tokens/:magicMcpTokenId', 'magicMcpTokens.delete'), {
        name: 'Delete magic MCP token',
        description: 'Deletes a magic MCP token.'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:write',
            'consumer#instance.magic_mcp:write'
          ]
        })
      )
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        await magicMcpTokenService.checkWriteAccess({
          token: ctx.magicMcpToken,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpToken = await magicMcpTokenService.deleteMagicMcpToken({
          auditScope: ctx.auditScope,
          token: ctx.magicMcpToken
        });

        return magicMcpTokenPresenter.present({ magicMcpToken });
      }),

    update: magicMcpTokenGroup
      .patch(instancePath('magic-mcp-tokens/:magicMcpTokenId', 'magicMcpTokens.update'), {
        name: 'Update magic MCP token',
        description: 'Updates a magic MCP token.'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:write',
            'consumer#instance.magic_mcp:write'
          ]
        })
      )
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        await magicMcpTokenService.checkWriteAccess({
          token: ctx.magicMcpToken,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpToken = await magicMcpTokenService.updateMagicMcpToken({
          auditScope: ctx.auditScope,
          token: ctx.magicMcpToken,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return magicMcpTokenPresenter.present({ magicMcpToken });
      }),

    addGroups: magicMcpTokenGroup
      .post(
        instancePath(
          'magic-mcp-tokens/:magicMcpTokenId/add-groups',
          'magicMcpTokens.addGroups'
        ),
        {
          name: 'Add magic MCP groups to token',
          description: 'Adds groups to a magic MCP token.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          magic_mcp_group_ids: v.array(v.string())
        })
      )
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        await magicMcpTokenService.checkWriteAccess({
          token: ctx.magicMcpToken,
          instance: ctx.instance
        });

        let magicMcpToken = await magicMcpTokenService.addGroupsToToken({
          auditScope: ctx.auditScope,
          token: ctx.magicMcpToken,
          groupIds: ctx.body.magic_mcp_group_ids
        });

        return magicMcpTokenPresenter.present({ magicMcpToken });
      }),

    removeGroups: magicMcpTokenGroup
      .post(
        instancePath(
          'magic-mcp-tokens/:magicMcpTokenId/remove-groups',
          'magicMcpTokens.removeGroups'
        ),
        {
          name: 'Remove magic MCP groups from token',
          description: 'Removes groups from a magic MCP token.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          magic_mcp_group_ids: v.array(v.string())
        })
      )
      .output(magicMcpTokenPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        await magicMcpTokenService.checkWriteAccess({
          token: ctx.magicMcpToken,
          instance: ctx.instance
        });

        let magicMcpToken = await magicMcpTokenService.removeGroupsFromToken({
          auditScope: ctx.auditScope,
          token: ctx.magicMcpToken,
          groupIds: ctx.body.magic_mcp_group_ids
        });

        return magicMcpTokenPresenter.present({ magicMcpToken });
      })
  }
);
