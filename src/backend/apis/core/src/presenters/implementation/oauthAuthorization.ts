import { v } from '@lowerdeck/validation';
import { getScopeDefinition, Scope } from '@metorial/module-access';
import { Presenter } from '@metorial/presenter';
import { oauthAuthorizationType } from '../types';
import { v1MachineAccessPresenter } from './machineAccess';
import { v1OAuthApplicationPresenter } from './oauthApplication';

export let v1OAuthAuthorizationPresenter = Presenter.create(oauthAuthorizationType)
  .presenter(async ({ oauthAuthorization }, opts) => ({
    object: 'machine_access.oauth_authorization',

    id: oauthAuthorization.id,
    status: oauthAuthorization.status,
    type: oauthAuthorization.type,
    scopes: oauthAuthorization.scopes.map(scope => {
      let definition = getScopeDefinition(scope as Scope);

      return {
        identifier: definition.identifier as string,
        name: definition.name,
        description: definition.description
      };
    }),

    organization_id: oauthAuthorization.oauthInstallation.organization.id,
    oauth_application_id: oauthAuthorization.oauthApplication.id,
    oauth_installation_id: oauthAuthorization.oauthInstallation.id,
    user_id: oauthAuthorization.user?.id ?? null,
    organization_member_id: oauthAuthorization.organizationMember?.id ?? null,

    oauth_application: await v1OAuthApplicationPresenter
      .present(
        {
          oauthApplication: oauthAuthorization.oauthApplication
        },
        opts
      )
      .run(),

    machine_access: await v1MachineAccessPresenter
      .present(
        {
          machineAccess: oauthAuthorization.machineAccess
        },
        opts
      )
      .run(),

    requesting_ip: oauthAuthorization.requestingIp,
    accepting_ip: oauthAuthorization.acceptingIp,
    last_used_at: oauthAuthorization.lastUsedAt,
    revoked_at: oauthAuthorization.revokedAt,
    created_at: oauthAuthorization.createdAt,
    updated_at: oauthAuthorization.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('machine_access.oauth_authorization', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique OAuth authorization identifier',
        examples: ['oaa_4sTuVwXyZaBcDeFg']
      }),
      status: v.enumOf(['active', 'revoked'], {
        name: 'status',
        description: 'OAuth authorization status'
      }),
      type: v.enumOf(['user', 'server_side'], {
        name: 'type',
        description: 'OAuth authorization type'
      }),
      scopes: v.array(
        v.object({
          identifier: v.string({
            name: 'identifier',
            description: 'OAuth scope identifier'
          }),
          name: v.string({
            name: 'name',
            description: 'Human-readable scope name'
          }),
          description: v.string({
            name: 'description',
            description: 'Human-readable scope description'
          })
        }),
        {
          name: 'scopes',
          description: 'Scopes granted to this authorization'
        }
      ),
      organization_id: v.string({
        name: 'organization_id',
        description: 'Organization that owns the authorization',
        examples: ['org_7hNkPqRsTuVwXyZa']
      }),
      oauth_application_id: v.string({
        name: 'oauth_application_id',
        description: 'OAuth application identifier',
        examples: ['oap_4sTuVwXyZaBcDeFg']
      }),
      oauth_installation_id: v.string({
        name: 'oauth_installation_id',
        description: 'OAuth installation identifier',
        examples: ['oai_4sTuVwXyZaBcDeFg']
      }),
      user_id: v.nullable(
        v.string({
          name: 'user_id',
          description: 'Authorized user identifier when this is a user authorization',
          examples: ['usr_4sTuVwXyZaBcDeFg']
        })
      ),
      organization_member_id: v.nullable(
        v.string({
          name: 'organization_member_id',
          description: 'Organization member identifier when this is a user authorization',
          examples: ['mem_4sTuVwXyZaBcDeFg']
        })
      ),
      oauth_application: v1OAuthApplicationPresenter.schema,
      machine_access: v1MachineAccessPresenter.schema,
      requesting_ip: v.nullable(
        v.string({
          name: 'requesting_ip',
          description: 'IP address that initiated the authorization'
        })
      ),
      accepting_ip: v.nullable(
        v.string({
          name: 'accepting_ip',
          description: 'IP address that accepted the authorization'
        })
      ),
      last_used_at: v.nullable(
        v.date({
          name: 'last_used_at',
          description: 'Timestamp when this authorization was last used'
        })
      ),
      revoked_at: v.nullable(
        v.date({
          name: 'revoked_at',
          description: 'Timestamp when this authorization was revoked'
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when this authorization was created'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when this authorization was last updated'
      })
    })
  )
  .build();
