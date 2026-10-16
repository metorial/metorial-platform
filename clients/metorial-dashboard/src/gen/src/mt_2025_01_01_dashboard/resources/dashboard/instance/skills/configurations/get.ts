import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsConfigurationsGetOutput = {
  object: 'skill.configuration';
  id: string;
  isDefault: boolean;
  allowScripts: boolean;
  allowedFileExtensions: string[];
  allowNonStandardDirectories: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceSkillsConfigurationsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsConfigurationsGetOutput>(
    [
      'is_default',
      'allow_scripts',
      'allowed_file_extensions',
      'allow_non_standard_directories',
      'deleted_at',
      'created_at',
      'updated_at'
    ],
    1
  );
