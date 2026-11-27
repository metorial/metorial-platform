import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { accessRoleType } from '../../types';

export let v1AccessRolePresenter = Presenter.create(accessRoleType)
  .presenter(async ({ accessRole }) => ({
    object: 'management.access_role',
    id: accessRole.id,
    organization_id: accessRole.organization.id,
    name: accessRole.name,
    slug: accessRole.slug,
    description: accessRole.description,
    is_admin: accessRole.isAdmin,
    scopes: accessRole.scopes,
    created_at: accessRole.createdAt,
    updated_at: accessRole.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('management.access_role'),
      id: v.string(),
      organization_id: v.string(),
      name: v.string(),
      slug: v.string(),
      description: v.nullable(v.string()),
      is_admin: v.boolean(),
      scopes: v.array(v.string()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
