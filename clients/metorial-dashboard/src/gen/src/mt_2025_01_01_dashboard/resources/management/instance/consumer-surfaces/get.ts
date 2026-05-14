import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceConsumerSurfacesGetOutput = {
  object: 'consumer.surface';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  allowConsumerSkillAuthoring: boolean;
  allowConsumerSkillPublishing: boolean;
  skillConfiguration: {
    id: string;
    isDefault: boolean;
    allowScripts: boolean;
    allowedFileExtensions: string[];
    allowNonStandardDirectories: boolean;
  };
  auth: {
    object: 'consumer.surface.auth';
    sessionExpiryTimeInSeconds: number;
    emailWhitelist: string[];
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceConsumerSurfacesGetOutput =
  mtMap.object<ManagementInstanceConsumerSurfacesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
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
        ),
        emailWhitelist: mtMap.objectField(
          'email_whitelist',
          mtMap.array(mtMap.passthrough())
        )
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

