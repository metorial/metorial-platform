import {
  type AgentTrackingContentMode,
  type AgentTrackingInstanceSettings,
  type AgentTrackingOrganizationSettings,
  type AgentTrackingProjectSettings,
  type Instance,
  type Organization,
  type Project
} from '@metorial/db';
import type {
  AgentTrackingInstanceSettingsValues,
  AgentTrackingOrganizationSettingsValues,
  AgentTrackingProjectSettingsValues
} from '@metorial/fabric';
import { readFromPrimary } from './primary';

export let agentTrackingContentModes = [
  'basic',
  'shape',
  'full'
] as const satisfies readonly AgentTrackingContentMode[];

export let defaultMinGroupUsers = 5;

// With two people either one can subtract their own usage from a group total.
export let minGroupUsersLimits = { min: 3, max: 100 };

export let retentionDaysLimits = { min: 1, max: 3650 };

export let serviceRetentionDefaults = { recordDays: 90, contentDays: 30, usageDays: 400 };

let contentModeRank: Record<AgentTrackingContentMode, number> = {
  basic: 0,
  shape: 1,
  full: 2
};

export type AgentTrackingPrivacy = AgentTrackingOrganizationSettingsValues['privacy'];

type CaptureSettings = Pick<AgentTrackingInstanceSettingsValues, 'content' | 'classification'>;

export let readOrganizationSettings = (organizationId: string) =>
  readFromPrimary(db =>
    db.agentTrackingOrganizationSettings.findFirst({
      where: { organization: { id: organizationId } }
    })
  );

export let readProjectSettings = (projectId: string) =>
  readFromPrimary(db =>
    db.agentTrackingProjectSettings.findFirst({ where: { project: { id: projectId } } })
  );

export let readInstanceSettings = (instanceId: string) =>
  readFromPrimary(db =>
    db.agentTrackingInstanceSettings.findFirst({ where: { instance: { id: instanceId } } })
  );

export let organizationSettingsOf = (
  organization: Pick<Organization, 'id'>,
  row: AgentTrackingOrganizationSettings | null
): AgentTrackingOrganizationSettingsValues => ({
  organizationId: organization.id,
  privacy: {
    hideIndividuals: row?.hideIndividuals ?? false,
    minGroupUsers: Math.max(
      row?.minGroupUsers ?? defaultMinGroupUsers,
      minGroupUsersLimits.min
    )
  },
  desktop: { toolDetails: row?.toolDetails ?? false }
});

export let projectSettingsOf = (
  d: { organization: Pick<Organization, 'id'>; project: Pick<Project, 'id'> },
  row: AgentTrackingProjectSettings | null
): AgentTrackingProjectSettingsValues => ({
  organizationId: d.organization.id,
  projectId: d.project.id,
  retention: {
    recordDays: row?.recordDays ?? null,
    contentDays: row?.contentDays ?? null,
    usageDays: row?.usageDays ?? null
  }
});

export let instanceSettingsOf = (
  d: {
    organization: Pick<Organization, 'id'>;
    project: Pick<Project, 'id'>;
    instance: Pick<Instance, 'id'>;
  },
  row: AgentTrackingInstanceSettings | null
): AgentTrackingInstanceSettingsValues => ({
  organizationId: d.organization.id,
  projectId: d.project.id,
  instanceId: d.instance.id,
  content: { mode: row?.mode ?? 'basic' },
  classification: {
    deterministicEnabled: row?.deterministicEnabled ?? true,
    aiEnabled: row?.aiEnabled ?? false
  }
});

export let narrowsCapture = (current: CaptureSettings, next: CaptureSettings) =>
  contentModeRank[next.content.mode] < contentModeRank[current.content.mode] ||
  (current.classification.aiEnabled && !next.classification.aiEnabled);

export let serviceOrganizationSettings = (
  settings: Pick<AgentTrackingOrganizationSettingsValues, 'privacy'>
) => ({ privacy: settings.privacy });

export let serviceProjectRetention = (
  settings: Pick<AgentTrackingProjectSettingsValues, 'retention'>
) => ({
  recordRetentionDays: settings.retention.recordDays,
  contentRetentionDays: settings.retention.contentDays,
  usageRetentionDays: settings.retention.usageDays
});

export let serviceInstanceSettings = (settings: CaptureSettings) => ({
  contentPolicy: { defaultMode: settings.content.mode },
  classification: {
    enabled: settings.classification.deterministicEnabled,
    ai: { enabled: settings.classification.aiEnabled }
  }
});
