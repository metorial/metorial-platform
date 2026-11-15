import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';
import type { SubspaceProviderSummary } from './_shared';

export type SubspaceSessionProviderSummary = {
  id: string;
  status: string;
  tag: string | null;
  provider: SubspaceProviderSummary;
  deploymentId: string | null;
  configId: string | null;
  authConfigId: string | null;
};

export let sessionAuditResource = resource({
  name: 'session',
  payload: v.typedAny<{
    id: string;
    status: string;
    isEphemeral: boolean;
    name: string | null;
    description: string | null;
    dataRetentionLevel: string;
    storeToolCallAttachments: boolean;
    collectErrors: boolean;
    identityId: string | null;
    identityActorId: string | null;
    providers: SubspaceSessionProviderSummary[];
    archivedAt: Date | null;
  }>('session'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let sessionProviderAuditResource = resource({
  name: 'session_provider',
  payload: v.typedAny<{
    id: string;
    status: string;
    tag: string;
    nameTemplate: string | null;
    isEphemeral: boolean;
    sessionId: string;
    provider: SubspaceProviderSummary;
    deploymentId: string | null;
    configId: string | null;
    authConfigId: string | null;
    toolFilter: unknown;
  }>('session_provider'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let sessionTemplateAuditResource = resource({
  name: 'session_template',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string | null;
    description: string | null;
    identityId: string | null;
    identityActorId: string | null;
    integrationInstanceId: string | null;
    integrationInstanceGroupId: string | null;
    providers: SubspaceSessionProviderSummary[];
    archivedAt: Date | null;
  }>('session_template'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let sessionTemplateProviderAuditResource = resource({
  name: 'session_template_provider',
  payload: v.typedAny<{
    id: string;
    status: string;
    sessionTemplateId: string;
    provider: SubspaceProviderSummary;
    deploymentId: string | null;
    configId: string | null;
    authConfigId: string | null;
    toolFilter: unknown;
  }>('session_template_provider'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
