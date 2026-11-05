import { rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { NebulaClient } from '../src/controllers';

export let nebula = rpc<NebulaClient>(
  `${e2eEndpoint('@metorial/nebula', 'api')}/metorial-nebula`
);
