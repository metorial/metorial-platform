import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsConsumerAccessCreateOutput = {
  object: 'consumer.group';
  id: string;
  access: {
    type: 'magic_mcp_group';
    magicMcpGroup: {
      object: 'magic_mcp.group';
      id: string;
      status: 'active' | 'deleted';
      slug: string;
      name: string;
      description: string | null;
      metadata: Record<string, any>;
      createdAt: Date;
      updatedAt: Date;
    };
  };
  consumerGroup: {
    object: 'consumer.group';
    id: string;
    status: 'active' | 'inactive';
    name: string;
    description: string | null;
    isDefault: boolean;
    ssoGroupIds: string[];
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsConsumerAccessCreateOutput =
  mtMap.object<PortalsConsumerAccessCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    access: mtMap.objectField(
      'access',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        magicMcpGroup: mtMap.objectField(
          'magic_mcp_group',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            status: mtMap.objectField('status', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            metadata: mtMap.objectField('metadata', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        )
      })
    ),
    consumerGroup: mtMap.objectField(
      'consumer_group',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        ssoGroupIds: mtMap.objectField(
          'sso_group_ids',
          mtMap.array(mtMap.passthrough())
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type PortalsConsumerAccessCreateBody = {
  consumerGroupId: string;
  access: { type: 'magic_mcp_group'; magicMcpGroupId: string };
};

export let mapPortalsConsumerAccessCreateBody =
  mtMap.object<PortalsConsumerAccessCreateBody>({
    consumerGroupId: mtMap.objectField(
      'consumer_group_id',
      mtMap.passthrough()
    ),
    access: mtMap.objectField(
      'access',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        magicMcpGroupId: mtMap.objectField(
          'magic_mcp_group_id',
          mtMap.passthrough()
        )
      })
    )
  });

