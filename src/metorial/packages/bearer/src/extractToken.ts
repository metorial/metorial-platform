import { parseBearerToken } from './parseBearerToken';

export let extractToken = (request: Request, url: URL) => {
  let bearer = parseBearerToken(request);
  if (bearer) return bearer;

  let key = url.searchParams.get('token') ?? url.searchParams.get('key');
  if (key) return key;

  // throw new ServiceError(
  //   unauthorizedError({
  //     message: 'Missing Authorization header or query parameter',
  //     description:
  //       'Make sure to include a Bearer token in the "Authorization" header in the form "Bearer <token>" or a "token" query parameter'
  //   })
  // );
};
