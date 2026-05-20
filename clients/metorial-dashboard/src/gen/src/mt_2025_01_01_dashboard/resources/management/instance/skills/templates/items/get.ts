import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSkillsTemplatesItemsGetOutput = {
  object: 'skill.template.item';
  id: string;
  type: 'integration' | 'provider';
  integration: {
    object: 'integration#preview';
    id: string;
    slug: string;
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    configuration: {
      canAttachCustomToolFilters: boolean;
      canAttachCustomProviderConfig: boolean;
      canOverrideToolFilters: boolean;
    };
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  } | null;
  provider: {
    object: 'provider#preview';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSkillsTemplatesItemsGetOutput =
  mtMap.object<ManagementInstanceSkillsTemplatesItemsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    integration: mtMap.objectField(
      'integration',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        configuration: mtMap.objectField(
          'configuration',
          mtMap.object({
            canAttachCustomToolFilters: mtMap.objectField(
              'can_attach_custom_tool_filters',
              mtMap.passthrough()
            ),
            canAttachCustomProviderConfig: mtMap.objectField(
              'can_attach_custom_provider_config',
              mtMap.passthrough()
            ),
            canOverrideToolFilters: mtMap.objectField(
              'can_override_tool_filters',
              mtMap.passthrough()
            )
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date()),
        archivedAt: mtMap.objectField('archived_at', mtMap.date())
      })
    ),
    provider: mtMap.objectField(
      'provider',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

