import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCallbacksDestinationsRotateSigningSecretOutput = {
  object: 'callback.destination_signing_secret';
  callbackDestinationId: string;
  signingSecret: string;
  rotatedAt: Date;
};

export let mapManagementInstanceCallbacksDestinationsRotateSigningSecretOutput =
  mtMap.object<ManagementInstanceCallbacksDestinationsRotateSigningSecretOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    callbackDestinationId: mtMap.objectField('callback_destination_id', mtMap.passthrough()),
    signingSecret: mtMap.objectField('signing_secret', mtMap.passthrough()),
    rotatedAt: mtMap.objectField('rotated_at', mtMap.date())
  });
