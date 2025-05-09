import { ServiceError, unauthorizedError } from '@metorial/error';

export let parseBearerToken = (request: Request) => {
  let authorization = request.headers.get('Authorization');
  if (!authorization) return;

  let parts = authorization.trim().split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new ServiceError(
      unauthorizedError({
        message: 'Malformed Authorization header',
        description: `Expected "Bearer <token>", got "${authorization}"`
      })
    );
  }

  return parts[1];
};
