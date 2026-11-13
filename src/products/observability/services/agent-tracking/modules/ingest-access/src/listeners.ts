import { Events } from '@mtsrc/agent-tracking-events';
import { ingestCredentialService } from './services/ingestCredential';

Events.listen('scope.organization.changed:after', d =>
  ingestCredentialService.invalidateScope({ organizationId: d.organizationId })
);

Events.listen('scope.project.changed:after', d =>
  ingestCredentialService.invalidateScope({ instanceIds: d.instanceIds })
);

Events.listen('scope.instance.changed:after', d =>
  ingestCredentialService.invalidateScope({ instanceIds: [d.instanceId] })
);

Events.listen('entities.entity.merged:after', d =>
  ingestCredentialService.invalidateTokens({ prefixes: d.tokenPrefixes })
);
