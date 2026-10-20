import { isAlreadyCaptured } from '@sentry/core';
import { describe, expect, it } from 'vitest';
import {
  getSentryHttpErrorDetails,
  markSentryCaptured,
  shouldIgnoreSentryFrontendError,
  shouldIgnoreSentryHttpError
} from './index';

describe('markSentryCaptured', () => {
  it('flags the error so the SDK drops later captures without making it serializable', () => {
    let error = new Error('already reported');

    markSentryCaptured(error);

    expect(isAlreadyCaptured(error)).toBe(true);
    expect(Object.keys(error)).not.toContain('__sentry_captured__');
  });
});

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

  it('ignores Metorial SDK network errors in the frontend', () => {
    let networkError = {
      originalException: {
        __typename: 'metorial.sdk.error',
        __isMetorialError: true,
        response: {
          status: 0,
          code: 'network_error'
        }
      }
    };

    expect(shouldIgnoreSentryFrontendError(networkError)).toBe(true);
    expect(
      shouldIgnoreSentryFrontendError(
        new Error(
          '[METORIAL ERROR]: network_error - Unable to connect to Metorial API - please check your internet connection'
        )
      )
    ).toBe(true);
    expect(shouldIgnoreSentryHttpError(networkError)).toBe(false);
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
