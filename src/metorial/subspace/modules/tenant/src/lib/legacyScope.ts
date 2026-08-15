export let CANONICAL_TENANT_PREFIX = 'mte-pro-';
export let CANONICAL_ENVIRONMENT_PREFIX = 'mte-ins-';

/**
 * Legacy identifiers embed the Metorial string id rather than the oid, and use an underscore
 * where the canonical identifiers use a dash: `mte-ins_0mlz...` is a legacy per-instance tenant,
 * `mte-ins-48526066661381120` is a canonical environment.
 */
export let isCanonicalProjectIdentifier = (identifier: string | null | undefined) =>
  identifier?.startsWith(CANONICAL_TENANT_PREFIX) ?? false;

export let isCanonicalEnvironmentIdentifier = (identifier: string | null | undefined) =>
  identifier?.startsWith(CANONICAL_ENVIRONMENT_PREFIX) ?? false;
