import { pulsarController } from './api/controllers';
import { restServer } from './rest';

export let apiServer = restServer.launch({
  versions: {
    v_2025_01_01_pulsar: {
      displayVersion: '2025-01-01',
      apiVersion: 'v_2025_01_01_pulsar',
      alternativeIdentifiers: [
        'pulsar',
        '2025_01_01',
        '2025-01-01',
        'v_2025_01_01_pulsar',
        '2025-01-01-pulsar'
      ],
      controller: pulsarController
    }
  },
  currentVersion: 'v_2025_01_01_pulsar'
});
