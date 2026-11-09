import { dynamicPage } from '@metorial/dynamic-component';
import { Navigate, type RouteObject } from 'react-router-dom';

let SandboxMachinesPage = dynamicPage(() =>
  import('./pages/(sandbox)/machines').then(c => c.SandboxMachinesPage)
);
let SandboxMachineLayout = dynamicPage(() =>
  import('./pages/(sandbox)/machine/_layout').then(c => c.SandboxMachineLayout)
);
let SandboxMachineOverviewPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine').then(c => c.SandboxMachineOverviewPage)
);
let SandboxMachineTerminalPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/terminal').then(c => c.SandboxMachineTerminalPage)
);
let SandboxMachineFilesPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/files').then(c => c.SandboxMachineFilesPage)
);
let SandboxMachineLogsPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/logs').then(c => c.SandboxMachineLogsPage)
);
let SandboxMachineUsagePage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/usage').then(c => c.SandboxMachineUsagePage)
);
let SandboxMachineActivityLayout = dynamicPage(() =>
  import('./pages/(sandbox)/machine/activityLayout').then(c => c.SandboxMachineActivityLayout)
);

let SandboxMachineEventsRedirect = dynamicPage(() =>
  import('./pages/(sandbox)/machine/activityLayout').then(c => c.SandboxMachineEventsRedirect)
);

let SandboxMachineEventsPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/events').then(c => c.SandboxMachineEventsPage)
);
let SandboxMachineSettingsLayout = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/_layout').then(
    c => c.SandboxMachineSettingsLayout
  )
);
let SandboxMachineSettingsGeneralPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/general').then(
    c => c.SandboxMachineSettingsGeneralPage
  )
);
let SandboxMachineSettingsSizePage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/size').then(c => c.SandboxMachineSettingsSizePage)
);
let SandboxMachineSettingsStoragePage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/storage').then(
    c => c.SandboxMachineSettingsStoragePage
  )
);
let SandboxMachineSettingsRuntimePage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/runtime').then(
    c => c.SandboxMachineSettingsRuntimePage
  )
);
let SandboxMachineSettingsLifecyclePage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/lifecycle').then(
    c => c.SandboxMachineSettingsLifecyclePage
  )
);
let SandboxMachineSettingsNetworkPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/network').then(
    c => c.SandboxMachineSettingsNetworkPage
  )
);

let SandboxImagesPage = dynamicPage(() =>
  import('./pages/(sandbox)/images').then(c => c.SandboxImagesPage)
);
let SandboxImageLayout = dynamicPage(() =>
  import('./pages/(sandbox)/image/_layout').then(c => c.SandboxImageLayout)
);
let SandboxImageOverviewPage = dynamicPage(() =>
  import('./pages/(sandbox)/image').then(c => c.SandboxImageOverviewPage)
);
let SandboxImageVersionsPage = dynamicPage(() =>
  import('./pages/(sandbox)/image/versions').then(c => c.SandboxImageVersionsPage)
);
let SandboxImageVersionPage = dynamicPage(() =>
  import('./pages/(sandbox)/image/version').then(c => c.SandboxImageVersionPage)
);
let SandboxImageSettingsPage = dynamicPage(() =>
  import('./pages/(sandbox)/image/settings').then(c => c.SandboxImageSettingsPage)
);

let SandboxDisksPage = dynamicPage(() =>
  import('./pages/(sandbox)/disks').then(c => c.SandboxDisksPage)
);
let SandboxDiskLayout = dynamicPage(() =>
  import('./pages/(sandbox)/disk/_layout').then(c => c.SandboxDiskLayout)
);
let SandboxDiskOverviewPage = dynamicPage(() =>
  import('./pages/(sandbox)/disk').then(c => c.SandboxDiskOverviewPage)
);
let SandboxDiskSettingsPage = dynamicPage(() =>
  import('./pages/(sandbox)/disk/settings').then(c => c.SandboxDiskSettingsPage)
);

export let sandboxRoutes: RouteObject[] = [
  { path: 'sandbox', element: <Navigate to="machines" replace /> },

  { path: 'sandbox/machines', element: <SandboxMachinesPage /> },
  {
    path: 'sandbox/machines/:machineId',
    element: <SandboxMachineLayout />,
    children: [
      { path: '', element: <SandboxMachineOverviewPage /> },
      { path: 'terminal', element: <SandboxMachineTerminalPage /> },
      { path: 'files', element: <SandboxMachineFilesPage /> },
      { path: 'events', element: <SandboxMachineEventsRedirect /> },
      { path: 'events/logs', element: <SandboxMachineEventsRedirect /> },
      { path: 'usage', element: <SandboxMachineUsagePage /> },
      {
        path: 'logs',
        element: <SandboxMachineActivityLayout />,
        children: [
          { path: '', element: <SandboxMachineEventsPage /> },
          { path: 'runtime', element: <SandboxMachineLogsPage /> }
        ]
      },
      {
        path: 'settings',
        element: <SandboxMachineSettingsLayout />,
        children: [
          { path: '', element: <SandboxMachineSettingsGeneralPage /> },
          { path: 'size', element: <SandboxMachineSettingsSizePage /> },
          { path: 'storage', element: <SandboxMachineSettingsStoragePage /> },
          { path: 'runtime', element: <SandboxMachineSettingsRuntimePage /> },
          { path: 'lifecycle', element: <SandboxMachineSettingsLifecyclePage /> },
          { path: 'network', element: <SandboxMachineSettingsNetworkPage /> }
        ]
      }
    ]
  },

  { path: 'sandbox/images', element: <SandboxImagesPage /> },
  {
    path: 'sandbox/images/:imageId',
    element: <SandboxImageLayout />,
    children: [
      { path: '', element: <SandboxImageOverviewPage /> },
      { path: 'versions', element: <SandboxImageVersionsPage /> },
      { path: 'versions/:versionId', element: <SandboxImageVersionPage /> },
      { path: 'settings', element: <SandboxImageSettingsPage /> }
    ]
  },

  { path: 'sandbox/disks', element: <SandboxDisksPage /> },
  {
    path: 'sandbox/disks/:diskId',
    element: <SandboxDiskLayout />,
    children: [
      { path: '', element: <SandboxDiskOverviewPage /> },
      { path: 'settings', element: <SandboxDiskSettingsPage /> }
    ]
  }
];
