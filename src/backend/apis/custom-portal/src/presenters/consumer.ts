import {
  Consumer,
  ConsumerProfile,
  ConsumerProfileSsoUser,
  SsoUser,
  SsoUserProfile
} from '@metorial/db';

export let consumerProfilePresenter = (
  profile: ConsumerProfile & {
    consumer: Consumer;
    ssoUsers: (ConsumerProfileSsoUser & {
      ssoProfile: SsoUserProfile;
      ssoUser: SsoUser;
    })[];
  }
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

  ssoProfiles: profile.ssoUsers.map(ssoUserLink => ({
    object: 'portal#sso.user.profile',

    id: ssoUserLink.ssoProfile.id,

    email: ssoUserLink.ssoProfile.email,
    firstName: ssoUserLink.ssoProfile.firstName,
    lastName: ssoUserLink.ssoProfile.lastName,

    groups: ssoUserLink.ssoProfile.groups,
    roles: ssoUserLink.ssoProfile.roles,

    sub: ssoUserLink.ssoProfile.sub,
    uid: ssoUserLink.ssoProfile.uid,

    ssoConnectionId: ssoUserLink.ssoProfile.ssoConnectionId,

    createdAt: ssoUserLink.ssoProfile.createdAt,
    updatedAt: ssoUserLink.ssoProfile.updatedAt,

    ssoUser: {
      object: 'portal#sso.user',

      id: ssoUserLink.ssoUser.id,

      email: ssoUserLink.ssoUser.email,
      roles: ssoUserLink.ssoUser.allGroups,
      groups: ssoUserLink.ssoUser.allRoles,

      createdAt: ssoUserLink.ssoUser.createdAt,
      updatedAt: ssoUserLink.ssoUser.updatedAt
    }
  }))
});
