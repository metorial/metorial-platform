import {
  Fabric,
  type AuditSubspaceCodeBucketFile,
  type AuditSubspaceCustomProvider,
  type AuditSubspaceCustomProviderCommit,
  type AuditSubspaceCustomProviderVersion,
  type AuditSubspaceScmRepo,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { getSubspaceAuditScope, recordSubspaceAuditEvent } from './_shared';

let customProviderPayload = (customProvider: AuditSubspaceCustomProvider) => ({
  id: customProvider.id,
  type: customProvider.type,
  status: customProvider.status,
  name: customProvider.name,
  description: customProvider.description,
  providerId: customProvider.provider?.id ?? null,
  maxVersionIndex: customProvider.maxVersionIndex
});

let versionPayload = (version: AuditSubspaceCustomProviderVersion) => ({
  id: version.id,
  status: version.status,
  versionIndex: version.versionIndex,
  versionIdentifier: version.versionIdentifier,
  customProvider: { id: version.customProvider.id, name: version.customProvider.name }
});

let commitPayload = (commit: AuditSubspaceCustomProviderCommit) => ({
  id: commit.id,
  status: commit.status,
  type: commit.type,
  trigger: commit.trigger,
  message: commit.message,
  errorCode: commit.errorCode,
  customProvider: { id: commit.customProvider.id, name: commit.customProvider.name },
  fromEnvironment: commit.fromEnvironment
    ? { id: commit.fromEnvironment.id, branchName: commit.fromEnvironment.branchName }
    : null,
  toEnvironment: commit.toEnvironment
    ? { id: commit.toEnvironment.id, branchName: commit.toEnvironment.branchName }
    : null
});

let scmRepositoryPayload = (
  repository: AuditSubspaceScmRepo,
  customProvider: { id: string; name: string } | null = null
) => ({
  id: repository.id,
  provider: repository.provider,
  name: repository.name,
  identifier: repository.identifier,
  externalId: repository.externalId,
  externalName: repository.externalName,
  externalOwner: repository.externalOwner,
  externalUrl: repository.externalUrl,
  externalIsPrivate: repository.externalIsPrivate,
  defaultBranch: repository.defaultBranch,
  customProvider
});

let codeBucketFilePayload = (file: AuditSubspaceCodeBucketFile) => ({
  bucketId: file.bucket.id,
  filename: file.filename,
  byteSize: file.byteSize
});

export let recordCustomProviderCreated = async (
  event: FabricEvents['provider.custom_provider.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'custom_provider', 'create', {
      payload: customProviderPayload(event.customProvider)
    })
  );
};

export let recordCustomProviderUpdated = async (
  event: FabricEvents['provider.custom_provider.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'custom_provider', 'update', {
      payload: customProviderPayload(event.customProvider),
      previousPayload: customProviderPayload(event.previousCustomProvider)
    })
  );
};

export let recordCustomProviderArchived = async (
  event: FabricEvents['provider.custom_provider.archived:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'custom_provider', 'delete', {
      payload: customProviderPayload(event.customProvider)
    })
  );
};

export let recordCustomProviderVersionCreated = async (
  event: FabricEvents['provider.custom_provider.version.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'custom_provider_version', 'create', {
      payload: versionPayload(event.customProviderVersion)
    })
  );
};

export let recordCustomProviderCommitCreated = async (
  event: FabricEvents['provider.custom_provider.commit.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'custom_provider_commit', 'create', {
      payload: commitPayload(event.customProviderCommit)
    })
  );
};

export let recordScmRepositoryCreated = async (
  event: FabricEvents['provider.scm_repository.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'scm_repository', 'create', {
      payload: scmRepositoryPayload(event.scmRepository)
    })
  );
};

export let recordScmRepositoryLinked = async (
  event: FabricEvents['provider.scm_repository.linked:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'scm_repository', 'link', {
      payload: scmRepositoryPayload(
        event.scmRepository,
        event.customProvider
          ? { id: event.customProvider.id, name: event.customProvider.name }
          : null
      )
    })
  );
};

Fabric.listen('provider.custom_provider.created:after', recordCustomProviderCreated);
Fabric.listen('provider.custom_provider.updated:after', recordCustomProviderUpdated);
Fabric.listen('provider.custom_provider.archived:after', recordCustomProviderArchived);
Fabric.listen(
  'provider.custom_provider.version.created:after',
  recordCustomProviderVersionCreated
);
Fabric.listen(
  'provider.custom_provider.commit.created:after',
  recordCustomProviderCommitCreated
);

Fabric.listen('provider.scm_repository.created:after', recordScmRepositoryCreated);
Fabric.listen('provider.scm_repository.linked:after', recordScmRepositoryLinked);
