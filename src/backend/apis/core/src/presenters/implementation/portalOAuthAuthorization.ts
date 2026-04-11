import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { portalOAuthAuthorizationType } from '../types';
import { v1PortalOAuthClientPresenter } from './portalOAuthClient';

let getRedirectUrl = (d: {
  redirectUri: string;
  state?: string | null;
  status: 'pending' | 'authorized' | 'active' | 'denied' | 'revoked';
  authorizationCode?: string | null;
}) => {
  if (d.status != 'authorized' && d.status != 'denied') {
    return null;
  }

  let url = new URL(d.redirectUri);

  if (d.status == 'authorized' && d.authorizationCode) {
    url.searchParams.set('code', d.authorizationCode);
  } else if (d.status == 'denied') {
    url.searchParams.set('error', 'access_denied');
    url.searchParams.set('error_description', 'The portal authorization request was denied.');
  }

  if (d.state) {
    url.searchParams.set('state', d.state);
  }

  return url.toString();
};

export let v1PortalOAuthAuthorizationPresenter = Presenter.create(portalOAuthAuthorizationType)
  .presenter(async ({ portalOAuthAuthorization }, opts) => ({
    object: 'portal.oauth_authorization' as const,
    id: portalOAuthAuthorization.id,
    status: portalOAuthAuthorization.status,
    redirect_uri: portalOAuthAuthorization.redirectUri,
    redirect_url: getRedirectUrl({
      redirectUri: portalOAuthAuthorization.redirectUri,
      state: portalOAuthAuthorization.state,
      status: portalOAuthAuthorization.status,
      authorizationCode: portalOAuthAuthorization.authorizationCode
    }),
    consumer_profile_id: portalOAuthAuthorization.consumerProfile?.id ?? null,
    magic_mcp_endpoint_id: portalOAuthAuthorization.magicMcpEndpoint?.id ?? null,
    created_at: portalOAuthAuthorization.createdAt,
    updated_at: portalOAuthAuthorization.updatedAt,
    expires_at: portalOAuthAuthorization.expiresAt,
    authorized_at: portalOAuthAuthorization.authorizedAt,
    denied_at: portalOAuthAuthorization.deniedAt,
    oauth_client: await v1PortalOAuthClientPresenter
      .present({ portalAuthClient: portalOAuthAuthorization.consumerAuthClient }, opts)
      .run()
  }))
  .schema(
    v.object({
      object: v.literal('portal.oauth_authorization'),
      id: v.string(),
      status: v.enumOf(['pending', 'authorized', 'active', 'denied', 'revoked']),
      redirect_uri: v.string(),
      redirect_url: v.nullable(v.string()),
      consumer_profile_id: v.nullable(v.string()),
      magic_mcp_endpoint_id: v.nullable(v.string()),
      created_at: v.date(),
      updated_at: v.date(),
      expires_at: v.date(),
      authorized_at: v.nullable(v.date()),
      denied_at: v.nullable(v.date()),
      oauth_client: v1PortalOAuthClientPresenter.schema
    })
  )
  .build();
