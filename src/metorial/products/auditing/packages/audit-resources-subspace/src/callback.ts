import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';
import type { SubspaceProviderSummary } from './_shared';

/**
 * A webhook receiver a tenant registered on a provider. `receiveUrl` and the provider's setup
 * document are omitted: the URL is the shared secret that authenticates inbound webhooks, and
 * the setup document embeds it.
 */
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
