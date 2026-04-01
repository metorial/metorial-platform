import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceConsumersGetMemberConsumerOutput = {
  object: 'consumer';
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
} & { isPortalConsumer: boolean; isOrganizationMember: boolean };

export let mapManagementInstanceConsumersGetMemberConsumerOutput = mtMap.union([
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
]);

export type ManagementInstanceConsumersGetMemberConsumerBody = {
  surfaceIdentifier: 'cli';
};

export let mapManagementInstanceConsumersGetMemberConsumerBody =
  mtMap.object<ManagementInstanceConsumersGetMemberConsumerBody>({
    surfaceIdentifier: mtMap.objectField(
      'surface_identifier',
      mtMap.passthrough()
    )
  });

