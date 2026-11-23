import { Events } from '@mtsrc/ai-gateway-events';
import { gatewayCredentialService } from './services/gatewayCredential';

Events.listen('scope.organization.changed:after', d =>
  gatewayCredentialService.invalidateScope({ organizationId: d.organizationId })
);

Events.listen('scope.project.changed:after', d =>
  gatewayCredentialService.invalidateScope({ instanceIds: d.instanceIds })
);

Events.listen('scope.instance.changed:after', d =>
  gatewayCredentialService.invalidateScope({ instanceIds: [d.instanceId] })
);
