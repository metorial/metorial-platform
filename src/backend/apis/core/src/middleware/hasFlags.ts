import { forbiddenError, paymentRequiredError, ServiceError } from '@metorial/error';
import { Flags, flagService } from '@metorial/module-flags';
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
      organization: ctx.organization as any
    });

    let missingFlags = expectedFlags.filter(f => !flags[f]);

    if (missingFlags.length) {
      if (missingFlags.some(f => f.startsWith('paid'))) {
        throw new ServiceError(
          paymentRequiredError({
            message: 'Upgrade to a different plan to access this feature'
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
