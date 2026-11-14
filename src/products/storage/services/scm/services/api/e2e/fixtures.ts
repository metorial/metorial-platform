import { uniqueId } from '@lowerdeck/testing-tools';
import type {
  ChangeNotificationType,
  ScmRepositoryAccessMode,
  ScmRepositorySyncStatus
} from '../prisma/generated/client';
import { db } from '../src/db';
import { getId, ID } from '../src/id';
import { origin } from './client';

export let createTenant = async (name = 'Test Tenant') => {
  let presented = await origin.tenant.upsert({ identifier: uniqueId('tenant'), name });
  return db.tenant.findUniqueOrThrow({ where: { id: presented.id } });
};

export let createActor = async (name = 'Test Actor') => {
  let presented = await origin.actor.upsert({ identifier: uniqueId('actor'), name });
  return db.actor.findUniqueOrThrow({ where: { id: presented.id } });
};

export let createBackend = (tenantId: string, input: Record<string, unknown> = {}) =>
  origin.scmBackend.create({
    tenantId,
    type: 'gitlab_selfhosted',
    name: uniqueId('backend'),
    apiUrl: 'https://gitlab.example.test/api/v4',
    webUrl: 'https://gitlab.example.test',
    clientId: uniqueId('client'),
    clientSecret: uniqueId('secret'),
    ...input
  });

export let createInstallation = async (input: {
  tenantOid: bigint;
  actorOid: bigint;
  backendOid: bigint;
  accountLogin?: string;
}) => {
  let login = input.accountLogin ?? uniqueId('account');

  return db.scmInstallation.create({
    data: {
      ...getId('scmInstallation'),
      provider: 'gitlab',
      backendOid: input.backendOid,
      ownerActorOid: input.actorOid,
      tenantOid: input.tenantOid,
      externalAccountId: login,
      externalAccountLogin: login,
      externalAccountName: 'Account Name',
      accessToken: 'secret-access-token',
      refreshToken: 'secret-refresh-token'
    }
  });
};

export let createRepoSetup = async () => {
  let tenant = await createTenant();
  let actor = await createActor();
  let backendPresented = await createBackend(tenant.id);
  let backend = await db.scmBackend.findUniqueOrThrow({ where: { id: backendPresented.id } });

  let installation = await createInstallation({
    tenantOid: tenant.oid,
    actorOid: actor.oid,
    backendOid: backend.oid
  });

  let account = await db.scmAccount.create({
    data: {
      ...getId('scmAccount'),
      provider: 'gitlab',
      type: 'organization',
      name: 'Account',
      identifier: installation.externalAccountLogin,
      externalId: installation.externalAccountId,
      backendOid: backend.oid,
      tenantOid: tenant.oid
    }
  });

  let repo = await createRepository({ tenant, backend, installation, account });

  return { tenant, actor, backend, installation, account, repo };
};

export let createRepository = async (input: {
  tenant: { oid: bigint };
  backend: { oid: bigint };
  installation: { oid: bigint };
  account: { oid: bigint };
  name?: string;
  defaultBranch?: string;
}) => {
  let name = input.name ?? uniqueId('repo');

  return db.scmRepository.create({
    data: {
      ...getId('scmRepository'),
      provider: 'gitlab',
      name,
      identifier: `owner/${name}`,
      externalId: uniqueId('ext'),
      externalName: name,
      externalOwner: 'owner',
      externalUrl: `https://gitlab.example.test/owner/${name}`,
      externalIsPrivate: true,
      defaultBranch: input.defaultBranch ?? 'main',
      backendOid: input.backend.oid,
      accountOid: input.account.oid,
      tenantOid: input.tenant.oid,
      installationOid: input.installation.oid
    },
    include: { account: true }
  });
};

export let createDbCodeBucket = async (input: {
  tenantOid: bigint;
  repositoryOid?: bigint;
  isSynced?: boolean;
  isReadOnly?: boolean;
}) => {
  let identifier = uniqueId('purpose');
  let purpose = await db.codeBucketPurpose.create({
    data: { ...getId('codeBucketPurpose'), identifier }
  });

  return db.codeBucket.create({
    data: {
      ...getId('codeBucket'),
      tenantOid: input.tenantOid,
      purposeOid: purpose.oid,
      repositoryOid: input.repositoryOid,
      isSynced: input.isSynced ?? false,
      isReadOnly: input.isReadOnly ?? false
    }
  });
};

export let createPush = (input: { tenantOid: bigint; repoOid: bigint; branchName?: string }) =>
  db.scmRepositoryPush.create({
    data: {
      ...getId('scmRepositoryPush'),
      tenantOid: input.tenantOid,
      repoOid: input.repoOid,
      branchName: input.branchName ?? 'main',
      sha: uniqueId('sha'),
      pusherName: 'Pusher',
      pusherEmail: 'pusher@example.test',
      commitMessage: 'A commit'
    }
  });

export let createSync = async (input: {
  tenantOid: bigint;
  repoOid: bigint;
  codeBucketOid: bigint;
  status?: ScmRepositorySyncStatus;
  repositoryAccessMode?: ScmRepositoryAccessMode;
}) =>
  db.scmRepositorySync.create({
    data: {
      ...getId('scmRepositorySync'),
      tenantOid: input.tenantOid,
      repoOid: input.repoOid,
      codeBucketOid: input.codeBucketOid,
      status: input.status ?? 'complete_no_changes',
      repositoryAccessMode: input.repositoryAccessMode ?? 'pull_request',
      branchName: uniqueId('branch'),
      baseBranch: 'main',
      title: 'Sync'
    }
  });

export let createChangeNotification = (input: {
  tenantOid: bigint;
  repoOid: bigint;
  type?: ChangeNotificationType;
  repoPushOid?: bigint;
  repositorySyncOid?: bigint;
}) =>
  db.changeNotification.create({
    data: {
      id: ID.generateIdSync('changeNotification'),
      type: input.type ?? 'repository_sync_status_changed',
      tenantOid: input.tenantOid,
      repoOid: input.repoOid,
      repoPushOid: input.repoPushOid,
      repositorySyncOid: input.repositorySyncOid
    }
  });
