import { instanceService } from '../src/services/instance';
import { organizationService } from '../src/services/organization';
import { projectService } from '../src/services/project';

let uniqueRef = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export let createTestScope = async (
  d: {
    organizationRef?: string;
    project?: Parameters<typeof projectService.upsertProject>[0]['input'];
    instance?: Partial<Parameters<typeof instanceService.upsertInstance>[0]['input']>;
  } = {}
) => {
  let organization = await organizationService.upsertOrganization({
    input: { ref: d.organizationRef ?? uniqueRef('org') }
  });
  let project = await projectService.upsertProject({
    organization,
    input: d.project ?? { ref: uniqueRef('proj') }
  });
  let instance = await instanceService.upsertInstance({
    organization,
    project,
    input: { ref: uniqueRef('inst'), ...d.instance }
  });

  return { organization, project, instance };
};
