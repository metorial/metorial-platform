import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { eventController } from './event';
import { eventDeliveryAttemptController } from './eventDeliveryAttempt';
import { eventDeliveryIntentController } from './eventDeliveryIntent';
import { eventDestinationController } from './eventDestination';
import { senderController } from './sender';
import { tenantController } from './tenant';

export let rootController = app.controller({
  tenant: tenantController,
  sender: senderController,
  event: eventController,
  eventDestination: eventDestinationController,
  eventDeliveryAttempt: eventDeliveryAttemptController,
  eventDeliveryIntent: eventDeliveryIntentController
});

export let SignalRPC = createServer({})(rootController);
export let SignalApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-signal' }, [SignalRPC]) }
]);

export type SignalClient = InferClient<typeof rootController>;
