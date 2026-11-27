import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { accessPolicyVersionType } from '../../types';

export let v1AccessPolicyVersionPresenter = Presenter.create(accessPolicyVersionType)
  .presenter(async ({ accessPolicyVersion }) => ({
    object: 'management.access_policy_version',
    id: accessPolicyVersion.id,
    access_policy_id: accessPolicyVersion.accessPolicy.id,
    index: accessPolicyVersion.index,
    message: accessPolicyVersion.message,
    document: accessPolicyVersion.document,
    created_at: accessPolicyVersion.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('management.access_policy_version'),
      id: v.string(),
      access_policy_id: v.string(),
      index: v.number(),
      message: v.nullable(v.string()),
      document: v.object({
        access: v.array(
          v.object({
            target: v.string(),
            scopes: v.optional(v.array(v.string())),
            roles: v.optional(v.array(v.string()))
          })
        )
      }),
      created_at: v.date()
    })
  )
  .build();
