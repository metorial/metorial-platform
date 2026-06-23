import { v } from '@lowerdeck/validation';
import { getScopeDefinition, Scope } from '@metorial/module-access';
import { Presenter } from '@metorial/presenter';
import { oauthInstallationType } from '../../types';
import { v1MachineAccessPresenter } from './machineAccess';
import { v1OAuthApplicationPresenter } from './oauthApplication';

export let v1OAuthInstallationPresenter = Presenter.create(oauthInstallationType)
  .presenter(async ({ oauthInstallation }, opts) => ({
    object: 'machine_access.oauth_installation',

    id: oauthInstallation.id,
    status: oauthInstallation.status,

    scopes: oauthInstallation.scopes.map(scope => {
      let definition = getScopeDefinition(scope as Scope);

      return {
        identifier: definition.identifier as string,
        name: definition.name,
        description: definition.description
      };
    }),

    organization_id: oauthInstallation.organization.id,

    oauth_application: await v1OAuthApplicationPresenter
      .present(
        {
          oauthApplication: oauthInstallation.oauthApplication
        },
        opts
      )
      .run(),

    server_side_machine_access: oauthInstallation.serverSideMachineAccess
      ? await v1MachineAccessPresenter
          .present(
            {
              machineAccess: oauthInstallation.serverSideMachineAccess
            },
            opts
          )
          .run()
      : null,

    last_used_at: oauthInstallation.lastUsedAt,
    revoked_at: oauthInstallation.revokedAt,
    created_at: oauthInstallation.createdAt,
    updated_at: oauthInstallation.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('machine_access.oauth_installation', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique OAuth installation identifier',
        examples: ['oai_4sTuVwXyZaBcDeFg']
      }),
      status: v.enumOf(['active', 'revoked'], {
        name: 'status',
        description: 'OAuth installation status'
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
          description: 'Scopes granted to this installation'
        }
      ),
      organization_id: v.string({
        name: 'organization_id',
        description: 'Organization that owns the installation',
        examples: ['org_7hNkPqRsTuVwXyZa']
      }),
      oauth_application: v1OAuthApplicationPresenter.schema,
      server_side_machine_access: v.nullable(v1MachineAccessPresenter.schema),
      last_used_at: v.nullable(
        v.date({
          name: 'last_used_at',
          description: 'Timestamp when this installation was last used'
        })
      ),
      revoked_at: v.nullable(
        v.date({
          name: 'revoked_at',
          description: 'Timestamp when this installation was revoked'
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when this installation was created'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when this installation was last updated'
      })
    })
  )
  .build();
