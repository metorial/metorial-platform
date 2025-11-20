import { consumerAuthFactorService } from '@metorial/module-consumer';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { consumerAuthFactorPresenter } from '../../presenters';
import { portalGroup } from './portal';

export let consumerAuthFactorGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerAuthFactorId) throw new Error('consumerAuthFactorId is required');

  let consumerAuthFactor = await consumerAuthFactorService.getConsumerAuthFactorById({
    consumerSurface: ctx.portal.surface,
    consumerAuthFactorId: ctx.params.consumerAuthFactorId
  });

  return { consumerAuthFactor };
});

export let portalConsumerAuthFactorController = Controller.create(
  {
    name: 'Portal Auth',
    description: 'Connect various authentication factors to your portal instance.'
  },
  {
    list: portalGroup
      .get(
        instancePath('portals/:portalId/auth-factors', 'portals.consumerAuthFactors.list'),
        {
          name: 'List Portal',
          description: 'Returns a paginated list of portals.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.auth:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .outputList(consumerAuthFactorPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await consumerAuthFactorService.listConsumerAuthFactors({
          consumerSurface: ctx.portal.surface
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerAuthFactor =>
          consumerAuthFactorPresenter.present({ consumerAuthFactor })
        );
      }),

    get: consumerAuthFactorGroup
      .get(
        instancePath(
          'portals/:portalId/auth-factors/:consumerAuthFactorId',
          'portals.consumerAuthFactors.get'
        ),
        {
          name: 'Get Auth by ID',
          description: 'Retrieves details for a specific portal by its ID.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.auth:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(consumerAuthFactorPresenter)
      .do(async ctx => {
        return consumerAuthFactorPresenter.present({
          consumerAuthFactor: ctx.consumerAuthFactor
        });
      }),

    create: portalGroup
      .post(
        instancePath('portals/:portalId/auth-factors', 'portals.consumerAuthFactors.create'),
        {
          name: 'Create Auth',
          description: 'Creates a new sso tenant for the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.auth:write']
        })
      )
      .use(hasFlags(['paid-portals']))
      .body(
        'default',
        v.union([
          v.object({
            type: v.literal('email_code')
          }),
          v.object({
            type: v.literal('sso'),
            sso_tenant_id: v.string()
          })
        ])
      )
      .output(consumerAuthFactorPresenter)
      .do(async ctx => {
        let consumerAuthFactor = await consumerAuthFactorService.createConsumerAuthFactor({
          consumerSurface: ctx.portal.surface,
          input:
            ctx.body.type === 'email_code'
              ? { type: 'email_code' }
              : {
                  type: 'sso',
                  ssoTenantId: ctx.body.sso_tenant_id
                }
        });

        return consumerAuthFactorPresenter.present({ consumerAuthFactor });
      }),

    delete: consumerAuthFactorGroup
      .delete(
        instancePath(
          'portals/:portalId/auth-factors/:consumerAuthFactorId',
          'portals.consumerAuthFactors.delete'
        ),
        {
          name: 'Delete Portal',
          description: 'Deletes a portal from the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.auth:write']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(consumerAuthFactorPresenter)
      .do(async ctx => {
        let consumerAuthFactor = await consumerAuthFactorService.deleteConsumerAuthFactor({
          consumerAuthFactor: ctx.consumerAuthFactor
        });

        return consumerAuthFactorPresenter.present({ consumerAuthFactor });
      }),

    update: consumerAuthFactorGroup
      .patch(
        instancePath(
          'portals/:portalId/auth-factors/:consumerAuthFactorId',
          'portals.consumerAuthFactors.update'
        ),
        {
          name: 'Update Portal',
          description: 'Updates a portal from the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.auth:write']
        })
      )
      .use(hasFlags(['paid-portals']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          public_name: v.optional(v.string())
        })
      )
      .output(consumerAuthFactorPresenter)
      .do(async ctx => {
        let consumerAuthFactor = await consumerAuthFactorService.updateConsumerAuthFactor({
          consumerAuthFactor: ctx.consumerAuthFactor,
          input: {
            name: ctx.body.name,
            publicName: ctx.body.public_name
          }
        });

        return consumerAuthFactorPresenter.present({ consumerAuthFactor });
      })
  }
);
