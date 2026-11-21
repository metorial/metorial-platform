import { isServiceError } from '@lowerdeck/error';
import type { Instance, Organization, Project } from '@metorial/db';
import type {
  AgentTrackingInstanceSettingsValues,
  AgentTrackingOrganizationSettingsValues,
  AgentTrackingProjectSettingsValues
} from '@metorial/fabric';
import {
  requireAgentTracking,
  type AgentTracking,
  type AgentTrackingCallOpts
} from './client';
import {
  isInstanceLinked,
  isOrganizationLinked,
  isProjectLinked,
  markInstanceLinked,
  markOrganizationLinked,
  markProjectLinked,
  unlinkOrganizationTree
} from './links';
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

type Call = { agentTracking: AgentTracking; callOpts?: AgentTrackingCallOpts };

type OrganizationScope = Call & { organization: Pick<Organization, 'oid' | 'id' | 'name'> };
type ProjectScope = OrganizationScope & { project: Pick<Project, 'oid' | 'id' | 'name'> };
type InstanceScope = ProjectScope & { instance: Pick<Instance, 'oid' | 'id' | 'name'> };

let scopeEntities = new Set(['organization', 'project', 'instance']);

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

let isStaleScopeError = (error: unknown) =>
  isServiceError(error) && error.data.status == 404 && scopeEntities.has(error.data.entity);

// A link outlives its service resource when the service loses, archives or re-creates it. A
// 404 does not tell which scope of the organization is gone, so every link of the organization
// is cleared and the run repeats once, so the ensures inside it upsert again. Only the outermost
// call retries; the ensures inside never do.
let retryOnStaleScope = async <T>(
  scope: { organization: Pick<Organization, 'oid'> },
  run: () => Promise<T>
) => {
  try {
    return await run();
  } catch (error) {
    if (!isStaleScopeError(error)) throw error;

    await unlinkOrganizationTree(scope.organization);
    return await run();
  }
};

export let pushOrganizationScope = async (
  d: OrganizationScope & { organizationSettings?: AgentTrackingOrganizationSettingsValues }
) => {
  let settings = await storedOr(
    d.organizationSettings,
    () => readOrganizationSettings(d.organization.id),
    row => organizationSettingsOf(d.organization, row)
  );

  let remote = await d.agentTracking.organization.upsert(
    {
      ref: d.organization.id,
      name: d.organization.name,
      settings: settings && serviceOrganizationSettings(settings)
    },
    d.callOpts
  );

  await markOrganizationLinked(d.organization);

  return remote;
};

let upsertProject = async (
  d: ProjectScope & { projectSettings?: AgentTrackingProjectSettingsValues }
) => {
  await ensureOrganizationScope(d);

  let settings = await storedOr(
    d.projectSettings,
    () => readProjectSettings(d.project.id),
    row => projectSettingsOf(d, row)
  );

  let remote = await d.agentTracking.project.upsert(
    {
      organizationId: d.organization.id,
      ref: d.project.id,
      name: d.project.name,
      ...(settings ? serviceProjectRetention(settings) : {})
    },
    d.callOpts
  );

  await markProjectLinked(d.project);

  return remote;
};

let upsertInstance = async (
  d: InstanceScope & { instanceSettings?: AgentTrackingInstanceSettingsValues }
) => {
  await ensureProjectScope(d);

  let settings = await storedOr(
    d.instanceSettings,
    () => readInstanceSettings(d.instance.id),
    row => instanceSettingsOf(d, row)
  );

  let remote = await d.agentTracking.instance.upsert(
    {
      organizationId: d.organization.id,
      projectId: d.project.id,
      ref: d.instance.id,
      name: d.instance.name,
      settings: settings && serviceInstanceSettings(settings)
    },
    d.callOpts
  );

  await markInstanceLinked(d.instance);

  return remote;
};

let ensureOrganizationScope = async (d: OrganizationScope) => {
  if (!(await isOrganizationLinked(d.organization))) await pushOrganizationScope(d);
};

let ensureProjectScope = async (d: ProjectScope) => {
  if (!(await isProjectLinked(d.project))) await upsertProject(d);
};

let ensureInstanceScope = async (d: InstanceScope) => {
  if (!(await isInstanceLinked(d.instance))) await upsertInstance(d);
};

export let pushProjectScope = (
  d: ProjectScope & { projectSettings?: AgentTrackingProjectSettingsValues }
) => retryOnStaleScope(d, () => upsertProject(d));

export let pushInstanceScope = (
  d: InstanceScope & { instanceSettings?: AgentTrackingInstanceSettingsValues }
) => retryOnStaleScope(d, () => upsertInstance(d));

export let withOrganizationScope = <T>(
  d: Omit<OrganizationScope, 'agentTracking'>,
  run: () => Promise<T>
) => {
  let scope = { ...d, agentTracking: requireAgentTracking() };

  return retryOnStaleScope(scope, async () => {
    await ensureOrganizationScope(scope);
    return await run();
  });
};

export let withInstanceScope = <T>(
  d: Omit<InstanceScope, 'agentTracking'>,
  run: () => Promise<T>
) => {
  let scope = { ...d, agentTracking: requireAgentTracking() };

  return retryOnStaleScope(scope, async () => {
    await ensureInstanceScope(scope);
    return await run();
  });
};
