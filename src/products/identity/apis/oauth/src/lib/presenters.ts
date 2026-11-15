import { oauthAuthorizationService, oauthOidcService } from '@metorial/module-machine-access';
import { getExpiresIn } from './expiration';
import type { OAuthRequestSubjectType } from './request';

export type CliAuthTokenResponse = Awaited<
  ReturnType<typeof oauthAuthorizationService.issueCliAuthTokenForMember>
>;

export let presentTokenSubject = (response: {
  subjectType: OAuthRequestSubjectType;
  consumerProfile: {
    id: string;
    name: string;
    email: string;
    instance: { id: string };
    surface: { portal: { id: string; name: string } | null };
  } | null;
}) => {
  if (response.subjectType != 'consumer' || !response.consumerProfile) {
    return { subject_type: response.subjectType };
  }

  let { consumerProfile } = response;

  return {
    subject_type: response.subjectType,

    consumer_profile: {
      id: consumerProfile.id,
      name: consumerProfile.name,
      email: consumerProfile.email
    },

    portal: consumerProfile.surface.portal
      ? {
          id: consumerProfile.surface.portal.id,
          name: consumerProfile.surface.portal.name
        }
      : null,

    instance: {
      id: consumerProfile.instance.id
    }
  };
};

export let presentCliAuthToken = (response: CliAuthTokenResponse) => ({
  access_token: response.oauthToken.accessToken,
  expires_in: getExpiresIn(response.oauthToken.accessTokenExpiresAt),
  refresh_token: response.oauthToken.refreshToken ?? undefined,
  scope: oauthOidcService.getGrantedScopes(response.oauthAuthorization),
  client_id: response.oauthAuthorization.oauthApplication.clientId,

  user: response.oauthAuthorization.user
    ? {
        id: response.oauthAuthorization.user.id,
        name: response.oauthAuthorization.user.name,
        email: response.oauthAuthorization.user.email
      }
    : null,

  organization: response.oauthInstallation.organization
    ? {
        id: response.oauthInstallation.organization.id,
        name: response.oauthInstallation.organization.name
      }
    : null,

  ...presentTokenSubject(response)
});
