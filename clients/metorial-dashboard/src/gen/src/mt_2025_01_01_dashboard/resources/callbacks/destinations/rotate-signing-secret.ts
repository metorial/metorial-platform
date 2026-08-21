import { mtMap } from '@metorial/util-resource-mapper';

export type CallbacksDestinationsRotateSigningSecretOutput = {
  object: 'callback.destination_signing_secret';
  callbackDestinationId: string;
  signingSecret: string;
  rotatedAt: Date;
};

export let mapCallbacksDestinationsRotateSigningSecretOutput =
  mtMap.object<CallbacksDestinationsRotateSigningSecretOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    callbackDestinationId: mtMap.objectField('callback_destination_id', mtMap.passthrough()),
    signingSecret: mtMap.objectField('signing_secret', mtMap.passthrough()),
    rotatedAt: mtMap.objectField('rotated_at', mtMap.date())
  });
