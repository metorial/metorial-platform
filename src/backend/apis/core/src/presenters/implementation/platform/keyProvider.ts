import { v } from '@lowerdeck/validation';
import type {
  NebulaKeyProvider,
  NebulaKeyProviderError,
  NebulaKeyProviderSetupInfo,
  NebulaKeyProviderValidation
} from '@metorial/module-secrets';
import { Presenter } from '@metorial/presenter';
import {
  keyProviderErrorType,
  keyProviderSetupInfoType,
  keyProviderType,
  keyProviderValidationType
} from '../../types';

let setupInfoStepSchema = v.object({
  title: v.string(),
  description: v.string(),
  markdown: v.optional(v.string()),
  inputs: v.optional(
    v.array(
      v.object({
        type: v.enumOf(['text', 'json']),
        key: v.string(),
        label: v.string(),
        description: v.string()
      })
    )
  )
});

export let v1KeyProviderPresenter = Presenter.create(keyProviderType)
  .presenter(async ({ keyProvider }: { keyProvider: NebulaKeyProvider }) => ({
    object: 'key_provider',
    id: keyProvider.id,
    name: keyProvider.name,
    type: keyProvider.type,
    owner: keyProvider.owner,
    status: keyProvider.status,
    is_metorial_managed: keyProvider.isMetorialManaged,
    key_reuse_time_seconds: keyProvider.keyReuseTimeSeconds,
    key_info: keyProvider.keyInfo as any,
    is_default: keyProvider.isDefault ?? false,
    created_at: keyProvider.createdAt,
    updated_at: keyProvider.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('key_provider'),
      id: v.string(),
      name: v.string(),
      type: v.enumOf(['aws_kms', 'local']),
      owner: v.enumOf(['tenant', 'system']),
      status: v.enumOf(['active', 'inactive', 'degraded']),
      is_metorial_managed: v.boolean(),
      key_reuse_time_seconds: v.nullable(v.number()),
      key_info: v.record(v.any()),
      is_default: v.boolean(),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1KeyProviderErrorPresenter = Presenter.create(keyProviderErrorType)
  .presenter(async ({ keyProviderError }: { keyProviderError: NebulaKeyProviderError }) => ({
    object: 'key_provider_error',
    id: keyProviderError.id,
    day: keyProviderError.day,
    operation: keyProviderError.operation,
    code: keyProviderError.code,
    count: keyProviderError.count,
    sample_message: keyProviderError.sampleMessage,
    first_seen_at: keyProviderError.firstSeenAt,
    last_seen_at: keyProviderError.lastSeenAt
  }))
  .schema(
    v.object({
      object: v.literal('key_provider_error'),
      id: v.string(),
      day: v.date(),
      operation: v.enumOf([
        'create_system_provider',
        'validate_provider',
        'generate_data_key',
        'decrypt_data_key'
      ]),
      code: v.string(),
      count: v.number(),
      sample_message: v.nullable(v.string()),
      first_seen_at: v.date(),
      last_seen_at: v.date()
    })
  )
  .build();

export let v1KeyProviderSetupInfoPresenter = Presenter.create(keyProviderSetupInfoType)
  .presenter(async ({ setupInfo }: { setupInfo: NebulaKeyProviderSetupInfo }) => ({
    object: 'key_provider_setup_info',
    steps: setupInfo.steps
  }))
  .schema(
    v.object({
      object: v.literal('key_provider_setup_info'),
      steps: v.array(setupInfoStepSchema)
    })
  )
  .build();

export let v1KeyProviderValidationPresenter = Presenter.create(keyProviderValidationType)
  .presenter(async ({ validation }: { validation: NebulaKeyProviderValidation }) => ({
    object: 'key_provider_validation',
    key_provider_id: validation.keyProviderId,
    description: validation.description
  }))
  .schema(
    v.object({
      object: v.literal('key_provider_validation'),
      key_provider_id: v.string(),
      description: v.record(v.any())
    })
  )
  .build();
