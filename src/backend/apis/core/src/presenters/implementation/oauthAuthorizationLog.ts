import { v } from '@lowerdeck/validation';
import { getScopeDefinition, Scope } from '@metorial/module-access';
import { Presenter } from '@metorial/presenter';
import { oauthAuthorizationLogType } from '../types';
import { v1OAuthApplicationPresenter } from './oauthApplication';
import { v1OrganizationActorPresenter } from './organizationActor';
import { v1UserPresenter } from './user';

export let v1OAuthAuthorizationLogPresenter = Presenter.create(oauthAuthorizationLogType)
  .presenter(async ({ oauthAuthorizationLog }, opts) => ({
    object: 'machine_access.oauth_authorization_log',

    id: oauthAuthorizationLog.id,
    status:
      oauthAuthorizationLog.status == 'consumed'
        ? ('accepted' as const)
        : oauthAuthorizationLog.status,
    type: oauthAuthorizationLog.type,

    organization_id: oauthAuthorizationLog.organization?.id ?? null,

    redirect_uri: oauthAuthorizationLog.redirectUri,
    client_ip: oauthAuthorizationLog.clientIp,

    scopes: oauthAuthorizationLog.scopes.map(scope => {
      let definition = getScopeDefinition(scope as Scope);

      return {
        identifier: definition.identifier as string,
        name: definition.name,
        description: definition.description
      };
    }),

    oauth_application: await v1OAuthApplicationPresenter
      .present(
        {
          oauthApplication: oauthAuthorizationLog.oauthApplication
        },
        opts
      )
      .run(),

    actor: oauthAuthorizationLog.actor
      ? await v1OrganizationActorPresenter
          .present(
            {
              organizationActor: oauthAuthorizationLog.actor
            },
            opts
          )
          .run()
      : null,

    user: oauthAuthorizationLog.user
      ? await v1UserPresenter
          .present(
            {
              user: oauthAuthorizationLog.user
            },
            opts
          )
          .run()
      : null,

    created_at: oauthAuthorizationLog.createdAt,
    accepted_at: oauthAuthorizationLog.acceptedAt,
    denied_at: oauthAuthorizationLog.deniedAt
  }))
  .schema(
    v.object({
      object: v.literal('machine_access.oauth_authorization_log'),
      id: v.string(),
      status: v.enumOf(['pending', 'accepted', 'denied']),
      type: v.enumOf(['interactive', 'device_code']),
      organization_id: v.nullable(v.string()),
      redirect_uri: v.nullable(v.string()),
      client_ip: v.nullable(v.string()),
      scopes: v.array(
        v.object({
          identifier: v.string(),
          name: v.string(),
          description: v.string()
        })
      ),
      oauth_application: v1OAuthApplicationPresenter.schema,
      actor: v.nullable(v1OrganizationActorPresenter.schema),
      user: v.nullable(v1UserPresenter.schema),
      created_at: v.date(),
      accepted_at: v.nullable(v.date()),
      denied_at: v.nullable(v.date())
    })
  )
  .build();
