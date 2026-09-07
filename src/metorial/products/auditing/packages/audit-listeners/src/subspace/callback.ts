import {
  Fabric,
  type AuditSubspaceCallback,
  type AuditSubspaceWebhookRegistration,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { getSubspaceAuditScope, recordSubspaceAuditEvent } from './_shared';

let callbackPayload = (callback: AuditSubspaceCallback) => ({
  id: callback.id,
  status: callback.status,
  name: callback.name,
  description: callback.description,
  integrationId: callback.integration.id,
  integrationProviderId: callback.integrationProvider.id,
  provider: {
    id: callback.provider.id,
    name: callback.provider.name
  }
});

export let recordCallbackUpdated = async (
  event: FabricEvents['provider.callback.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'callback', 'update', {
      payload: callbackPayload(event.callback),
      previousPayload: callbackPayload(event.previousCallback)
    })
  );
};

Fabric.listen('provider.callback.updated:after', recordCallbackUpdated);

let webhookRegistrationPayload = (webhookRegistration: AuditSubspaceWebhookRegistration) => ({
  id: webhookRegistration.id,
  status: webhookRegistration.status,
  name: webhookRegistration.name,
  description: webhookRegistration.description,
  metadata: webhookRegistration.metadata,
  isSetupComplete: webhookRegistration.isSetupComplete,
  provider: {
    id: webhookRegistration.provider.id,
    name: webhookRegistration.provider.name
  },
  archivedAt: webhookRegistration.archivedAt
});

export let recordWebhookRegistrationCreated = async (
  event: FabricEvents['provider.webhook_registration.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'webhook_registration', 'create', {
      payload: webhookRegistrationPayload(event.webhookRegistration)
    })
  );
};

export let recordWebhookRegistrationSetupCompleted = async (
  event: FabricEvents['provider.webhook_registration.setup_completed:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'webhook_registration', 'update', {
      payload: webhookRegistrationPayload(event.webhookRegistration)
    })
  );
};

export let recordWebhookRegistrationUpdated = async (
  event: FabricEvents['provider.webhook_registration.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'webhook_registration', 'update', {
      payload: webhookRegistrationPayload(event.webhookRegistration),
      previousPayload: webhookRegistrationPayload(event.previousWebhookRegistration)
    })
  );
};

export let recordWebhookRegistrationArchived = async (
  event: FabricEvents['provider.webhook_registration.archived:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'webhook_registration', 'delete', {
      payload: webhookRegistrationPayload(event.webhookRegistration)
    })
  );
};

Fabric.listen('provider.webhook_registration.created:after', recordWebhookRegistrationCreated);
Fabric.listen(
  'provider.webhook_registration.setup_completed:after',
  recordWebhookRegistrationSetupCompleted
);
Fabric.listen('provider.webhook_registration.updated:after', recordWebhookRegistrationUpdated);
Fabric.listen(
  'provider.webhook_registration.archived:after',
  recordWebhookRegistrationArchived
);
