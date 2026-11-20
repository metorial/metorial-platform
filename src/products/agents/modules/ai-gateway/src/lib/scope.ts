import {
  addAfterTransactionHook,
  type Instance,
  type Organization,
  type Project
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import type { AiGateway } from './client';

// Gateway organizations, projects and instances use the core ids as refs.
export let upsertOrganizationScope = async (d: {
  gateway: AiGateway;
  organization: Pick<Organization, 'id' | 'name'>;
}) =>
  await d.gateway.organization.upsert({
    ref: d.organization.id,
    name: d.organization.name
  });

export let upsertProjectScope = async (d: {
  gateway: AiGateway;
  organization: Organization;
  project: Project;
}) => {
  await upsertOrganizationScope(d);

  let gatewayProject = await d.gateway.project.upsert({
    organizationId: d.organization.id,
    ref: d.project.id,
    name: d.project.name
  });

  // Plan limits and billing pick a project up from this event; until then it is unlimited.
  if (!gatewayProject.platformLimitsSyncedAt) {
    await addAfterTransactionHook(() =>
      Fabric.fire('ai_gateway.project.created:after', {
        organization: d.organization,
        project: d.project,
        gatewayProjectId: gatewayProject.id
      })
    );
  }

  return gatewayProject;
};

export let upsertInstanceScope = async (d: {
  gateway: AiGateway;
  organization: Organization;
  project: Project;
  instance: Pick<Instance, 'id' | 'name'>;
}) => {
  let project = await upsertProjectScope(d);

  let instance = await d.gateway.instance.upsert({
    organizationId: d.organization.id,
    projectId: project.id,
    ref: d.instance.id,
    name: d.instance.name
  });

  return { project, instance };
};
