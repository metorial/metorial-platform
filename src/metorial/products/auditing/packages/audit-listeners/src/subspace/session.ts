import {
  Fabric,
  type AuditSubspaceSession,
  type AuditSubspaceSessionProvider,
  type AuditSubspaceSessionTemplate,
  type AuditSubspaceSessionTemplateProvider,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { getSubspaceAuditScope, recordSubspaceAuditEvent } from './_shared';

let providerSummary = (
  provider: AuditSubspaceSessionProvider | AuditSubspaceSessionTemplateProvider,
  tag: string | null
) => ({
  id: provider.id,
  status: provider.status,
  tag,
  provider: { id: provider.provider.id, name: provider.provider.name },
  deploymentId: provider.deployment?.id ?? null,
  configId: provider.config?.id ?? null,
  authConfigId: provider.authConfig?.id ?? null
});

let sessionPayload = (session: AuditSubspaceSession) => ({
  id: session.id,
  status: session.status,
  isEphemeral: session.isEphemeral,
  name: session.name,
  description: session.description,
  dataRetentionLevel: session.dataRetentionLevel,
  storeToolCallAttachments: session.storeToolCallAttachments,
  collectErrors: session.collectErrors,
  identityId: session.identity?.id ?? null,
  identityActorId: session.identityActor?.id ?? null,
  providers: (session.providers ?? []).map(p => providerSummary(p, p.tag)),
  archivedAt: session.archivedAt
});

let sessionProviderPayload = (sessionProvider: AuditSubspaceSessionProvider) => ({
  id: sessionProvider.id,
  status: sessionProvider.status,
  tag: sessionProvider.tag,
  nameTemplate: sessionProvider.nameTemplate,
  isEphemeral: sessionProvider.isEphemeral,
  sessionId: sessionProvider.session.id,
  provider: { id: sessionProvider.provider.id, name: sessionProvider.provider.name },
  deploymentId: sessionProvider.deployment?.id ?? null,
  configId: sessionProvider.config?.id ?? null,
  authConfigId: sessionProvider.authConfig?.id ?? null,
  toolFilter: sessionProvider.toolFilter
});

let sessionTemplatePayload = (sessionTemplate: AuditSubspaceSessionTemplate) => ({
  id: sessionTemplate.id,
  status: sessionTemplate.status,
  name: sessionTemplate.name,
  description: sessionTemplate.description,
  identityId: sessionTemplate.identity?.id ?? null,
  identityActorId: sessionTemplate.identityActor?.id ?? null,
  integrationInstanceId: sessionTemplate.integrationInstance?.id ?? null,
  integrationInstanceGroupId: sessionTemplate.integrationInstanceGroup?.id ?? null,
  providers: (sessionTemplate.providers ?? []).map(p => providerSummary(p, null)),
  archivedAt: sessionTemplate.archivedAt
});

let sessionTemplateProviderPayload = (
  sessionTemplateProvider: AuditSubspaceSessionTemplateProvider
) => ({
  id: sessionTemplateProvider.id,
  status: sessionTemplateProvider.status,
  sessionTemplateId: sessionTemplateProvider.sessionTemplate.id,
  provider: {
    id: sessionTemplateProvider.provider.id,
    name: sessionTemplateProvider.provider.name
  },
  deploymentId: sessionTemplateProvider.deployment?.id ?? null,
  configId: sessionTemplateProvider.config?.id ?? null,
  authConfigId: sessionTemplateProvider.authConfig?.id ?? null,
  toolFilter: sessionTemplateProvider.toolFilter
});

export let recordSessionCreated = async (
  event: FabricEvents['provider.session.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session', 'create', {
      payload: sessionPayload(event.session)
    })
  );
};

export let recordSessionUpdated = async (
  event: FabricEvents['provider.session.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session', 'update', {
      payload: sessionPayload(event.session),
      previousPayload: sessionPayload(event.previousSession)
    })
  );
};

export let recordSessionDeleted = async (
  event: FabricEvents['provider.session.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session', 'delete', {
      payload: sessionPayload(event.session)
    })
  );
};

export let recordSessionProviderCreated = async (
  event: FabricEvents['provider.session.provider.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session_provider', 'create', {
      payload: sessionProviderPayload(event.sessionProvider)
    })
  );
};

export let recordSessionProviderUpdated = async (
  event: FabricEvents['provider.session.provider.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session_provider', 'update', {
      payload: sessionProviderPayload(event.sessionProvider),
      previousPayload: sessionProviderPayload(event.previousSessionProvider)
    })
  );
};

export let recordSessionProviderDeleted = async (
  event: FabricEvents['provider.session.provider.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session_provider', 'delete', {
      payload: sessionProviderPayload(event.sessionProvider)
    })
  );
};

export let recordSessionTemplateCreated = async (
  event: FabricEvents['provider.session_template.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session_template', 'create', {
      payload: sessionTemplatePayload(event.sessionTemplate)
    })
  );
};

export let recordSessionTemplateUpdated = async (
  event: FabricEvents['provider.session_template.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session_template', 'update', {
      payload: sessionTemplatePayload(event.sessionTemplate),
      previousPayload: sessionTemplatePayload(event.previousSessionTemplate)
    })
  );
};

export let recordSessionTemplateDeleted = async (
  event: FabricEvents['provider.session_template.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session_template', 'delete', {
      payload: sessionTemplatePayload(event.sessionTemplate)
    })
  );
};

export let recordSessionTemplateProviderCreated = async (
  event: FabricEvents['provider.session_template.provider.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session_template_provider', 'create', {
      payload: sessionTemplateProviderPayload(event.sessionTemplateProvider)
    })
  );
};

export let recordSessionTemplateProviderUpdated = async (
  event: FabricEvents['provider.session_template.provider.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session_template_provider', 'update', {
      payload: sessionTemplateProviderPayload(event.sessionTemplateProvider),
      previousPayload: sessionTemplateProviderPayload(event.previousSessionTemplateProvider)
    })
  );
};

export let recordSessionTemplateProviderDeleted = async (
  event: FabricEvents['provider.session_template.provider.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'session_template_provider', 'delete', {
      payload: sessionTemplateProviderPayload(event.sessionTemplateProvider)
    })
  );
};

export let recordEphemeralSessionCreated = async (
  event: FabricEvents['provider.session.ephemeral_created:after']
) => {
  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(event.auditScope, 'session', 'create', {
      payload: sessionPayload(event.session)
    })
  );
};

Fabric.listen('provider.session.created:after', recordSessionCreated);
Fabric.listen('provider.session.ephemeral_created:after', recordEphemeralSessionCreated);
Fabric.listen('provider.session.updated:after', recordSessionUpdated);
Fabric.listen('provider.session.deleted:after', recordSessionDeleted);

Fabric.listen('provider.session.provider.created:after', recordSessionProviderCreated);
Fabric.listen('provider.session.provider.updated:after', recordSessionProviderUpdated);
Fabric.listen('provider.session.provider.deleted:after', recordSessionProviderDeleted);

Fabric.listen('provider.session_template.created:after', recordSessionTemplateCreated);
Fabric.listen('provider.session_template.updated:after', recordSessionTemplateUpdated);
Fabric.listen('provider.session_template.deleted:after', recordSessionTemplateDeleted);

Fabric.listen(
  'provider.session_template.provider.created:after',
  recordSessionTemplateProviderCreated
);
Fabric.listen(
  'provider.session_template.provider.updated:after',
  recordSessionTemplateProviderUpdated
);
Fabric.listen(
  'provider.session_template.provider.deleted:after',
  recordSessionTemplateProviderDeleted
);
