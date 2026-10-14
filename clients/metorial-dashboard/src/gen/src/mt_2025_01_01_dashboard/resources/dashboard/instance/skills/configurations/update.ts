import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsConfigurationsUpdateOutput = {
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

export let mapDashboardInstanceSkillsConfigurationsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsConfigurationsUpdateOutput>(
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

export type DashboardInstanceSkillsConfigurationsUpdateBody = {
  allowScripts?: boolean | undefined;
  allowedFileExtensions?: string[] | null | undefined;
  allowNonStandardDirectories?: boolean | undefined;
};

export let mapDashboardInstanceSkillsConfigurationsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsConfigurationsUpdateBody>([
    'allow_scripts',
    'allowed_file_extensions',
    'allow_non_standard_directories'
  ]);
