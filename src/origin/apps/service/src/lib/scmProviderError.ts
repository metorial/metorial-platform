import {
  badRequestError,
  conflictError,
  forbiddenError,
  internalServerError,
  isServiceError,
  notFoundError,
  ServiceError,
  timeoutError,
  tooManyRequestsError,
  unauthorizedError
} from '@lowerdeck/error';

type ScmProvider = 'github' | 'gitlab';

export let getScmProviderErrorStatus = (error: any): number | undefined =>
  error?.status ?? error?.response?.status ?? error?.cause?.response?.statusCode;

let providerName = (provider: ScmProvider) => (provider === 'github' ? 'GitHub' : 'GitLab');

export let wrapScmProviderError = (
  provider: ScmProvider,
  error: unknown,
  operation: string
): ServiceError<any> => {
  if (isServiceError(error)) return error;

  let status = getScmProviderErrorStatus(error);
  let prefix = `${providerName(provider)} could not ${operation}`;
  let mapped =
    status === 400 || status === 422
      ? badRequestError({ message: `${prefix} because the request was invalid.` })
      : status === 401
        ? unauthorizedError({ message: `${prefix} because authentication failed.` })
        : status === 403
          ? forbiddenError({ message: `${prefix} because the integration lacks permission.` })
          : status === 404
            ? notFoundError({ entity: 'SCM provider resource', message: `${prefix}: resource not found.` })
            : status === 409
              ? conflictError({ message: `${prefix} because the resource already exists or changed.` })
              : status === 429
                ? tooManyRequestsError({ message: `${prefix} because the provider rate limit was reached.` })
                : status === 408 || status === 504
                  ? timeoutError({ message: `${prefix} because the provider request timed out.` })
                  : internalServerError({ message: `${prefix} due to an upstream provider error.` });

  let serviceError = new ServiceError(mapped);
  if (error instanceof Error) serviceError.setParent(error);
  return serviceError;
};

export let withScmProviderError = async <T>(
  provider: ScmProvider,
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    throw wrapScmProviderError(provider, error, operation);
  }
};
