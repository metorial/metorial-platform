import { shadowId } from '@lowerdeck/shadow-id';
import type { ScmRepo, ScmRepoPush } from '@metorial-subspace/db';
import { scmRepositoryPresenter } from './scmRepository';

export let scmPushPresenter = (
  scmPush: ScmRepoPush & {
    repo: ScmRepo;
  }
) => ({
  object: 'scm.push',

  id: scmPush.id,

  actor: {
    object: 'scm.actor',

    id: shadowId(
      'spco_',
      [scmPush.repo.id],
      [scmPush.senderIdentifier ?? scmPush.pusherEmail ?? scmPush.id]
    ),

    externalId: scmPush.senderIdentifier,
    name: scmPush.pusherName,
    email: scmPush.pusherEmail
  },

  commit: {
    object: 'scm.commit',

    id: shadowId('spco_', [scmPush.id], [scmPush.sha]),

    sha: scmPush.sha,
    branch: scmPush.branchName,
    message: scmPush.commitMessage,

    createdAt: scmPush.createdAt
  },

  repository: scmRepositoryPresenter(scmPush.repo),

  createdAt: scmPush.createdAt
});
