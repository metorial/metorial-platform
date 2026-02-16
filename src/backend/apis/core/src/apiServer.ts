import {
  fullDashboardController,
  magnetarController,
  magnetarDashboardController,
  pulsarController
} from './controllers';
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
      controller: fullDashboardController
    },

    mt_2026_01_01_magnetar: {
      displayVersion: '2026-02-01',
      apiVersion: 'mt_2026_01_01_magnetar',
      alternativeIdentifiers: [
        'magnetar',
        '2026_02_01',
        '2026-02-01',
        'mt_2026_01_01_magnetar',
        '2026-02-01-magnetar'
      ],
      controller: magnetarController
    },

    mt_2025_01_01_dashboard: {
      displayVersion: '2026-02-01-dashboard',
      apiVersion: 'mt_2025_01_01_dashboard',
      alternativeIdentifiers: ['mt_2025_01_01_dashboard', '2026-02-01-dashboard'],
      controller: magnetarDashboardController
    }
  },
  currentVersion: 'mt_2026_01_01_magnetar'
});
