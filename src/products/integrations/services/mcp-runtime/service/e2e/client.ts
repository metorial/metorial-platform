import { rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { ShuttleClient } from '@mtsrc/mcp-runtime-api-internal';

export let shuttleClient = rpc<ShuttleClient>(
  `${e2eEndpoint('@mtsrc/mcp-runtime-service', 'api')}/metorial-shuttle`
);
