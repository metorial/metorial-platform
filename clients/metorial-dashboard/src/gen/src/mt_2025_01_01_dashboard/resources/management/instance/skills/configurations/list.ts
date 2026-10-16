import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsConfigurationsListOutput = {
  items: {
    object: 'skill.configuration';
    id: string;
    isDefault: boolean;
    allowScripts: boolean;
    allowedFileExtensions: string[];
    allowNonStandardDirectories: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSkillsConfigurationsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsConfigurationsListOutput>(
    [
      7,
      [
        1,
        [
          'is_default',
          'allow_scripts',
          'allowed_file_extensions',
          'allow_non_standard_directories',
          'deleted_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceSkillsConfigurationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceSkillsConfigurationsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsConfigurationsListQuery>(
    0
  );
