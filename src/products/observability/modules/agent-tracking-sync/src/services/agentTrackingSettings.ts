import { createError, isServiceError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  ID,
  withTransaction,
  type Instance,
  type Organization,
  type Project
} from '@metorial/db';
import {
  Fabric,
  type AgentTrackingInstanceSettingsValues,
  type AgentTrackingOrganizationSettingsValues,
  type AgentTrackingProjectSettingsValues,
  type AgentTrackingSettingsInput,
  type AgentTrackingSettingsValues
} from '@metorial/fabric';
import { isDeepStrictEqual } from 'node:util';
import {
  getAgentTracking,
  requireAgentTracking,
  type AgentTrackingCallOpts
} from '../lib/client';
import {
  upsertInstanceScope,
  upsertOrganizationScope,
  upsertProjectScope
} from '../lib/scope';
import {
  instanceSettingsOf,
  narrowsCapture,
  organizationSettingsOf,
  projectSettingsOf,
  readInstanceSettings,
  readOrganizationSettings,
  readProjectSettings,
  serviceInstanceSettings,
  serviceOrganizationSettings,
  serviceProjectRetention,
  serviceRetentionDefaults
} from '../lib/settings';
import { syncScopeQueue, type ScopeSyncTarget } from '../queues/syncScope';

let pushCallOpts: AgentTrackingCallOpts = { timeoutMs: 3_000, retry: false };

let statusCallOpts: AgentTrackingCallOpts = {
  timeoutMs: 3_000,
  retry: false,
  captureErrors: false
};

export type AgentTrackingSettingsServiceStatus = 'applied' | 'pending' | 'unknown';

let narrowingNotAppliedError = createError({
  status: 503,
  code: 'service_unavailable',
  message:
    'Agent Usage could not apply the narrower setting, so nothing was changed. Try again in a moment.'
});

type OrganizationScope = { organization: Organization };
type ProjectScope = OrganizationScope & { project: Project };
type InstanceScope = ProjectScope & { instance: Instance };

type Level<V extends AgentTrackingSettingsValues> = {
  read: () => Promise<{ settings: V; stored: boolean }>;
  write: (settings: V) => Promise<unknown>;
  push: (settings?: V) => Promise<unknown>;
  serviceHolds: (settings: V) => Promise<boolean>;
  syncTarget: ScopeSyncTarget;
  narrows?: (current: V, next: V) => boolean;
};

let read = async <Row, V>(row: Promise<Row | null>, valuesOf: (row: Row | null) => V) => {
  let stored = await row;
  return { settings: valuesOf(stored), stored: !!stored };
};

let holds = (remote: unknown, expected: unknown): boolean =>
  typeof expected == 'object' && expected !== null
    ? Object.entries(expected).every(([key, value]) =>
        holds((remote as Record<string, unknown> | undefined)?.[key], value)
      )
    : remote === expected;

let defined = <T extends object>(changes: T | undefined) =>
  Object.fromEntries(
    Object.entries(changes ?? {}).filter(([, value]) => value !== undefined)
  ) as Partial<T>;

let withChanges = <V extends AgentTrackingSettingsValues>(
  settings: V,
  input: AgentTrackingSettingsInput
) =>
  Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [
      key,
      typeof value == 'object'
        ? { ...value, ...defined(input[key as keyof AgentTrackingSettingsInput]) }
        : value
    ])
  ) as V;

let organizationLevel = (
  d: OrganizationScope
): Level<AgentTrackingOrganizationSettingsValues> => ({
  read: () =>
    read(readOrganizationSettings(d.organization.id), row =>
      organizationSettingsOf(d.organization, row)
    ),
  write: settings =>
    withTransaction(async db =>
      db.agentTrackingOrganizationSettings.upsert({
        where: { organizationOid: d.organization.oid },
        create: {
          id: await ID.generateId('agentTrackingOrganizationSettings'),
          organizationOid: d.organization.oid,
          ...settings.privacy
        },
        update: settings.privacy
      })
    ),
  push: organizationSettings =>
    upsertOrganizationScope({
      agentTracking: requireAgentTracking(),
      organization: d.organization,
      organizationSettings,
      callOpts: pushCallOpts
    }),
  serviceHolds: async settings => {
    let organization = await requireAgentTracking().organization.get(
      { organizationId: d.organization.id },
      statusCallOpts
    );
    return holds(organization.settings, serviceOrganizationSettings(settings));
  },
  syncTarget: { type: 'organization', id: d.organization.id }
});

