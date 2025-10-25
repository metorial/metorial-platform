import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCallbacksDestinationsCreateOutput = {
  object: 'callback.destination';
  id: string;
  type: 'webhook';
  name: string;
  description: string;
  webhookDestination: { url: string; signingSecret: string } | null;
  callbacks: { type: 'all' } | { type: 'selected'; callbackIds: string[] };
  createdAt: Date;
};

export let mapManagementInstanceCallbacksDestinationsCreateOutput =
  mtMap.object<ManagementInstanceCallbacksDestinationsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    webhookDestination: mtMap.objectField(
      'webhook_destination',
      mtMap.object({
        url: mtMap.objectField('url', mtMap.passthrough()),
        signingSecret: mtMap.objectField('signing_secret', mtMap.passthrough())
      })
    ),
    callbacks: mtMap.objectField(
      'callbacks',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            callbackIds: mtMap.objectField(
              'callback_ids',
              mtMap.array(mtMap.passthrough())
            )
          })
        )
      ])
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

export type ManagementInstanceCallbacksDestinationsCreateBody = {
  name: string;
  description?: string | undefined;
  url: string;
  callbacks: { type: 'all' } | { type: 'selected'; callbackId: string[] };
};

export let mapManagementInstanceCallbacksDestinationsCreateBody =
  mtMap.object<ManagementInstanceCallbacksDestinationsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    callbacks: mtMap.objectField(
      'callbacks',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            callbackId: mtMap.objectField(
              'callback_id',
              mtMap.array(mtMap.passthrough())
            )
          })
        )
      ])
    )
  });

