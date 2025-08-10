import { ApolloServerErrorCode } from '@apollo/server/errors';
import { internalServerError, isServiceError, ServiceError } from '@metorial/error';
import { getSentry } from '@metorial/sentry';
import { GraphQLError } from 'graphql';
import { MiddlewareFn } from 'type-graphql';

let Sentry = getSentry();

let serviceErrorCodeToGraphQLErrorCode: Record<string, string> = {
  invalid_data: ApolloServerErrorCode.BAD_REQUEST,
  internal_server_error: ApolloServerErrorCode.INTERNAL_SERVER_ERROR,
  bad_request: ApolloServerErrorCode.BAD_REQUEST,
  not_found: 'NOT_FOUND',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  invalid_version: 'INVALID_VERSION',
  conflict: 'CONFLICT',
  gone: 'GONE',
  payment_required: 'PAYMENT_REQUIRED',
  precondition_failed: 'PRECONDITION_FAILED',
  not_acceptable: 'NOT_ACCEPTABLE',
  not_implemented: 'NOT_IMPLEMENTED',
  too_many_requests: 'TOO_MANY_REQUESTS',
  timeout: 'TIMEOUT',
  method_not_allowed: 'METHOD_NOT_ALLOWED'
};

export class PrivateError extends GraphQLError {
  constructor(message: string, code: string, extensions?: Record<string, any>) {
    super(message, {
      extensions: {
        code,
        ...extensions
      }
    });
  }

  static fromServiceError(err: ServiceError<any>): PrivateError {
    return new PrivateError(
      err.message,
      serviceErrorCodeToGraphQLErrorCode[err.data.code] ?? err.data.code,
      {
        ...err.data,
        http: {
          status: err.data.status
        }
      }
    );
  }
}

export let ErrorInterceptor: MiddlewareFn<any> = async ({ context, info }, next) => {
  try {
    return await next();
  } catch (err) {
    Sentry.captureException(err);

    if (isServiceError(err)) {
      throw PrivateError.fromServiceError(err);
    }

    throw PrivateError.fromServiceError(new ServiceError(internalServerError({})));
  }
};

export let wrapPrivateError = async <T>(cb: () => Promise<T>): Promise<T> => {
  try {
    return await cb();
  } catch (err) {
    Sentry.captureException(err);

    if (isServiceError(err)) {
      throw PrivateError.fromServiceError(err);
    }

    throw PrivateError.fromServiceError(new ServiceError(internalServerError({})));
  }
};
