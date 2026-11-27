import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerGroupService } from '@metorial/module-consumer-core';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { getVisibleConsumerGroups } from '../../../lib/visibleConsumerGroups';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { consumerGroupPresenter } from '@metorial/presenters';
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
    consumerGroupId: ctx.params.consumerGroupId,
    visibleToConsumerGroups: getVisibleConsumerGroups(ctx)
  });

  return { consumerGroup };
});

export let portalConsumerGroupController = Controller.create(
  {
    name: 'Portal Consumer Groups',
    description:
      'A portal consumer group is a set of consumers on a portal. Groups decide which listings each consumer sees.'
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
              ]),
              { description: 'Only return groups with one of these statuses.' }
            ),
            search: v.optional(v.string({ description: 'Search by name or description.' }))
          })
        )
      )
      .do(async ctx => {
        let paginator = await consumerGroupService.listConsumerGroups({
          consumerSurface: ctx.portal.surface,
          status: normalizeArrayParam(ctx.query.status),
          search: ctx.query.search,
          visibleToConsumerGroups: getVisibleConsumerGroups(ctx)
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
          description: 'Retrieves a portal consumer group.'
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
          description: 'Creates a consumer group for a portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.string({ description: 'Display name.' }),
          description: v.optional(v.string({ description: 'Free-text description.' })),
          is_default: v.optional(
            v.boolean({ description: 'Whether this is a default group on the portal.' })
          )
        })
      )
      .output(consumerGroupPresenter)
      .do(async ctx => {
        let consumerGroup = await consumerGroupService.createConsumerGroup({
          consumerSurface: ctx.portal.surface,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
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
          description: 'Updates a portal consumer group. Omitted fields keep their current value.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ description: 'Display name.' })),
          description: v.optional(v.string({ description: 'Free-text description.' })),
          is_default: v.optional(
            v.boolean({ description: 'Whether this is a default group on the portal.' })
          )
        })
      )
      .output(consumerGroupPresenter)
      .do(async ctx => {
        let consumerGroup = await consumerGroupService.updateConsumerGroup({
          consumerSurface: ctx.portal.surface,
          consumerGroup: ctx.consumerGroup,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
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
          name: 'Archive portal consumer group',
          description: 'Archives a portal consumer group.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerGroupPresenter)
      .do(async ctx => {
        let consumerGroup = await consumerGroupService.deleteConsumerGroup({
          organization: ctx.organization,
          consumerSurface: ctx.portal.surface,
          consumerGroup: ctx.consumerGroup,
          auditScope: ctx.auditScope
        });

        return consumerGroupPresenter.present({ consumerGroup });
      })
  }
);
