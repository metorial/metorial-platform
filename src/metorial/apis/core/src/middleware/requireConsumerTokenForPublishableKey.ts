import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { isPublicCatalogOnly } from '../lib/publicCatalogOnly';
import { instanceGroup } from './instanceGroup';

export let requireConsumerTokenForPublishableKey = instanceGroup.createMiddleware(async ctx => {
  if (isPublicCatalogOnly(ctx)) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Missing consumer session client secret'
      })
    );
  }
});
