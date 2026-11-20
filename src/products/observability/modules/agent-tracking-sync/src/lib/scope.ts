import type { Instance, Organization, Project } from '@metorial/db';
import type {
  AgentTrackingInstanceSettingsValues,
  AgentTrackingOrganizationSettingsValues,
  AgentTrackingProjectSettingsValues
} from '@metorial/fabric';
import type { AgentTracking, AgentTrackingCallOpts } from './client';
import {
  instanceSettingsOf,
  organizationSettingsOf,
  projectSettingsOf,
  readInstanceSettings,
  readOrganizationSettings,
  readProjectSettings,
  serviceInstanceSettings,
  serviceOrganizationSettings,
  serviceProjectRetention
} from './settings';

// No stored row means Metorial never set a value: nothing is sent, and a value set in the
// service stays.
let storedOr = async <Row, Values>(
  settings: Values | undefined,
  read: () => Promise<Row | null>,
  valuesOf: (row: Row) => Values
) => {
  if (settings) return settings;

  let row = await read();
  return row ? valuesOf(row) : undefined;
};

export let upsertOrganizationScope = async (d: {
  agentTracking: AgentTracking;
  organization: Pick<Organization, 'id' | 'name'>;
  organizationSettings?: AgentTrackingOrganizationSettingsValues;
  callOpts?: AgentTrackingCallOpts;
}) => {
  let settings = await storedOr(
    d.organizationSettings,
    () => readOrganizationSettings(d.organization.id),
    row => organizationSettingsOf(d.organization, row)
  );

  return await d.agentTracking.organization.upsert(
    {
      ref: d.organization.id,
      name: d.organization.name,
      settings: settings && serviceOrganizationSettings(settings)
    },
    d.callOpts
  );
};

export let upsertProjectScope = async (d: {
  agentTracking: AgentTracking;
  organization: Pick<Organization, 'id' | 'name'>;
  project: Pick<Project, 'id' | 'name'>;
  projectSettings?: AgentTrackingProjectSettingsValues;
  callOpts?: AgentTrackingCallOpts;
}) => {
  await upsertOrganizationScope(d);

  let settings = await storedOr(
    d.projectSettings,
    () => readProjectSettings(d.project.id),
    row => projectSettingsOf(d, row)
  );

  return await d.agentTracking.project.upsert(
    {
      organizationId: d.organization.id,
      ref: d.project.id,
      name: d.project.name,
      ...(settings ? serviceProjectRetention(settings) : {})
    },
    d.callOpts
  );
};

export let upsertInstanceScope = async (d: {
  agentTracking: AgentTracking;
  organization: Pick<Organization, 'id' | 'name'>;
  project: Pick<Project, 'id' | 'name'>;
  instance: Pick<Instance, 'id' | 'name'>;
  instanceSettings?: AgentTrackingInstanceSettingsValues;
  callOpts?: AgentTrackingCallOpts;
}) => {
  await upsertProjectScope(d);

  let settings = await storedOr(
    d.instanceSettings,
    () => readInstanceSettings(d.instance.id),
    row => instanceSettingsOf(d, row)
  );

  return await d.agentTracking.instance.upsert(
    {
      organizationId: d.organization.id,
      projectId: d.project.id,
      ref: d.instance.id,
      name: d.instance.name,
      settings: settings && serviceInstanceSettings(settings)
    },
    d.callOpts
  );
};
