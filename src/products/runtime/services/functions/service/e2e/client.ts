import { rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { FunctionBayClient } from '../src/controllers';

export let functionBay = rpc<FunctionBayClient>(
  `${e2eEndpoint('@mtsrc/functions-service', 'api')}/metorial-function-bay`
);
