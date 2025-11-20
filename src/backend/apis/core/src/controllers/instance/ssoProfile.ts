import { ssoProfileService } from '@metorial/module-sso';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { ssoUserProfilePresenter } from '../../presenters';

export let ssoProfileGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.ssoProfileId) throw new Error('ssoProfileId is required');

  let ssoProfile = await ssoProfileService.getSsoProfileById({
    ssoProfileId: ctx.params.ssoProfileId,
    instance: ctx.instance
  });

  return { ssoProfile };
});

export let ssoProfileController = Controller.create(
  {
    name: 'SSO Profiles',
    description:
      'SSO Profiles allow you to manage single sign-on configurations for your instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('sso-profiles', 'ssoTenants.profiles.list'), {
        name: 'List SSO Tenants',
        description: 'Returns a paginated list of sso tenants.'
      })
      .use(checkAccess({ possibleScopes: ['instance.ssoTenant:read'] }))
      .use(hasFlags(['paid-sso-tenants']))
      .outputList(ssoUserProfilePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            user_id: v.optional(v.union([v.string(), v.array(v.string())])),
            consumer_profile_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await ssoProfileService.listSsoProfiles({
          instance: ctx.instance,
          user_ids: normalizeArrayParam(ctx.query.user_id),
          consumer_profile_ids: normalizeArrayParam(ctx.query.consumer_profile_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, ssoUserProfile =>
          ssoUserProfilePresenter.present({ ssoUserProfile })
        );
      }),

    get: ssoProfileGroup
      .get(instancePath('sso-profiles/:ssoProfileId', 'ssoTenants.profiles.get'), {
        name: 'Get SSO Tenant by ID',
        description: 'Retrieves details for a specific sso tenant by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.ssoTenant:read'] }))
      .use(hasFlags(['paid-sso-tenants']))
      .output(ssoUserProfilePresenter)
      .do(async ctx => {
        return ssoUserProfilePresenter.present({ ssoUserProfile: ctx.ssoProfile });
      })
  }
);
