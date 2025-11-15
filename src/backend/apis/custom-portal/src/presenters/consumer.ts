import { Consumer, ConsumerProfile, SsoUser } from '@metorial/db';

export let consumerProfilePresenter = (
  profile: ConsumerProfile & { consumer: Consumer; ssoUser: SsoUser | null }
) => ({
  object: 'portal#consumer.profile',

  id: profile.id,

  name: profile.name,
  email: profile.email,

  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,

  consumer: {
    object: 'portal#consumer',

    id: profile.consumer.id,

    email: profile.consumer.email,
    name: profile.consumer.name,

    createdAt: profile.consumer.createdAt,
    updatedAt: profile.consumer.updatedAt
  },

  ssoUser: profile.ssoUser
    ? {
        object: 'portal#sso.user',

        id: profile.ssoUser.id,

        email: profile.ssoUser.email,
        firstName: profile.ssoUser.firstName,
        lastName: profile.ssoUser.lastName,

        createdAt: profile.ssoUser.createdAt,
        updatedAt: profile.ssoUser.updatedAt
      }
    : null
});
