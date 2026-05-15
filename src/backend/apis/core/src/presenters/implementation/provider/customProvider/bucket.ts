import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { bucketType } from '../../../types';
import { v1ScmRepoPresenter } from '../scm/repos';

export let v1BucketPresenter = Presenter.create(bucketType)
  .presenter(async ({ bucket }, opts) => ({
    object: 'bucket' as const,

    id: bucket.id,

    is_immutable: bucket.isImmutable,
    is_read_only: bucket.isReadOnly,

    scm_repo_link: bucket.scmRepoLink
      ? {
          object: 'bucket.scm_repo' as const,
          is_linked: true as const,
          path: bucket.scmRepoLink.path,
          repository: await v1ScmRepoPresenter
            .present({ scmRepo: bucket.scmRepoLink.repository }, opts)
            .run()
        }
      : null,

    created_at: bucket.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('bucket', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique bucket identifier'
      }),
      is_immutable: v.boolean({
        name: 'is_immutable',
        description: 'Whether the bucket is immutable'
      }),
      is_read_only: v.boolean({
        name: 'is_read_only',
        description: 'Whether the bucket is read-only'
      }),
      scm_repo_link: v.nullable(
        v.object({
          object: v.literal('bucket.scm_repo'),
          is_linked: v.literal(true),
          path: v.nullable(
            v.string({
              name: 'path',
              description: 'Path within the SCM repository'
            })
          ),
          repository: v1ScmRepoPresenter.schema
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created'
      })
    })
  )
  .build();
