import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { ssoUserProfileType } from '../types';

export let v1SsoUserProfilePresenter = Presenter.create(ssoUserProfileType)
  .presenter(async ({ ssoUserProfile }, opts) => ({
    object: 'sso.user_profile',

    id: ssoUserProfile.id,

    sso_connection_id: ssoUserProfile.ssoConnectionId,

    email: ssoUserProfile.email,
    uid: ssoUserProfile.uid,
    sub: ssoUserProfile.sub,
    first_name: ssoUserProfile.firstName,
    last_name: ssoUserProfile.lastName,
    roles: ssoUserProfile.roles,
    groups: ssoUserProfile.groups,

    created_at: ssoUserProfile.createdAt,
    updated_at: ssoUserProfile.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('sso.user_profile', {
        name: 'object',
        description: 'Type of the object, fixed as sso.user_profile'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the sso tenant'
      }),

      sso_connection_id: v.string({
        name: 'sso_connection_id',
        description: 'The SSO Connection ID associated with this user profile'
      }),

      email: v.string({
        name: 'email',
        description: 'The email address of the SSO user'
      }),

      uid: v.string({
        name: 'uid',
        description: 'The unique identifier of the SSO user provided by the SSO provider'
      }),

      sub: v.string({
        name: 'sub',
        description: 'The subject identifier of the SSO user'
      }),

      first_name: v.string({
        name: 'first_name',
        description: 'The first name of the SSO user'
      }),

      last_name: v.string({
        name: 'last_name',
        description: 'The last name of the SSO user'
      }),

      roles: v.array(v.string(), {
        name: 'roles',
        description: 'The roles assigned to the SSO user'
      }),

      groups: v.array(v.string(), {
        name: 'groups',
        description: 'The groups the SSO user belongs to'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'The ISO 8601 timestamp when the sso user profile was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'The ISO 8601 timestamp when the sso user profile was last updated'
      })
    })
  )
  .build();
