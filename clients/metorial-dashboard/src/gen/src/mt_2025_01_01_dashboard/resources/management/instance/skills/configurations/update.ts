import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsConfigurationsUpdateOutput = {
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

export let mapManagementInstanceSkillsConfigurationsUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsConfigurationsUpdateOutput>(
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

export type ManagementInstanceSkillsConfigurationsUpdateBody = {
  allowScripts?: boolean | undefined;
  allowedFileExtensions?: string[] | null | undefined;
  allowNonStandardDirectories?: boolean | undefined;
};

export let mapManagementInstanceSkillsConfigurationsUpdateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsConfigurationsUpdateBody>([
    'allow_scripts',
    'allowed_file_extensions',
    'allow_non_standard_directories'
  ]);
