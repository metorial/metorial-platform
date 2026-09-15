import { forbiddenError, paymentRequiredError, ServiceError } from '@lowerdeck/error';
import {
  Flags,
  flagService,
  getFlagDisabledReason,
  isFlagEnabled
} from '@metorial/module-flags';
import { apiGroup } from './apiGroup';

export let hasFlags = apiGroup.createMiddleware(
  async (ctx, expectedFlags: (keyof Flags)[]) => {
    if (!('organization' in ctx)) {
      throw new ServiceError(
        forbiddenError({
          message: 'You are not entitled to access this endpoint'
        })
      );
    }

    let flags = await flagService.getFlags({
      organization: ctx.organization as any,
      project: 'project' in ctx ? (ctx.project as any) : undefined
    });

    let missingFlags = expectedFlags.filter(f => !isFlagEnabled(flags[f]));

    if (missingFlags.length) {
      let disabledReason = missingFlags
        .map(flag => getFlagDisabledReason(flags[flag]))
        .find(reason => reason !== undefined);

      if (disabledReason) {
        throw new ServiceError(
          forbiddenError({
            message: disabledReason
          })
        );
      }

      if (missingFlags.some(f => f.startsWith('paid'))) {
        throw new ServiceError(
          paymentRequiredError({
            message: 'Please upgrade to a different plan to access this feature'
          })
        );
      }

      throw new ServiceError(
        forbiddenError({
          message: 'You are not entitled to access this endpoint'
        })
      );
    }
  }
);
