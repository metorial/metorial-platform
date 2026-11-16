import { usageSliceService } from '@mtsrc/agent-tracking-module-usage';
import { isSessionlessKey } from '@mtsrc/agent-tracking-module-usage';
import { attributionService } from '@mtsrc/agent-tracking-module-attribution';

export let reattributeSession = async (d: {
  sessionKey: string;
  organizationId?: string;
  force?: boolean;
}) => {
  if (isSessionlessKey(d.sessionKey)) {
    if (!d.organizationId)
      throw new Error('Sessionless re-attribution needs the organization.');

    await usageSliceService.rewriteSessionlessSliceDims({
      organizationId: d.organizationId,
      sessionlessKey: d.sessionKey
    });
    return null;
  }

  let result = await attributionService.resolveSession({ sessionKey: d.sessionKey });
  if (!result?.session.attribution) return result;

  if (result.changed || d.force) {
    await usageSliceService.rewriteSessionSliceDims({
      organizationId: result.session.organizationId,
      sessionKey: d.sessionKey,
      attribution: result.session.attribution
    });
  }

  return result;
};
