import type { Context } from '@metorial/context';
import {
  createAuditScope,
  createOrganizationActorAuditScope,
  type AuditActor,
  type AuditScope,
  type OrganizationActorAuditScope
} from './scope';

type OrganizationInput = {
  oid: bigint;
};

type InstanceInput = {
  oid: bigint;
};

type OrganizationActorInput = {
  oid: bigint;
  id: string;
};

type OrganizationMemberInput = {
  actor: OrganizationActorInput;
};

export let ensureOrganizationAuditScope = async (d: {
  organization: OrganizationInput;
  actor: AuditActor;
  context: Context;
}): Promise<AuditScope> =>
  createAuditScope({
    organization: d.organization,
    actor: d.actor,
    context: d.context
  });

export let ensureOrganizationActorAuditScope = async (d: {
  organization: OrganizationInput;
  organizationActor: OrganizationActorInput;
  context: Context;
}): Promise<OrganizationActorAuditScope> =>
  createOrganizationActorAuditScope({
    organization: d.organization,
    organizationActor: d.organizationActor,
    context: d.context
  });

export let ensureOrganizationMemberAuditScope = async (d: {
  organization: OrganizationInput;
  member: OrganizationMemberInput;
  context: Context;
}): Promise<OrganizationActorAuditScope> =>
  await ensureOrganizationActorAuditScope({
    organization: d.organization,
    organizationActor: d.member.actor,
    context: d.context
  });

export let ensureInstanceAuditScope = async (d: {
  organization: OrganizationInput;
  instance: InstanceInput;
  actor: AuditActor;
  context: Context;
}): Promise<AuditScope> =>
  createAuditScope({
    organization: d.organization,
    instance: d.instance,
    actor: d.actor,
    context: d.context
  });

export let ensureInstanceActorAuditScope = async (d: {
  organization: OrganizationInput;
  instance: InstanceInput;
  organizationActor: OrganizationActorInput;
  context: Context;
}): Promise<OrganizationActorAuditScope> =>
  createOrganizationActorAuditScope({
    organization: d.organization,
    instance: d.instance,
    organizationActor: d.organizationActor,
    context: d.context
  });
