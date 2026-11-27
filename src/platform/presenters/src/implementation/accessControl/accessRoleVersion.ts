import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { accessRoleVersionType } from '../../types';

export let v1AccessRoleVersionPresenter = Presenter.create(accessRoleVersionType)
  .presenter(async ({ accessRoleVersion }) => ({
    object: 'management.access_role_version',
    id: accessRoleVersion.id,
    access_role_id: accessRoleVersion.accessRole.id,
    index: accessRoleVersion.index,
    scopes: accessRoleVersion.scopes,
    scopes_added: accessRoleVersion.scopesAdded,
    scopes_removed: accessRoleVersion.scopesRemoved,
    message: accessRoleVersion.message,
    created_at: accessRoleVersion.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('management.access_role_version'),
      id: v.string(),
      access_role_id: v.string(),
      index: v.number(),
      scopes: v.array(v.string()),
      scopes_added: v.array(v.string()),
      scopes_removed: v.array(v.string()),
      message: v.nullable(v.string()),
      created_at: v.date()
    })
  )
  .build();
