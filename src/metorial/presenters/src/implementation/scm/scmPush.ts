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
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.'
      }),
      actor: v.object(
        {
          object: v.literal('scm.actor', {
            description: 'String representing the object’s type.'
          }),
          id: v.string({ description: 'Stable ID for the actor.' }),
          external_id: v.nullable(
            v.string({ description: 'ID of the actor on the provider.' })
          ),
          name: v.nullable(v.string({ description: 'Name of the actor.' })),
          email: v.nullable(v.string({ description: 'Email of the actor.' }))
        },
        { description: 'Actor that pushed.' }
      ),
      commit: v.object(
        {
          object: v.literal('scm.commit', {
            description: 'String representing the object’s type.'
          }),
          id: v.string({ description: 'Unique ID.' }),
          sha: v.string({ description: 'SHA hash of the commit.' }),
          branch: v.string({ description: 'Branch the commit was pushed to.' }),
          message: v.nullable(v.string({ description: 'Full message of the commit.' })),
          created_at: v.date({ description: 'Creation time.' })
        },
        { description: 'Commit that was pushed.' }
      ),
      repository: v1ScmRepoPresenter.schema,
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.'
      })
    })
  )
  .build();
