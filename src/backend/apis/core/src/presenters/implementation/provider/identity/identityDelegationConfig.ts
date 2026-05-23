import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { identityDelegationConfigType } from '../../../types';

export let v1IdentityDelegationConfigPresenter = Presenter.create(identityDelegationConfigType)
  .presenter(async ({ identityDelegationConfig }) => ({
    object: 'identity.delegation_config' as const,

    id: identityDelegationConfig.id,
    status: identityDelegationConfig.status,

    is_default: identityDelegationConfig.isDefault,

    name: identityDelegationConfig.name,
    description: identityDelegationConfig.description,
    metadata: identityDelegationConfig.metadata,

    sub_delegation_behavior: identityDelegationConfig.subDelegationBehavior,
    sub_delegation_depth: identityDelegationConfig.subDelegationDepth,

    created_at: identityDelegationConfig.createdAt,
    updated_at: identityDelegationConfig.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('identity.delegation_config', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique delegation config identifier.',
        examples: ['idc_2mNpQrStUvWxYzAb']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Current lifecycle status of the delegation config.'
      }),
      is_default: v.boolean({
        name: 'is_default',
        description: 'Whether this config is the default config for the environment.'
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Human-readable name of the delegation config.',
          examples: ['Default External Sharing Policy']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Optional description of the delegation policy.',
          examples: ['Allows one level of reviewed sub-delegation']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Additional metadata associated with the delegation config.',
          examples: [{ team: 'security', policy_version: '2026-02' }]
        })
      ),
      sub_delegation_behavior: v.enumOf(['allow', 'deny', 'require_consent'], {
        name: 'sub_delegation_behavior',
        description: 'How this config handles sub-delegation requests.'
      }),
      sub_delegation_depth: v.number({
        name: 'sub_delegation_depth',
        description: 'Maximum allowed sub-delegation depth for this policy.',
        examples: [1]
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the delegation config was created.',
        examples: [new Date('2026-02-03T10:15:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the delegation config was last updated.',
        examples: [new Date('2026-02-10T14:30:00Z')]
      })
    })
  )
  .build();
