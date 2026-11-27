import { v } from '@lowerdeck/validation';
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

    sub_delegation_behavior:
      identityDelegationConfig.currentVersion?.subDelegationBehavior ?? 'deny',
    sub_delegation_depth: identityDelegationConfig.currentVersion?.subDelegationDepth ?? 0,

    created_at: identityDelegationConfig.createdAt,
    updated_at: identityDelegationConfig.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('identity.delegation_config', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['idc_2mNpQrStUvWxYzAb']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description:
          'Current lifecycle status of the delegation config. `archived` once you archive the config.'
      }),
      is_default: v.boolean({
        name: 'is_default',
        description: 'Delegations use this config when none is specified.'
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name.',
          examples: ['Default External Sharing Policy']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Allows one level of reviewed sub-delegation']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.',
          examples: [{ team: 'security', policy_version: '2026-02' }]
        })
      ),
      sub_delegation_behavior: v.enumOf(['allow', 'deny', 'require_consent'], {
        name: 'sub_delegation_behavior',
        description:
          'Whether delegates can delegate further. `require_consent` asks the owner for approval first.'
      }),
      sub_delegation_depth: v.number({
        name: 'sub_delegation_depth',
        description: 'Maximum sub-delegation depth. `0` blocks sub-delegation.',
        examples: [1]
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2026-02-03T10:15:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-02-10T14:30:00Z')]
      })
    })
  )
  .build();
