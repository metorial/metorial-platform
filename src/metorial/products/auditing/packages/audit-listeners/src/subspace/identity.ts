import {
  Fabric,
  type AuditSubspaceAgent,
  type AuditSubspaceIdentity,
  type AuditSubspaceIdentityCredential,
  type AuditSubspaceIdentityDelegation,
  type AuditSubspaceIdentityDelegationConfig,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { getSubspaceAuditScope, recordSubspaceAuditEvent } from './_shared';

let agentPayload = (agent: AuditSubspaceAgent) => ({
  id: agent.id,
  status: agent.status,
  type: agent.type,
  name: agent.name,
  description: agent.description,
  slug: agent.slug
});

let identityPayload = (identity: AuditSubspaceIdentity) => ({
  id: identity.id,
  status: identity.status,
  name: identity.name,
  description: identity.description,
  actor: identity.actor ? { id: identity.actor.id, name: identity.actor.name } : null
});

let credentialPayload = (credential: AuditSubspaceIdentityCredential) => ({
  id: credential.id,
  status: credential.status,
  identity: { id: credential.identity.id, name: credential.identity.name },
  deploymentId: credential.deployment?.id ?? null,
  configId: credential.config?.id ?? null,
  authConfigId: credential.authConfig?.id ?? null
});

let delegationPayload = (delegation: AuditSubspaceIdentityDelegation) => ({
  id: delegation.id,
  status: delegation.status,
  delegationLevel: delegation.delegationLevel,
  permissions: delegation.permissions,
  deniedReason: delegation.deniedReason,
  note: delegation.note,
  wasAutoApprovedFromPreviousDelegation:
    delegation.wasCoveredByPreviousDelegationAndAutoApproved,
  identity: { id: delegation.identity.id, name: delegation.identity.name }
});

let delegationConfigPayload = (config: AuditSubspaceIdentityDelegationConfig) => ({
  id: config.id,
  status: config.status,
  isDefault: config.isDefault,
  name: config.name,
  description: config.description
});

export let recordAgentCreated = async (
  event: FabricEvents['identity.agent.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'agent', 'create', {
      payload: agentPayload(event.agent)
    })
  );
};

export let recordAgentUpdated = async (
  event: FabricEvents['identity.agent.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'agent', 'update', {
      payload: agentPayload(event.agent),
      previousPayload: agentPayload(event.previousAgent)
    })
  );
};

export let recordAgentDeleted = async (
  event: FabricEvents['identity.agent.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'agent', 'delete', {
      payload: agentPayload(event.agent)
    })
  );
};

export let recordAgentClientCreated = async (
  event: FabricEvents['identity.agent_client.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'agent_client', 'create', {
      payload: {
        id: event.agentClient.id,
        type: event.agentClient.type,
        name: event.agentClient.name
      }
    })
  );
};

export let recordIdentityActorCreated = async (
  event: FabricEvents['identity.actor.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity_actor', 'create', {
      payload: {
        id: event.identityActor.id,
        type: event.identityActor.type,
        status: event.identityActor.status,
        name: event.identityActor.name,
        description: event.identityActor.description
      }
    })
  );
};

export let recordIdentityActorDeleted = async (
  event: FabricEvents['identity.actor.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity_actor', 'delete', {
      payload: {
        id: event.identityActor.id,
        type: event.identityActor.type,
        status: event.identityActor.status,
        name: event.identityActor.name,
        description: event.identityActor.description
      }
    })
  );
};

export let recordIdentityCreated = async (event: FabricEvents['identity.created:after']) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity', 'create', {
      payload: identityPayload(event.identity)
    })
  );
};

export let recordIdentityUpdated = async (event: FabricEvents['identity.updated:after']) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity', 'update', {
      payload: identityPayload(event.identity),
      previousPayload: identityPayload(event.previousIdentity)
    })
  );
};

export let recordIdentityDeleted = async (event: FabricEvents['identity.deleted:after']) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity', 'delete', {
      payload: identityPayload(event.identity)
    })
  );
};

export let recordIdentityCredentialCreated = async (
  event: FabricEvents['identity.credential.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity_credential', 'create', {
      payload: credentialPayload(event.identityCredential)
    })
  );
};

export let recordIdentityCredentialUpdated = async (
  event: FabricEvents['identity.credential.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity_credential', 'update', {
      payload: credentialPayload(event.identityCredential),
      previousPayload: credentialPayload(event.previousIdentityCredential)
    })
  );
};

export let recordIdentityCredentialDeleted = async (
  event: FabricEvents['identity.credential.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity_credential', 'delete', {
      payload: credentialPayload(event.identityCredential)
    })
  );
};

export let recordIdentityDelegationCreated = async (
  event: FabricEvents['identity.delegation.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity_delegation', 'create', {
      payload: delegationPayload(event.identityDelegation)
    })
  );
};

export let recordIdentityDelegationRevoked = async (
  event: FabricEvents['identity.delegation.revoked:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity_delegation', 'revoke', {
      payload: delegationPayload(event.identityDelegation)
    })
  );
};

export let recordIdentityDelegationConfigCreated = async (
  event: FabricEvents['identity.delegation_config.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity_delegation_config', 'create', {
      payload: delegationConfigPayload(event.identityDelegationConfig)
    })
  );
};

export let recordIdentityDelegationConfigUpdated = async (
  event: FabricEvents['identity.delegation_config.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity_delegation_config', 'update', {
      payload: delegationConfigPayload(event.identityDelegationConfig),
      previousPayload: delegationConfigPayload(event.previousIdentityDelegationConfig)
    })
  );
};

export let recordIdentityDelegationConfigDeleted = async (
  event: FabricEvents['identity.delegation_config.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'identity_delegation_config', 'delete', {
      payload: delegationConfigPayload(event.identityDelegationConfig)
    })
  );
};

Fabric.listen('identity.agent.created:after', recordAgentCreated);
Fabric.listen('identity.agent.updated:after', recordAgentUpdated);
Fabric.listen('identity.agent.deleted:after', recordAgentDeleted);
Fabric.listen('identity.agent_client.created:after', recordAgentClientCreated);

Fabric.listen('identity.actor.created:after', recordIdentityActorCreated);
Fabric.listen('identity.actor.deleted:after', recordIdentityActorDeleted);
Fabric.listen('identity.created:after', recordIdentityCreated);
Fabric.listen('identity.updated:after', recordIdentityUpdated);
Fabric.listen('identity.deleted:after', recordIdentityDeleted);

Fabric.listen('identity.credential.created:after', recordIdentityCredentialCreated);
Fabric.listen('identity.credential.updated:after', recordIdentityCredentialUpdated);
Fabric.listen('identity.credential.deleted:after', recordIdentityCredentialDeleted);

Fabric.listen('identity.delegation.created:after', recordIdentityDelegationCreated);
Fabric.listen('identity.delegation.revoked:after', recordIdentityDelegationRevoked);

Fabric.listen(
  'identity.delegation_config.created:after',
  recordIdentityDelegationConfigCreated
);
Fabric.listen(
  'identity.delegation_config.updated:after',
  recordIdentityDelegationConfigUpdated
);
Fabric.listen(
  'identity.delegation_config.deleted:after',
  recordIdentityDelegationConfigDeleted
);
