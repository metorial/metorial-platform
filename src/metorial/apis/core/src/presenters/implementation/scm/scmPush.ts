import { shadowId } from '@lowerdeck/shadow-id';
import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { scmPushType } from '../../types';
import { v1ScmRepoPresenter } from './repos';

export let v1ScmPushPresenter = Presenter.create(scmPushType)
  .presenter(async ({ scmPush }, opts) => ({
    object: 'scm.push' as const,

    id: scmPush.id,

    actor: {
      object: 'scm.actor' as const,
      id: shadowId(
        'spco_',
        [scmPush.repo.id],
        [scmPush.senderIdentifier ?? scmPush.pusherEmail ?? scmPush.id]
      ),
      external_id: scmPush.senderIdentifier,
      name: scmPush.pusherName,
      email: scmPush.pusherEmail
    },

    commit: {
      object: 'scm.commit' as const,
      id: shadowId('spco_', [scmPush.id], [scmPush.sha]),
      sha: scmPush.sha,
      branch: scmPush.branchName,
      message: scmPush.commitMessage,
      created_at: scmPush.createdAt
    },

    repository: await v1ScmRepoPresenter.present({ scmRepo: scmPush.repo }, opts).run(),

    created_at: scmPush.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.push', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique SCM push identifier'
      }),
      actor: v.object({
        object: v.literal('scm.actor'),
        id: v.string({ description: 'Actor identifier' }),
        external_id: v.nullable(v.string({ description: 'External actor identifier' })),
        name: v.nullable(v.string({ description: 'Actor name' })),
        email: v.nullable(v.string({ description: 'Actor email' }))
      }),
      commit: v.object({
        object: v.literal('scm.commit'),
        id: v.string({ description: 'Commit identifier' }),
        sha: v.string({ description: 'Commit SHA' }),
        branch: v.string({ description: 'Branch name' }),
        message: v.nullable(v.string({ description: 'Commit message' })),
        created_at: v.date({ description: 'Timestamp when commit was created' })
      }),
      repository: v1ScmRepoPresenter.schema,
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created'
      })
    })
  )
  .build();
