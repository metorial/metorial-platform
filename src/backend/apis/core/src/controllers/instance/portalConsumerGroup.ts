import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerGroupService } from '@metorial/module-consumer';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { consumerGroupPresenter } from '../../presenters';
import { portalGroup } from './portal';

export let consumerGroupGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerGroupId) {
    throw new ServiceError(
      badRequestError({
        message: 'consumerGroupId is required',
        description: 'The consumerGroupId path parameter is required.'
      })
    );
  }

  let consumerGroup = await consumerGroupService.getConsumerGroupById({
    consumerSurface: ctx.portal.surface,
    consumerGroupId: ctx.params.consumerGroupId
  });

  return { consumerGroup };
});

export let portalConsumerGroupController = Controller.create(
  {
    name: 'Portal Consumer Groups',
    description: 'Manage the consumer groups that drive portal visibility and access rules.'
  },
  {
    list: portalGroup
      .get(instancePath('portals/:portalId/consumer-groups', 'portals.consumerGroups.list'), {
        name: 'List portal consumer groups',
        description: 'Returns a paginated list of consumer groups for a portal.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .outputList(consumerGroupPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            search: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await consumerGroupService.listConsumerGroups({
          consumerSurface: ctx.portal.surface,
          status: normalizeArrayParam(ctx.query.status),
          search: ctx.query.search
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerGroup =>
          consumerGroupPresenter.present({ consumerGroup })
        );
      }),

    get: consumerGroupGroup
      .get(
        instancePath(
          'portals/:portalId/consumer-groups/:consumerGroupId',
          'portals.consumerGroups.get'
        ),
        {
          name: 'Get portal consumer group',
          description: 'Retrieves a portal consumer group by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerGroupPresenter)
      .do(async ctx => {
        return consumerGroupPresenter.present({
          consumerGroup: ctx.consumerGroup
        });
      }),

    create: portalGroup
      .post(
        instancePath('portals/:portalId/consumer-groups', 'portals.consumerGroups.create'),
        {
          name: 'Create portal consumer group',
          description: 'Creates a new consumer group for the portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          sso_group_ids: v.optional(v.array(v.string())),
          is_default: v.optional(v.boolean())
        })
      )
      .output(consumerGroupPresenter)
      .do(async ctx => {
        let consumerGroup = await consumerGroupService.createConsumerGroup({
          consumerSurface: ctx.portal.surface,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            ssoGroupIds: ctx.body.sso_group_ids,
            isDefault: ctx.body.is_default
          }
        });

        return consumerGroupPresenter.present({ consumerGroup });
      }),

    update: consumerGroupGroup
      .patch(
        instancePath(
          'portals/:portalId/consumer-groups/:consumerGroupId',
          'portals.consumerGroups.update'
        ),
        {
          name: 'Update portal consumer group',
          description: 'Updates a consumer group for the portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          sso_group_ids: v.optional(v.array(v.string())),
          is_default: v.optional(v.boolean())
        })
      )
      .output(consumerGroupPresenter)
      .do(async ctx => {
        let consumerGroup = await consumerGroupService.updateConsumerGroup({
          consumerGroup: ctx.consumerGroup,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            ssoGroupIds: ctx.body.sso_group_ids,
            isDefault: ctx.body.is_default
          }
        });

        return consumerGroupPresenter.present({ consumerGroup });
      }),

    delete: consumerGroupGroup
      .delete(
        instancePath(
          'portals/:portalId/consumer-groups/:consumerGroupId',
          'portals.consumerGroups.delete'
        ),
        {
          name: 'Delete portal consumer group',
          description: 'Archives a consumer group for the portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerGroupPresenter)
      .do(async ctx => {
        let consumerGroup = await consumerGroupService.deleteConsumerGroup({
          organization: ctx.organization,
          consumerGroup: ctx.consumerGroup
        });

        return consumerGroupPresenter.present({ consumerGroup });
      })
  }
);
