import { fullDashboardController, magnetarController } from './controllers';
import { restServer } from './rest';

export let apiServer = restServer.launch({
  versions: {
    mt_2025_01_01_dashboard: {
      displayVersion: '2025-01-01',
      apiVersion: 'mt_2025_01_01_dashboard',
      alternativeIdentifiers: [
        'dashboard',
        '2025_01_01',
        '2025-01-01',
        'mt_2025_01_01_dashboard',
        '2025-01-01-dashboard'
      ],
      controller: fullDashboardController
    },
    mt_2026_01_01_magnetar: {
      displayVersion: '2026-01-01',
      apiVersion: 'mt_2026_01_01_magnetar',
      alternativeIdentifiers: [
        'magnetar',
        '2026_01_01',
        '2026-01-01',
        'mt_2026_01_01_magnetar',
        '2026-01-01-magnetar'
      ],
      controller: magnetarController
    }
  },
  currentVersion: 'mt_2025_01_01_dashboard'
});
