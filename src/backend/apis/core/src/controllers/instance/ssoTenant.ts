import { ssoTenantService } from '@metorial/module-sso';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { ssoTenantPresenter, ssoTenantSetupPresenter } from '../../presenters';

export let ssoTenantGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.ssoTenantId) throw new Error('ssoTenantId is required');

  let ssoTenant = await ssoTenantService.getTenantById({
    tenantId: ctx.params.ssoTenantId,
    organization: ctx.organization
  });

  return { ssoTenant };
});

export let ssoTenantController = Controller.create(
  {
    name: 'SSO Tenants',
    description:
      'SSO Tenants allow you to manage single sign-on configurations for your instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('sso-tenants', 'ssoTenants.list'), {
        name: 'List SSO Tenants',
        description: 'Returns a paginated list of sso tenants.'
      })
      .use(checkAccess({ possibleScopes: ['instance.ssoTenant:read'] }))
      .use(hasFlags(['paid-sso-tenants']))
      .outputList(ssoTenantPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await ssoTenantService.listTenants({
          organization: ctx.organization
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, ssoTenant => ssoTenantPresenter.present({ ssoTenant }));
      }),

    get: ssoTenantGroup
      .get(instancePath('sso-tenants/:ssoTenantId', 'ssoTenants.get'), {
        name: 'Get SSO Tenant by ID',
        description: 'Retrieves details for a specific sso tenant by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.ssoTenant:read'] }))
      .use(hasFlags(['paid-sso-tenants']))
      .output(ssoTenantPresenter)
      .do(async ctx => {
        return ssoTenantPresenter.present({ ssoTenant: ctx.ssoTenant });
      }),

    create: instanceGroup
      .post(instancePath('sso-tenants', 'ssoTenants.create'), {
        name: 'Create SSO Tenant',
        description: 'Creates a new sso tenant for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.ssoTenant:write'] }))
      .use(hasFlags(['paid-sso-tenants']))
      .body(
        'default',
        v.object({
          name: v.string()
        })
      )
      .output(ssoTenantPresenter)
      .do(async ctx => {
        let ssoTenant = await ssoTenantService.createSsoTenant({
          organization: ctx.organization,
          input: {
            name: ctx.body.name
          }
        });

        return ssoTenantPresenter.present({ ssoTenant });
      }),

    setup: ssoTenantGroup
      .post(instancePath('sso-tenants/:ssoTenantId/setup', 'ssoTenants.setup'), {
        name: 'Setup SSO Tenant',
        description: 'Creates a new sso tenant setup for the tenant.'
      })
      .use(checkAccess({ possibleScopes: ['instance.ssoTenant:write'] }))
      .use(hasFlags(['paid-sso-tenants']))
      .output(ssoTenantSetupPresenter)
      .body(
        'default',
        v.object({
          redirect_uri: v.string({
            modifiers: [v.url()]
          })
        })
      )
      .do(async ctx => {
        let ssoTenantSetup = await ssoTenantService.createTenantSetup({
          tenant: ctx.ssoTenant,
          input: {
            redirectUri: ctx.body.redirect_uri
          }
        });

        return ssoTenantSetupPresenter.present({ ssoTenantSetup });
      })
  }
);
