import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { ssoUserType } from '../types';
import { v1SsoTenantPresenter } from './ssoTenant';
import { v1SsoUserProfilePresenter } from './ssoUserProfile';

export let v1SsoUserPresenter = Presenter.create(ssoUserType)
  .presenter(async ({ ssoUser }, opts) => ({
    object: 'sso.tenant',

    id: ssoUser.id,

    sso_user_id: ssoUser.ssoUserId,

    email: ssoUser.email,
    first_name: ssoUser.firstName,
    last_name: ssoUser.lastName,

    created_at: ssoUser.createdAt,
    updated_at: ssoUser.updatedAt,

    sso_tenant: await v1SsoTenantPresenter
      .present({ ssoTenant: ssoUser.ssoTenant }, opts)
      .run(),

    profiles: await Promise.all(
      ssoUser.profiles.map(profile =>
        v1SsoUserProfilePresenter
          .present(
            {
              ssoUserProfile: {
                ...profile,
                ssoUser
              }
            },
            opts
          )
          .run()
      )
    )
  }))
  .schema(
    v.object({
      object: v.literal('sso.tenant', {
        name: 'object',
        description: 'Type of the object, fixed as sso.tenant'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the sso tenant'
      }),

      sso_user_id: v.string({
        name: 'sso_user_id',
        description: 'The SSO Tenant ID associated with this user'
      }),

      email: v.string({
        name: 'email',
        description: 'The email address of the SSO user'
      }),

      first_name: v.string({
        name: 'first_name',
        description: 'The first name of the SSO user'
      }),

      last_name: v.string({
        name: 'last_name',
        description: 'The last name of the SSO user'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'The ISO 8601 timestamp when the sso user was created',
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'The ISO 8601 timestamp when the sso user was last updated',
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      sso_tenant: v1SsoTenantPresenter.schema,

      profiles: v.array(v1SsoUserProfilePresenter.schema, {
        name: 'profiles',
        description: 'List of SSO user profiles associated with this user'
      })
    })
  )
  .build();
