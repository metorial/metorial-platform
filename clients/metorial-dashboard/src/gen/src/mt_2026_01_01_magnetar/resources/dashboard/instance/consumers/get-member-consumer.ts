import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceConsumersGetMemberConsumerOutput = {
  object: 'consumer';
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceConsumersGetMemberConsumerOutput =
  mtMap.object<DashboardInstanceConsumersGetMemberConsumerOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceConsumersGetMemberConsumerBody = {
  surfaceIdentifier?: 'cli' | undefined;
};

export let mapDashboardInstanceConsumersGetMemberConsumerBody =
  mtMap.object<DashboardInstanceConsumersGetMemberConsumerBody>({
    surfaceIdentifier: mtMap.objectField(
      'surface_identifier',
      mtMap.passthrough()
    )
  });

