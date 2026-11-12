// Generated from the organization config declarations by `bun run generate:config-types`.
// Do not edit by hand.

export interface OrganizationConfigs {
  'skills.pinned': { instances: Record<string, Array<string>> };
}

export type OrganizationConfigKey = keyof OrganizationConfigs;

export let organizationConfigDefaults: OrganizationConfigs = {
  'skills.pinned': { instances: {} }
};
