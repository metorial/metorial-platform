import { portalService } from '@metorial/module-portal';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { portalPresenter } from '../../presenters';

export let portalGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.portalId) throw new Error('portalId is required');

  let portal = await portalService.getPortalById({
    portalId: ctx.params.portalId,
    instance: ctx.instance
  });

  return { portal };
});

export let portalController = Controller.create(
  {
    name: 'Portal',
    description:
      'Use Portals to create custom branded MCP server marketplaces for your organization.'
  },
  {
    list: instanceGroup
      .get(instancePath('portals', 'portals.list'), {
        name: 'List Portal',
        description: 'Returns a paginated list of portals.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal:read'] }))
      .use(hasFlags(['paid-portals']))
      .outputList(portalPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await portalService.listPortals({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        let urls = Object.fromEntries(
          await Promise.all(
            list.items.map(async portal => [
              portal.id,
              (await portalService.getPortalHost({ portal })).host
            ])
          )
        );

        return Paginator.present(list, portal =>
          portalPresenter.present({
            portal,
            portalUrl: urls[portal.id]
          })
        );
      }),

    get: portalGroup
      .get(instancePath('portals/:portalId', 'portals.get'), {
        name: 'Get SSO Tenant by ID',
        description: 'Retrieves details for a specific portal by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal:read'] }))
      .use(hasFlags(['paid-portals']))
      .output(portalPresenter)
      .do(async ctx => {
        return portalPresenter.present({
          portal: ctx.portal,
          portalUrl: (await portalService.getPortalHost({ portal: ctx.portal })).host
        });
      }),

    create: instanceGroup
      .post(instancePath('portals', 'portals.create'), {
        name: 'Create SSO Tenant',
        description: 'Creates a new sso tenant for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal:write'] }))
      .use(hasFlags(['paid-portals']))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string())
        })
      )
      .output(portalPresenter)
      .do(async ctx => {
        let portal = await portalService.createPortal({
          organization: ctx.organization,
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description
          }
        });

        return portalPresenter.present({
          portal,
          portalUrl: (await portalService.getPortalHost({ portal })).host
        });
      }),

    update: portalGroup
      .patch(instancePath('portals/:portalId', 'portals.update'), {
        name: 'Update Portal',
        description: 'Updates an existing portal for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal:write'] }))
      .use(hasFlags(['paid-portals']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string())
        })
      )
      .output(portalPresenter)
      .do(async ctx => {
        let portal = await portalService.updatePortal({
          portal: ctx.portal,
          input: {
            name: ctx.body.name,
            description: ctx.body.description
          }
        });

        return portalPresenter.present({
          portal,
          portalUrl: (await portalService.getPortalHost({ portal })).host
        });
      }),

    delete: portalGroup
      .delete(instancePath('portals/:portalId', 'portals.delete'), {
        name: 'Delete Portal',
        description: 'Deletes a portal from the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal:write'] }))
      .use(hasFlags(['paid-portals']))
      .output(portalPresenter)
      .do(async ctx => {
        let portal = await portalService.deletePortal({
          portal: ctx.portal
        });

        return portalPresenter.present({
          portal,
          portalUrl: (await portalService.getPortalHost({ portal })).host
        });
      })
  }
);
