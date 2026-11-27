import { rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { SlatesHubClient } from '../src/apis/internal';

export let slatesHubClient = rpc<SlatesHubClient>(
  `${e2eEndpoint('@metorial/slates', 'internal')}/slates-hub`
);
