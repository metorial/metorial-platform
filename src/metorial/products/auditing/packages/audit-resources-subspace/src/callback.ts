import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';
import type { SubspaceProviderSummary } from './_shared';

export let callbackAuditResource = resource({
  name: 'callback',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string;
    description: string | null;
    integrationId: string;
    integrationProviderId: string;
    provider: SubspaceProviderSummary;
  }>('callback'),
  presenter: undefined,
  actions: {
    update: true
  }
});

export let webhookRegistrationAuditResource = resource({
  name: 'webhook_registration',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string;
    description: string | null;
    metadata: unknown;
    isSetupComplete: boolean;
    provider: SubspaceProviderSummary;
    archivedAt: Date | null;
  }>('webhook_registration'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
