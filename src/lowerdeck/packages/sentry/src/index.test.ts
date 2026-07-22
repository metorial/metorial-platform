import { describe, expect, it } from 'vitest';
import {
  getSentryHttpErrorDetails,
  shouldIgnoreSentryFrontendError,
  shouldIgnoreSentryHttpError
} from './index';

describe('@lowerdeck/sentry filters', () => {
  it('extracts client error details from wrapped lowerdeck errors', () => {
    let hint = {
      originalException: new Error(
        '[@lowerdeck/error]: You are not authorized to access this resource. ({"status":401,"code":"unauthorized","message":"You are not authorized to access this resource."})'
      )
    };

    expect(getSentryHttpErrorDetails(hint)).toEqual({
      status: 401,
      code: 'unauthorized'
    });
    expect(shouldIgnoreSentryHttpError(hint)).toBe(true);
  });

  it('ignores nested client response errors', () => {
    expect(
      shouldIgnoreSentryHttpError({
        object: 'ServiceError',
        response: {
          status: 404
        }
      })
    ).toBe(true);
  });

  it.each([
    [402, 'payment_required'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [422, 'invalid_data'],
    [400, 'magic_mcp_backing_integration_delete_blocked']
  ])('ignores Metorial SDK client errors with status %i', (status, code) => {
    expect(
      shouldIgnoreSentryFrontendError({
        originalException: {
          __typename: 'metorial.sdk.error',
          __isMetorialError: true,
          response: {
            status,
            code
          }
        }
      })
    ).toBe(true);
  });

  it('recognizes serialized Metorial SDK client errors', () => {
    expect(
      shouldIgnoreSentryFrontendError(
        new Error(
          '[METORIAL ERROR]: payment_required - This feature is unavailable on the current plan'
        )
      )
    ).toBe(true);
  });

  it('keeps upstream http errors reportable when they are not lowerdeck errors', () => {
    expect(
      shouldIgnoreSentryHttpError({
        response: {
          status: 404
        }
      })
    ).toBe(false);
  });

  it('keeps server-side failures reportable', () => {
    expect(
      shouldIgnoreSentryFrontendError({
        originalException: {
          __typename: 'metorial.sdk.error',
          __isMetorialError: true,
          response: {
            status: 500
          },
          code: 'internal_error'
        }
      })
    ).toBe(false);
  });
});
