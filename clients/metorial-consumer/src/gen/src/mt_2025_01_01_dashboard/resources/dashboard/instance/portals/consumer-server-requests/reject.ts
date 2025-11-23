import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsConsumerServerRequestsRejectOutput = {
  object: 'consumer.server_request';
  id: string;
  server: {
    object: 'server#preview';
    id: string;
    name: string;
    description: string | null;
    type: 'public' | 'custom';
    createdAt: Date;
    updatedAt: Date;
  };
  consumer: {
    object: 'consumer.profile';
    id: string;
    name: string;
    email: string;
    imageUrl: string;
    createdAt: Date;
  };
  reason: string;
  rejectionReason: string | null;
  status: 'approved' | 'rejected' | 'pending';
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePortalsConsumerServerRequestsRejectOutput =
  mtMap.object<DashboardInstancePortalsConsumerServerRequestsRejectOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    server: mtMap.objectField(
      'server',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    consumer: mtMap.objectField(
      'consumer',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        email: mtMap.objectField('email', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    reason: mtMap.objectField('reason', mtMap.passthrough()),
    rejectionReason: mtMap.objectField('rejection_reason', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstancePortalsConsumerServerRequestsRejectBody = {
  reason: string;
};

export let mapDashboardInstancePortalsConsumerServerRequestsRejectBody =
  mtMap.object<DashboardInstancePortalsConsumerServerRequestsRejectBody>({
    reason: mtMap.objectField('reason', mtMap.passthrough())
  });

