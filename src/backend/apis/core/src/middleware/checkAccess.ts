import { accessService, Scope } from '@metorial/module-access';
import { apiGroup } from './apiGroup';

export let checkAccess = apiGroup.createMiddleware(
  async (
    ctx,
    input: {
      possibleScopes: Scope[];
    }
  ) => {
    await accessService.checkAccess({
      authInfo: ctx.auth,
      possibleScopes: input.possibleScopes
    });
  }
);
