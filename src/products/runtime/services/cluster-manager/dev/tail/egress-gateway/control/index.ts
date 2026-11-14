import { dev, project } from '@metorial/control';
import { devRuntime } from '@metorial/control/presets';

let runtime = devRuntime();

export default project({
  name: '@metorial/runtime-egress-gateway',
  group: 'oss',
  ...(runtime && { dev: dev({ run: ['dev:start'], env: runtime.controllerEnv() }) })
});
