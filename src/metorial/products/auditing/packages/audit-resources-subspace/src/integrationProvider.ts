import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';
import type { SubspaceProviderSummary } from './_shared';

export let integrationProviderAuditResource = resource({
  name: 'integration_provider',
  payload: v.typedAny<{
    id: string;
    status: string;
    integration: { id: string; name: string };
    provider: SubspaceProviderSummary;
    currentVersionId: string | null;
  }>('integration_provider'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let integrationInstanceGroupAuditResource = resource({
  name: 'integration_instance_group',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string;
    description: string | null;
    isMagicMcpBacking: boolean;
    identityId: string | null;
    identityActorId: string | null;
    archivedAt: Date | null;
  }>('integration_instance_group'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let integrationInstanceProviderAuditResource = resource({
  name: 'integration_instance_provider',
  payload: v.typedAny<{
    id: string;
    status: string;
    integrationId: string | null;
    integrationInstanceId: string | null;
    integrationProviderId: string | null;
    provider: SubspaceProviderSummary | null;
  }>('integration_instance_provider'),
  presenter: undefined,
  actions: {
    set: true
  }
});

export let integrationInstanceGroupProviderAuditResource = resource({
  name: 'integration_instance_group_provider',
  payload: v.typedAny<{
    id: string;
    status: string;
    integrationId: string | null;
    integrationInstanceGroupId: string | null;
    integrationProviderId: string | null;
    provider: SubspaceProviderSummary | null;
  }>('integration_instance_group_provider'),
  presenter: undefined,
  actions: {
    set: true,
    delete: true
  }
});

export let integrationSetupSessionAuditResource = resource({
  name: 'integration_setup_session',
  payload: v.typedAny<{
    id: string;
    status: string;
    integration: { id: string; name: string } | null;
  }>('integration_setup_session'),
  presenter: undefined,
  actions: {
    create: true
  }
});
