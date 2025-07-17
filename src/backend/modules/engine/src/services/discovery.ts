import { ServerDeployment } from '@metorial/db';
import { Service } from '@metorial/service';
import { discoverServer } from '../run/discover';

class EngineServerDiscoveryServiceImpl {
  async discoverServer(d: { serverDeployment: ServerDeployment }) {
    return discoverServer(d.serverDeployment);
  }
}

export let engineServerDiscoveryService = Service.create(
  'engineServerDiscovery',
  () => new EngineServerDiscoveryServiceImpl()
).build();
