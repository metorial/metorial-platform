import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { MagicMcpGroupStatus } from '@metorial/db';
import { magicMcpGroupService } from '@metorial/module-magic';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireNonPublishableMachineAccess } from '../../../middleware/requireNonPublishableMachineAccess';
import { magicMcpGroupPresenter } from '@metorial/presenters';

export let magicMcpGroupGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.magicMcpGroupId) {
    throw new ServiceError(
      badRequestError({
        message: 'magicMcpGroupId is required',
        description: 'The magicMcpGroupId path parameter is required.'
      })
    );
  }

  let magicMcpGroup = await magicMcpGroupService.getMagicMcpGroupById({
    magicMcpGroupId: ctx.params.magicMcpGroupId,
    instance: ctx.instance
  });

  return { magicMcpGroup };
});

let magicMcpGroupStatusValues = ['active', 'archived', 'deleted'] as const;

export let magicMcpGroupController = Controller.create(
  {
    name: 'Magic MCP Groups',
    description: 'Magic MCP groups categorize servers and can be bound to token access.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('magic-mcp-groups', 'magicMcpGroups.list'), {
        name: 'List magic MCP groups',
        description: 'Returns a paginated list of magic MCP groups.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(requireNonPublishableMachineAccess())
      .outputList(magicMcpGroupPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf([...magicMcpGroupStatusValues]),
                v.array(v.enumOf([...magicMcpGroupStatusValues]))
              ])
            ),
            search: v.optional(v.string())
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled', 'paid-magic-mcp-groups']))
      .do(async ctx => {
        let paginator = await magicMcpGroupService.listMagicMcpGroups({
          instance: ctx.instance,
          status: normalizeArrayParam<MagicMcpGroupStatus>(ctx.query.status),
          search: ctx.query.search
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpGroup =>
          magicMcpGroupPresenter.present({ magicMcpGroup })
        );
      }),

    get: magicMcpGroupGroup
      .get(instancePath('magic-mcp-groups/:magicMcpGroupId', 'magicMcpGroups.get'), {
        name: 'Get magic MCP group',
        description: 'Retrieves a specific magic MCP group.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(requireNonPublishableMachineAccess())
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled', 'paid-magic-mcp-groups']))
      .do(async ctx => {
        return magicMcpGroupPresenter.present({ magicMcpGroup: ctx.magicMcpGroup });
      }),

    create: instanceGroup
      .post(instancePath('magic-mcp-groups', 'magicMcpGroups.create'), {
        name: 'Create magic MCP group',
        description: 'Creates a magic MCP group.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write'],
          fineGrainedPolicy: 'deny'
        })
      )
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled', 'paid-magic-mcp-groups']))
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.createMagicMcpGroup({
          organization: ctx.organization,
          performedBy: ctx.actor!,
          instance: ctx.instance,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return magicMcpGroupPresenter.present({ magicMcpGroup });
      }),

    delete: magicMcpGroupGroup
      .delete(instancePath('magic-mcp-groups/:magicMcpGroupId', 'magicMcpGroups.delete'), {
        name: 'Delete magic MCP group',
        description: 'Deletes a magic MCP group.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write'],
          fineGrainedPolicy: 'deny'
        })
      )
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled', 'paid-magic-mcp-groups']))
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.deleteMagicMcpGroup({
          group: ctx.magicMcpGroup
        });

        return magicMcpGroupPresenter.present({ magicMcpGroup });
      }),

    update: magicMcpGroupGroup
      .patch(instancePath('magic-mcp-groups/:magicMcpGroupId', 'magicMcpGroups.update'), {
        name: 'Update magic MCP group',
        description: 'Updates a magic MCP group.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write'],
          fineGrainedPolicy: 'deny'
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
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled', 'paid-magic-mcp-groups']))
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.updateMagicMcpGroup({
          group: ctx.magicMcpGroup,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return magicMcpGroupPresenter.present({ magicMcpGroup });
      }),

    addServers: magicMcpGroupGroup
      .post(
        instancePath(
          'magic-mcp-groups/:magicMcpGroupId/add-servers',
          'magicMcpGroups.addServers'
        ),
        {
          name: 'Add servers to magic MCP group',
          description: 'Adds magic MCP servers to a group.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write'],
          fineGrainedPolicy: 'deny'
        })
      )
      .body(
        'default',
        v.object({
          magic_mcp_server_ids: v.array(v.string())
        })
      )
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled', 'paid-magic-mcp-groups']))
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.addServersToGroup({
          group: ctx.magicMcpGroup,
          serverIds: ctx.body.magic_mcp_server_ids
        });

        return magicMcpGroupPresenter.present({ magicMcpGroup });
      }),

    removeServers: magicMcpGroupGroup
      .post(
        instancePath(
          'magic-mcp-groups/:magicMcpGroupId/remove-servers',
          'magicMcpGroups.removeServers'
        ),
        {
          name: 'Remove servers from magic MCP group',
          description: 'Removes magic MCP servers from a group.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write'],
          fineGrainedPolicy: 'deny'
        })
      )
      .body(
        'default',
        v.object({
          magic_mcp_server_ids: v.array(v.string())
        })
      )
      .output(magicMcpGroupPresenter)
      .use(hasFlags(['magic-mcp-enabled', 'paid-magic-mcp-groups']))
      .do(async ctx => {
        let magicMcpGroup = await magicMcpGroupService.removeServersFromGroup({
          group: ctx.magicMcpGroup,
          serverIds: ctx.body.magic_mcp_server_ids
        });

        return magicMcpGroupPresenter.present({ magicMcpGroup });
      })
  }
);
