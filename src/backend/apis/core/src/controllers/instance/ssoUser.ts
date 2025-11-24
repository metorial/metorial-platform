import { ssoUserService } from '@metorial/module-sso';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { ssoUserPresenter } from '../../presenters';

export let ssoUserGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.ssoUserId) throw new Error('ssoUserId is required');

  let ssoUser = await ssoUserService.getSsoUserById({
    ssoUserId: ctx.params.ssoUserId,
    instance: ctx.instance
  });

  return { ssoUser };
});

export let ssoUserController = Controller.create(
  {
    name: 'SSO Users',
    description:
      'SSO Users allow you to manage single sign-on configurations for your instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('sso-users', 'ssoTenants.users.list'), {
        name: 'List SSO Tenants',
        description: 'Returns a paginated list of sso tenants.'
      })
      .use(checkAccess({ possibleScopes: ['instance.ssoTenant:read'] }))
      .use(hasFlags(['paid-sso-tenants']))
      .outputList(ssoUserPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            profile_id: v.optional(v.union([v.string(), v.array(v.string())])),
            consumer_profile_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await ssoUserService.listSsoUsers({
          instance: ctx.instance,
          profile_ids: normalizeArrayParam(ctx.query.profile_id),
          consumer_profile_ids: normalizeArrayParam(ctx.query.consumer_profile_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, ssoUser => ssoUserPresenter.present({ ssoUser }));
      }),

    get: ssoUserGroup
      .get(instancePath('sso-users/:ssoUserId', 'ssoTenants.users.get'), {
        name: 'Get SSO Tenant by ID',
        description: 'Retrieves details for a specific sso tenant by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.ssoTenant:read'] }))
      .use(hasFlags(['paid-sso-tenants']))
      .output(ssoUserPresenter)
      .do(async ctx => {
        return ssoUserPresenter.present({ ssoUser: ctx.ssoUser });
      })
  }
);
