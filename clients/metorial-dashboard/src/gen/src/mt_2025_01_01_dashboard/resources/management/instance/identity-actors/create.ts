import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceIdentityActorsCreateOutput = {
  object: 'identity.actor';
  id: string;
  type: 'person' | 'agent';
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  agentId: string | null;
  createdAt: Date;
  updatedAt: Date;
} & {
  consumer:
    | ({
        object: 'consumer';
        id: string;
        name: string;
        email: string;
        createdAt: Date;
        updatedAt: Date;
      } & { isPortalConsumer: boolean; isOrganizationMember: boolean })
    | null;
};

export let mapManagementInstanceIdentityActorsCreateOutput = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
      status: mtMap.objectField('status', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      agentId: mtMap.objectField('agent_id', mtMap.passthrough()),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date()),
      consumer: mtMap.objectField(
        'consumer',
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              email: mtMap.objectField('email', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date()),
              isPortalConsumer: mtMap.objectField(
                'is_portal_consumer',
                mtMap.passthrough()
              ),
              isOrganizationMember: mtMap.objectField(
                'is_organization_member',
                mtMap.passthrough()
              )
            })
          )
        ])
      )
    })
  )
]);

export type ManagementInstanceIdentityActorsCreateBody = {
  type: 'person' | 'agent';
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapManagementInstanceIdentityActorsCreateBody =
  mtMap.object<ManagementInstanceIdentityActorsCreateBody>({
    type: mtMap.objectField('type', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough())
  });

