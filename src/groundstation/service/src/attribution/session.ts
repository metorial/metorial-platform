import { rewriteSessionlessSliceDims, rewriteSessionSliceDims } from '../facts/write';
import { isSessionlessKey } from '../facts/slices';
import { resolveSessionAttribution } from './resolve';

export let reattributeSession = async (d: {
  sessionKey: string;
  organizationId?: string;
  force?: boolean;
}) => {
  if (isSessionlessKey(d.sessionKey)) {
    if (!d.organizationId)
      throw new Error('Sessionless re-attribution needs the organization.');

    await rewriteSessionlessSliceDims({
      organizationId: d.organizationId,
      sessionlessKey: d.sessionKey
    });
    return null;
  }

  let result = await resolveSessionAttribution({ sessionKey: d.sessionKey });
  if (!result?.session.attribution) return result;

  if (result.changed || d.force) {
    await rewriteSessionSliceDims({
      organizationId: result.session.organizationId,
      sessionKey: d.sessionKey,
      attribution: result.session.attribution
    });
  }

  return result;
};
