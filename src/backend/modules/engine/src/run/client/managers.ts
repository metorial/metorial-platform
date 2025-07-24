import { delay } from '@metorial/delay';
import { McpManagerClient, createManagerClient } from '@metorial/mcp-engine-generated';
import { env } from '../../env';

export interface Manager {
  id?: string;
  address: string;
  client: McpManagerClient;

  enabled: boolean;
}

let managers = new Map<string, Manager>();

for (let m of env.engine.ENGINE_MANAGER_ADDRESSES.split(',')) {
  let address = m.trim();

  managers.set(address, {
    address,
    enabled: false,
    client: createManagerClient({ address })
  });
}

let checkManagers = async () => {
  for (let manager of managers.values()) {
    try {
      let knownManagers = await Promise.race([
        manager.client.listManagers({}),
        delay(5000).then(() => {
          throw new Error(`Manager ${manager.address} did not respond in time`);
        })
      ]);

      let addresses = knownManagers.managers.map(m => m.address);

      for (let existingManagers of managers.values()) {
        if (!addresses.includes(existingManagers.address)) {
          existingManagers.enabled = false;
        }
      }

      for (let manager of knownManagers.managers) {
        if (!managers.has(manager.address)) {
          console.log(`Adding new manager ${manager.address} from ${manager.address}`);
          managers.set(manager.address, {
            enabled: true,
            id: manager.id,
            address: manager.address,
            client: createManagerClient({ address: manager.address })
          });
        } else {
          let existingManager = managers.get(manager.address)!;
          existingManager.id = manager.id;
          existingManager.enabled = true;
        }
      }

      manager.enabled = true;
    } catch (error) {
      console.error(`Error checking manager ${manager.address}:`, error);
      manager.enabled = false;
    }
  }

  setTimeout(checkManagers, 5000);
};

checkManagers();

export let getManagers = () => {
  return Array.from(managers.values()).filter(m => m.enabled);
};
