import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  consumerAccessService,
  consumerGroupService,
  providerTemplateService
} from '@metorial/module-consumer';
import { magicMcpServerService } from '@metorial/module-magic';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { consumerAccessPresenter } from '../../presenters';
import { portalGroup } from './portal';

export let consumerAccessGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerAccessId) {
    throw new ServiceError(
      badRequestError({
        message: 'consumerAccessId is required',
        description: 'The consumerAccessId path parameter is required.'
      })
    );
  }

  let consumerAccess = await consumerAccessService.getConsumerAccessById({
    consumerSurface: ctx.portal.surface,
    consumerAccessId: ctx.params.consumerAccessId
  });

  return { consumerAccess };
});

export let portalConsumerAccessController = Controller.create(
  {
    name: 'Portal Consumer Access',
    description:
      'Manage which consumer groups can access portal provider templates and MCP servers.',
    hideInDocs: true
  },
  {
    list: portalGroup
      .get(instancePath('portals/:portalId/consumer-access', 'portals.consumerAccess.list'), {
        name: 'List portal consumer access',
        description: 'Returns a paginated list of consumer access rules for a portal.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .outputList(consumerAccessPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            consumer_group_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_template_id: v.optional(v.union([v.string(), v.array(v.string())])),
            magic_mcp_server_id: v.optional(v.union([v.string(), v.array(v.string())])),
            type: v.optional(
              v.union([
                v.enumOf(['provider_template', 'magic_mcp_server']),
                v.array(v.enumOf(['provider_template', 'magic_mcp_server']))
              ])
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await consumerAccessService.listConsumerAccesses({
          consumerSurface: ctx.portal.surface,
          consumerGroupIds: normalizeArrayParam(ctx.query.consumer_group_id),
          providerTemplateIds: normalizeArrayParam(ctx.query.provider_template_id),
          magicMcpServerIds: normalizeArrayParam(ctx.query.magic_mcp_server_id),
          types: normalizeArrayParam(ctx.query.type)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerAccess =>
          consumerAccessPresenter.present({ consumerAccess })
        );
      }),

    get: consumerAccessGroup
      .get(
        instancePath(
          'portals/:portalId/consumer-access/:consumerAccessId',
          'portals.consumerAccess.get'
        ),
        {
          name: 'Get portal consumer access',
          description: 'Retrieves a portal consumer access rule by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerAccessPresenter)
      .do(async ctx => {
        return consumerAccessPresenter.present({
          consumerAccess: ctx.consumerAccess
        });
      }),

    create: portalGroup
      .post(
        instancePath('portals/:portalId/consumer-access', 'portals.consumerAccess.create'),
        {
          name: 'Create portal consumer access',
          description: 'Creates a new consumer access rule for the portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          consumer_group_id: v.string(),
          access: v.union([
            v.object({
              type: v.literal('provider_template'),
              provider_template_id: v.string()
            }),
            v.object({
              type: v.literal('magic_mcp_server'),
              magic_mcp_server_id: v.string()
            })
          ])
        })
      )
      .output(consumerAccessPresenter)
      .do(async ctx => {
        let consumerGroup = await consumerGroupService.getConsumerGroupById({
          consumerSurface: ctx.portal.surface,
          consumerGroupId: ctx.body.consumer_group_id,
          types: ['default', 'user_access']
        });

        let consumerAccess =
          ctx.body.access.type == 'provider_template'
            ? await consumerAccessService.createConsumerAccess({
                organization: ctx.organization,
                consumerSurface: ctx.portal.surface,
                consumerGroup,
                access: {
                  type: 'provider_template',
                  providerTemplate: await providerTemplateService.getProviderTemplateById({
                    instance: ctx.instance,
                    providerTemplateId: ctx.body.access.provider_template_id
                  })
                }
              })
            : await consumerAccessService.createConsumerAccess({
                organization: ctx.organization,
                consumerSurface: ctx.portal.surface,
                consumerGroup,
                access: {
                  type: 'magic_mcp_server',
                  magicMcpServer: await magicMcpServerService.getMagicMcpServerById({
                    instance: ctx.instance,
                    magicMcpServerId: ctx.body.access.magic_mcp_server_id
                  })
                }
              });

        return consumerAccessPresenter.present({ consumerAccess });
      }),

    delete: consumerAccessGroup
      .delete(
        instancePath(
          'portals/:portalId/consumer-access/:consumerAccessId',
          'portals.consumerAccess.delete'
        ),
        {
          name: 'Delete portal consumer access',
          description: 'Deletes a consumer access rule from the portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerAccessPresenter)
      .do(async ctx => {
        let consumerAccess = await consumerAccessService.deleteConsumerAccess({
          organization: ctx.organization,
          consumerAccess: ctx.consumerAccess
        });

        return consumerAccessPresenter.present({ consumerAccess });
      })
  }
);
