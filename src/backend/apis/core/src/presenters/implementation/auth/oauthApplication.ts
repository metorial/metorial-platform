import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { getScopeDefinition, Scope } from '@metorial/module-access';
import { Presenter } from '@metorial/presenter';
import { oauthApplicationType } from '../../types';
import { v1OAuthApplicationClientSecretPresenter } from './oauthApplicationClientSecret';

export let v1OAuthApplicationPresenter = Presenter.create(oauthApplicationType)
  .presenter(async ({ oauthApplication }, opts) => ({
    object: 'machine_access.oauth_application',

    id: oauthApplication.id,

    status: oauthApplication.status,
    type: oauthApplication.type,
    access_level: oauthApplication.accessLevel,
    allow_token_exchange_without_client_secret:
      oauthApplication.allowClientSecretlessTokenExchange,

    name: oauthApplication.name,
    description: oauthApplication.description,
    scopes: oauthApplication.scopes.map(scope => {
      let definition = getScopeDefinition(scope as Scope);

      return {
        identifier: definition.identifier,
        name: definition.name,
        description: definition.description
      };
    }),
    image_url: await getImageUrl(oauthApplication),

    website_url: oauthApplication.websiteUrl,
    privacy_policy_url: oauthApplication.privacyPolicyUrl,
    terms_of_service_url: oauthApplication.termsOfServiceUrl,
    redirect_uris: oauthApplication.redirectUris,
    client_id: oauthApplication.clientId,

    client_secrets: await Promise.all(
      (oauthApplication.clientSecrets ?? []).map(clientSecret =>
        v1OAuthApplicationClientSecretPresenter
          .present({ oauthApplicationClientSecret: clientSecret }, opts)
          .run()
      )
    ),

    organization_id: oauthApplication.organization?.id ?? null,
    created_at: oauthApplication.createdAt,
    updated_at: oauthApplication.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('machine_access.oauth_application', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique OAuth application identifier',
        examples: ['oap_4sTuVwXyZaBcDeFg']
      }),
      status: v.enumOf(['active', 'archived'], {
        name: 'status',
        description: 'OAuth application status'
      }),
      type: v.enumOf(['user_facing', 'cli_auth', 'server_side'], {
        name: 'type',
        description: 'OAuth application type'
      }),
      access_level: v.enumOf(['organization', 'global'], {
        name: 'access_level',
        description:
          'Whether this OAuth application is organization-scoped or globally installable'
      }),
      allow_token_exchange_without_client_secret: v.boolean({
        name: 'allow_token_exchange_without_client_secret',
        description:
          'Whether authorization_code and device_code token exchanges may omit the client secret'
      }),
      name: v.string({
        name: 'name',
        description: 'OAuth application display name',
        examples: ['Acme CLI']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'OAuth application description',
          examples: ['Access Metorial from the Acme CLI']
        })
      ),
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
          description: 'Scopes requested by this OAuth application'
        }
      ),
      image_url: v.string({
        name: 'image_url',
        description: 'OAuth application image URL',
        examples: ['https://avatar-cdn.metorial.com/aimg_1234567890']
      }),
      website_url: v.nullable(
        v.string({
          name: 'website_url',
          description: 'OAuth application website URL',
          examples: ['https://acme.example.com']
        })
      ),
      privacy_policy_url: v.nullable(
        v.string({
          name: 'privacy_policy_url',
          description: 'OAuth application privacy policy URL',
          examples: ['https://acme.example.com/privacy']
        })
      ),
      terms_of_service_url: v.nullable(
        v.string({
          name: 'terms_of_service_url',
          description: 'OAuth application terms of service URL',
          examples: ['https://acme.example.com/terms']
        })
      ),
      redirect_uris: v.array(
        v.string({
          name: 'redirect_uri',
          description: 'Allowed redirect URI'
        }),
        {
          name: 'redirect_uris',
          description: 'Allowed redirect URIs for interactive OAuth flows'
        }
      ),
      client_id: v.string({
        name: 'client_id',
        description: 'OAuth client identifier',
        examples: ['mt_oauth_1234567890abcdef']
      }),
      client_secrets: v.array(v1OAuthApplicationClientSecretPresenter.schema, {
        name: 'client_secrets',
        description:
          'Client secret records for this OAuth application. Full secret values are only returned when created.'
      }),
      organization_id: v.nullable(
        v.string({
          name: 'organization_id',
          description: 'Organization that owns this OAuth application',
          examples: ['org_7hNkPqRsTuVwXyZa']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when this OAuth application was created'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when this OAuth application was last updated'
      })
    }) as any
  )
  .build();
