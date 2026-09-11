import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsCreateOutput = {
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
  auth: {
    object: 'portal.auth';
    sessionExpiryTimeInSeconds: number;
    allowedRedirectUrlFilters: { url: string }[];
  };
  urls: { type: 'default' | 'namespace'; url: string }[];
  magicMcpUrl: string;
  createdAt: Date;
  updatedAt: Date;
} & { managedEveryoneGroupId: string | null };

export let mapPortalsCreateOutput = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
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
          ),
          allowedRedirectUrlFilters: mtMap.objectField(
            'allowed_redirect_url_filters',
            mtMap.array(
              mtMap.object({
                url: mtMap.objectField('url', mtMap.passthrough())
              })
            )
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
      magicMcpUrl: mtMap.objectField('magic_mcp_url', mtMap.passthrough()),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date()),
      managedEveryoneGroupId: mtMap.objectField(
        'managed_everyone_group_id',
        mtMap.passthrough()
      )
    })
  )
]);

export type PortalsCreateBody = {
  name: string;
  description?: string | undefined;
  allowedRedirectUrlFilters?: { url: string }[] | undefined;
  sessionExpiryTimeInSeconds?: number | undefined;
  allowConsumerSkillAuthoring?: boolean | undefined;
  allowConsumerSkillPublishing?: boolean | undefined;
};

export let mapPortalsCreateBody = mtMap.object<PortalsCreateBody>({
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
  )
});

