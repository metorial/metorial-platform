import { Context } from '@metorial/context';

export type AuditActorType =
  | 'org_actor'
  | 'consumer_profile'
  | 'system'
  | 'fine_grained_token';

export type AuditActorMetadataValue =
  | string
  | number
  | boolean
  | null
  | AuditActorMetadataValue[]
  | { [key: string]: AuditActorMetadataValue };

export interface AuditActor {
  type: AuditActorType;
  id: string;
  metadata?: Record<string, AuditActorMetadataValue>;
}

export interface AuditScope {
  organizationOid: bigint;
  projectOid?: bigint;
  instanceOid?: bigint;
  organizationActorOid?: bigint;
  actor: AuditActor;
  context: Context;
}

export let createAuditScope = (d: {
  organization: { oid: bigint };
  project?: { oid: bigint } | null;
  instance?: { oid: bigint } | null;
  organizationActor?: { oid: bigint } | null;
  actor: AuditActor;
  context: Context;
}): AuditScope => ({
  organizationOid: d.organization.oid,
  projectOid: d.project?.oid,
  instanceOid: d.instance?.oid,
  organizationActorOid: d.organizationActor?.oid,
  actor: d.actor,
  context: d.context
});
