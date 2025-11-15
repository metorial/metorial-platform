import { Consumer, ConsumerProfile, SsoUser } from '@metorial/db';

export let consumerProfilePresenter = (
  session: ConsumerProfile & { consumer: Consumer; ssoUser: SsoUser | null }
) => ({
  object: 'consumer#consumer.profile',

  id: session.id,

  name: session.name,
  email: session.email,

  createdAt: session.createdAt,
  updatedAt: session.updatedAt,

  consumer: {
    object: 'consumer#consumer',

    id: session.consumer.id,

    email: session.consumer.email,
    name: session.consumer.name,

    createdAt: session.consumer.createdAt,
    updatedAt: session.consumer.updatedAt
  },

  ssoUser: session.ssoUser
    ? {
        object: 'consumer#sso.user',

        id: session.ssoUser.id,

        email: session.ssoUser.email,
        firstName: session.ssoUser.firstName,
        lastName: session.ssoUser.lastName,

        createdAt: session.ssoUser.createdAt,
        updatedAt: session.ssoUser.updatedAt
      }
    : null
});
