import { forbiddenError, ServiceError } from '@metorial/error';
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

    if (expectedFlags.some(f => !flags[f])) {
      throw new ServiceError(
        forbiddenError({
          message: 'You are not entitled to access this endpoint'
        })
      );
    }
  }
);
