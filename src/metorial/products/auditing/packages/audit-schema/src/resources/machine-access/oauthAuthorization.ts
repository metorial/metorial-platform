import { v } from '@lowerdeck/validation';
import { OAuthSubjectType } from '@metorial/db';
import { resource } from '../../_lib/resource';

export let oauthAuthorizationResource = resource({
  name: 'oauth_authorization',
  payload: v.typedAny<{
    id: string;
    status: string;
    type: string;
    subjectType: OAuthSubjectType;
    scopes: string[];
    consumerProfileId: string | null;
    oauthApplication: { id: string; name: string };
  }>('oauth_authorization'),
  presenter: undefined,
  actions: {
    revoke: true
  }
});

export let oauthAuthorizationRequestResource = resource({
  name: 'oauth_authorization_request',
  payload: v.typedAny<{
    id: string;
    status: string;
    type: string;
    subjectType: OAuthSubjectType;
    scopes: string[];
    organizationMemberId: string | null;
    consumerProfileId: string | null;
    oauthApplication: { id: string; name: string };
  }>('oauth_authorization_request'),
  presenter: undefined,
  actions: {
    accept: true,
    deny: true
  }
});
