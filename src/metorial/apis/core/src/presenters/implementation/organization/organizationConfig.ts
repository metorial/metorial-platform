import { v, ValidationType } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { organizationConfigType } from '../../types';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

let jsonValueValidator = v.any() as ValidationType<JsonValue>;

export let v1OrganizationConfigPresenter = Presenter.create(organizationConfigType)
  .presenter(async ({ config }) => ({
    object: 'organization.config' as const,
    id: config.id,
    config_type_id: config.type.id,
    identifier: config.type.identifier,
    name: config.type.name,
    ownership: config.type.ownership,
    user_id: config.user?.id ?? null,
    organization_id: config.organization?.id ?? null,
    value: config.value,
    created_at: config.createdAt,
    updated_at: config.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.config'),
      id: v.string(),
      config_type_id: v.string(),
      identifier: v.string(),
      name: v.string(),
      ownership: v.enumOf(['user', 'organization', 'user_organization']),
      user_id: v.nullable(v.string()),
      organization_id: v.nullable(v.string()),
      value: jsonValueValidator,
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
