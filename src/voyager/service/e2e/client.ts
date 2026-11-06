import { rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { VoyagerClient } from '../src/controllers';

export let voyager = rpc<VoyagerClient>(
  `${e2eEndpoint('@metorial/voyager', 'rpc')}/metorial-voyager`
);
