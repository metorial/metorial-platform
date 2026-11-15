import { Fabric } from '@metorial/fabric';
import { magicMcpTokenService } from '../services/magicMcpToken';

Fabric.listen('consumer.device.ended:after', async ({ consumerDevice, auditScope }) => {
  await magicMcpTokenService.deleteConsumerDeviceTokens({ consumerDevice, auditScope });
});
