import { consumerAccessService, consumerGroupService } from '@metorial/module-consumer';
import { serverDeploymentTemplateService } from '@metorial/module-server-deployment';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { consumerAccessPresenter } from '../../presenters';
import { portalGroup } from './portal';

export let consumerAccessGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerAccessId) throw new Error('consumerAccessId is required');

  let consumerAccess = await consumerAccessService.getConsumerAccessById({
    consumerSurface: ctx.portal.surface,
    accessId: ctx.params.consumerAccessId
  });

  return { consumerAccess };
});

export let portalConsumerAccessController = Controller.create(
  {
    name: 'Portal Consumer Access',
    description: 'Connect Consumer Groups to Portals to control access to your marketplaces.'
  },
  {
    list: portalGroup
      .get(instancePath('portals/:portalId/consumer-access', 'portals.consumerAccess.list'), {
        name: 'List Portal',
        description: 'Returns a paginated list of portals.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .outputList(consumerAccessPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            consumer_group_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by consumer group ID(s)'
            }),
            server_deployment_template_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by deployment template ID(s)' }
            ),
            type: v.optional(
              v.union([
                v.enumOf(['server_deployment_template']),
                v.array(v.enumOf(['server_deployment_template']))
              ]),
              { description: 'Filter by access type' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await consumerAccessService.listConsumerAccesses({
          consumerSurface: ctx.portal.surface,

          consumerGroupIds: normalizeArrayParam(ctx.query.consumer_group_id),
          serverDeploymentTemplateIds: normalizeArrayParam(
            ctx.query.server_deployment_template_id
          ),
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
          name: 'Get Consumer Access by ID',
          description: 'Retrieves details for a specific portal by its ID.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:read']
        })
      )
      .use(hasFlags(['paid-portals']))
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
          name: 'Create Consumer Access',
          description: 'Creates a new sso tenant for the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:write']
        })
      )
      .use(hasFlags(['paid-portals']))
      .body(
        'default',
        v.object({
          consumer_group_id: v.string(),

          access: v.object({
            type: v.literal('server_deployment_template'),
            server_deployment_template_id: v.string()
          })
        })
      )
      .output(consumerAccessPresenter)
      .do(async ctx => {
        let consumerGroup = await consumerGroupService.getConsumerGroupById({
          consumerSurface: ctx.portal.surface,
          consumerGroupId: ctx.body.consumer_group_id
        });

        let consumerAccess = await consumerAccessService.createConsumerAccess({
          consumerSurface: ctx.portal.surface,
          consumerGroup,
          access: {
            type: 'server_deployment_template',
            serverDeploymentTemplate:
              await serverDeploymentTemplateService.getServerDeploymentTemplateById({
                instance: ctx.instance,
                serverDeploymentTemplateId: ctx.body.access.server_deployment_template_id
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
          name: 'Delete Portal',
          description: 'Deletes a portal from the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.access:write']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(consumerAccessPresenter)
      .do(async ctx => {
        let consumerAccess = await consumerAccessService.deleteConsumerAccess({
          groupAccess: ctx.consumerAccess
        });

        return consumerAccessPresenter.present({ consumerAccess });
      })
  }
);
