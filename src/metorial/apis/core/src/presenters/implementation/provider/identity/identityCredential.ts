import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { identityCredentialType } from '../../../types';

export let v1IdentityCredentialPresenter = Presenter.create(identityCredentialType)
  .presenter(async ({ identityCredential }) => ({
    object: 'identity.credential' as const,

    id: identityCredential.id,
    status: identityCredential.status,

    identity_id: identityCredential.identityId,
    provider_id: identityCredential.providerId,

    deployment_id: identityCredential.deploymentId,
    config_id: identityCredential.configId,
    auth_config_id: identityCredential.authConfigId,

    delegation_config_id: identityCredential.delegationConfigId,

    created_at: identityCredential.createdAt,
    updated_at: identityCredential.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('identity.credential', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique identity credential identifier.',
        examples: ['icr_8vBnM4xZa2cDf7gH']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Current lifecycle status of the credential.'
      }),
      identity_id: v.string({
        name: 'identity_id',
        description: 'Identity that owns this credential.',
        examples: ['idn_5gHjKlMnPqRsTuVw']
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider associated with the credential.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      deployment_id: v.nullable(
        v.string({
          name: 'deployment_id',
          description: 'Provider deployment used by this credential.',
          examples: ['pdp_4dEfGhJkLmNpQrSt']
        })
      ),
      config_id: v.nullable(
        v.string({
          name: 'config_id',
          description: 'Provider config used by this credential.',
          examples: ['pcf_7dEfGhJkLmNpQrSt']
        })
      ),
      auth_config_id: v.nullable(
        v.string({
          name: 'auth_config_id',
          description: 'Provider auth config used by this credential.',
          examples: ['pac_3nOpRsTuVwXyZaBc']
        })
      ),
      delegation_config_id: v.nullable(
        v.string({
          name: 'delegation_config_id',
          description: 'Delegation config applied to this credential.',
          examples: ['idc_2mNpQrStUvWxYzAb']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the credential was created.',
        examples: [new Date('2026-02-03T10:15:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the credential was last updated.',
        examples: [new Date('2026-02-10T14:30:00Z')]
      })
    })
  )
  .build();
