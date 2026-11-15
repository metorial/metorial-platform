import { rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { OriginClient } from '../src/controllers';

export let origin = rpc<OriginClient>(
  `${e2eEndpoint('@mtsrc/scm-service', 'api')}/metorial-origin`
);
