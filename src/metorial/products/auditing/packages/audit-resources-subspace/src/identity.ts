import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';

export let agentAuditResource = resource({
  name: 'agent',
  payload: v.typedAny<{
    id: string;
    status: string;
    type: string;
    name: string;
    description: string | null;
    slug: string;
  }>('agent'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let agentClientAuditResource = resource({
  name: 'agent_client',
  payload: v.typedAny<{
    id: string;
    type: string;
    name: string;
  }>('agent_client'),
  presenter: undefined,
  actions: {
    create: true
  }
});

export let identityActorAuditResource = resource({
  name: 'identity_actor',
  payload: v.typedAny<{
    id: string;
    type: string;
    status: string;
    name: string;
    description: string | null;
  }>('identity_actor'),
  presenter: undefined,
  actions: {
    create: true,
    delete: true
  }
});

export let identityAuditResource = resource({
  name: 'identity',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string | null;
    description: string | null;
    actor: { id: string; name: string } | null;
  }>('identity'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let identityCredentialAuditResource = resource({
  name: 'identity_credential',
  payload: v.typedAny<{
    id: string;
    status: string;
    identity: { id: string; name: string | null };
    deploymentId: string | null;
    configId: string | null;
    authConfigId: string | null;
  }>('identity_credential'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let identityDelegationAuditResource = resource({
  name: 'identity_delegation',
  payload: v.typedAny<{
    id: string;
    status: string;
    delegationLevel: number;
    permissions: string[];
    deniedReason: string | null;
    note: string | null;
    wasAutoApprovedFromPreviousDelegation: boolean;
    identity: { id: string; name: string | null };
  }>('identity_delegation'),
  presenter: undefined,
  actions: {
    create: true,
    revoke: true
  }
});

export let identityDelegationConfigAuditResource = resource({
  name: 'identity_delegation_config',
  payload: v.typedAny<{
    id: string;
    status: string;
    isDefault: boolean;
    name: string | null;
    description: string | null;
  }>('identity_delegation_config'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
