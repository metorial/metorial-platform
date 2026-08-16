export type SkillMarketplaceUpdateFields = {
  imageFileId?: unknown;
  image?: unknown;
  providerOverrides?: unknown;
  name?: unknown;
  description?: unknown;
  skillConfigurationId?: unknown;
  repositoryAccessMode?: unknown;
  forceMergeOrPush?: unknown;
  mergeBeforeChecksPass?: unknown;
};

let contentFields = [
  'imageFileId',
  'image',
  'providerOverrides',
  'name',
  'description',
  'skillConfigurationId'
] as const;

let settingsFields = [
  'repositoryAccessMode',
  'forceMergeOrPush',
  'mergeBeforeChecksPass'
] as const;

export let getSkillMarketplaceUpdateFlags = (input: SkillMarketplaceUpdateFields) => ({
  hasUpdate: [...contentFields, ...settingsFields].some(field => input[field] !== undefined),
  hasContentUpdate: contentFields.some(field => input[field] !== undefined)
});
