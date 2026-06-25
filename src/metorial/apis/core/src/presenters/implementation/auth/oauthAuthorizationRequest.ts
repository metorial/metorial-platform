import { v } from '@lowerdeck/validation';
import { getScopeDefinition, Scope } from '@metorial/module-access';
import type { OAuthAuthorizationRequestWithRelations } from '@metorial/module-machine-access';
import { Presenter } from '@metorial/presenter';
import { oauthAuthorizationRequestType } from '../../types';
import { v1OAuthApplicationPresenter } from './oauthApplication';

let getRedirectUrl = (d: OAuthAuthorizationRequestWithRelations) => {
  if (d.type != 'interactive' || d.status == 'pending' || !d.redirectUri) return null;

  let url = new URL(d.redirectUri);
  url.searchParams.set('code', d.code);
  if (d.state) url.searchParams.set('state', d.state);

  return url.toString();
};

export let v1OAuthAuthorizationRequestPresenter = Presenter.create(
  oauthAuthorizationRequestType
)
  .presenter(async ({ oauthAuthorizationRequest }, opts) => ({
    object: 'machine_access.oauth_authorization_request',

    id: oauthAuthorizationRequest.id,
    status: oauthAuthorizationRequest.status,
    type: oauthAuthorizationRequest.type,

    user_code: oauthAuthorizationRequest.userCode,
    redirect_uri: oauthAuthorizationRequest.redirectUri,

    scopes: oauthAuthorizationRequest.scopes.map(scope => {
      let definition = getScopeDefinition(scope as Scope);

      return {
        identifier: definition.identifier as string,
        name: definition.name,
        description: definition.description
      };
    }),

    redirect_url: getRedirectUrl(oauthAuthorizationRequest),
    created_at: oauthAuthorizationRequest.createdAt,

    oauth_application: await v1OAuthApplicationPresenter
      .present(
        {
          oauthApplication: oauthAuthorizationRequest.oauthApplication
        },
        opts
      )
      .run()
  }))
  .schema(
    v.object({
      object: v.literal('machine_access.oauth_authorization_request'),
      id: v.string(),
      status: v.enumOf(['pending', 'accepted', 'denied', 'consumed']),
      type: v.enumOf(['interactive', 'device_code']),
      user_code: v.nullable(v.string()),
      redirect_uri: v.nullable(v.string()),
      scopes: v.array(
        v.object({
          identifier: v.string(),
          name: v.string(),
          description: v.string()
        })
      ),
      redirect_url: v.nullable(v.string()),
      created_at: v.date(),

      oauth_application: v1OAuthApplicationPresenter.schema
    })
  )
  .build();
