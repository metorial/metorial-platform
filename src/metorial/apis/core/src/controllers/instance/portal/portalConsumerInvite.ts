import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerInviteService } from '@metorial/module-consumer-core';
import { portalService } from '@metorial/module-portal';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { consumerInvitePresenter } from '@metorial/presenters';
import { portalGroup } from './portal';

export let consumerInviteGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerInviteId) {
    throw new ServiceError(
      badRequestError({
        message: 'consumerInviteId is required',
        description: 'The consumerInviteId path parameter is required.'
      })
    );
  }

  let consumerInvite = await consumerInviteService.getConsumerInviteById({
    consumerSurface: ctx.portal.surface,
    consumerInviteId: ctx.params.consumerInviteId
  });

  return { consumerInvite };
});

export let portalConsumerInviteController = Controller.create(
  {
    name: 'Portal Consumer Invites',
    description: 'List and inspect consumer invites for a portal.'
  },
  {
    list: portalGroup
      .get(
        instancePath('portals/:portalId/consumer-invites', 'portals.consumerInvites.list'),
        {
          name: 'List portal consumer invites',
          description: 'Returns a paginated list of invites for a portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .outputList(consumerInvitePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            email: v.optional(
              v.union([
                v.string({ modifiers: [v.email()] }),
                v.array(v.string({ modifiers: [v.email()] }))
              ])
            ),
            status: v.optional(
              v.union([
                v.enumOf(['pending', 'accepted']),
                v.array(v.enumOf(['pending', 'accepted']))
              ])
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await consumerInviteService.listConsumerInvites({
          consumerSurface: ctx.portal.surface,
          search: ctx.query.search,
          emails: normalizeArrayParam(ctx.query.email),
          statuses: normalizeArrayParam(ctx.query.status)
        });
        let list = await paginator.run(ctx.query);

        let portalUrl = await portalService.getPrimaryPortalUrl({ portal: ctx.portal });

        return Paginator.present(list, consumerInvite =>
          consumerInvitePresenter.present({ consumerInvite, portalUrl })
        );
      }),

    create: portalGroup
      .post(
        instancePath('portals/:portalId/consumer-invites', 'portals.consumerInvites.create'),
        {
          name: 'Create portal consumer invite',
          description: 'Invites a consumer to a portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.string(),
          email: v.string({ modifiers: [v.email()] }),
          message: v.optional(v.string())
        })
      )
      .output(consumerInvitePresenter)
      .do(async ctx => {
        let consumerInvite = await consumerInviteService.inviteConsumer({
          consumerSurface: ctx.portal.surface,
          performedBy: ctx.actor!,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            email: ctx.body.email,
            message: ctx.body.message
          }
        });

        return consumerInvitePresenter.present({
          consumerInvite,
          portalUrl: await portalService.getPrimaryPortalUrl({ portal: ctx.portal })
        });
      }),

    get: consumerInviteGroup
      .get(
        instancePath(
          'portals/:portalId/consumer-invites/:consumerInviteId',
          'portals.consumerInvites.get'
        ),
        {
          name: 'Get portal consumer invite',
          description: 'Retrieves a portal consumer invite by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerInvitePresenter)
      .do(async ctx => {
        return consumerInvitePresenter.present({
          consumerInvite: ctx.consumerInvite,
          portalUrl: await portalService.getPrimaryPortalUrl({ portal: ctx.portal })
        });
      })
  }
);
