import type { Instance, Organization, Project } from '@metorial/db';
import type { Groundstation } from './groundstation';

export let upsertOrganizationScope = async (d: {
  groundstation: Groundstation;
  organization: Pick<Organization, 'id' | 'name'>;
}) =>
  await d.groundstation.organization.upsert({
    ref: d.organization.id,
    name: d.organization.name
  });

export let upsertProjectScope = async (d: {
  groundstation: Groundstation;
  organization: Pick<Organization, 'id' | 'name'>;
  project: Pick<Project, 'id' | 'name'>;
}) => {
  await upsertOrganizationScope(d);

  return await d.groundstation.project.upsert({
    organizationId: d.organization.id,
    ref: d.project.id,
    name: d.project.name
  });
};

export let upsertInstanceScope = async (d: {
  groundstation: Groundstation;
  organization: Pick<Organization, 'id' | 'name'>;
  project: Pick<Project, 'id' | 'name'>;
  instance: Pick<Instance, 'id' | 'name'>;
}) => {
  await upsertProjectScope(d);

  return await d.groundstation.instance.upsert({
    organizationId: d.organization.id,
    projectId: d.project.id,
    ref: d.instance.id,
    name: d.instance.name
  });
};
