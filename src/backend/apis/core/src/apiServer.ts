import { dashboardController, pulsarController } from './api/controllers';
import { restServer } from './rest';

export let apiServer = restServer.launch({
  versions: {
    mt_2025_01_01_pulsar: {
      displayVersion: '2025-01-01',
      apiVersion: 'mt_2025_01_01_pulsar',
      alternativeIdentifiers: [
        'pulsar',
        '2025_01_01',
        '2025-01-01',
        'mt_2025_01_01_pulsar',
        '2025-01-01-pulsar'
      ],
      controller: pulsarController
    },

    mt_2025_01_01_dashboard: {
      displayVersion: '2025-01-01-dashboard',
      apiVersion: 'mt_2025_01_01_dashboard',
      alternativeIdentifiers: ['mt_2025_01_01_dashboard', '2025-01-01-dashboard'],
      controller: dashboardController
    }
  },
  currentVersion: 'mt_2025_01_01_pulsar'
});
