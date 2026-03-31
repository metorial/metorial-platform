import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceConsumerSurfacesGetOutput = {
  object: 'consumer.surface';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  auth: { object: 'consumer.surface.auth'; sessionExpiryTimeInSeconds: number };
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceConsumerSurfacesGetOutput =
  mtMap.object<DashboardInstanceConsumerSurfacesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
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
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

