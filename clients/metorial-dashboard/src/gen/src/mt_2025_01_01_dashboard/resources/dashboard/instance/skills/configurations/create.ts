import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsConfigurationsCreateOutput = {
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

export let mapDashboardInstanceSkillsConfigurationsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsConfigurationsCreateOutput>(
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

export type DashboardInstanceSkillsConfigurationsCreateBody = {
  allowScripts?: boolean | undefined;
  allowedFileExtensions?: string[] | null | undefined;
  allowNonStandardDirectories?: boolean | undefined;
};

export let mapDashboardInstanceSkillsConfigurationsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsConfigurationsCreateBody>([
    'allow_scripts',
    'allowed_file_extensions',
    'allow_non_standard_directories'
  ]);