let projectLevel = (d: ProjectScope): Level<AgentTrackingProjectSettingsValues> => ({
  read: () => read(readProjectSettings(d.project.id), row => projectSettingsOf(d, row)),
  write: settings =>
    withTransaction(async db =>
      db.agentTrackingProjectSettings.upsert({
        where: { projectOid: d.project.oid },
        create: {
          id: await ID.generateId('agentTrackingProjectSettings'),
          projectOid: d.project.oid,
          ...settings.retention
        },
        update: settings.retention
      })
    ),
  push: projectSettings =>
    upsertProjectScope({
      agentTracking: requireAgentTracking(),
      organization: d.organization,
      project: d.project,
      projectSettings,
      callOpts: pushCallOpts
    }),
  serviceHolds: async settings => {
    let project = await requireAgentTracking().project.get(
      { organizationId: d.organization.id, projectId: d.project.id },
      statusCallOpts
    );
    return holds(
      project,
      serviceProjectRetention({
        retention: {
          recordDays: settings.retention.recordDays ?? serviceRetentionDefaults.recordDays,
          contentDays: settings.retention.contentDays ?? serviceRetentionDefaults.contentDays,
          usageDays: settings.retention.usageDays ?? serviceRetentionDefaults.usageDays
        }
      })
    );
  },
  syncTarget: { type: 'project', id: d.project.id }
});

let instanceLevel = (d: InstanceScope): Level<AgentTrackingInstanceSettingsValues> => ({
  read: () => read(readInstanceSettings(d.instance.id), row => instanceSettingsOf(d, row)),
  write: settings =>
    withTransaction(async db => {
      let data = { ...settings.content, ...settings.classification };

      return await db.agentTrackingInstanceSettings.upsert({
        where: { instanceOid: d.instance.oid },
        create: {
          id: await ID.generateId('agentTrackingInstanceSettings'),
          instanceOid: d.instance.oid,
          ...data
        },
        update: data
      });
    }),
  push: instanceSettings =>
    upsertInstanceScope({
      agentTracking: requireAgentTracking(),
      organization: d.organization,
      project: d.project,
      instance: d.instance,
      instanceSettings,
      callOpts: pushCallOpts
    }),
  serviceHolds: async settings => {
    let instance = await requireAgentTracking().instance.get(
      { organizationId: d.organization.id, instanceId: d.instance.id },
      statusCallOpts
    );
    return holds(instance.settings, serviceInstanceSettings(settings));
  },
  syncTarget: { type: 'instance', id: d.instance.id },
  narrows: narrowsCapture
});

class AgentTrackingSettingsServiceImpl {
  async getPrivacy(d: { organization: Pick<Organization, 'id'> }) {
    return organizationSettingsOf(
      d.organization,
      await readOrganizationSettings(d.organization.id)
    ).privacy;
  }

  async getOrganizationSettings(d: OrganizationScope) {
    return await this.get(organizationLevel(d));
  }

  async getProjectSettings(d: ProjectScope) {
    return await this.get(projectLevel(d));
  }

  async getInstanceSettings(d: InstanceScope) {
    let [result, privacy] = await Promise.all([
      this.get(instanceLevel(d)),
      this.getPrivacy(d)
    ]);

    return { ...result, privacy };
  }

  async updateOrganizationSettings(
    d: OrganizationScope & {
      auditScope: AuditScope;
      input: Pick<AgentTrackingSettingsInput, 'privacy'>;
    }
  ) {
    return await this.update(organizationLevel(d), d);
  }

