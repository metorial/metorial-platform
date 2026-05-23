import { v } from '@mtsrc/validation';
import { getScopeDefinition, Scope } from '@metorial/module-access';
import { Presenter } from '@metorial/presenter';
import { serviceAccountCredentialType } from '../../types';
import { v1MachineAccessPresenter } from '../auth/machineAccess';

export let v1ServiceAccountCredentialPresenter = Presenter.create(serviceAccountCredentialType)
  .presenter(async ({ serviceAccountCredential }, opts) => ({
    object: 'machine_access.service_account_credential',

    id: serviceAccountCredential.id,
    status: serviceAccountCredential.oauthAuthorization.status,
    service_account_id: serviceAccountCredential.serviceAccount.id,

    scopes: serviceAccountCredential.oauthAuthorization.scopes.map(scope => {
      let definition = getScopeDefinition(scope as Scope);

      return {
        identifier: definition.identifier as string,
        name: definition.name,
        description: definition.description
      };
    }),

    machine_access: await v1MachineAccessPresenter
      .present(
        {
          machineAccess: serviceAccountCredential.oauthAuthorization.machineAccess
        },
        opts
      )
      .run(),

    last_used_at: serviceAccountCredential.oauthAuthorization.lastUsedAt,
    revoked_at: serviceAccountCredential.oauthAuthorization.revokedAt,
    created_at: serviceAccountCredential.createdAt,
    updated_at: serviceAccountCredential.oauthAuthorization.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('machine_access.service_account_credential'),
      id: v.string(),
      status: v.enumOf(['active', 'revoked']),
      service_account_id: v.string(),
      scopes: v.array(
        v.object({
          identifier: v.string(),
          name: v.string(),
          description: v.string()
        })
      ),
      machine_access: v1MachineAccessPresenter.schema,
      last_used_at: v.nullable(v.date()),
      revoked_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
