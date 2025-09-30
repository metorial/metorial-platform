import { getFullConfig } from '@metorial/config';
import { ServerDeployment } from '@metorial/db';
import { Service } from '@metorial/service';
import { addServerDeploymentDiscovery } from '../queues/discoverServer';

class EngineServerDiscoveryServiceImpl {
  // async discoverServer(d: { serverDeployment: ServerDeployment }) {
  //   let config = await getFullConfig();
  //   if (config.sessionRunner != 'engine') return null;

  //   return await discoverServer(d.serverDeployment.id);
  // }

  async discoverServerAsync(d: { serverDeployment: ServerDeployment }) {
    let config = await getFullConfig();
    if (config.sessionRunner != 'engine') return;

    await addServerDeploymentDiscovery({
      serverDeploymentId: d.serverDeployment.id
    });
  }
}

export let engineServerDiscoveryService = Service.create(
  'engineServerDiscovery',
  () => new EngineServerDiscoveryServiceImpl()
).build();
