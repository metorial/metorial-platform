import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';

export let customProviderAuditResource = resource({
  name: 'custom_provider',
  payload: v.typedAny<{
    id: string;
    type: string;
    status: string;
    name: string;
    description: string | null;
    providerId: string | null;
    maxVersionIndex: number;
  }>('custom_provider'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let customProviderVersionAuditResource = resource({
  name: 'custom_provider_version',
  payload: v.typedAny<{
    id: string;
    status: string;
    versionIndex: number;
    versionIdentifier: string;
    customProvider: { id: string; name: string };
  }>('custom_provider_version'),
  presenter: undefined,
  actions: {
    create: true
  }
});

export let customProviderCommitAuditResource = resource({
  name: 'custom_provider_commit',
  payload: v.typedAny<{
    id: string;
    status: string;
    type: string;
    trigger: string;
    message: string | null;
    errorCode: string | null;
    customProvider: { id: string; name: string };
    fromEnvironment: { id: string; branchName: string | null } | null;
    toEnvironment: { id: string; branchName: string | null } | null;
  }>('custom_provider_commit'),
  presenter: undefined,
  actions: {
    create: true
  }
});

export let scmRepositoryAuditResource = resource({
  name: 'scm_repository',
  payload: v.typedAny<{
    id: string;
    provider: string;
    name: string;
    identifier: string;
    externalId: string;
    externalName: string;
    externalOwner: string;
    externalUrl: string;
    externalIsPrivate: boolean;
    defaultBranch: string;
    customProvider: { id: string; name: string } | null;
  }>('scm_repository'),
  presenter: undefined,
  actions: {
    create: true,
    link: true
  }
});
