import { rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { SignalClient } from '../src/controllers';

export let signal = rpc<SignalClient>(`${e2eEndpoint('@metorial/signal', 'api')}/metorial-signal`);
