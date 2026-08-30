import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';
import type { SubspaceProviderSummary } from './_shared';

export let providerDeploymentAuditResource = resource({
  name: 'provider_deployment',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string | null;
    description: string | null;
    isDefault: boolean;
    isEphemeral: boolean;
    provider: SubspaceProviderSummary;
    toolFilter: unknown;
    archivedAt: Date | null;
  }>('provider_deployment'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let providerConfigAuditResource = resource({
  name: 'provider_config',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string | null;
    description: string | null;
    isDefault: boolean;
    isEphemeral: boolean;
    isForVault: boolean;
    provider: SubspaceProviderSummary;
    deploymentId: string | null;
    toolFilter: unknown;
    archivedAt: Date | null;
  }>('provider_config'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let providerConfigVaultAuditResource = resource({
  name: 'provider_config_vault',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string;
    description: string | null;
    archivedAt: Date | null;
  }>('provider_config_vault'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
