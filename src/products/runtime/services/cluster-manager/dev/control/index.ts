import { dependency, dev, endpoint, project } from '@metorial/control';
import { devRuntime, devRuntimePackage } from '@metorial/control/presets';

let runtime = devRuntime();

export default project({
  name: devRuntimePackage,
  group: 'oss',
  ...(runtime && {
    endpoints: {
      control: endpoint(52240).listenEnv('RUNTIME_DEV_CONTROL_PORT'),
      networkLogs: endpoint(52250).listenEnv('RUNTIME_DEV_NETWORK_LOGS_PORT')
    },
    dependencies: [
      dependency('@metorial/object-storage')
        .noStart()
        .env('api', 'RUNTIME_DEV_OBJECT_STORAGE_PORT', '{{BIND_PORT}}'),
      dependency('@metorial/runtime-cluster-manager'),
      dependency('@metorial/runtime-egress-gateway')
    ],
    dev: dev({ run: ['dev:start'], env: runtime.controllerEnv() })
  })
});
