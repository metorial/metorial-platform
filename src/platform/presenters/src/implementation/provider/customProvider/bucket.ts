import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { bucketType } from '../../../types';
import { v1ScmRepoPresenter } from '../../scm';

export let v1BucketPresenter = Presenter.create(bucketType)
  .presenter(async ({ bucket }, opts) => {
    return {
      object: 'bucket' as const,

      id: bucket.id,

      is_immutable: bucket.isImmutable,
      is_read_only: bucket.isReadOnly,

      scm_repo_link: bucket.scmRepo
        ? {
            object: 'bucket.scm_repo' as const,
            is_linked: true as const,
            path: bucket.scmRepoPath ?? null,
            repository: await v1ScmRepoPresenter
              .present({ scmRepo: bucket.scmRepo }, opts)
              .run()
          }
        : null,

      created_at: bucket.createdAt
    };
  })
  .schema(
    v.object({
      object: v.literal('bucket', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.'
      }),
      is_immutable: v.boolean({
        name: 'is_immutable',
        description: '`true` when the bucket contents can no longer change.'
      }),
      is_read_only: v.boolean({
        name: 'is_read_only',
        description: '`true` when the bucket cannot be written to.'
      }),
      scm_repo_link: v.nullable(
        v.object(
          {
            object: v.literal('bucket.scm_repo', {
              description: 'String representing the object’s type.'
            }),
            is_linked: v.literal(true, {
              description: '`true` when the bucket is linked to a repository.'
            }),
            path: v.nullable(
              v.string({
                name: 'path',
                description: 'Path within the repository the bucket syncs.'
              })
            ),
            repository: v1ScmRepoPresenter.schema
          },
          { description: 'Repository this bucket syncs with. `null` when not linked.' }
        )
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.'
      })
    })
  )
  .build();