  async updateProjectSettings(
    d: ProjectScope & {
      auditScope: AuditScope;
      input: Pick<AgentTrackingSettingsInput, 'retention'>;
    }
  ) {
    return await this.update(projectLevel(d), d);
  }

  async updateInstanceSettings(
    d: InstanceScope & {
      auditScope: AuditScope;
      input: Pick<AgentTrackingSettingsInput, 'content' | 'classification'>;
    }
  ) {
    let [result, privacy] = await Promise.all([
      this.update(instanceLevel(d), d),
      this.getPrivacy(d)
    ]);

    return { ...result, privacy };
  }

  private async get<V extends AgentTrackingSettingsValues>(level: Level<V>) {
    let { settings, stored } = await level.read();

    return { settings, serviceStatus: await this.serviceStatus(level, settings, stored) };
  }

  private async serviceStatus<V extends AgentTrackingSettingsValues>(
    level: Level<V>,
    settings: V,
    stored: boolean
  ): Promise<AgentTrackingSettingsServiceStatus> {
    if (!getAgentTracking()) return 'unknown';
    if (!stored) return 'applied';

    try {
      return (await level.serviceHolds(settings)) ? 'applied' : 'pending';
    } catch (error) {
      return isServiceError(error) && error.data.status == 404 ? 'pending' : 'unknown';
    }
  }

  private async update<V extends AgentTrackingSettingsValues>(
    level: Level<V>,
    d: OrganizationScope & {
      project?: Project;
      instance?: Instance;
      auditScope: AuditScope;
      input: AgentTrackingSettingsInput;
    }
  ): Promise<{ settings: V; serviceStatus: AgentTrackingSettingsServiceStatus }> {
    let current = await level.read();
    let next = withChanges(current.settings, d.input);
    if (isDeepStrictEqual(current.settings, next)) {
      return {
        settings: current.settings,
        serviceStatus: await this.serviceStatus(level, current.settings, current.stored)
      };
    }

    await Fabric.fire('agent_tracking.settings.updated:before', {
      organization: d.organization,
      project: d.project,
      instance: d.instance,
      input: d.input,
      auditScope: d.auditScope
    });

    // Capturing less is pushed before it is stored and capturing more after, so capture is
    // never broader than what Metorial shows. A push that timed out may have landed, so a
    // failure queues a sync.
    let narrowing = level.narrows?.(current.settings, next) ?? false;
    if (narrowing) {
      try {
        await level.push(next);
      } catch {
        await this.queueSync(level);
        throw new ServiceError(narrowingNotAppliedError);
      }
    }

    let settings = await withTransaction(async db => {
      await db.$queryRaw`SELECT "oid" FROM "Organization" WHERE "oid" = ${d.organization.oid} FOR UPDATE`;

      let previous = await level.read();
      let settings = withChanges(previous.settings, d.input);
      await level.write(settings);

      await Fabric.fire('agent_tracking.settings.updated:after', {
        settings,
        previousSettings: previous.settings,
        auditScope: d.auditScope
      });

      return settings;
    }).catch(async error => {
      if (narrowing) await this.queueSync(level);
      throw error;
    });

    return { settings, serviceStatus: await this.push(level) };
  }

  // Sends what is stored at push time, so the last push to land carries the latest values.
  private async push<V extends AgentTrackingSettingsValues>(level: Level<V>) {
    try {
      await level.push();
      return 'applied' as const;
    } catch {
      await this.queueSync(level);
      return 'pending' as const;
    }
  }

  private async queueSync(level: Pick<Level<AgentTrackingSettingsValues>, 'syncTarget'>) {
    try {
      await syncScopeQueue.add(level.syncTarget);
    } catch {}
  }
}

export let agentTrackingSettingsService = Service.create(
  'agentTrackingSettingsService',
  () => new AgentTrackingSettingsServiceImpl()
).build();
