import type { Context } from '@metorial/context';
import { createAuditScope, type AuditActor, type AuditScope } from './scope';

type OrganizationInput = {
  oid: bigint;
};

type ProjectInput = {
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

let createOrganizationActorAuditScope = (d: {
  organization: OrganizationInput;
  project?: ProjectInput;
  instance?: InstanceInput;
  organizationActor: OrganizationActorInput;
  context: Context;
}): AuditScope =>
  createAuditScope({
    organization: d.organization,
    project: d.project,
    instance: d.instance,
    organizationActor: d.organizationActor,
    actor: {
      type: 'org_actor',
      id: d.organizationActor.id
    },
    context: d.context
  });

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
}): Promise<AuditScope> =>
  createOrganizationActorAuditScope({
    organization: d.organization,
    organizationActor: d.organizationActor,
    context: d.context
  });

export let ensureOrganizationMemberAuditScope = async (d: {
  organization: OrganizationInput;
  member: OrganizationMemberInput;
  context: Context;
}): Promise<AuditScope> =>
  await ensureOrganizationActorAuditScope({
    organization: d.organization,
    organizationActor: d.member.actor,
    context: d.context
  });

export let ensureProjectAuditScope = async (d: {
  organization: OrganizationInput;
  project: ProjectInput;
  actor: AuditActor;
  context: Context;
}): Promise<AuditScope> =>
  createAuditScope({
    organization: d.organization,
    project: d.project,
    actor: d.actor,
    context: d.context
  });

export let ensureProjectActorAuditScope = async (d: {
  organization: OrganizationInput;
  project: ProjectInput;
  organizationActor: OrganizationActorInput;
  context: Context;
}): Promise<AuditScope> =>
  createOrganizationActorAuditScope({
    organization: d.organization,
    project: d.project,
    organizationActor: d.organizationActor,
    context: d.context
  });

export let ensureInstanceAuditScope = async (d: {
  organization: OrganizationInput;
  project: ProjectInput;
  instance: InstanceInput;
  actor: AuditActor;
  context: Context;
}): Promise<AuditScope> =>
  createAuditScope({
    organization: d.organization,
    project: d.project,
    instance: d.instance,
    actor: d.actor,
    context: d.context
  });

export let ensureInstanceActorAuditScope = async (d: {
  organization: OrganizationInput;
  project: ProjectInput;
  instance: InstanceInput;
  organizationActor: OrganizationActorInput;
  context: Context;
}): Promise<AuditScope> =>
  createOrganizationActorAuditScope({
    organization: d.organization,
    project: d.project,
    instance: d.instance,
    organizationActor: d.organizationActor,
    context: d.context
  });
