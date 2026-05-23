import { slugify } from '@mtsrc/slugify';
import type { Skill } from '@metorial-subspace/db';

export type SkillClientMetadataInput = {
  clientName?: string;
  clientDescription?: string;
  license?: string | null;
  compatibility?: string | null;
  clientMetadata?: Record<string, any> | null;
};

let normalizeOptionalString = (
  value: string | null | undefined,
  opts?: { maxLength?: number }
) => {
  if (value === undefined || value === null) return null;

  let trimmed = value.trim();
  if (opts?.maxLength !== undefined) trimmed = trimmed.slice(0, opts.maxLength);
  return trimmed.length ? trimmed : null;
};

let normalizeClientNameString = (value: string) => {
  let trimmed = value.trim().slice(0, 64);

  return trimmed;
};

let normalizeOptionalClientMetadata = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  return { ...(value as Record<string, any>) };
};

export let inferClientName = (name: string) => {
  let inferred = slugify(name).toLowerCase();
  inferred = inferred.replace(/-+/g, '-');
  inferred = inferred.replace(/^-+/, '').replace(/-+$/, '');
  inferred = inferred.slice(0, 64).replace(/-+$/, '');

  if (!inferred.length) return 'skill';

  return inferred;
};

export let normalizeExplicitClientName = (value: string | null | undefined) => {
  if (value === undefined || value === null) return null;

  let normalized = normalizeClientNameString(value);
  return normalized.length ? normalized : null;
};

export let normalizeSkillClientFields = (d: {
  current: {
    clientName: Skill['clientName'] | null;
    clientDescription: Skill['clientDescription'];
    license: Skill['license'];
    compatibility: Skill['compatibility'];
    clientMetadata: Skill['clientMetadata'];
  };
  inferredClientName: string;
  input: SkillClientMetadataInput;
}) => {
  let res = {
    clientName: d.current.clientName || d.inferredClientName,
    clientDescription: d.current.clientDescription,
    license: d.current.license,
    compatibility: d.current.compatibility,
    clientMetadata: d.current.clientMetadata
  };

  if (d.input.clientName !== undefined) {
    res.clientName = normalizeExplicitClientName(d.input.clientName) ?? d.inferredClientName;
  }

  if (d.input.clientDescription !== undefined) {
    res.clientDescription = normalizeOptionalString(d.input.clientDescription, {
      maxLength: 1024
    });
  }

  if (d.input.license !== undefined) {
    res.license = normalizeOptionalString(d.input.license);
  }

  if (d.input.compatibility !== undefined) {
    res.compatibility = normalizeOptionalString(d.input.compatibility, {
      maxLength: 500
    });
  }

  if (d.input.clientMetadata !== undefined) {
    res.clientMetadata = normalizeOptionalClientMetadata(d.input.clientMetadata) ?? null;
  }

  return res;
};
