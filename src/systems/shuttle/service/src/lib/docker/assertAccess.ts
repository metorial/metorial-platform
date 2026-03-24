import { badRequestError, ServiceError } from '@lowerdeck/error';
import { checkImageAccess } from './access';
import type { ParsedImageRef } from './parseImageRef';

export let assertAccess = async (d: {
  ref: ParsedImageRef;
  username?: string;
  password?: string;
}) => {
  let checkRes = await checkImageAccess(d);
  if (!checkRes.accessible) {
    if (checkRes.reason?.toLowerCase().includes('auth')) {
      throw new ServiceError(
        badRequestError({
          message: `Authentication failed for image reference: ${checkRes.reason}`
        })
      );
    }

    throw new ServiceError(
      badRequestError({
        message: `Invalid image reference: ${checkRes.reason || 'unknown reason'}`
      })
    );
  }
};
