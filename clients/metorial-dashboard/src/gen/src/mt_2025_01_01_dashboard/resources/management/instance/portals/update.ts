import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePortalsUpdateOutput = {
  object: 'portal';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  slug: string;
  description: string | null;
  allowConsumerSkillAuthoring: boolean;
  allowConsumerSkillPublishing: boolean;
  skillConfiguration: {
    object: 'portal.skill_configuration';
    id: string;
    isDefault: boolean;
    allowScripts: boolean;
    allowedFileExtensions: string[];
    allowNonStandardDirectories: boolean;
  };
  auth: { object: 'portal.auth'; sessionExpiryTimeInSeconds: number };
  urls: { type: 'default'; url: string }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePortalsUpdateOutput =
  mtMap.object<ManagementInstancePortalsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    allowConsumerSkillAuthoring: mtMap.objectField(
      'allow_consumer_skill_authoring',
      mtMap.passthrough()
    ),
    allowConsumerSkillPublishing: mtMap.objectField(
      'allow_consumer_skill_publishing',
      mtMap.passthrough()
    ),
    skillConfiguration: mtMap.objectField(
      'skill_configuration',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        allowScripts: mtMap.objectField('allow_scripts', mtMap.passthrough()),
        allowedFileExtensions: mtMap.objectField(
          'allowed_file_extensions',
          mtMap.array(mtMap.passthrough())
        ),
        allowNonStandardDirectories: mtMap.objectField(
          'allow_non_standard_directories',
          mtMap.passthrough()
        )
      })
    ),
    auth: mtMap.objectField(
      'auth',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        sessionExpiryTimeInSeconds: mtMap.objectField(
          'session_expiry_time_in_seconds',
          mtMap.passthrough()
        )
      })
    ),
    urls: mtMap.objectField(
      'urls',
      mtMap.array(
        mtMap.object({
          type: mtMap.objectField('type', mtMap.passthrough()),
          url: mtMap.objectField('url', mtMap.passthrough())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstancePortalsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  allowedRedirectUrlFilters?: { url: string }[] | undefined;
  sessionExpiryTimeInSeconds?: number | undefined;
  allowConsumerSkillAuthoring?: boolean | undefined;
  allowConsumerSkillPublishing?: boolean | undefined;
  skillConfiguration?:
    | {
        allowScripts?: boolean | undefined;
        allowedFileExtensions?: string[] | null | undefined;
        allowNonStandardDirectories?: boolean | undefined;
      }
    | undefined;
};

export let mapManagementInstancePortalsUpdateBody =
  mtMap.object<ManagementInstancePortalsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    allowedRedirectUrlFilters: mtMap.objectField(
      'allowed_redirect_url_filters',
      mtMap.array(
        mtMap.object({ url: mtMap.objectField('url', mtMap.passthrough()) })
      )
    ),
    sessionExpiryTimeInSeconds: mtMap.objectField(
      'session_expiry_time_in_seconds',
      mtMap.passthrough()
    ),
    allowConsumerSkillAuthoring: mtMap.objectField(
      'allow_consumer_skill_authoring',
      mtMap.passthrough()
    ),
    allowConsumerSkillPublishing: mtMap.objectField(
      'allow_consumer_skill_publishing',
      mtMap.passthrough()
    ),
    skillConfiguration: mtMap.objectField(
      'skill_configuration',
      mtMap.object({
        allowScripts: mtMap.objectField('allow_scripts', mtMap.passthrough()),
        allowedFileExtensions: mtMap.objectField(
          'allowed_file_extensions',
          mtMap.array(mtMap.passthrough())
        ),
        allowNonStandardDirectories: mtMap.objectField(
          'allow_non_standard_directories',
          mtMap.passthrough()
        )
      })
    )
  });

