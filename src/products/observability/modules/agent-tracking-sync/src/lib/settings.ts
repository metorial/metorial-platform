import type { ValidationModifier } from '@lowerdeck/validation';
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

export let ticketUrlTemplateKey = '{key}';

export let ticketUrlTemplateMaxLength = 500;

let unsafeTicketUrlCharacters = /[\u0000-\u001f\u007f\\]/;

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
  desktop: {
    toolDetails: row?.toolDetails ?? false,
    sessionContext: row?.sessionContext ?? true,
    sessionTitles: row?.sessionTitles ?? false,
    historyImport: row?.historyImport ?? false
  },
  links: { ticketUrlTemplate: row?.ticketUrlTemplate ?? null }
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

export let isTicketUrlTemplate = (value: string) => {
  let template = value.trim();
  if (
    template.length > ticketUrlTemplateMaxLength ||
    !template.includes(ticketUrlTemplateKey) ||
    unsafeTicketUrlCharacters.test(template)
  ) {
    return false;
  }

  try {
    let url = new URL(template.replaceAll(ticketUrlTemplateKey, 'KEY-1'));
    let other = new URL(template.replaceAll(ticketUrlTemplateKey, 'OTHER-2'));

    return (
      (url.protocol == 'https:' || url.protocol == 'http:') &&
      url.origin == other.origin &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

export let ticketUrlTemplate: ValidationModifier<string> = value =>
  value.trim() == '' || isTicketUrlTemplate(value)
    ? []
    : [
        {
          code: 'invalid_ticket_url_template',
          message: `Must be an http or https URL of at most ${ticketUrlTemplateMaxLength} characters with ${ticketUrlTemplateKey} in its path or query.`,
          received: value
        }
      ];

export let normalizeTicketUrlTemplate = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() || null;

export let narrowsDesktop = (
  current: Pick<AgentTrackingOrganizationSettingsValues, 'desktop'>,
  next: Pick<AgentTrackingOrganizationSettingsValues, 'desktop'>
) =>
  Object.entries(current.desktop).some(
    ([key, enabled]) =>
      enabled && !next.desktop[key as keyof AgentTrackingOrganizationSettingsValues['desktop']]
  );

export let serviceOrganizationSettings = (
  settings: Pick<AgentTrackingOrganizationSettingsValues, 'privacy' | 'desktop'>
) => ({ privacy: settings.privacy, desktop: settings.desktop });

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
