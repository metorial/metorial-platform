import { v, ValidationType } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { organizationLayoutType } from '../../types';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

let jsonValueValidator = v.any() as ValidationType<JsonValue>;

export let v1OrganizationLayoutPresenter = Presenter.create(organizationLayoutType)
  .presenter(async ({ layout }) => ({
    object: 'organization.layout' as const,
    id: layout.id,
    layout_type_id: layout.type.id,
    identifier: layout.type.identifier,
    name: layout.type.name,
    ownership: layout.type.ownership,
    user_id: layout.user?.id ?? null,
    organization_id: layout.organization?.id ?? null,
    value: layout.value,
    created_at: layout.createdAt,
    updated_at: layout.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.layout'),
      id: v.string(),
      layout_type_id: v.string(),
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
