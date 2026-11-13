export type TagOrigin = 'source' | 'repo' | 'environment';

export type IngestTag = { key: string; value: string };

export type SliceErasureMode = 'anonymize' | 'delete';

export type OrganizationSettings = {
  allowedEmailDomains?: string[];
  sliceErasureMode?: SliceErasureMode;
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
};

export type EntityKindAttributes = {
  description?: string;
  tagOrigins?: TagOrigin[];
};

export type EntityAttributes = Record<string, unknown>;

export type AttributionRuleMatch =
  | { all: AttributionRuleMatch[] }
  | { any: AttributionRuleMatch[] }
  | { not: AttributionRuleMatch }
  | {
      field: string;
      op: 'eq' | 'in' | 'glob' | 'regex' | 'exists';
      value?: string | string[];
    };

export type ClassifierFeatures = Record<string, unknown>;
