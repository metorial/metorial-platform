import type { ContentPolicy } from './contentPolicy';

export type TagOrigin = 'source' | 'repo' | 'environment';

export type IngestTag = { key: string; value: string };

export type SliceErasureMode = 'anonymize' | 'delete';

export type OrganizationPrivacySettings = {
  hideIndividuals?: boolean;
  minGroupUsers?: number;
};

export type OrganizationDesktopSwitches = {
  toolDetails?: boolean;
  sessionContext?: boolean;
  sessionTitles?: boolean;
  historyImport?: boolean;
};

export type OrganizationDesktopSettings = OrganizationDesktopSwitches & {
  historyImportDays?: number;
};

export let defaultOrganizationDesktopSettings: Required<OrganizationDesktopSettings> = {
  toolDetails: false,
  sessionContext: true,
  sessionTitles: false,
  historyImport: false,
  historyImportDays: 90
};

export let fullIngestPolicy: Required<OrganizationDesktopSwitches> = {
  toolDetails: true,
  sessionContext: true,
  sessionTitles: true,
  historyImport: true
};

export type OrganizationSettings = {
  allowedEmailDomains?: string[];
  sliceErasureMode?: SliceErasureMode;
  privacy?: OrganizationPrivacySettings;
  desktop?: OrganizationDesktopSettings;
};

export type ClassificationSettings = {
  enabled?: boolean;
  threshold?: number;
  ai?: { enabled?: boolean; model?: 'clef' | 'clef-flash' };
};

export type InstanceSettings = {
  ephemeralDeviceIdleDays?: number;
  inferredSessionGapMinutes?: number;
  classification?: ClassificationSettings;
  contentPolicy?: ContentPolicy;
};

export type EntityKindAttributes = {
  description?: string;
  tagOrigins?: TagOrigin[];
  queryableAttributes?: string[];
};

export type EntityAttributes = Record<string, unknown>;

export type CanonicalQuery = Record<string, unknown>;

export type QueryExportScope = {
  organizationId: string;
  projectIds?: string[];
  instanceIds?: string[];
};

export type QueryExportPart = { number: number; etag: string; size: number; rows: number };

export type ClassifierFeatures = Record<string, unknown>;

export let desktopSettingsOf = (
  settings: Pick<OrganizationSettings, 'desktop'>
): Required<OrganizationDesktopSettings> => ({
  ...defaultOrganizationDesktopSettings,
  ...settings.desktop
});
