import { rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { ShuttleClient } from '../src/apis/controllers';

export let shuttleClient = rpc<ShuttleClient>(
  `${e2eEndpoint('@metorial/shuttle', 'api')}/metorial-shuttle`
);
