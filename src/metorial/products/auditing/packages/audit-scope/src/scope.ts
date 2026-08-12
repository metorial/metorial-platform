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
  resourceTenantOid: bigint;
  resourceGroupOid: bigint;
  resourceActorOid?: bigint;
  actor: AuditActor;
  context: Context;
}

export let createAuditScope = (d: {
  resourceTenant: { oid: bigint };
  resourceGroup: { oid: bigint };
  resourceActor?: { oid: bigint } | null;
  actor: AuditActor;
  context: Context;
}): AuditScope => ({
  resourceTenantOid: d.resourceTenant.oid,
  resourceGroupOid: d.resourceGroup.oid,
  resourceActorOid: d.resourceActor?.oid,
  actor: d.actor,
  context: d.context
});
