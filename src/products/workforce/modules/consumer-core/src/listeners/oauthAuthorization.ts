import { Fabric } from '@metorial/fabric';
import { consumerDeviceService } from '../services/consumerDevice';

// `:before` runs inside the revoke transaction: devices signed in through the
// authorization end, and lose their install tokens, together with it.
Fabric.listen(
  'machine_access.oauth_authorization.revoked:before',
  async ({ oauthAuthorization, auditScope }) => {
    if (oauthAuthorization.subjectType != 'consumer') return;

    await consumerDeviceService.revokeDevicesForAuthorization({
      oauthAuthorization,
      auditScope
    });
  }
);
