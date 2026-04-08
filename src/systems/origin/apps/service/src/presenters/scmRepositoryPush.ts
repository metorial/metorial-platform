import type {
  ScmAccount,
  ScmRepository,
  ScmRepositoryPush
} from '../../prisma/generated/client';
import { repositoryPresenter } from './repository';

export let scmRepositoryPushPresenter = (
  push: ScmRepositoryPush & { repo: ScmRepository & { account: ScmAccount } }
) => ({
  object: 'origin#scmRepositoryPush',

  id: push.id,
  sha: push.sha,
  branchName: push.branchName,

  pusherName: push.pusherName,
  pusherEmail: push.pusherEmail,
  senderIdentifier: push.senderIdentifier,
  commitMessage: push.commitMessage,

  repo: push.repo ? repositoryPresenter(push.repo) : undefined,

  createdAt: push.createdAt
});
