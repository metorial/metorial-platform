import { mtMap } from '@metorial/util-resource-mapper';

export type SkillsMarketplacesGetOutput = {
  object: 'skill.marketplace';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  repositoryAccessMode: 'pull_request' | 'default_branch';
  forceMergeOrPush: boolean;
  mergeBeforeChecksPass: boolean;
  syncStatus: 'pending' | 'processing' | 'synced';
  imageUrl: string;
  name: string;
  description: string | null;
  slug: string;
  skillConfigurationId: string | null;
  plugins: {
    object: 'skill.marketplace_plugin';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    identifier: string;
    skillConfigurationId: string | null;
    skillMarketplaceId: string | null;
    skillPlugin: {
      object: 'skill.plugin';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      syncStatus: 'pending' | 'processing' | 'synced';
      imageUrl: string;
      name: string;
      description: string | null;
      longDescription: string | null;
      category: string | null;
      slug: string;
      skillConfigurationId: string | null;
      skills: {
        object: 'skill.plugin_skill';
        id: string;
        identifier: string;
        status: 'active' | 'archived' | 'deleted';
        clientName: string | null;
        clientDescription: string | null;
        clientMetadata: Record<string, any> | null;
        license: string | null;
        compatibility: string | null;
        skillConfigurationId: string | null;
        skillId: string;
        skill: {
          object: 'skill';
          id: string;
          status: 'active' | 'archived' | 'deleted';
          slug: string;
          name: string;
          description: string | null;
          imageUrl: string;
          clientName: string;
          clientDescription: string | null;
          clientMetadata: Record<string, any> | null;
          license: string | null;
          compatibility: string | null;
          metadata: Record<string, any> | null;
          createdAt: Date;
          updatedAt: Date;
        };
        createdAt: Date;
        updatedAt: Date;
      }[];
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapSkillsMarketplacesGetOutput =
  mtMap.object<SkillsMarketplacesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    repositoryAccessMode: mtMap.objectField(
      'repository_access_mode',
      mtMap.passthrough()
    ),
    forceMergeOrPush: mtMap.objectField(
      'force_merge_or_push',
      mtMap.passthrough()
    ),
    mergeBeforeChecksPass: mtMap.objectField(
      'merge_before_checks_pass',
      mtMap.passthrough()
    ),
    syncStatus: mtMap.objectField('sync_status', mtMap.passthrough()),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    skillConfigurationId: mtMap.objectField(
      'skill_configuration_id',
      mtMap.passthrough()
    ),
    plugins: mtMap.objectField(
      'plugins',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          skillConfigurationId: mtMap.objectField(
            'skill_configuration_id',
            mtMap.passthrough()
          ),
          skillMarketplaceId: mtMap.objectField(
            'skill_marketplace_id',
            mtMap.passthrough()
          ),
          skillPlugin: mtMap.objectField(
            'skill_plugin',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              syncStatus: mtMap.objectField('sync_status', mtMap.passthrough()),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              longDescription: mtMap.objectField(
                'long_description',
                mtMap.passthrough()
              ),
              category: mtMap.objectField('category', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              skillConfigurationId: mtMap.objectField(
                'skill_configuration_id',
                mtMap.passthrough()
              ),
              skills: mtMap.objectField(
                'skills',
                mtMap.array(
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    identifier: mtMap.objectField(
                      'identifier',
                      mtMap.passthrough()
                    ),
                    status: mtMap.objectField('status', mtMap.passthrough()),
                    clientName: mtMap.objectField(
                      'client_name',
                      mtMap.passthrough()
                    ),
                    clientDescription: mtMap.objectField(
                      'client_description',
                      mtMap.passthrough()
                    ),
                    clientMetadata: mtMap.objectField(
                      'client_metadata',
                      mtMap.passthrough()
                    ),
                    license: mtMap.objectField('license', mtMap.passthrough()),
                    compatibility: mtMap.objectField(
                      'compatibility',
                      mtMap.passthrough()
                    ),
                    skillConfigurationId: mtMap.objectField(
                      'skill_configuration_id',
                      mtMap.passthrough()
                    ),
                    skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
                    skill: mtMap.objectField(
                      'skill',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        status: mtMap.objectField(
                          'status',
                          mtMap.passthrough()
                        ),
                        slug: mtMap.objectField('slug', mtMap.passthrough()),
                        name: mtMap.objectField('name', mtMap.passthrough()),
                        description: mtMap.objectField(
                          'description',
                          mtMap.passthrough()
                        ),
                        imageUrl: mtMap.objectField(
                          'image_url',
                          mtMap.passthrough()
                        ),
                        clientName: mtMap.objectField(
                          'client_name',
                          mtMap.passthrough()
                        ),
                        clientDescription: mtMap.objectField(
                          'client_description',
                          mtMap.passthrough()
                        ),
                        clientMetadata: mtMap.objectField(
                          'client_metadata',
                          mtMap.passthrough()
                        ),
                        license: mtMap.objectField(
                          'license',
                          mtMap.passthrough()
                        ),
                        compatibility: mtMap.objectField(
                          'compatibility',
                          mtMap.passthrough()
                        ),
                        metadata: mtMap.objectField(
                          'metadata',
                          mtMap.passthrough()
                        ),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                )
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

