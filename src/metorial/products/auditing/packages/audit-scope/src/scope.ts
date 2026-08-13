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

export type OrganizationActorAuditActor = AuditActor & {
  type: 'org_actor';
};

export interface AuditScope {
  organizationOid: bigint;
  instanceOid?: bigint;
  organizationActorOid?: bigint;
  actor: AuditActor;
  context: Context;
}

export type OrganizationActorAuditScope = AuditScope & {
  organizationActorOid: bigint;
  actor: OrganizationActorAuditActor;
};

export let isOrganizationActorAuditActor = (
  actor: AuditActor
): actor is OrganizationActorAuditActor => actor.type == 'org_actor';

export let isOrganizationActorAuditScope = (
  scope: AuditScope
): scope is OrganizationActorAuditScope =>
  isOrganizationActorAuditActor(scope.actor) && scope.organizationActorOid != null;

export let createOrganizationActorAuditActor = (d: {
  organizationActor: { id: string };
  metadata?: Record<string, AuditActorMetadataValue>;
}): OrganizationActorAuditActor => ({
  type: 'org_actor',
  id: d.organizationActor.id,
  ...(d.metadata ? { metadata: d.metadata } : {})
});

export let createAuditScope = (d: {
  organization: { oid: bigint };
  instance?: { oid: bigint } | null;
  organizationActor?: { oid: bigint } | null;
  actor: AuditActor;
  context: Context;
}): AuditScope => ({
  organizationOid: d.organization.oid,
  instanceOid: d.instance?.oid,
  organizationActorOid: d.organizationActor?.oid,
  actor: d.actor,
  context: d.context
});

export let createOrganizationActorAuditScope = (d: {
  organization: { oid: bigint };
  instance?: { oid: bigint } | null;
  organizationActor: { oid: bigint; id: string };
  metadata?: Record<string, AuditActorMetadataValue>;
  context: Context;
}): OrganizationActorAuditScope => {
  let actor = createOrganizationActorAuditActor({
    organizationActor: d.organizationActor,
    metadata: d.metadata
  });

  return {
    ...createAuditScope({
      organization: d.organization,
      instance: d.instance,
      organizationActor: d.organizationActor,
      actor,
      context: d.context
    }),
    organizationActorOid: d.organizationActor.oid,
    actor
  };
};

export let bindAuditScope = <Scope extends AuditScope>(d: {
  scope: Scope;
  organization: { oid: bigint };
  instance?: { oid: bigint } | null;
}): Scope => ({
  ...d.scope,
  organizationOid: d.organization.oid,
  instanceOid: d.instance?.oid
});
