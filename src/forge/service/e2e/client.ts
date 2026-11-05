import { rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { ForgeClient } from '../src/controllers';

export let forge = rpc<ForgeClient>(`${e2eEndpoint('@metorial/forge', 'api')}/metorial-forge`);
