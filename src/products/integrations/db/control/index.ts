import { dev, mergeEnv, project } from '@metorial/control';
import { baseDevEnv, pickEnv, sharedDatabases } from '@metorial/control/presets';

export default project({
  name: '@metorial-subspace/db',
  group: 'oss',
  dev: dev({
    env: mergeEnv(
      baseDevEnv('oss'),
      pickEnv('INTEGRATIONS_API_URL', 'SLATE_ATTACHMENT_SIGNING_SECRET')
    ),
    databases: {
      subspace: sharedDatabases.subspace,
      main: sharedDatabases.metorialEnterprise,
      federation: sharedDatabases.metorialEnterpriseFederation
    }
  })
});
