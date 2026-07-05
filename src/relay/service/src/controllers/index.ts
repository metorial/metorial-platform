import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { emailController } from './email';
import { emailIdentityController } from './emailIdentity';
import { inboxController } from './inbox';
import { incomingEmailThreadController } from './incomingEmailThread';
import { senderController } from './sender';

export let rootController = app.controller({
  emailIdentity: emailIdentityController,
  inbox: inboxController,
  incomingEmailThread: incomingEmailThreadController,
  sender: senderController,
  email: emailController
});

export let RelayRPC = createServer({})(rootController);
export let RelayApi = apiMux([{ endpoint: rpcMux({ path: '/metorial-relay' }, [RelayRPC]) }]);

export type RelayClient = InferClient<typeof rootController>;
